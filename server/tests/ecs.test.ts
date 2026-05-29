import { describe, expect, test } from "bun:test";
import { createWorld } from "../src/ecs/world";
import { runMovementSystem, runSteeringSystem } from "../src/ecs/systems";

describe("ECS movement systems", () => {
  test("steering writes a per-step movement vector toward the destination", () => {
    const world = createWorld({ movementPerStep: 5 });
    const destination = world.addComponents({
      position: { x: 10, y: 0 }
    });
    const moving = world.addComponents({
      position: { x: 0, y: 0 },
      destinationReference: { entityId: destination }
    });

    runSteeringSystem(world);

    expect(world.getComponent("movementVector", moving)).toEqual({ dx: 5, dy: 0 });
  });

  test("movement snaps to destination and removes movement vector before overshooting", () => {
    const world = createWorld({ movementPerStep: 5 });
    const destination = world.addComponents({
      position: { x: 3, y: 0 }
    });
    const moving = world.addComponents({
      position: { x: 0, y: 0 },
      destinationReference: { entityId: destination },
      movementVector: { dx: 5, dy: 0 }
    });

    runMovementSystem(world);

    expect(world.getComponent("position", moving)).toEqual({ x: 3, y: 0 });
    expect(world.getComponent("movementVector", moving)).toBeUndefined();
  });

  test("movement applies vectors without destination references", () => {
    const world = createWorld({ movementPerStep: 5 });
    const moving = world.addComponents({
      position: { x: 2, y: 3 },
      movementVector: { dx: 5, dy: -1 }
    });

    runMovementSystem(world);

    expect(world.getComponent("position", moving)).toEqual({ x: 7, y: 2 });
    expect(world.getComponent("movementVector", moving)).toEqual({ dx: 5, dy: -1 });
  });

  test("a participant pair starts colocated without a movement vector", () => {
    const world = createWorld({ movementPerStep: 5 });
    const pair = world.createParticipantPair({
      participantId: "participant-1",
      color: "#2f80ed",
      position: { x: 400, y: 300 }
    });

    expect(world.getComponent("position", pair.movingEntityId)).toEqual({ x: 400, y: 300 });
    expect(world.getComponent("position", pair.destinationEntityId)).toEqual({ x: 400, y: 300 });
    expect(world.getComponent("destinationReference", pair.movingEntityId)).toEqual({
      entityId: pair.destinationEntityId
    });
    expect(world.getComponent("movementVector", pair.movingEntityId)).toBeUndefined();
  });
});
