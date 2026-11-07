import { describe, expect, it } from "vitest";
import { assertInitializedChildRoleIntegrity as validate } from "../domain/initializedChildRoles.js";

const hash = "a".repeat(64);
describe("initialization cannot infer parent privileges from broken child roles", () => {
  it("preserves the existing ordinary adult signup policy", () => {
    expect(() => validate({}, undefined)).not.toThrow();
    expect(() => validate({ roleKeys: ["parent"] }, { roles: { parent: true } })).not.toThrow();
  });
  it("accepts complete invited and existing pre-invitation child identities", () => {
    expect(() => validate({ roleKeys: ["child"] }, { roles: { child: true } })).not.toThrow();
    expect(() => validate({ roleKeys: ["child"], childInvitationHash: hash }, { roles: { child: true }, childInvitationHash: hash })).not.toThrow();
  });
  it("rejects missing, empty, duplicated and unknown claims before the ordinary parent default can run", () => {
    for (const keys of [undefined, [], ["unknown"], ["child", "unknown"], ["child", "child"]])
      expect(() => validate({ roleKeys: keys }, { roles: { child: true } })).toThrow();
  });
  it("rejects inconsistent stored roles, missing profiles and mixed child/adult identities", () => {
    expect(() => validate({ roleKeys: ["child"] }, undefined)).toThrow();
    expect(() => validate({ roleKeys: ["parent"] }, { roles: { child: true } })).toThrow();
    expect(() => validate({ roleKeys: ["child", "parent"] }, { roles: { child: true, parent: true } })).toThrow();
  });
  it("requires intact invitation markers without changing a later explicit consistent administrator role decision", () => {
    for (const marker of [undefined, "short", "b".repeat(64)])
      expect(() => validate({ roleKeys: ["child"], childInvitationHash: marker }, { roles: { child: true }, childInvitationHash: hash })).toThrow();
    expect(() => validate({ roleKeys: ["parent"], childInvitationHash: hash }, { roles: { parent: true }, childInvitationHash: hash })).not.toThrow();
  });
});
