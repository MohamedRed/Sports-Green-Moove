import type { UserRole } from "./types.js";

export const USER_ROLES: readonly UserRole[] = [
  "parent",
  "driver",
  "child",
  "clubManager",
  "admin",
];

export type UserRoleMap = Record<UserRole, boolean>;

export function emptyRoleMap(): UserRoleMap {
  return {
    admin: false,
    child: false,
    clubManager: false,
    driver: false,
    parent: false,
  };
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

export function normalizeRoleMap(input: Partial<Record<UserRole, unknown>>): UserRoleMap {
  const roles = emptyRoleMap();
  for (const role of USER_ROLES) {
    roles[role] = input[role] === true;
  }
  return roles;
}

export function roleKeysForRoleMap(roles: UserRoleMap): UserRole[] {
  return USER_ROLES.filter((role) => roles[role]);
}

export function roleMapForRoleKeys(roleKeys: readonly UserRole[]): UserRoleMap {
  const roles = emptyRoleMap();
  for (const role of roleKeys) {
    roles[role] = true;
  }
  return roles;
}

export function roleKeysFromToken(token: unknown): UserRole[] {
  if (!token || typeof token !== "object") return [];
  const roleKeys = (token as { roleKeys?: unknown }).roleKeys;
  if (!Array.isArray(roleKeys)) return [];

  return [...new Set(roleKeys.filter(isUserRole))];
}

export function defaultRoleKeysForClaims(claims: Record<string, unknown> | undefined): UserRole[] {
  const currentRoleKeys = roleKeysFromToken(claims);
  return currentRoleKeys.length > 0 ? currentRoleKeys : ["parent"];
}

export function initializedRoleClaims(claims: Record<string, unknown> | undefined): Record<string, unknown> {
  return {
    ...stripLegacyRoleClaims(claims ?? {}),
    roleKeys: defaultRoleKeysForClaims(claims),
  };
}

export function stripLegacyRoleClaims(claims: Record<string, unknown>): Record<string, unknown> {
  const nextClaims = { ...claims };
  delete nextClaims.roles;
  delete nextClaims.roleKeys;
  for (const role of USER_ROLES) {
    delete nextClaims[role];
  }
  return nextClaims;
}
