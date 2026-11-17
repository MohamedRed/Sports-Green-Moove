import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import type { markNotificationRead as Callable } from "../functions/src/callables/notificationRead.js";

let firestore: Firestore;
let mark: typeof Callable;
const prefix = "notification-read-qa-";
const id = `${prefix}notice`;
const input = { userId: "qa-parent", notificationId: id };
const invoke = (data: unknown = input, uid: string | null = "qa-parent") => mark.run({ data,
  ...(uid ? { auth: { uid, token: {} } } : {}) } as Parameters<typeof mark.run>[0]);
const original = { userId: "qa-parent", type: "bookingAccepted", title: "Réservation confirmée",
  body: "Deux places QA", sourceId: "qa-booking", read: false, createdAt: Timestamp.fromMillis(1792770000000) };

async function clear() {
  const records = await firestore.collection("notifications").get();
  const batch = firestore.batch();
  for (const record of records.docs.filter((doc) => doc.id.startsWith(prefix))) batch.delete(record.ref);
  await batch.commit();
}
beforeAll(async () => {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) {
    throw new Error("Loopback Firestore emulator required.");
  }
  process.env.GCLOUD_PROJECT = "sports-green-moove-rules-test";
  process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: process.env.GCLOUD_PROJECT });
  ({ firestore } = await import("../functions/src/lib/firestore.js"));
  ({ markNotificationRead: mark } = await import("../functions/src/callables/notificationRead.js"));
});
beforeEach(async () => { await clear(); await firestore.doc(`notifications/${id}`).set(original); });
afterEach(clear);

describe("isolated per-notification acknowledgement", () => {
  it("acknowledges the owner notice with a server time without changing its content", async () => {
    await expect(invoke()).resolves.toEqual({ ...input, read: true });
    const saved = (await firestore.doc(`notifications/${id}`).get()).data()!;
    expect(saved).toMatchObject({ ...original, read: true });
    expect(saved.readAt).toBeInstanceOf(Timestamp);
    expect(Object.keys(saved).sort()).toEqual([...Object.keys(original), "readAt"].sort());
  });
  it("replays after a lost response without rewriting the first read time", async () => {
    await invoke();
    const first = (await firestore.doc(`notifications/${id}`).get()).data();
    await invoke();
    expect((await firestore.doc(`notifications/${id}`).get()).data()).toEqual(first);
  });
  it("serializes concurrent acknowledgements into one read timestamp", async () => {
    const receipts = await Promise.all([invoke(), invoke(), invoke()]);
    expect(receipts.every((receipt) => JSON.stringify(receipt) === JSON.stringify(receipts[0]))).toBe(true);
    const first = (await firestore.doc(`notifications/${id}`).get()).data();
    await invoke(); expect((await firestore.doc(`notifications/${id}`).get()).data()).toEqual(first);
  });
  it("keeps an already-read legacy record byte-for-byte unchanged", async () => {
    await firestore.doc(`notifications/${id}`).update({ read: true });
    await invoke();
    expect((await firestore.doc(`notifications/${id}`).get()).data()).toEqual({ ...original, read: true });
  });
  it("does not change another account's notification", async () => {
    await expect(invoke({ ...input, userId: "qa-other" }, "qa-other")).rejects.toMatchObject({ code: "not-found" });
    expect((await firestore.doc(`notifications/${id}`).get()).data()).toEqual(original);
  });
  it("rejects an account switch even when both accounts exist", async () => {
    await expect(invoke(input, "qa-other")).rejects.toMatchObject({ code: "permission-denied" });
    expect((await firestore.doc(`notifications/${id}`).get()).data()).toEqual(original);
  });
  it("does not disclose or create missing notifications", async () => {
    await expect(invoke({ ...input, notificationId: `${prefix}missing` })).rejects.toMatchObject({ code: "not-found" });
    expect((await firestore.doc(`notifications/${prefix}missing`).get()).exists).toBe(false);
  });
  it("rejects unauthenticated requests", async () => {
    await expect(invoke(input, null)).rejects.toMatchObject({ code: "unauthenticated" });
    expect((await firestore.doc(`notifications/${id}`).get()).data()).toEqual(original);
  });
  it.each([{}, { ...input, notificationId: "bad/path" }, { ...input, notificationId: ".." },
    { ...input, notificationId: "" }, { ...input, userId: "bad/path" },
    { ...input, read: false }, { ...input, readAt: 0 }])("rejects invalid or extra request fields: %j", async (data) => {
    await expect(invoke(data)).rejects.toMatchObject({ code: "invalid-argument" });
    expect((await firestore.doc(`notifications/${id}`).get()).data()).toEqual(original);
  });
  it("touches only the explicitly selected notice, not older or newer rows", async () => {
    const other = firestore.doc(`notifications/${prefix}other`); await other.set(original);
    await invoke(); expect((await other.get()).data()).toEqual(original);
  });
  it("does not acknowledge a chat message or mutate its unread conversation counter", async () => {
    await firestore.doc(`notifications/${id}`).update({ type: "chatMessage", messageId: "qa-message" });
    const message = firestore.doc("messages/notification-read-qa-message");
    const inbox = firestore.doc("chatInboxes/notification-read-qa-inbox");
    await message.set({ readByUserIds: ["qa-driver"], body: "Synthetic message" });
    await inbox.set({ unreadCount: 1 });
    try {
      await invoke();
      expect((await message.get()).data()).toEqual({ readByUserIds: ["qa-driver"], body: "Synthetic message" });
      expect((await inbox.get()).data()).toEqual({ unreadCount: 1 });
    } finally { await message.delete(); await inbox.delete(); }
  });
});
