import type { ParticipantJoinedMessage, Position, WorldSnapshot } from "@ecs-nav-demo/shared";
import type { ClientCommand, SystemStates } from "@ecs-nav-demo/shared";
import { applyClientCommand } from "./commands.ts";
import { runEnabledSystems } from "./systems.ts";
import { createWorld, type World } from "./world.ts";

const defaultParticipantColors = [
  "#2f80ed",
  "#eb5757",
  "#27ae60",
  "#f2994a",
  "#9b51e0",
  "#00a6a6"
];

export interface SimulationHostOptions {
  world?: World;
  movementPerStep?: number;
  participantStartPosition?: Position;
  participantColors?: string[];
}

export interface SimulationHost {
  readonly world: World;
  joinParticipant(): ParticipantJoinedMessage;
  leaveParticipant(participantId: string): void;
  applyCommand(participantId: string, command: ClientCommand): boolean;
  setSystemEnabled(system: keyof SystemStates, enabled: boolean): void;
  step(): void;
  snapshot(): WorldSnapshot;
}

export function createSimulationHost(options: SimulationHostOptions = {}): SimulationHost {
  const world = options.world ?? createWorld({ movementPerStep: options.movementPerStep ?? 5 });
  const participantStartPosition = options.participantStartPosition ?? { x: 400, y: 300 };
  const participantColors = options.participantColors ?? defaultParticipantColors;
  let nextParticipantNumber = 1;

  function joinParticipant(): ParticipantJoinedMessage {
    const participantId = `participant-${nextParticipantNumber++}`;
    const color = participantColors[(nextParticipantNumber - 2) % participantColors.length];
    const pair = world.createParticipantPair({
      participantId,
      color,
      position: participantStartPosition
    });

    return {
      type: "participant.joined",
      participantId,
      movingEntityId: pair.movingEntityId,
      destinationEntityId: pair.destinationEntityId
    };
  }

  return {
    world,
    joinParticipant,
    leaveParticipant(participantId) {
      world.removeParticipant(participantId);
    },
    applyCommand(participantId, command) {
      return applyClientCommand(world, participantId, command);
    },
    setSystemEnabled(system, enabled) {
      world.setSystemEnabled(system, enabled);
    },
    step() {
      runEnabledSystems(world);
    },
    snapshot() {
      return world.snapshot();
    }
  };
}
