import { describe, expect, test } from "bun:test";
import { createWorld } from "../src/ecs/world";
import { runEnabledSystems, runMovementSystem, runSteeringSystem } from "../src/ecs/systems";

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

  test("path node connections are symmetric and binary", () => {
    const world = createWorld({ movementPerStep: 5 });
    const first = world.createPathNode({ x: 0, y: 0 });
    const second = world.createPathNode({ x: 10, y: 0 });

    expect(world.connectPathNodes({ fromEntityId: first, toEntityId: second })).toBe(true);
    expect(world.connectPathNodes({ fromEntityId: second, toEntityId: first })).toBe(true);

    expect(world.getComponent("pathConnections", first)).toEqual({ entityIds: [second] });
    expect(world.getComponent("pathConnections", second)).toEqual({ entityIds: [first] });
  });

  test("path nodes cannot connect to themselves", () => {
    const world = createWorld({ movementPerStep: 5 });
    const node = world.createPathNode({ x: 0, y: 0 });

    expect(world.connectPathNodes({ fromEntityId: node, toEntityId: node })).toBe(false);
    expect(world.getComponent("pathConnections", node)).toEqual({ entityIds: [] });
  });

  test("removing a path node removes its path connections", () => {
    const world = createWorld({ movementPerStep: 5 });
    const first = world.createPathNode({ x: 0, y: 0 });
    const second = world.createPathNode({ x: 10, y: 0 });
    world.connectPathNodes({ fromEntityId: first, toEntityId: second });

    expect(world.removePathNode(first)).toBe(true);

    expect(world.getComponent("pathNode", first)).toBeUndefined();
    expect(world.getComponent("pathConnections", second)).toEqual({ entityIds: [] });
  });

  test("steering moves directly when the destination is closer than the nearest path node", () => {
    const world = createWorld({ movementPerStep: 5 });
    world.createPathNode({ x: 100, y: 0 });
    const destination = world.addComponents({
      position: { x: 3, y: 0 }
    });
    const moving = world.addComponents({
      position: { x: 0, y: 0 },
      destinationReference: { entityId: destination }
    });

    runSteeringSystem(world);

    expect(world.getComponent("movementVector", moving)).toEqual({ dx: 3, dy: 0 });
  });

  test("steering uses path speed while attached to a connected route", () => {
    const world = createWorld({ movementPerStep: 5 });
    const first = world.createPathNode({ x: 0, y: 0 });
    const second = world.createPathNode({ x: 100, y: 0 });
    world.connectPathNodes({ fromEntityId: first, toEntityId: second });
    const destination = world.addComponents({
      position: { x: 120, y: 0 }
    });
    const moving = world.addComponents({
      position: { x: 0, y: 0 },
      destinationReference: { entityId: destination }
    });

    runSteeringSystem(world);

    expect(world.getComponent("movementVector", moving)).toEqual({ dx: 10, dy: 0 });
    expect(world.getComponent("pathAttachment", moving)).toEqual({
      fromEntityId: first,
      toEntityId: second
    });
  });

  test("attached moving entities continue along a path connection instead of returning to the attach node", () => {
    const world = createWorld({ movementPerStep: 5 });
    const first = world.createPathNode({ x: 0, y: 0 });
    const second = world.createPathNode({ x: 100, y: 0 });
    world.connectPathNodes({ fromEntityId: first, toEntityId: second });
    const destination = world.addComponents({
      position: { x: 120, y: 0 }
    });
    const moving = world.addComponents({
      position: { x: 0, y: 0 },
      destinationReference: { entityId: destination }
    });

    runEnabledSystems(world);
    expect(world.getComponent("position", moving)).toEqual({ x: 10, y: 0 });

    runEnabledSystems(world);
    expect(world.getComponent("position", moving)).toEqual({ x: 20, y: 0 });
  });

  test("detached moving entities continue to the destination instead of returning to the final path node", () => {
    const world = createWorld({ movementPerStep: 5 });
    const first = world.createPathNode({ x: 0, y: 0 });
    const second = world.createPathNode({ x: 20, y: 0 });
    world.connectPathNodes({ fromEntityId: first, toEntityId: second });
    const destination = world.addComponents({
      position: { x: 35, y: 0 }
    });
    const moving = world.addComponents({
      position: { x: 0, y: 0 },
      destinationReference: { entityId: destination }
    });

    runEnabledSystems(world);
    expect(world.getComponent("position", moving)).toEqual({ x: 10, y: 0 });

    runEnabledSystems(world);
    expect(world.getComponent("position", moving)).toEqual({ x: 20, y: 0 });

    runEnabledSystems(world);
    expect(world.getComponent("position", moving)).toEqual({ x: 25, y: 0 });
    expect(world.getComponent("pathAttachment", moving)).toBeUndefined();

    runEnabledSystems(world);
    expect(world.getComponent("position", moving)).toEqual({ x: 30, y: 0 });
  });

  test("steering moves directly when nearest path nodes are disconnected", () => {
    const world = createWorld({ movementPerStep: 5 });
    world.createPathNode({ x: 1, y: 0 });
    world.createPathNode({ x: 100, y: 0 });
    const destination = world.addComponents({
      position: { x: 105, y: 0 }
    });
    const moving = world.addComponents({
      position: { x: 0, y: 0 },
      destinationReference: { entityId: destination }
    });

    runSteeringSystem(world);

    expect(world.getComponent("movementVector", moving)).toEqual({ dx: 5, dy: 0 });
  });
});
