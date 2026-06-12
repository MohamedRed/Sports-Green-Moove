import { Timestamp } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  normalizeRoleMap,
  roleKeysForRoleMap,
  stripLegacyRoleClaims,
  USER_ROLES,
} from "../domain/roles.js";
import type { UserRole } from "../domain/types.js";
import { auth, firestore } from "../lib/firebase.js";
import { requireAdmin, requireAuth } from "../lib/https.js";

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

function roleClaims(roleKeys: readonly UserRole[]): Record<string, unknown> {
  return { roleKeys: [...roleKeys] };
}

export const setUserRoles = onCall(async (request) => {
  requireAuth(request.auth?.uid);
  requireAdmin(request.auth?.token);

  const data = setUserRolesSchema.parse(request.data);
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
