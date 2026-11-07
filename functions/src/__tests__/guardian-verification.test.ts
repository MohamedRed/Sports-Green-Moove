import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { guardianNextStatus, guardianOperationDigest, guardianOperationId, guardianTransitionSchema,
  guardianVerificationId, guardianVerificationSchema, isActiveGuardianClubMember } from "../domain/guardianVerification.js";

describe("guardian verification identity and lifecycle", () => {
  it("separates tuples without delimiter collisions, clubs, children, parents and operation owners", () => {
    const ids = [["a_b", "c", "d"], ["a", "b_c", "d"], ["a", "c", "d"], ["a", "c", "e"]]
      .map(([club, child, parent]) => guardianVerificationId(club, child, parent));
    expect(new Set(ids).size).toBe(ids.length);
    expect(guardianVerificationId("a", "c", "d")).toBe(guardianVerificationId("a", "c", "d"));
    expect(guardianOperationId("parent", "request")).not.toBe(guardianOperationId("manager", "request"));
  });

  it("permits only explicit pending decisions, revocation and a fresh request after closure", () => {
    expect(guardianNextStatus(undefined, "request")).toBe("requested");
    expect(guardianNextStatus("requested", "verify")).toBe("verified");
    expect(guardianNextStatus("requested", "refuse")).toBe("refused");
    expect(guardianNextStatus("verified", "revoke")).toBe("revoked");
    for (const state of ["requested", "verified"] as const) expect(guardianNextStatus(state, "withdraw")).toBe("withdrawn");
    for (const state of ["refused", "revoked", "withdrawn"] as const) expect(guardianNextStatus(state, "request")).toBe("requested");
    for (const state of [undefined, "requested", "verified", "refused", "revoked", "withdrawn"] as const) {
      for (const action of ["request", "withdraw", "verify", "refuse", "revoke"] as const) {
        if (action === "request" && [undefined, "refused", "revoked", "withdrawn"].includes(state)) continue;
        if (action === "withdraw" && (state === "requested" || state === "verified")) continue;
        if (["verify", "refuse"].includes(action) && state === "requested") continue;
        if (action === "revoke" && state === "verified") continue;
        expect(guardianNextStatus(state, action)).toBeNull();
      }
    }
  });

  it("binds an operation to the action and revision, rejects extra ownership fields and malformed revisions", () => {
    const input = { childId: "child", parentUserId: "parent", clubId: "club", action: "request" as const,
      requestId: "4c949181-39a8-4483-a3a4-ad781f3b7c61", expectedRevision: 0 };
    expect(guardianTransitionSchema.parse(input)).toEqual(input);
    expect(guardianOperationDigest(input)).not.toBe(guardianOperationDigest({ ...input, expectedRevision: 1 }));
    expect(guardianOperationDigest(input)).not.toBe(guardianOperationDigest({ ...input, action: "verify" }));
    for (const value of [-1, 0.5, "0", Number.MAX_SAFE_INTEGER, Infinity])
      expect(guardianTransitionSchema.safeParse({ ...input, expectedRevision: value }).success).toBe(false);
    expect(guardianTransitionSchema.safeParse({ ...input, verified: true }).success).toBe(false);
  });

  it("does not infer active club membership from a role claim, absent status or a foreign record", () => {
    const record = { userId: "parent", clubId: "club", status: "active", active: true };
    expect(isActiveGuardianClubMember(record, "parent", "club")).toBe(true);
    for (const fields of [{ active: false }, { status: undefined }, { status: "requested" }, { userId: "other" }, { clubId: "other" }])
      expect(isActiveGuardianClubMember({ ...record, ...fields }, "parent", "club")).toBe(false);
  });

  it("requires an auditable versioned verification rather than accepting a legacy verified flag", () => {
    const record = { childId: "child", parentUserId: "parent", clubId: "club", status: "verified",
      revision: 2, lastActorUserId: "manager", createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
    expect(guardianVerificationSchema.safeParse(record).success).toBe(true);
    for (const fields of [{ revision: 0 }, { revision: "2" }, { createdAt: undefined },
      { updatedAt: "today" }, { lastActorUserId: undefined }, { status: undefined, verified: true }])
      expect(guardianVerificationSchema.safeParse({ ...record, ...fields }).success).toBe(false);
  });
});
