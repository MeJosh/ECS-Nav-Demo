import { describe, expect, test } from "bun:test";
import { createWorld } from "@ecs-nav-demo/simulation";
import { buildApp } from "../src/app";

describe("Fastify API", () => {
  test("returns world snapshots", async () => {
    const world = createWorld({ movementPerStep: 5 });
    const app = await buildApp({ world });

    const response = await app.inject({ method: "GET", url: "/api/state" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      tick: 0,
      components: {},
      systems: { steering: true, movement: true }
    });
  });

  test("toggles systems", async () => {
    const world = createWorld({ movementPerStep: 5 });
    const app = await buildApp({ world });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/systems/steering",
      payload: { enabled: false }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json() as { id: string; enabled: boolean }).toEqual({
      id: "steering",
      enabled: false
    });
    expect(world.systems.steering).toBe(false);
  });

  test("sets participant destination", async () => {
    const world = createWorld({ movementPerStep: 5 });
    world.createParticipantPair({
      participantId: "participant-1",
      color: "#2f80ed",
      position: { x: 400, y: 300 }
    });
    const app = await buildApp({ world });

    const response = await app.inject({
      method: "POST",
      url: "/api/participants/participant-1/destination",
      payload: { x: 50, y: 60 }
    });

    expect(response.statusCode).toBe(200);
    const snapshot = world.snapshot();
    const destinationId = Object.keys(snapshot.components.position).find(
      (entityId) => snapshot.components.position[entityId].x === 50
    );
    expect(destinationId).toBeDefined();
    expect(destinationId ? snapshot.components.position[destinationId] : undefined).toEqual({ x: 50, y: 60 });
  });

  test("creates path nodes through the API", async () => {
    const world = createWorld({ movementPerStep: 5 });
    const app = await buildApp({ world });

    const response = await app.inject({
      method: "POST",
      url: "/api/path-nodes",
      payload: { x: 10, y: 20 }
    });

    expect(response.statusCode).toBe(200);
    const { entityId } = response.json() as { entityId: string };
    expect(world.getComponent("position", entityId)).toEqual({ x: 10, y: 20 });
    expect(world.getComponent("pathConnections", entityId)).toEqual({ entityIds: [] });
  });

  test("connects and disconnects path nodes through the API", async () => {
    const world = createWorld({ movementPerStep: 5 });
    const first = world.createPathNode({ x: 0, y: 0 });
    const second = world.createPathNode({ x: 10, y: 0 });
    const app = await buildApp({ world });

    const connectResponse = await app.inject({
      method: "POST",
      url: "/api/path-connections",
      payload: { fromEntityId: first, toEntityId: second }
    });

    expect(connectResponse.statusCode).toBe(200);
    expect(world.getComponent("pathConnections", first)).toEqual({ entityIds: [second] });
    expect(world.getComponent("pathConnections", second)).toEqual({ entityIds: [first] });

    const disconnectResponse = await app.inject({
      method: "DELETE",
      url: `/api/path-connections/${first}/${second}`
    });

    expect(disconnectResponse.statusCode).toBe(200);
    expect(world.getComponent("pathConnections", first)).toEqual({ entityIds: [] });
    expect(world.getComponent("pathConnections", second)).toEqual({ entityIds: [] });
  });
});
