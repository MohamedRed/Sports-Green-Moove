import { Timestamp } from "firebase-admin/firestore";
import { type CallableRequest, HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { transitionPassenger } from "../domain/passengerTransition.js";
import { manualPassengerAuditEvent, manualPassengerAuditEventId } from "../domain/rideAudit.js";
import type { RideSessionDocument } from "../lib/activeRideLookup.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth, requireRole } from "../lib/https.js";
import { notifyUsers } from "../lib/notifications.js";
import { parseCallableData } from "../lib/validation.js";

type BookingPassengerRecord = {
  childId?: string;
  driverUserId: string;
  parentUserId?: string;
  requesterUserId?: string;
  status?: string;
  tripId?: string;
};

async function markPassengerStatus(request: CallableRequest, event: "pickup" | "dropoff") {
  const uid = requireAuth(request.auth?.uid);
  requireRole(request.auth?.token, "driver");
  const schema = z.object({
    rideSessionId: z.string(), bookingId: z.string(), childId: z.string(),
    note: z.string().max(300).optional(),
  });
  const data = parseCallableData(schema, request.data);
  const rideRef = firestore.collection("rideSessions").doc(data.rideSessionId);
  const bookingRef = firestore.collection("bookings").doc(data.bookingId);

  const parentUserId = await firestore.runTransaction(async (transaction) => {
    const [rideSnap, bookingSnap] = await Promise.all([transaction.get(rideRef), transaction.get(bookingRef)]);
    if (!rideSnap.exists) throw new HttpsError("not-found", "Ride session not found.");
    if (!bookingSnap.exists) throw new HttpsError("not-found", "Booking not found.");
    const ride = rideSnap.data() as RideSessionDocument;
    const booking = bookingSnap.data() as BookingPassengerRecord;
    if (ride.driverUserId !== uid || booking.driverUserId !== uid) {
      throw new HttpsError("permission-denied", "Only the ride driver can update passenger status.");
    }
    if (booking.status !== "approved" || ride.status !== "active") {
      throw new HttpsError("failed-precondition", "Passenger confirmation requires an active ride and approved booking.");
    }
    if (!ride.bookingIds?.includes(data.bookingId) || !ride.tripId || booking.tripId !== ride.tripId) {
      throw new HttpsError("failed-precondition", "Booking is not attached to this ride and trip.");
    }
    if ((booking.childId ?? data.bookingId) !== data.childId) {
      throw new HttpsError("failed-precondition", "Child does not match the booking.");
    }
    const transition = transitionPassenger(ride.passengers ?? [], data.bookingId, data.childId, event);
    if (!transition.ok) throw new HttpsError("failed-precondition", transition.message);
    const now = Timestamp.now();
    const auditEvent = manualPassengerAuditEvent({ event, bookingId: data.bookingId, childId: data.childId,
      driverUserId: uid, note: data.note, recordedAt: now });
    const statusUpdate = event === "pickup"
      ? { pickupStatus: "pickedUp", pickedUpAt: now, pickupNote: data.note ?? null }
      : { dropoffStatus: "droppedOff", droppedOffAt: now, dropoffNote: data.note ?? null };
    transaction.set(rideRef, {
      passengers: transition.passengers,
      passengerStatuses: { [data.bookingId]: { ...statusUpdate, bookingId: data.bookingId,
        updatedByUserId: uid, updatedAt: now } },
      updatedAt: now,
    }, { merge: true });
    transaction.set(bookingRef, { ...statusUpdate, updatedAt: now }, { merge: true });
    transaction.create(rideRef.collection("auditEvents").doc(manualPassengerAuditEventId(event, data.bookingId, data.childId)), auditEvent);
    return booking.parentUserId ?? booking.requesterUserId;
  });
  await notifyUsers(parentUserId ? [parentUserId] : [], {
    type: event === "pickup" ? "passengerPickedUp" : "passengerDroppedOff",
    title: event === "pickup" ? "Enfant récupéré" : "Enfant déposé",
    body: event === "pickup" ? "Le conducteur a confirmé le pickup." : "Le conducteur a confirmé le dropoff.",
    sourceId: data.rideSessionId,
  });
  return { rideSessionId: data.rideSessionId, bookingId: data.bookingId, childId: data.childId, status: event };
}

export const markPickup = onCall((request) => markPassengerStatus(request, "pickup"));
export const markDropoff = onCall((request) => markPassengerStatus(request, "dropoff"));
