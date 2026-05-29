import type { Position } from "@ecs-nav-demo/shared";
import type { World } from "./world";

function distance(a: Position, b: Position): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function runSteeringSystem(world: World): void {
  for (const entityId of world.query({ required: ["position", "destinationReference"] })) {
    const position = world.getComponent("position", entityId);
    const destinationReference = world.getComponent("destinationReference", entityId);
    const destination = destinationReference
      ? world.getComponent("position", destinationReference.entityId)
      : undefined;

    if (!position || !destination) {
      continue;
    }

    const remainingDistance = distance(position, destination);
    if (remainingDistance === 0) {
      world.removeComponent("movementVector", entityId);
      continue;
    }

    const scale = world.movementPerStep / remainingDistance;
    world.setComponent("movementVector", entityId, {
      dx: (destination.x - position.x) * scale,
      dy: (destination.y - position.y) * scale
    });
  }
}

export function runMovementSystem(world: World): void {
  for (const entityId of world.query({ required: ["position", "movementVector"] })) {
    const position = world.getComponent("position", entityId);
    const movementVector = world.getComponent("movementVector", entityId);
    if (!position || !movementVector) {
      continue;
    }

    const destinationReference = world.getComponent("destinationReference", entityId);
    const destination = destinationReference
      ? world.getComponent("position", destinationReference.entityId)
      : undefined;
    const movementDistance = Math.hypot(movementVector.dx, movementVector.dy);

    if (destination && distance(position, destination) <= movementDistance) {
      world.setComponent("position", entityId, { ...destination });
      world.removeComponent("movementVector", entityId);
      continue;
    }

    world.setComponent("position", entityId, {
      x: position.x + movementVector.dx,
      y: position.y + movementVector.dy
    });
  }
}

export function runEnabledSystems(world: World): void {
  if (world.systems.steering) {
    runSteeringSystem(world);
  }
  if (world.systems.movement) {
    runMovementSystem(world);
  }
  world.nextTick();
}
