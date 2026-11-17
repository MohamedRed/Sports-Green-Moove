import { FieldPath, Filter, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { chatDocumentIdSchema as documentId } from "../domain/chatReference.js";
import { reservationActions, reservationSchema } from "../domain/reservations.js";
import type { Trip } from "../domain/types.js";
import { toClientBookingRequestSummary } from "../lib/clientBookings.js";
import { directoryCursor, parseDirectoryCursor } from "../lib/chatDirectoryCursor.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth, requireRole } from "../lib/https.js";
import { createBookingNotifications } from "../lib/bookingNotifications.js";
import { parseCallableData } from "../lib/validation.js";

const listInput = z.object({ role: z.enum(["parent", "driver"]), cursor: z.string().min(1).max(2048).optional() });
const declineInput = z.object({ bookingId: documentId });

export const listReservations = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const input = parseCallableData(listInput, request.data);
  requireRole(request.auth?.token, input.role);
  const kind = input.role === "parent" ? "parent-reservations" : "driver-reservations";
  const filter = input.role === "driver" ? Filter.where("driverUserId", "==", uid)
    : Filter.or(Filter.where("parentUserId", "==", uid), Filter.where("requesterUserId", "==", uid));
  let query = firestore.collection("bookings").where(filter)
    .orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");
  if (input.cursor) query = query.startAfter(...parseDirectoryCursor(input.cursor, kind, uid));
  const snapshot = await query.limit(21).get();
  const scanned = snapshot.docs.slice(0, 20);
  const items = [];
  const proposals = new Map<string, FirebaseFirestore.DocumentData | undefined>();
  for (const doc of scanned) {
    const parsed = reservationSchema.safeParse(doc.data());
    if (!parsed.success || !(doc.get("createdAt") instanceof Timestamp)) {
      throw new HttpsError("failed-precondition", "Reservation data requires repair.");
    }
    const booking = { ...parsed.data, id: doc.id };
    const owner = input.role === "driver" ? booking.driverUserId : booking.parentUserId ?? booking.requesterUserId;
    if (owner !== uid) continue;
    const tripSnap = await firestore.collection("trips").doc(booking.tripId).get();
    if (!tripSnap.exists) throw new HttpsError("failed-precondition", "Reservation trip requires repair.");
    const trip = { ...tripSnap.data(), id: tripSnap.id } as Trip;
    const ride = trip.activeRideSessionId
      ? (await firestore.collection("rideSessions").doc(trip.activeRideSessionId).get()).data() : undefined;
    const proposalId = trip.pendingChangeId ?? trip.appliedChangeId;
    if (proposalId != null && (typeof proposalId !== "string" || !/^[a-f0-9]{64}$/.test(proposalId)))
      throw new HttpsError("failed-precondition", "Trip change reference requires repair.");
    if (proposalId && !proposals.has(proposalId))
      proposals.set(proposalId, (await firestore.collection("tripChanges").doc(proposalId).get()).data());
    const proposal = proposalId ? proposals.get(proposalId) : undefined;
    const canReviewChange = proposal?.tripId === booking.tripId && proposal.driverUserId === trip.driverUserId &&
      Array.isArray(proposal.bookingIds) && proposal.bookingIds.includes(booking.id) &&
      (input.role === "driver" || (Array.isArray(proposal.parentUserIds) && proposal.parentUserIds.includes(uid)));
    items.push({ ...toClientBookingRequestSummary(booking, trip),
      allowedActions: reservationActions(uid, input.role, booking, trip, ride),
      refundPending: booking.refundStatus === "pending", tripChangeId: canReviewChange ? proposalId : null });
  }
  const last = scanned.at(-1);
  return { items, nextCursor: snapshot.size > 20 && last
    ? directoryCursor(kind, uid, last.get("createdAt"), last.id) : null };
});

export const declineBooking = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  requireRole(request.auth?.token, "driver");
  const { bookingId } = parseCallableData(declineInput, request.data);
  const ref = firestore.collection("bookings").doc(bookingId);
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "Booking not found.");
    const parsed = reservationSchema.safeParse(snapshot.data());
    if (!parsed.success) throw new HttpsError("failed-precondition", "Reservation data requires repair.");
    const booking = { ...parsed.data, id: snapshot.id };
    if (booking.driverUserId !== uid) throw new HttpsError("permission-denied", "Only this booking's driver can decline it.");
    const tripSnap = await transaction.get(firestore.collection("trips").doc(booking.tripId));
    if (!tripSnap.exists) throw new HttpsError("failed-precondition", "Booking trip is missing.");
    const trip = { ...tripSnap.data(), id: tripSnap.id } as Trip;
    if (trip.driverUserId !== uid) throw new HttpsError("permission-denied", "Only the trip driver can decline.");
    if (!reservationActions(uid, "driver", booking, trip, undefined).includes("decline")) {
      throw new HttpsError("failed-precondition", "Only a pending booking on an open trip can be declined.");
    }
    const now = Timestamp.now();
    transaction.update(ref, { status: "declined", declinedAt: now, declinedByUserId: uid, updatedAt: now });
    const parent = booking.parentUserId ?? booking.requesterUserId;
    createBookingNotifications(transaction, parent ? [parent] : [], {
      type: "bookingDeclined", title: "Demande refusée",
      body: `${toClientBookingRequestSummary(booking, trip).title} : demande refusée par le conducteur.`, sourceId: bookingId,
    });
  });
  return { bookingId, status: "declined" };
});
