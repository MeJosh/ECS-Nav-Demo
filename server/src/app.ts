import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import { createSimulationHost, type SimulationHost, type World } from "@ecs-nav-demo/simulation";
import type { ClientCommand, EntityId, Position, ServerMessage, SystemStates } from "@ecs-nav-demo/shared";

const systemIds = ["steering", "movement"] as const;
type SystemId = (typeof systemIds)[number];

interface BuildAppOptions {
  host?: SimulationHost;
  world?: World;
}

interface DestinationPayload extends Position {
  participantId?: string;
}

interface SystemPayload {
  enabled?: boolean;
}

interface ClientCommandPayload {
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

function isSystemId(value: string): value is SystemId {
  return systemIds.includes(value as SystemId);
}

function parsePosition(payload: DestinationPayload): Position | undefined {
  if (typeof payload.x !== "number" || typeof payload.y !== "number") {
    return undefined;
  }
  return { x: payload.x, y: payload.y };
}

function parsePathConnection(payload: ClientCommandPayload): { fromEntityId: string; toEntityId: string } | undefined {
  if (typeof payload.fromEntityId !== "string" || typeof payload.toEntityId !== "string") {
    return undefined;
  }
  return { fromEntityId: payload.fromEntityId, toEntityId: payload.toEntityId };
}

function parseClientCommand(payload: ClientCommandPayload): ClientCommand | undefined {
  if (payload.type === "destination.set") {
    const position = parsePosition(payload as DestinationPayload);
    return position ? { type: payload.type, ...position } : undefined;
  }

  if (payload.type === "pathNode.create") {
    const position = parsePosition(payload as DestinationPayload);
    return position ? { type: payload.type, ...position } : undefined;
  }

  if (payload.type === "pathNode.delete" && typeof payload.entityId === "string") {
    return { type: payload.type, entityId: payload.entityId as EntityId };
  }

  if (payload.type === "pathConnection.create" || payload.type === "pathConnection.delete") {
    const connection = parsePathConnection(payload);
    return connection ? { type: payload.type, ...connection } : undefined;
  }

  return undefined;
}

function serialize(message: ServerMessage): string {
  return JSON.stringify(message);
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const host = options.host ?? createSimulationHost({ world: options.world });
  const { world } = host;
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

      host.setSystemEnabled(systemId, request.body.enabled);
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

      if (!host.applyCommand(request.params.participantId, { type: "destination.set", ...position })) {
        return reply.code(404).send({ error: "Unknown participant." });
      }

      broadcastSnapshot();
      return { ok: true };
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

  app.post<{ Body: ClientCommandPayload }>("/api/path-connections", async (request, reply) => {
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
    const joined = host.joinParticipant();

    connections.set(joined.participantId, { socket, participantId: joined.participantId });
    socket.send(serialize(joined));
    socket.send(serialize({ type: "world.snapshot", snapshot: world.snapshot() }));
    broadcastSnapshot();

    socket.addEventListener("message", (event: MessageEvent) => {
      const command = parseClientCommand(JSON.parse(String(event.data)) as ClientCommandPayload);
      if (command && host.applyCommand(joined.participantId, command)) {
        broadcastSnapshot();
      }
    });

    socket.addEventListener("close", () => {
      connections.delete(joined.participantId);
      host.leaveParticipant(joined.participantId);
      broadcastSnapshot();
    });
  });

  return app;
}

export function startSimulation(app: FastifyInstance, host: SimulationHost, intervalMs = 50): Timer {
  return setInterval(() => {
    host.step();
    const broadcast = app.broadcastSnapshot as (() => void) | undefined;
    broadcast?.();
  }, intervalMs);
}

declare module "fastify" {
  interface FastifyInstance {
    broadcastSnapshot?: () => void;
  }
}
