import { describe, expect, it } from "vitest";
import { childInvitationTargetSchema, invitationHash, invitationOwnerId, invitationUrl,
  redeemChildInvitationSchema, redemptionDigest } from "../domain/childInvitation.js";

const token = "a".repeat(64), password = "a-local-test-password";
describe("parent-shared child invitation boundaries", () => {
  it("places only a random secret in the fragment of the approved HTTPS host", () => {
    const url = new URL(invitationUrl(token));
    expect(url.origin).toBe("https://sports-green-moove-prod.web.app");
    expect(url.pathname).toBe("/child-invitation"); expect(url.search).toBe(""); expect(url.hash).toBe("#" + token);
    expect(() => invitationUrl("short")).toThrow();
  });
  it("does not accept a client-selected account, role or parent", () => {
    const target = { childId: "child-one", clubId: "club-one", expectedChildInstanceId: token };
    expect(childInvitationTargetSchema.parse(target)).toEqual(target);
    for (const extra of [{ parentUserId: "other" }, { roleKeys: ["admin"] }, { accountUserId: "chosen" }])
      expect(childInvitationTargetSchema.safeParse({ ...target, ...extra }).success).toBe(false);
  });
  it("binds retries to normalized email and the original password without a stored key", () => {
    const input = redeemChildInvitationSchema.parse({ token, email: "CHILD@example.test", password });
    expect(input.email).toBe("child@example.test"); expect(redemptionDigest(input)).toMatch(/^[a-f0-9]{64}$/);
    expect(redemptionDigest(input)).not.toContain(password);
    expect(redemptionDigest(input)).not.toBe(redemptionDigest({ ...input, token: "b".repeat(64) }));
    expect(redemptionDigest(input)).not.toBe(redemptionDigest({ ...input, password: password + "different" }));
    expect(invitationOwnerId("child-one", token)).not.toBe(invitationOwnerId("child-two", token));
    expect(invitationHash(token)).not.toBe(token);
  });
  it("rejects weak, oversized and malformed signup inputs without accepting extra claims", () => {
    const input = { token, email: "child@example.test", password };
    for (const patch of [{ password: "short" }, { password: "x".repeat(129) }, { email: "not-an-email" },
      { token: "x".repeat(64) }, { roles: { parent: true } }, { accountUserId: "chosen" }])
      expect(redeemChildInvitationSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  });
});
