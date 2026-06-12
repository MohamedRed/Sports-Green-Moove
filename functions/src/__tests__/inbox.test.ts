import { describe, expect, it } from "vitest";
import { buildInboxChats, buildInboxReviewPrompts, mapInboxNotifications } from "../domain/inbox.js";

describe("client inbox", () => {
  it("maps notifications with unread state and stable labels", () => {
    const notifications = mapInboxNotifications([
      { id: "n1", data: { title: "Départ confirmé", body: "Le conducteur a démarré.", read: false, createdAt: "2026-06-12T10:00:00Z" } },
    ]);

    expect(notifications[0]).toMatchObject({
      id: "n1",
      title: "Départ confirmé",
      unread: true,
      initials: "DC",
    });
  });

  it("groups chat messages by conversation and counts unread messages", () => {
    const chats = buildInboxChats([
      { id: "m1", data: { sourceType: "booking", sourceId: "b1", senderUserId: "driver", body: "À 16h45", createdAt: 1000 } },
      { id: "m2", data: { sourceType: "booking", sourceId: "b1", senderUserId: "parent", body: "Parfait", createdAt: 2000 } },
      { id: "m3", data: { sourceType: "rideSession", sourceId: "r1", senderUserId: "driver", body: "Arrivé", readByUserIds: ["parent"], createdAt: 3000 } },
    ], "parent");

    expect(chats.map((chat) => chat.id)).toEqual(["rideSession:r1", "booking:b1"]);
    expect(chats[1].preview).toBe("Parfait");
    expect(chats[1].unreadCount).toBe(1);
    expect(chats[0].unreadCount).toBe(0);
  });

  it("creates review prompts only when the caller has not rated the target", () => {
    const prompts = buildInboxReviewPrompts([
      { id: "ride-1", data: { status: "completed", driverUserId: "driver", participantUserIds: ["parent"] } },
      { id: "ride-2", data: { status: "completed", driverUserId: "driver", participantUserIds: ["parent"] } },
    ], new Set(["ride-2_parent_driver"]), "parent");

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({ id: "ride-1_parent_driver", rideSessionId: "ride-1", ratedUserId: "driver" });
  });
});
