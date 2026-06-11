import { HttpsError } from "firebase-functions/v2/https";

export function requireAuth(uid: string | undefined): string {
  if (!uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  return uid;
}
