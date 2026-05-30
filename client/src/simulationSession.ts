import { createSimulationHost, type SimulationHost } from "@ecs-nav-demo/simulation";
import type { ClientCommand, ServerMessage } from "@ecs-nav-demo/shared";

export type SimulationMode = "remote" | "local";

export interface SimulationSession {
  sendCommand(command: ClientCommand): void;
  dispose(): void;
}

export interface SimulationSessionOptions {
  mode: SimulationMode;
  serverUrl: string;
  onMessage(message: ServerMessage): void;
}

export function createSimulationSession(options: SimulationSessionOptions): SimulationSession {
  if (options.mode === "local") {
    return createLocalSimulationSession(options.onMessage);
  }
  return createRemoteSimulationSession(options.serverUrl, options.onMessage);
}

function createRemoteSimulationSession(
  serverUrl: string,
  onMessage: (message: ServerMessage) => void
): SimulationSession {
  const wsUrl = new URL("/ws", serverUrl);
  wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(wsUrl);

  socket.addEventListener("message", (event) => {
    onMessage(JSON.parse(String(event.data)) as ServerMessage);
  });

  return {
    sendCommand(command) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(command));
      }
    },
    dispose() {
      socket.close();
    }
  };
}

function createLocalSimulationSession(onMessage: (message: ServerMessage) => void): SimulationSession {
  const host = createSimulationHost();
  const joined = host.joinParticipant();
  const intervalId = window.setInterval(() => {
    host.step();
    emitSnapshot(host, onMessage);
  }, 50);

  onMessage(joined);
  emitSnapshot(host, onMessage);

  return {
    sendCommand(command) {
      if (host.applyCommand(joined.participantId, command)) {
        emitSnapshot(host, onMessage);
      }
    },
    dispose() {
      window.clearInterval(intervalId);
      host.leaveParticipant(joined.participantId);
    }
  };
}

function emitSnapshot(host: SimulationHost, onMessage: (message: ServerMessage) => void): void {
  onMessage({ type: "world.snapshot", snapshot: host.snapshot() });
}
