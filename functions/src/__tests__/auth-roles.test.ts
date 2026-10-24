import { HttpsError } from "firebase-functions/v2/https";
import { describe, expect, it } from "vitest";
import {
  defaultRoleKeysForClaims,
  initializedRoleClaims,
  normalizeRoleMap,
  roleMapForRoleKeys,
  roleKeysForRoleMap,
  roleKeysFromToken,
  stripLegacyRoleClaims,
} from "../domain/roles.js";
import { requireRole } from "../lib/https.js";

describe("auth role claims", () => {
  it("normalizes partial user role maps to the complete profile shape", () => {
    const roles = normalizeRoleMap({ driver: true, parent: true });

    expect(roles).toEqual({
      admin: false,
      child: false,
      clubManager: false,
      driver: true,
      parent: true,
    });
    expect(roleKeysForRoleMap(roles)).toEqual(["parent", "driver"]);
  });

  it("keeps only supported roles from auth tokens", () => {
    expect(roleKeysFromToken({ roleKeys: ["admin", "unknown", "parent", "admin"] })).toEqual(["admin", "parent"]);
    expect(roleKeysFromToken({ roleKeys: "admin" })).toEqual([]);
  });

  it("initializes new public accounts with the parent role only", () => {
    expect(defaultRoleKeysForClaims(undefined)).toEqual(["parent"]);
    expect(roleMapForRoleKeys(["parent"])).toEqual({
      admin: false,
      child: false,
      clubManager: false,
      driver: false,
      parent: true,
    });
  });

  it("preserves existing role claims during profile initialization", () => {
    expect(defaultRoleKeysForClaims({ roleKeys: ["driver", "parent"] })).toEqual(["driver", "parent"]);
    expect(initializedRoleClaims({
      emailVerified: true,
      roleKeys: ["driver"],
      roles: { driver: true },
      driver: true,
    })).toEqual({
      emailVerified: true,
      roleKeys: ["driver"],
    });
  });

  it("removes legacy role claims before writing new custom claims", () => {
    expect(stripLegacyRoleClaims({
      admin: true,
      clubManager: false,
      emailVerified: true,
      roleKeys: ["admin"],
      roles: { admin: true },
    })).toEqual({ emailVerified: true });
  });

  it("throws a callable permission error when a role is missing", () => {
    expect(() => requireRole({ roleKeys: ["parent"] }, "admin")).toThrow(HttpsError);
    expect(() => requireRole({ roleKeys: ["parent"] }, "admin")).toThrow("admin role is required");
  });
});
