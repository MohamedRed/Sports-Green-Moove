import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { childAccountLinkSchema } from "../domain/childAccountLink.js";
import { emergencyChildInstanceId, emergencyContactId, emergencyContactRecordSchema, emergencyDigest,
  childRideEmergencyReadSchema, emergencyReadSchema, emergencyWriteSchema, legacyChildEmergencyContactId, personalContactSchema } from "../domain/emergencyContact.js";

describe("private emergency contact inputs", () => {
  it("requires a strict server-owned child account link with an immutable profile identity", () => {
    const link = { accountUserId: "account", childId: "profile", childInstanceId: "a".repeat(64),
      status: "verified", verifiedAt: Timestamp.now(), verifiedByUserId: "approver" };
    expect(childAccountLinkSchema.safeParse(link).success).toBe(true);
    expect(childAccountLinkSchema.safeParse({ ...link, status: "revoked" }).success).toBe(true);
    for (const patch of [{ childId: "a/b" }, { childInstanceId: "a".repeat(63) }, { status: "pending" },
      { verifiedAt: new Date() }, { verifiedByUserId: "" }, { trusted: true }])
      expect(childAccountLinkSchema.safeParse({ ...link, ...patch }).success).toBe(false);
  });
  it("lets the child select a ride but never another child identity or contact provenance", () => {
    expect(childRideEmergencyReadSchema.safeParse({ rideSessionId: "ride" }).success).toBe(true);
    for (const input of [{ rideSessionId: "a/b" }, { rideSessionId: "ride", childId: "other" },
      { rideSessionId: "ride", parentUserId: "parent" }, { rideSessionId: "ride", guardianClubId: "club" }])
      expect(childRideEmergencyReadSchema.safeParse(input).success).toBe(false);
  });
  it("requires explicit international syntax without guessing a country or number", () => {
    expect(personalContactSchema.parse({ name: " Contact QA ", phone: "+12025550123" }).name).toBe("Contact QA");
    for (const phone of ["112", "0470000000", "+0123456789", "+12025550123;123", "+12025550123\n", "+1 202 555 0123"])
      expect(personalContactSchema.safeParse({ name: "QA", phone }).success).toBe(false);
  });
  it("rejects empty names, control characters, directional overrides and unbounded text", () => {
    for (const name of [" ", "a\nb", "a\u202eb", "a\u2066b", "a".repeat(101)])
      expect(personalContactSchema.safeParse({ name, phone: "+12025550123" }).success).toBe(false);
  });
  it("keeps self ownership server-selected and child authority explicitly scoped", () => {
    expect(emergencyReadSchema.safeParse({ target: { kind: "self" } }).success).toBe(true);
    expect(emergencyReadSchema.safeParse({ target: { kind: "self", uid: "other" } }).success).toBe(false);
    expect(emergencyReadSchema.safeParse({ target: { kind: "child", childId: "child", clubId: "club" } }).success).toBe(true);
    for (const target of [{ kind: "child", childId: "child" }, { kind: "child", childId: "a/b", clubId: "club" },
      { kind: "child", childId: "child", clubId: "club", verified: true }])
      expect(emergencyReadSchema.safeParse({ target }).success).toBe(false);
    expect(emergencyContactId("self", "same")).not.toBe(emergencyContactId("child", "same", "a".repeat(64)));
  });
  it("accepts explicit removal but rejects unsafe revisions and extra fields", () => {
    const input = { target: { kind: "self" }, contact: null, expectedRevision: 2, requestId: "4c949181-39a8-4483-a3a4-ad781f3b7c61" };
    expect(emergencyWriteSchema.safeParse(input).success).toBe(true);
    for (const expectedRevision of [-1, 0.5, "2", Number.MAX_SAFE_INTEGER, Infinity])
      expect(emergencyWriteSchema.safeParse({ ...input, expectedRevision }).success).toBe(false);
    expect(emergencyWriteSchema.safeParse({ ...input, parentUserId: "other" }).success).toBe(false);
  });
  it("binds child identity to exact server creation nanoseconds rather than mutable timestamps or milliseconds", () => {
    const before = new Timestamp(10, 100), after = new Timestamp(10, 101);
    expect(before.toMillis()).toBeCloseTo(after.toMillis(), 3);
    expect(emergencyChildInstanceId("child", before)).not.toBe(emergencyChildInstanceId("child", after));
    expect(emergencyChildInstanceId("child", before)).toBe(emergencyChildInstanceId("child", before));
    expect(emergencyChildInstanceId("other", before)).not.toBe(emergencyChildInstanceId("child", before));
  });
  it("keeps adult keys stable while recreated children and legacy keys have distinct private documents", () => {
    expect(emergencyContactId("self", "adult")).toBe(emergencyDigest(["self", "adult"]));
    const first = emergencyContactId("child", "same", "a".repeat(64));
    expect(first).not.toBe(emergencyContactId("child", "same", "b".repeat(64)));
    expect(first).not.toBe(legacyChildEmergencyContactId("same"));
    expect(() => emergencyContactId("child", "same")).toThrow();
    expect(() => emergencyContactId("self", "same", "a".repeat(64))).toThrow();
  });
  it("requires a child write marker and rejects one supplied for an adult", () => {
    const input = { target: { kind: "child", childId: "child", clubId: "club" }, contact: null,
      expectedRevision: 0, requestId: "4c949181-39a8-4483-a3a4-ad781f3b7c61", expectedChildInstanceId: "a".repeat(64) };
    expect(emergencyWriteSchema.safeParse(input).success).toBe(true);
    for (const value of [undefined, null, "", "A".repeat(64), "a".repeat(63)])
      expect(emergencyWriteSchema.safeParse({ ...input, expectedChildInstanceId: value }).success).toBe(false);
    expect(emergencyWriteSchema.safeParse({ ...input, target: { kind: "self" } }).success).toBe(false);
  });
  it("rejects unbound child records and markers on adult records instead of treating them as empty", () => {
    const record = { kind: "self", subjectId: "subject", contact: null, revision: 1,
      lastActorUserId: "parent", createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
    expect(emergencyContactRecordSchema.safeParse(record).success).toBe(true);
    expect(emergencyContactRecordSchema.safeParse({ ...record, kind: "child" }).success).toBe(false);
    expect(emergencyContactRecordSchema.safeParse({ ...record, childInstanceId: "a".repeat(64) }).success).toBe(false);
    expect(emergencyContactRecordSchema.safeParse({ ...record, kind: "child", childInstanceId: "a".repeat(64) }).success).toBe(true);
  });
});
