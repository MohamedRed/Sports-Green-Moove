import { describe, expect, it } from "vitest";
import { chatMessageId, chatNotificationId, sameChatRequest } from "../domain/chatDelivery.js";

describe("chat delivery identities", () => {
  it("reuses one sender request ID without sharing another sender's identity", () => {
    expect(chatMessageId("parent", "request-1")).toBe(chatMessageId("parent", "request-1"));
    expect(chatMessageId("parent", "request-1")).not.toBe(chatMessageId("driver", "request-1"));
    expect(chatMessageId("a:b", "c")).not.toBe(chatMessageId("a", "b:c"));
    expect(chatMessageId("a/b", "request")).toMatch(/^[a-f0-9]{64}$/);
  });
  it("scopes notifications to both message and recipient", () => {
    expect(chatNotificationId("m1", "p1")).toBe(chatNotificationId("m1", "p1"));
    expect(chatNotificationId("m1", "p1")).not.toBe(chatNotificationId("m2", "p1"));
    expect(chatNotificationId("m1", "p1")).not.toBe(chatNotificationId("m1", "p2"));
  });
  it("requires identical content, sender and conversation on retry", () => {
    const request = { senderUserId: "parent", sourceType: "booking", sourceId: "b1", body: "Au stade." };
    expect(sameChatRequest({ ...request, createdAt: 1 }, request)).toBe(true);
    for (const change of [{ senderUserId: "driver" }, { sourceType: "rideSession" }, { sourceId: "b2" }, { body: "Autre texte" }]) {
      expect(sameChatRequest(request, { ...request, ...change })).toBe(false);
    }
  });
});
