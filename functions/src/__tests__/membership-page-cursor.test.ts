import { describe, expect, it } from "vitest";
import { membershipDocumentId } from "../domain/memberships.js";
import { membershipPageCursor, parseMembershipPageCursor } from "../lib/membershipPageCursor.js";

describe("opaque membership cursor document identities", () => {
  const scope = JSON.stringify(["isolated-parent", "team-enrollment-options", "clubs", null]);
  it("round trips a canonical combined membership ID longer than an individual entity ID", () => {
    const id = membershipDocumentId("isolated-parent", "c".repeat(256));
    expect(id.length).toBe(272);
    expect(parseMembershipPageCursor(membershipPageCursor(scope, id), scope)).toBe(id);
  });
  it("retains long multibyte IDs and escaped control characters without truncating either scope or identity", () => {
    for (const id of ["界".repeat(500), "\u0001".repeat(1500)]) {
      const wideScope = JSON.stringify(["\u0002".repeat(128), "club-memberships", "\u0003".repeat(256)]);
      const encoded = membershipPageCursor(wideScope, id);
      expect(encoded.length).toBeGreaterThan(2048);
      expect(parseMembershipPageCursor(encoded, wideScope)).toBe(id);
    }
  });
  it("refuses invalid document IDs and byte limits before emitting an unusable cursor", () => {
    for (const id of ["", ".", "..", "users/other", "__reserved__", "a".repeat(1501), "界".repeat(501), "\ud800"])
      expect(() => membershipPageCursor(scope, id)).toThrow();
  });
  it("preserves version-one cursors and current account/list authorization", () => {
    const encoded = Buffer.from(JSON.stringify({ version: 1, scope, id: "existing" })).toString("base64url");
    expect(parseMembershipPageCursor(encoded, scope)).toBe("existing");
    expect(() => parseMembershipPageCursor(encoded, scope + "other")).toThrow("another list");
  });
  it("rejects malformed UTF-8 rather than replacing bytes in the selected identity", () => {
    const encoded = Buffer.concat([Buffer.from('{"version":1,"scope":"scope","id":"a'), Buffer.from([0xff]), Buffer.from('"}')]).toString("base64url");
    expect(() => parseMembershipPageCursor(encoded, "scope")).toThrow("Invalid membership cursor");
  });
  it("rejects unknown format fields, noncanonical base64 and oversized cursor envelopes", () => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    for (const encoded of [encode({ version: 2, scope, id: "a" }), encode({ version: 1, scope, id: "a", extra: true }),
      encode({ version: 1, scope, id: "a" }) + "=", "a".repeat(16_385)])
      expect(() => parseMembershipPageCursor(encoded, scope)).toThrow("Invalid membership cursor");
  });
});
