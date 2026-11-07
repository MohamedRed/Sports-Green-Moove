import { describe, expect, it } from "vitest";
import { z } from "zod";
import { locationBatchRequestSchema } from "../domain/locationBatch.js";
import { teamConversationReadSchema } from "../domain/teamConversationRead.js";

describe("bounded request collections reject size before walking their elements", () => {
  it("rejects oversized location batches with a size issue, not one error per update", () => {
    const result = locationBatchRequestSchema.safeParse({ updates: Array(101).fill(null) });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Oversized location batch was accepted");
    const union = result.error.issues[0];
    expect(union.code).toBe("invalid_union");
    if (union.code !== "invalid_union") throw new Error("Expected the request transport union");
    expect(union.errors[0]).toEqual([expect.objectContaining({ code: "too_big", maximum: 100, path: ["updates"] })]);
  });
  it("rejects oversized team read acknowledgements before validating individual IDs", () => {
    const result = teamConversationReadSchema.safeParse({ teamId: "qa-team", expectedTeamInstanceId: "a".repeat(64),
      expectedAccessVersion: "b".repeat(64), messageIds: Array(51).fill("invalid") });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Oversized acknowledgement batch was accepted");
    expect(result.error.issues).toEqual([expect.objectContaining({ code: "too_big", maximum: 50, path: ["messageIds"] })]);
  });
  it("does not invoke element validation or allocate per-element issues for an oversized bounded array", () => {
    let visited = 0;
    const element = z.string().superRefine(() => { visited += 1; });
    const result = z.array(element).max(50).safeParse(Array(10_000).fill("qa-value"));
    expect(result.success).toBe(false); expect(visited).toBe(0);
    if (result.success) throw new Error("Oversized array was accepted");
    expect(result.error.issues).toHaveLength(1); expect(result.error.issues[0].code).toBe("too_big");
  });
  it("still validates every element at the supported batch boundary", () => {
    const update = { rideSessionId: "qa-ride", role: "driver", lat: 50, lng: 4, accuracyM: 5, capturedAt: 1 };
    expect(locationBatchRequestSchema.safeParse({ updates: Array(100).fill(update) }).success).toBe(true);
    const data = { teamId: "qa-team", expectedTeamInstanceId: "a".repeat(64), expectedAccessVersion: "b".repeat(64),
      messageIds: Array.from({ length: 50 }, (_, index) => index.toString(16).padStart(64, "0")) };
    expect(teamConversationReadSchema.safeParse(data).success).toBe(true);
    expect(teamConversationReadSchema.safeParse({ ...data, messageIds: [...data.messageIds.slice(0, 49), "invalid"] }).success).toBe(false);
    expect(locationBatchRequestSchema.safeParse({ updates: [...Array(99).fill(update), null] }).success).toBe(false);
  });
});
