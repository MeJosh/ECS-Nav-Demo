import { describe, expect, test } from "bun:test";
import { createSimulationHost } from "../src";

describe("Simulation host", () => {
  test("joins the first participant with the same identity shape as dedicated mode", () => {
    const host = createSimulationHost();

    const joined = host.joinParticipant();

    expect(joined).toMatchObject({
      type: "participant.joined",
      participantId: "participant-1"
    });
    expect(host.snapshot().components.participantOwnership[joined.movingEntityId]).toEqual({
      participantId: "participant-1"
    });
    expect(host.snapshot().components.participantOwnership[joined.destinationEntityId]).toEqual({
      participantId: "participant-1"
    });
  });

  test("applies participant commands without leaking command metadata into component state", () => {
    const host = createSimulationHost();
    const joined = host.joinParticipant();

    expect(host.applyCommand(joined.participantId, { type: "destination.set", x: 50, y: 60 })).toBe(true);

    expect(host.snapshot().components.position[joined.destinationEntityId]).toEqual({ x: 50, y: 60 });
  });
});
