import { describe, expect, test } from "bun:test";
import { buildApp } from "../src/app";
import { createWorld } from "../src/ecs/world";

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
});
