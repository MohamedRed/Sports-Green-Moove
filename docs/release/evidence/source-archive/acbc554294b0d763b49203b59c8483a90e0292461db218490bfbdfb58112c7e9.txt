import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { teamPushInstallationId, teamPushRegistrationSchema, teamPushRegistrationFingerprint,
  teamPushRegistrationRecordSchema, teamPushSecretHash, teamPushTokenId } from "../domain/teamPushRegistration.js";

const input = { installationId: "11223344-1234-4234-8234-123456789abc", installationSecret: "a".repeat(64),
  revision: 1, platform: "android" as const, token: "synthetic_" + "T".repeat(80) };
describe("private account-bound device registration", () => {
  it("canonicalizes installation identity and keeps opaque token/proof material out of document IDs", () => {
    expect(teamPushRegistrationSchema.parse({ ...input, installationId: input.installationId.toUpperCase() })).toEqual(input);
    for (const id of [teamPushInstallationId(input.installationId), teamPushSecretHash(input.installationSecret), teamPushTokenId(input.token)])
      expect(id).toMatch(/^[a-f0-9]{64}$/);
    expect(new Set([teamPushInstallationId(input.installationId), teamPushSecretHash(input.installationSecret), teamPushTokenId(input.token)]).size).toBe(3);
  });
  it("binds retry identity to the authenticated user, revision, platform and exact token", () => {
    const hash = teamPushRegistrationFingerprint("parent", input);
    expect(teamPushRegistrationFingerprint("parent", { ...input })).toBe(hash);
    for (const value of [{ ...input, revision: 2 }, { ...input, token: null }, { ...input, token: input.token + "b" }])
      expect(teamPushRegistrationFingerprint("parent", value)).not.toBe(hash);
    expect(teamPushRegistrationFingerprint("other", input)).not.toBe(hash);
  });
  for (const change of [{ userId: "other" }, { installationId: "../other" }, { installationSecret: "a" },
    { installationSecret: "A".repeat(64) }, { revision: 0 }, { revision: 1.5 }, { revision: Number.MAX_SAFE_INTEGER },
    { platform: "ios" }, { token: "short" }, { token: "T".repeat(4097) }, { token: "T".repeat(40) + "\n" }, { token: undefined }])
    it("rejects malformed registration fields " + Object.keys(change)[0], () => {
      expect(teamPushRegistrationSchema.safeParse({ ...input, ...change }).success).toBe(false);
    });
  it("accepts explicit removal but never a mismatched active/token or uncommitted timestamp", () => {
    expect(teamPushRegistrationSchema.parse({ ...input, token: null }).token).toBeNull();
    const record = { schemaVersion: 1, userId: "parent", platform: "android", secretHash: teamPushSecretHash(input.installationSecret),
      revision: 1, fingerprint: teamPushRegistrationFingerprint("parent", input), active: true, token: input.token,
      createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
    expect(teamPushRegistrationRecordSchema.safeParse(record).success).toBe(true);
    for (const change of [{ active: false }, { token: null }, { updatedAt: null }, { installationSecret: input.installationSecret }])
      expect(teamPushRegistrationRecordSchema.safeParse({ ...record, ...change }).success).toBe(false);
  });
});
