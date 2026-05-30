import type { EntityId, Position } from "@ecs-nav-demo/shared";
import type { World } from "./world.ts";

const pathSpeedMultiplier = 2;
const positionTolerance = 0.001;

function distance(a: Position, b: Position): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function nearestPathNode(world: World, position: Position): { entityId: EntityId; position: Position; distance: number } | undefined {
  let nearest: { entityId: EntityId; position: Position; distance: number } | undefined;
  for (const entityId of world.query({ required: ["position", "pathNode"] })) {
    const pathNodePosition = world.getComponent("position", entityId);
    if (!pathNodePosition) {
      continue;
    }
    const pathNodeDistance = distance(position, pathNodePosition);
    if (!nearest || pathNodeDistance < nearest.distance) {
      nearest = { entityId, position: pathNodePosition, distance: pathNodeDistance };
    }
  }
  return nearest;
}

function shortestPathRoute(world: World, startEntityId: EntityId, endEntityId: EntityId): EntityId[] | undefined {
  if (startEntityId === endEntityId) {
    return [startEntityId];
  }

  const distances = new Map<EntityId, number>([[startEntityId, 0]]);
  const previous = new Map<EntityId, EntityId>();
  const unvisited = new Set(world.query({ required: ["position", "pathNode"] }));

  while (unvisited.size > 0) {
    let current: EntityId | undefined;
    let currentDistance = Infinity;
    for (const entityId of unvisited) {
      const entityDistance = distances.get(entityId) ?? Infinity;
      if (entityDistance < currentDistance) {
        current = entityId;
        currentDistance = entityDistance;
      }
    }

    if (!current || currentDistance === Infinity) {
      break;
    }
    if (current === endEntityId) {
      break;
    }

    unvisited.delete(current);
    const currentPosition = world.getComponent("position", current);
    const connections = world.getComponent("pathConnections", current)?.entityIds ?? [];
    if (!currentPosition) {
      continue;
    }

    for (const connectedEntityId of connections) {
      if (!unvisited.has(connectedEntityId)) {
        continue;
      }
      const connectedPosition = world.getComponent("position", connectedEntityId);
      if (!connectedPosition) {
        continue;
      }
      const nextDistance = currentDistance + distance(currentPosition, connectedPosition);
      if (nextDistance < (distances.get(connectedEntityId) ?? Infinity)) {
        distances.set(connectedEntityId, nextDistance);
        previous.set(connectedEntityId, current);
      }
    }
  }

  if (!distances.has(endEntityId)) {
    return undefined;
  }

  const route = [endEntityId];
  let current = endEntityId;
  while (current !== startEntityId) {
    const previousEntityId = previous.get(current);
    if (!previousEntityId) {
      return undefined;
    }
    route.unshift(previousEntityId);
    current = previousEntityId;
  }
  return route;
}

function movementVectorToward(position: Position, target: Position, movementPerStep: number): { dx: number; dy: number } | undefined {
  const remainingDistance = distance(position, target);
  if (remainingDistance === 0) {
    return undefined;
  }

  const movementDistance = Math.min(movementPerStep, remainingDistance);
  const scale = movementDistance / remainingDistance;
  return {
    dx: (target.x - position.x) * scale,
    dy: (target.y - position.y) * scale
  };
}

function arePathNodesConnected(world: World, fromEntityId: EntityId, toEntityId: EntityId): boolean {
  return world.getComponent("pathConnections", fromEntityId)?.entityIds.includes(toEntityId) ?? false;
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

    const directDistance = distance(position, destination);
    if (directDistance === 0) {
      world.removeComponent("movementVector", entityId);
      continue;
    }

    let movementTarget = destination;
    let movementPerStep = world.movementPerStep;
    const pathAttachment = world.getComponent("pathAttachment", entityId);
    const detachNode = nearestPathNode(world, destination);

    if (pathAttachment && detachNode) {
      const attachedTargetPosition = world.getComponent("position", pathAttachment.toEntityId);
      if (
        attachedTargetPosition &&
        arePathNodesConnected(world, pathAttachment.fromEntityId, pathAttachment.toEntityId)
      ) {
        if (distance(position, attachedTargetPosition) > positionTolerance) {
          movementTarget = attachedTargetPosition;
          movementPerStep *= pathSpeedMultiplier;
        } else {
          const route = shortestPathRoute(world, pathAttachment.toEntityId, detachNode.entityId);
          if (route && route.length > 1) {
            world.setComponent("pathAttachment", entityId, {
              fromEntityId: route[0],
              toEntityId: route[1]
            });
            const nextPathNodePosition = world.getComponent("position", route[1]);
            if (nextPathNodePosition) {
              movementTarget = nextPathNodePosition;
              movementPerStep *= pathSpeedMultiplier;
            }
          } else {
            world.removeComponent("pathAttachment", entityId);
          }
        }
      } else {
        world.removeComponent("pathAttachment", entityId);
      }
    }

    if (world.getComponent("pathAttachment", entityId)) {
      const movementVector = movementVectorToward(position, movementTarget, movementPerStep);
      if (!movementVector) {
        world.removeComponent("movementVector", entityId);
        continue;
      }
      world.setComponent("movementVector", entityId, movementVector);
      continue;
    }

    const attachNode = nearestPathNode(world, position);

    if (attachNode && directDistance >= attachNode.distance) {
      const route = detachNode ? shortestPathRoute(world, attachNode.entityId, detachNode.entityId) : undefined;

      if (route) {
        if (route.length === 1) {
          world.removeComponent("pathAttachment", entityId);
        } else if (attachNode.distance > positionTolerance) {
          movementTarget = attachNode.position;
        } else if (route.length > 1) {
          const nextPathNodePosition = world.getComponent("position", route[1]);
          if (nextPathNodePosition) {
            world.setComponent("pathAttachment", entityId, {
              fromEntityId: route[0],
              toEntityId: route[1]
            });
            movementTarget = nextPathNodePosition;
            movementPerStep *= pathSpeedMultiplier;
          }
        } else {
          world.removeComponent("pathAttachment", entityId);
        }
      }
    } else {
      world.removeComponent("pathAttachment", entityId);
    }

    const movementVector = movementVectorToward(position, movementTarget, movementPerStep);
    if (!movementVector) {
      world.removeComponent("movementVector", entityId);
      continue;
    }
    world.setComponent("movementVector", entityId, movementVector);
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
    const pathAttachment = world.getComponent("pathAttachment", entityId);

    if (!pathAttachment && destination && distance(position, destination) <= movementDistance) {
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
