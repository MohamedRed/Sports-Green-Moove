import { describe, expect, it } from "vitest";
import { emergencyContactId, emergencyReadSchema, emergencyWriteSchema, personalContactSchema } from "../domain/emergencyContact.js";

describe("private emergency contact inputs", () => {
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
    expect(emergencyContactId("self", "same")).not.toBe(emergencyContactId("child", "same"));
  });
  it("accepts explicit removal but rejects unsafe revisions and extra fields", () => {
    const input = { target: { kind: "self" }, contact: null, expectedRevision: 2, requestId: "4c949181-39a8-4483-a3a4-ad781f3b7c61" };
    expect(emergencyWriteSchema.safeParse(input).success).toBe(true);
    for (const expectedRevision of [-1, 0.5, "2", Number.MAX_SAFE_INTEGER, Infinity])
      expect(emergencyWriteSchema.safeParse({ ...input, expectedRevision }).success).toBe(false);
    expect(emergencyWriteSchema.safeParse({ ...input, parentUserId: "other" }).success).toBe(false);
  });
});
