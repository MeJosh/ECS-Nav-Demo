import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import type { Position, ServerMessage, SystemStates } from "@ecs-nav-demo/shared";
import { runEnabledSystems } from "./ecs/systems";
import { createWorld, type World } from "./ecs/world";

const systemIds = ["steering", "movement"] as const;
type SystemId = (typeof systemIds)[number];

interface BuildAppOptions {
  world?: World;
}

interface DestinationPayload extends Position {
  participantId?: string;
}

interface SystemPayload {
  enabled?: boolean;
}

interface ClientCommand {
  type?: string;
  x?: number;
  y?: number;
  entityId?: string;
  fromEntityId?: string;
  toEntityId?: string;
}

interface ParticipantConnection {
  socket: WebSocket;
  participantId: string;
}

const participantColors = [
  "#2f80ed",
  "#eb5757",
  "#27ae60",
  "#f2994a",
  "#9b51e0",
  "#00a6a6"
];

let nextParticipantNumber = 1;

function isSystemId(value: string): value is SystemId {
  return systemIds.includes(value as SystemId);
}

function parsePosition(payload: DestinationPayload): Position | undefined {
  if (typeof payload.x !== "number" || typeof payload.y !== "number") {
    return undefined;
  }
  return { x: payload.x, y: payload.y };
}

function parsePathConnection(payload: ClientCommand): { fromEntityId: string; toEntityId: string } | undefined {
  if (typeof payload.fromEntityId !== "string" || typeof payload.toEntityId !== "string") {
    return undefined;
  }
  return { fromEntityId: payload.fromEntityId, toEntityId: payload.toEntityId };
}

function serialize(message: ServerMessage): string {
  return JSON.stringify(message);
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const world = options.world ?? createWorld({ movementPerStep: 5 });
  const app = Fastify({ logger: true });
  const connections = new Map<string, ParticipantConnection>();

  await app.register(cors, { origin: true });
  await app.register(websocket);

  function broadcastSnapshot(): void {
    const message = serialize({ type: "world.snapshot", snapshot: world.snapshot() });
    for (const connection of connections.values()) {
      connection.socket.send(message);
    }
  }

  app.decorate("broadcastSnapshot", broadcastSnapshot);

  app.get("/api/state", async () => world.snapshot());

  app.get("/api/systems", async () => world.systems);

  app.patch<{ Params: { systemId: string }; Body: SystemPayload }>(
    "/api/systems/:systemId",
    async (request, reply) => {
      const { systemId } = request.params;
      if (!isSystemId(systemId)) {
        return reply.code(404).send({ error: "Unknown system." });
      }
      if (typeof request.body.enabled !== "boolean") {
        return reply.code(400).send({ error: "Expected boolean enabled value." });
      }

      world.setSystemEnabled(systemId, request.body.enabled);
      broadcastSnapshot();
      return { id: systemId, enabled: world.systems[systemId] };
    }
  );

  app.post<{ Params: { participantId: string }; Body: DestinationPayload }>(
    "/api/participants/:participantId/destination",
    async (request, reply) => {
      const position = parsePosition(request.body);
      if (!position) {
        return reply.code(400).send({ error: "Expected numeric x and y." });
      }

      const pair = world.setParticipantDestination(request.params.participantId, position);
      if (!pair) {
        return reply.code(404).send({ error: "Unknown participant." });
      }

      broadcastSnapshot();
      return { ok: true, ...pair };
    }
  );

  app.post<{ Body: DestinationPayload }>("/api/path-nodes", async (request, reply) => {
    const position = parsePosition(request.body);
    if (!position) {
      return reply.code(400).send({ error: "Expected numeric x and y." });
    }

    const entityId = world.createPathNode(position);
    broadcastSnapshot();
    return { entityId };
  });

  app.delete<{ Params: { entityId: string } }>("/api/path-nodes/:entityId", async (request, reply) => {
    if (!world.removePathNode(request.params.entityId)) {
      return reply.code(404).send({ error: "Unknown path node." });
    }

    broadcastSnapshot();
    return { ok: true };
  });

  app.post<{ Body: ClientCommand }>("/api/path-connections", async (request, reply) => {
    const connection = parsePathConnection(request.body);
    if (!connection) {
      return reply.code(400).send({ error: "Expected fromEntityId and toEntityId." });
    }
    if (!world.connectPathNodes(connection)) {
      return reply.code(400).send({ error: "Expected two different path nodes." });
    }

    broadcastSnapshot();
    return { ok: true, ...connection };
  });

  app.delete<{ Params: { fromEntityId: string; toEntityId: string } }>(
    "/api/path-connections/:fromEntityId/:toEntityId",
    async (request, reply) => {
      if (!world.disconnectPathNodes(request.params)) {
        return reply.code(404).send({ error: "Unknown path connection." });
      }

      broadcastSnapshot();
      return { ok: true };
    }
  );

  app.get("/ws", { websocket: true }, (socket) => {
    const participantId = `participant-${nextParticipantNumber++}`;
    const color = participantColors[(nextParticipantNumber - 2) % participantColors.length];
    const pair = world.createParticipantPair({
      participantId,
      color,
      position: { x: 400, y: 300 }
    });

    connections.set(participantId, { socket, participantId });
    socket.send(
      serialize({
        type: "participant.joined",
        participantId,
        movingEntityId: pair.movingEntityId,
        destinationEntityId: pair.destinationEntityId
      })
    );
    socket.send(serialize({ type: "world.snapshot", snapshot: world.snapshot() }));
    broadcastSnapshot();

    socket.addEventListener("message", (event: MessageEvent) => {
      const command = JSON.parse(String(event.data)) as ClientCommand;
      if (command.type === "destination.set") {
        const position = parsePosition(command as DestinationPayload);
        if (!position) {
          return;
        }
        world.setParticipantDestination(participantId, position);
        broadcastSnapshot();
        return;
      }

      if (command.type === "pathNode.create") {
        const position = parsePosition(command as DestinationPayload);
        if (!position) {
          return;
        }
        world.createPathNode(position);
        broadcastSnapshot();
        return;
      }

      if (command.type === "pathNode.delete" && typeof command.entityId === "string") {
        if (world.removePathNode(command.entityId)) {
          broadcastSnapshot();
        }
        return;
      }

      if (command.type === "pathConnection.create") {
        const connection = parsePathConnection(command);
        if (connection && world.connectPathNodes(connection)) {
          broadcastSnapshot();
        }
        return;
      }

      if (command.type === "pathConnection.delete") {
        const connection = parsePathConnection(command);
        if (connection && world.disconnectPathNodes(connection)) {
          broadcastSnapshot();
        }
      }
    });

    socket.addEventListener("close", () => {
      connections.delete(participantId);
      world.removeParticipant(participantId);
      broadcastSnapshot();
    });
  });

  return app;
}

export function startSimulation(app: FastifyInstance, world: World, intervalMs = 50): Timer {
  return setInterval(() => {
    runEnabledSystems(world);
    const broadcast = app.broadcastSnapshot as (() => void) | undefined;
    broadcast?.();
  }, intervalMs);
}

declare module "fastify" {
  interface FastifyInstance {
    broadcastSnapshot?: () => void;
  }
}
