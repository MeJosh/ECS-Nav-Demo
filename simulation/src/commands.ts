import type { ClientCommand } from "@ecs-nav-demo/shared";
import type { World } from "./world.ts";

export function applyClientCommand(world: World, participantId: string, command: ClientCommand): boolean {
  if (command.type === "destination.set") {
    return Boolean(world.setParticipantDestination(participantId, { x: command.x, y: command.y }));
  }

  if (command.type === "pathNode.create") {
    world.createPathNode({ x: command.x, y: command.y });
    return true;
  }

  if (command.type === "pathNode.delete") {
    return world.removePathNode(command.entityId);
  }

  if (command.type === "pathConnection.create") {
    return world.connectPathNodes(command);
  }

  if (command.type === "pathConnection.delete") {
    return world.disconnectPathNodes(command);
  }

  return false;
}
