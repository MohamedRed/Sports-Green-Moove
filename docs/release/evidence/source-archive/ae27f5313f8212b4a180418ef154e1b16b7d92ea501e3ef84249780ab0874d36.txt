import { HttpsError } from "firebase-functions/v2/https";
import { roleKeysFromToken, USER_ROLES } from "./roles.js";

export function assertInitializedChildRoleIntegrity(claims: Record<string, unknown>, profile: Record<string, unknown> | undefined) {
  const flags = profile?.roles as Record<string, unknown> | undefined;
  const keys = claims.roleKeys;
  const marked = claims.childInvitationHash !== undefined || profile?.childInvitationHash !== undefined;
  const childContext = marked || flags?.child === true || Array.isArray(keys) && keys.includes("child");
  if (!childContext) return;
  const roles = roleKeysFromToken(claims);
  const invalid = !Array.isArray(keys) || keys.length === 0 || keys.length !== roles.length ||
    !flags || typeof flags !== "object" || Array.isArray(flags) ||
    USER_ROLES.some(role => (flags[role] === true) !== roles.includes(role)) ||
    roles.includes("child") && roles.length !== 1;
  const invalidMarker = marked && (typeof claims.childInvitationHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(claims.childInvitationHash) || claims.childInvitationHash !== profile?.childInvitationHash);
  if (invalid || invalidMarker) throw new HttpsError("failed-precondition", "Child account role integrity requires review.");
}
