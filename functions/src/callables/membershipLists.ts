import { FieldPath } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { chatDocumentIdSchema } from "../domain/chatReference.js";
import { canReviewMembership, isActiveClubManager, membershipReviewSchema, membershipVersion } from "../domain/membershipReview.js";
import { firestore } from "../lib/firebase.js";
import { hasRole, requireAnyRole, requireAuth } from "../lib/https.js";
import { requireMembershipReviewer } from "../lib/membershipReviewAccess.js";
import { membershipPageCursor, parseMembershipPageCursor } from "../lib/membershipPageCursor.js";
import { parseCallableData } from "../lib/validation.js";

const pageInput = z.object({ cursor: z.string().min(1).max(2048).optional() }).strict();
export const listMembershipReviewClubs = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  requireAnyRole(request.auth?.token, ["admin", "clubManager"]);
  const { cursor } = parseCallableData(pageInput, request.data);
  const admin = hasRole(request.auth?.token, "admin");
  const scope = JSON.stringify([uid, "review-clubs", admin]);
  let query = admin ? firestore.collection("clubs").orderBy(FieldPath.documentId())
    : firestore.collection("memberships").where("userId", "==", uid).orderBy(FieldPath.documentId());
  if (cursor) query = query.startAfter(parseMembershipPageCursor(cursor, scope));
  const page = await query.limit(21).get();
  const scanned = page.docs.slice(0, 20);
  const items = [];
  for (const doc of scanned) {
    const clubId = admin ? doc.id : doc.get("clubId");
    if (!admin && (!chatDocumentIdSchema.safeParse(clubId).success || !isActiveClubManager(doc.data(), uid, clubId))) continue;
    const club = admin ? doc : await firestore.collection("clubs").doc(clubId).get();
    const name = club.get("name");
    if (!club.exists || typeof name !== "string" || !name.trim()) throw new HttpsError("failed-precondition", "Club requires repair.");
    items.push({ id: clubId as string, name });
  }
  return { items, nextCursor: page.size > 20 ? membershipPageCursor(scope, scanned.at(-1)!.id) : null };
});

export const listClubMemberships = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const { clubId, cursor } = parseCallableData(pageInput.extend({ clubId: chatDocumentIdSchema }), request.data);
  await requireMembershipReviewer(uid, request.auth?.token, clubId);
  const club = await firestore.collection("clubs").doc(clubId).get();
  if (!club.exists) throw new HttpsError("not-found", "Club not found.");
  const scope = JSON.stringify([uid, "club-memberships", clubId]);
  let query = firestore.collection("memberships").where("clubId", "==", clubId).orderBy(FieldPath.documentId());
  if (cursor) query = query.startAfter(parseMembershipPageCursor(cursor, scope));
  const page = await query.limit(21).get();
  const scanned = page.docs.slice(0, 20);
  const items = [];
  for (const doc of scanned) {
    const parsed = membershipReviewSchema.safeParse(doc.data());
    if (!parsed.success || !doc.updateTime) throw new HttpsError("failed-precondition", "Membership requires repair.");
    const member = parsed.data;
    const user = await firestore.collection(member.role === "child" ? "children" : "users").doc(member.userId).get();
    const displayName = user.get("displayName");
    const teamId = doc.get("teamId");
    const team = chatDocumentIdSchema.safeParse(teamId).success ? await firestore.collection("teams").doc(teamId).get() : null;
    const teamName = team?.get("clubId") === clubId && typeof team.get("name") === "string" ? team.get("name") : null;
    items.push({ id: doc.id, userId: member.userId, name: typeof displayName === "string" && displayName.trim() ? displayName : null,
      role: member.role, status: member.status, active: member.status === "active" && member.active !== false, teamName,
      requestVersion: membershipVersion(doc.updateTime), allowedActions: club.get("status") !== "archived" && canReviewMembership(member)
        ? ["approve", "reject"] : [], reviewedByUserId: doc.get("reviewedByUserId") ?? null });
  }
  return { items, nextCursor: page.size > 20 ? membershipPageCursor(scope, scanned.at(-1)!.id) : null };
});
