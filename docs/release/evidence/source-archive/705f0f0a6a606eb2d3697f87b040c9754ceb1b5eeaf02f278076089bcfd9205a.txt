import { HttpsError } from "firebase-functions/v2/https";
import { roleKeysFromToken } from "../domain/roles.js";
import type { UserRole } from "../domain/types.js";

export function requireAuth(uid: string | undefined): string {
  if (!uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  return uid;
}

export function hasRole(token: unknown, role: UserRole): boolean {
  return roleKeysFromToken(token).includes(role);
}

export function requireRole(token: unknown, role: UserRole): void {
  if (!hasRole(token, role)) {
    throw new HttpsError("permission-denied", `${role} role is required.`);
  }
}

export function requireAnyRole(token: unknown, roles: readonly UserRole[]): void {
  const tokenRoles = roleKeysFromToken(token);
  if (!roles.some((role) => tokenRoles.includes(role))) {
    throw new HttpsError("permission-denied", `${roles.join(" or ")} role is required.`);
  }
}

export function requireAdmin(token: unknown): void {
  requireRole(token, "admin");
}
