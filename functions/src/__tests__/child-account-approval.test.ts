import { describe, expect, it } from "vitest";
import { childAccountApprovalSchema, childAccountRequestSchema, childAccountCodeHash,
  childAccountCodeLifetimeMs } from "../domain/childAccountApproval.js";

describe("verified-parent child account approval inputs", () => {
  const input = { code: "a".repeat(32), childId: "profile", clubId: "club", expectedChildInstanceId: "b".repeat(64) };
  it("accepts only an opaque code and the explicit immutable child selection", () => {
    expect(childAccountApprovalSchema.parse(input)).toEqual(input);
    for (const patch of [{ accountUserId: "someone" }, { verifiedByUserId: "parent" }, { status: "verified" },
      { code: "123456" }, { code: "A".repeat(32) }, { childId: "../profile" }, { expectedChildInstanceId: "b".repeat(63) }])
      expect(childAccountApprovalSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  });
  it("never lets the requesting device select an account or grant a role", () => {
    expect(childAccountRequestSchema.safeParse({}).success).toBe(true);
    for (const input of [{ uid: "someone" }, { roleKeys: ["child"] }, { expiresAtMillis: 9999999999999 }])
      expect(childAccountRequestSchema.safeParse(input).success).toBe(false);
  });
  it("stores a one-way code fingerprint and bounds the pairing lifetime", () => {
    expect(childAccountCodeHash(input.code)).toMatch(/^[a-f0-9]{64}$/);
    expect(childAccountCodeHash(input.code)).not.toContain(input.code);
    expect(childAccountCodeHash(input.code)).not.toEqual(childAccountCodeHash("b".repeat(32)));
    expect(childAccountCodeLifetimeMs).toBe(600_000);
  });
});
