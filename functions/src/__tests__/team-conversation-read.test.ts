import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { teamConversationReadSchema, teamReadReceiptId, teamUnreadCount, validateTeamReadReceipt } from "../domain/teamConversationRead.js";

describe("team message read receipts", () => {
  const messageId = "a".repeat(64), at = new Timestamp(100, 4);
  const input = { teamId: "team", expectedTeamInstanceId: "b".repeat(64), expectedAccessVersion: "c".repeat(64), messageIds: [messageId] };
  it("requires an exact current window, bounded unique message identities and no caller-selected account", () => {
    expect(teamConversationReadSchema.parse(input)).toEqual(input);
    for (const change of [{ expectedAccessVersion: undefined }, { expectedAccessVersion: "old" }, { messageIds: [] },
      { messageIds: [messageId, messageId] }, { messageIds: ["foreign/id"] }, { userId: "other" },
      { messageIds: Array.from({ length: 51 }, (_, i) => i.toString(16).padStart(64, "0")) }])
      expect(teamConversationReadSchema.safeParse({ ...input, ...change }).success).toBe(false);
  });
  it("binds private receipt identities to both the account and message", () => {
    expect(teamReadReceiptId("parent", messageId)).toMatch(/^[a-f0-9]{64}$/);
    expect(teamReadReceiptId("parent", messageId)).not.toBe(teamReadReceiptId("driver", messageId));
    expect(teamReadReceiptId("parent", messageId)).not.toBe(teamReadReceiptId("parent", "d".repeat(64)));
  });
  it("does not infer success from another account, message, timestamp or incomplete metadata", () => {
    const receipt = { userId: "parent", messageId, messageCreatedAt: at, readAt: new Timestamp(101, 0) };
    expect(() => validateTeamReadReceipt(receipt, "parent", messageId, at)).not.toThrow();
    for (const change of [{ userId: "driver" }, { messageId: "d".repeat(64) }, { messageCreatedAt: new Timestamp(100, 5) },
      { messageCreatedAt: at.toDate() }, { readAt: null }, { readAt: new Timestamp(100, 3) }])
      expect(() => validateTeamReadReceipt({ ...receipt, ...change }, "parent", messageId, at)).toThrow();
  });
  it("computes exact counts and rejects inconsistent aggregates instead of inventing zero", () => {
    expect(teamUnreadCount(123, 120)).toBe(3); expect(teamUnreadCount(0, 0)).toBe(0);
    for (const pair of [[0, 1], [-1, 0], [1, -1], [1.1, 0], [Number.MAX_SAFE_INTEGER + 1, 0], [NaN, 0]])
      expect(() => teamUnreadCount(pair[0], pair[1])).toThrow();
  });
});
