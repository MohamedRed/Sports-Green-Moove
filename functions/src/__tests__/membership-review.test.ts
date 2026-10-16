import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { canReviewMembership, isActiveClubManager, membershipReviewSchema, membershipVersion } from "../domain/membershipReview.js";
import { membershipPageCursor, parseMembershipPageCursor } from "../lib/membershipPageCursor.js";

const member = { userId: "manager", clubId: "club", role: "clubManager", status: "active" };
describe("scoped membership decisions", () => {
  it("requires an active manager membership, not a requested or ordinary membership", () => {
    expect(isActiveClubManager(member, "manager", "club")).toBe(true);
    for (const patch of [{ role: "member" }, { status: "requested" }, { active: false }, { userId: "foreign" }, { clubId: "other" }]) {
      expect(isActiveClubManager({ ...member, ...patch }, "manager", "club")).toBe(false);
    }
    expect(isActiveClubManager(undefined, "manager", "club")).toBe(false);
  });
  it("reviews only explicitly inactive ordinary member requests without promoting roles", () => {
    const pending = { ...member, role: "member", status: "requested", active: false };
    expect(canReviewMembership(pending)).toBe(true);
    for (const patch of [{ active: true }, { active: undefined }, { role: "clubManager" }, { role: "admin" }, { status: "active" }, { status: "rejected" }]) {
      expect(canReviewMembership({ ...pending, ...patch })).toBe(false);
    }
  });
  it("rejects malformed identity and represents a document revision without precision loss", () => {
    expect(membershipReviewSchema.safeParse({ ...member, userId: "users/other" }).success).toBe(false);
    expect(membershipVersion(new Timestamp(1_800_000_000, 999999999))).toBe("1800000000.999999999");
  });
  it("binds pagination to the actor, club and list", () => {
    const scope = JSON.stringify(["manager", "club"]);
    const cursor = membershipPageCursor(scope, "request-20");
    expect(parseMembershipPageCursor(cursor, scope)).toBe("request-20");
    expect(() => parseMembershipPageCursor(cursor, JSON.stringify(["other", "club"]))).toThrow("another list");
    expect(() => parseMembershipPageCursor(cursor, JSON.stringify(["manager", "foreign"]))).toThrow("another list");
    expect(() => parseMembershipPageCursor("!bad", scope)).toThrow("Invalid membership cursor");
  });
});
