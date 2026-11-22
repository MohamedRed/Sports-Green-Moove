import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { acknowledgeChatInbox, appendChatInbox, chatInboxId, indexHistoricalChatMessage, requireChatInbox,
  type ChatInboxEntry, type IndexedChatMessage } from "../domain/chatInbox.js";

const source = { sourceType: "booking" as const, sourceId: "b1" };
const message = (id: string, seconds = 1, nanos = 0): IndexedChatMessage => ({ ...source, id,
  senderUserId: "driver", participantUserIds: ["driver", "parent"], body: `Message ${id}`, createdAt: new Timestamp(seconds, nanos) });
const indexChatHistory = (uid: string, ref: typeof source, messages: IndexedChatMessage[]) =>
  messages.reduce<ChatInboxEntry | null>((entry, item) => indexHistoricalChatMessage(entry, uid, ref, item), null);

describe("private conversation inbox entries", () => {
  it("scopes identity to the owner and the exact source without delimiter collisions", () => {
    expect(chatInboxId("p", source)).toBe(chatInboxId("p", source));
    expect(chatInboxId("p", source)).not.toBe(chatInboxId("d", source));
    expect(chatInboxId("p", source)).not.toBe(chatInboxId("p", { ...source, sourceType: "rideSession" }));
    expect(chatInboxId("a:b", { ...source, sourceId: "c" })).not.toBe(chatInboxId("a", { ...source, sourceId: "b:c" }));
    expect(chatInboxId("a/b", source)).toMatch(/^[a-f0-9]{64}$/);
  });
  it("counts all addressed incoming messages, not just the recent message window", () => {
    const history = Array.from({ length: 121 }, (_, i) => message(`m${i}`, i));
    const parent = indexChatHistory("parent", source, history)!;
    expect(parent.unreadCount).toBe(121);
    expect(parent.lastMessageId).toBe("m120");
    expect(indexChatHistory("driver", source, history)!.unreadCount).toBe(0);
  });
  it("indexes historical read markers without claiming to read unseen messages", () => {
    const first = { ...message("a"), readByUserIds: ["parent"] };
    const entry = indexChatHistory("parent", source, [first, message("b", 2)])!;
    expect(entry.unreadCount).toBe(1);
    expect(indexChatHistory("parent", source, [])).toBeNull();
    expect(() => indexChatHistory("outsider", source, [first])).toThrow(/belong/);
  });
  it("preserves stable latest ordering across timestamp ties and delayed writes", () => {
    let entry = appendChatInbox(null, "parent", message("z", 2, 4));
    entry = indexHistoricalChatMessage(entry, "parent", source, message("a", 2, 4));
    entry = indexHistoricalChatMessage(entry, "parent", source, message("later-delayed", 1));
    expect(entry.lastMessageId).toBe("z");
    expect(entry.unreadCount).toBe(3);
    entry = indexHistoricalChatMessage(entry, "parent", source, message("a", 2, 5));
    expect(entry.lastMessageId).toBe("a");
    expect(entry.revision).toBe(4);
  });
  it("acknowledges only newly read incoming messages and rejects counter corruption", () => {
    const entry = indexChatHistory("parent", source, [message("a"), message("b")])!;
    const read = acknowledgeChatInbox(entry, 1);
    expect(read.unreadCount).toBe(1);
    expect(read.lastMessageAt).toEqual(entry.lastMessageAt);
    expect(read.revision).toBe(entry.revision + 1);
    expect(acknowledgeChatInbox(read, 0)).toEqual(read);
    for (const count of [-1, 2, 0.5, NaN]) expect(() => acknowledgeChatInbox(read, count)).toThrow(/unread/);
  });
  it("fails closed on owner, source, schema and count mismatches", () => {
    const entry = appendChatInbox(null, "parent", message("a"));
    expect(() => requireChatInbox(entry, "outsider", source)).toThrow(/inconsistent/);
    expect(() => requireChatInbox(entry, "parent", { ...source, sourceId: "b2" })).toThrow(/inconsistent/);
    for (const change of [{ schemaVersion: 2 }, { unreadCount: -1 }, { revision: 0 }, { lastMessageAt: null }]) {
      expect(() => requireChatInbox({ ...entry, ...change }, "parent", source)).toThrow(/inconsistent/);
    }
  });
});
