import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  canRequestMembership,
  membershipDocumentId,
  membershipRequestData,
  membershipRequestStatus,
  type MembershipRecord,
} from "../domain/memberships.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth } from "../lib/https.js";

export const requestClubMembership = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const schema = z.object({
    clubId: z.string().min(1).max(120).regex(/^[A-Za-z0-9._-]+$/),
  });
  const { clubId } = schema.parse(request.data);
  const clubRef = firestore.collection("clubs").doc(clubId);
  const membershipRef = firestore.collection("memberships").doc(membershipDocumentId(uid, clubId));

  return firestore.runTransaction(async (transaction) => {
    const [clubSnap, membershipSnap] = await Promise.all([
      transaction.get(clubRef),
      transaction.get(membershipRef),
    ]);
    if (!clubSnap.exists) throw new HttpsError("not-found", "Club not found.");

    const club = clubSnap.data() as { status?: string } | undefined;
    if (club?.status === "archived" || club?.status === "private") {
      throw new HttpsError("failed-precondition", "This club is not open to membership requests.");
    }

    const existing = membershipSnap.data() as MembershipRecord | undefined;
    if (!canRequestMembership(existing)) {
      return {
        membershipId: membershipRef.id,
        clubId,
        status: membershipRequestStatus(existing),
        reused: true,
      };
    }

    transaction.set(membershipRef, membershipRequestData(uid, clubId), { merge: true });
    return {
      membershipId: membershipRef.id,
      clubId,
      status: "requested",
      reused: false,
    };
  });
});
