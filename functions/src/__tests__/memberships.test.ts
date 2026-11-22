import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import {
  canRequestMembership,
  membershipDocumentId,
  membershipRequestData,
  membershipRequestStatus,
} from "../domain/memberships.js";

describe("club membership requests", () => {
  it("uses a deterministic user and club membership document id", () => {
    expect(membershipDocumentId("user-1", "club-1")).toBe("user-1_club-1");
  });

  it("builds a pending membership request owned by the user", () => {
    const now = Timestamp.fromMillis(1_700_000_000_000);

    expect(membershipRequestData("user-1", "club-1", now)).toEqual({
      userId: "user-1",
      clubId: "club-1",
      role: "member",
      status: "requested",
      active: false,
      requestedAt: now,
      updatedAt: now,
    });
  });

  it("allows new or previously rejected requests but keeps active/requested memberships idempotent", () => {
    expect(canRequestMembership(undefined)).toBe(true);
    expect(canRequestMembership({ status: "rejected" })).toBe(true);
    expect(canRequestMembership({ status: "cancelled" })).toBe(true);
    expect(canRequestMembership({ status: "requested" })).toBe(false);
    expect(canRequestMembership({ status: "active" })).toBe(false);
    expect(canRequestMembership({ active: true })).toBe(false);
    expect(membershipRequestStatus({ active: true })).toBe("active");
  });
});
