import { Timestamp } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  defaultRoleKeysForClaims,
  initializedRoleClaims,
  normalizeRoleMap,
  roleMapForRoleKeys,
  roleKeysForRoleMap,
  stripLegacyRoleClaims,
  USER_ROLES,
} from "../domain/roles.js";
import type { UserRole } from "../domain/types.js";
import { auth, firestore } from "../lib/firebase.js";
import { requireAdmin, requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";

const roleMapSchema = z.object({
  admin: z.boolean().optional(),
  child: z.boolean().optional(),
  clubManager: z.boolean().optional(),
  driver: z.boolean().optional(),
  parent: z.boolean().optional(),
}).strict();

const setUserRolesSchema = z.object({
  userId: z.string().min(1),
  roles: roleMapSchema,
});

const initializeUserProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(160).optional(),
}).strict();

function roleClaims(roleKeys: readonly UserRole[]): Record<string, unknown> {
  return { roleKeys: [...roleKeys] };
}

export const initializeUserProfile = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const data = parseCallableData(initializeUserProfileSchema, request.data ?? {});
  const user = await auth.getUser(uid);
  const currentClaims = user.customClaims ?? {};
  const roleKeys = defaultRoleKeysForClaims(currentClaims);
  const rawRoleKeys = currentClaims.roleKeys;
  const hasLegacyClaims = "roles" in currentClaims || USER_ROLES.some((role) => role in currentClaims);
  const needsClaimWrite = hasLegacyClaims ||
    !Array.isArray(rawRoleKeys) ||
    rawRoleKeys.length !== roleKeys.length ||
    roleKeys.some((role, index) => rawRoleKeys[index] !== role);

  if (needsClaimWrite) {
    await auth.setCustomUserClaims(uid, initializedRoleClaims(currentClaims));
  }

  const profileRef = firestore.collection("users").doc(uid);
  const profile = await profileRef.get();
  const now = Timestamp.now();
  const profileData: Record<string, unknown> = {
    email: user.email ?? request.auth?.token.email ?? null,
    roles: roleMapForRoleKeys(roleKeys),
    updatedAt: now,
  };
  const existingProfile = profile.data() ?? {};
  const existingDisplayName = existingProfile.displayName as string | undefined;
  const displayName = data.displayName ?? user.displayName ?? existingDisplayName;
  if (displayName) profileData.displayName = displayName;
  if (!profile.exists) profileData.createdAt = now;

  await profileRef.set(profileData, { merge: true });

  return {
    userId: uid,
    displayName: displayName ?? null,
    email: user.email ?? request.auth?.token.email ?? null,
    roles: roleMapForRoleKeys(roleKeys),
    roleKeys,
  };
});

export const setUserRoles = onCall(async (request) => {
  requireAuth(request.auth?.uid);
  requireAdmin(request.auth?.token);

  const data = parseCallableData(setUserRolesSchema, request.data);
  const roles = normalizeRoleMap(data.roles);
  const roleKeys = roleKeysForRoleMap(roles);
  const user = await auth.getUser(data.userId);
  const preservedClaims = stripLegacyRoleClaims(user.customClaims ?? {});

  await auth.setCustomUserClaims(data.userId, {
    ...preservedClaims,
    ...roleClaims(roleKeys),
  });

  await firestore.collection("users").doc(data.userId).set(
    {
      roles,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  return {
    userId: data.userId,
    roles,
    roleKeys,
    supportedRoles: USER_ROLES,
  };
});
