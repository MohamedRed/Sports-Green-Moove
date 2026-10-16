import { Timestamp, type DocumentData, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { chatDocumentIdSchema as documentId } from "../domain/chatReference.js";
import { reservationSchema } from "../domain/reservations.js";
import { tripChangeHash, tripChangeSourceData, tripChangeTermsSchema } from "../domain/tripChanges.js";
import { firestore } from "../lib/firebase.js";

export const tripChangeLimit = 100;
export const changeDecisionRecordSchema = z.object({ requestId: z.uuid(), decision: z.enum(["accept", "decline"]),
  decidedAt: z.instanceof(Timestamp) }).strict();
export const storedTripChangeSchema = z.object({
  tripId: documentId, driverUserId: documentId, requestId: z.uuid(), expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
  revision: z.string().regex(/^[a-f0-9]{64}$/), originalTerms: tripChangeTermsSchema, terms: tripChangeTermsSchema,
  bookingIds: z.array(documentId).max(tripChangeLimit), parentUserIds: z.array(documentId).max(tripChangeLimit),
  status: z.enum(["pending", "confirmed", "declined", "withdrawn", "cancelled"]),
  decisions: z.record(documentId, changeDecisionRecordSchema), createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp), withdrawalRequestId: z.uuid().optional(),
}).strict();
export type StoredTripChange = z.infer<typeof storedTripChangeSchema>;
const tripSchema = z.object({ driverUserId: documentId, status: z.string(),
  seatsTotal: z.number().int().min(1).max(8), seatsAvailable: z.number().int().min(0).max(8),
  activeRideSessionId: documentId.nullish(), pendingChangeId: z.string().regex(/^[a-f0-9]{64}$/).nullish(),
}).refine((trip) => trip.seatsAvailable <= trip.seatsTotal);
export function changePrecondition(message: string): never { throw new HttpsError("failed-precondition", message); }

export async function loadTripChangeState(transaction: Transaction, tripId: string) {
  const tripRef = firestore.collection("trips").doc(tripId), snapshot = await transaction.get(tripRef);
  if (!snapshot.exists) throw new HttpsError("not-found", "Trip not found.");
  const data = snapshot.data()!;
  const parsed = tripSchema.safeParse(data), terms = tripChangeTermsSchema.safeParse({
    departureAt: data.departureAt, arrivalBy: data.arrivalBy ?? null,
    origin: data.origin, destination: data.destination, priceCents: data.priceCents });
  if (!parsed.success || !terms.success) changePrecondition("Trip metadata must be reconciled before editing.");
  const trip = parsed.data;
  const activeRides = await transaction.get(firestore.collection("rideSessions")
    .where("tripId", "==", tripId).where("status", "==", "active").limit(1));
  const bookings = await transaction.get(firestore.collection("bookings").where("tripId", "==", tripId)
    .where("status", "in", ["requested", "approved"]).limit(tripChangeLimit + 1));
  if (bookings.size > tripChangeLimit) throw new HttpsError("resource-exhausted", "Too many reservations for an atomic change proposal.");
  const items = bookings.docs.map((doc) => {
    const booking = reservationSchema.safeParse(doc.data());
    if (!booking.success || booking.data.driverUserId !== trip.driverUserId || booking.data.tripId !== tripId ||
        (booking.data.parentUserId && booking.data.requesterUserId && booking.data.parentUserId !== booking.data.requesterUserId)) {
      changePrecondition("Reservation ownership or seat metadata must be reconciled before editing.");
    }
    return { snapshot: doc, booking: booking.data, parentUserId: (booking.data.parentUserId ?? booking.data.requesterUserId)! };
  });
  if (items.reduce((sum, item) => sum + (item.booking.status === "approved" ? item.booking.seats : 0), trip.seatsAvailable) > trip.seatsTotal)
    changePrecondition("Reserved seats exceed trip capacity.");
  const childIds = [...new Set(items.flatMap((item) => item.booking.childId ? [item.booking.childId] : []))].sort();
  const children = childIds.length ? await transaction.getAll(...childIds.map((id) => firestore.collection("children").doc(id))) : [];
  const revision = tripChangeHash([tripChangeSourceData(data), items.map((item) =>
    [item.snapshot.id, item.snapshot.updateTime]).sort(([a], [b]) => String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0),
  children.map((child) => [child.id, child.exists ? child.updateTime : null])]);
  return { tripId, tripRef, trip, terms: terms.data, items, revision,
    available: ["published", "full"].includes(trip.status) && Date.parse(terms.data.departureAt) > Date.now() &&
      !trip.activeRideSessionId && activeRides.empty };
}
export type TripChangeState = Awaited<ReturnType<typeof loadTripChangeState>>;

export async function loadStoredTripChange(transaction: Transaction, tripId: string, proposalId: string) {
  const ref = firestore.collection("tripChanges").doc(proposalId), snapshot = await transaction.get(ref);
  if (!snapshot.exists) throw new HttpsError("not-found", "Trip change proposal not found.");
  const parsed = storedTripChangeSchema.safeParse(snapshot.data());
  if (!parsed.success || parsed.data.tripId !== tripId) changePrecondition("Trip change record must be reconciled.");
  const change = parsed.data;
  if (tripChangeHash([tripId, change.driverUserId, change.requestId]) !== proposalId ||
      tripChangeHash([proposalId, change.expectedRevision, change.terms]) !== change.revision ||
      new Set(change.bookingIds).size !== change.bookingIds.length || new Set(change.parentUserIds).size !== change.parentUserIds.length ||
      Object.keys(change.decisions).some((id) => !change.parentUserIds.includes(id)))
    changePrecondition("Trip change identity or parent decisions must be reconciled.");
  const votes = Object.values(change.decisions), allAccepted = change.parentUserIds.every((id) =>
    Object.hasOwn(change.decisions, id) && change.decisions[id].decision === "accept");
  if ((change.status === "confirmed" && !allAccepted) || (change.status === "pending" && (allAccepted || votes.some((vote) => vote.decision === "decline"))) ||
      (change.status === "declined" && !votes.some((vote) => vote.decision === "decline")))
    changePrecondition("Trip change status conflicts with its recorded decisions.");
  return { ref, change };
}

export function requireTripChangeDriver(data: DocumentData | undefined, uid: string) {
  if (data?.driverUserId !== uid) throw new HttpsError("permission-denied", "Only the owning driver can propose or withdraw changes.");
}

export async function requireTripChangeReader(transaction: Transaction, state: TripChangeState, change: StoredTripChange, uid: string) {
  if (state.trip.driverUserId === uid && change.driverUserId === uid) return { role: "driver" as const, bookingIds: change.bookingIds };
  if (!change.parentUserIds.includes(uid)) throw new HttpsError("permission-denied", "Only an affected parent can review this proposal.");
  const bookings = change.bookingIds.length ? await transaction.getAll(...change.bookingIds.map((id) => firestore.collection("bookings").doc(id))) : [];
  const own = bookings.filter((snapshot) => {
    const data = snapshot.data();
    return data?.tripId === change.tripId && data.driverUserId === change.driverUserId &&
      !(data.parentUserId && data.requesterUserId && data.parentUserId !== data.requesterUserId) &&
      (data.parentUserId ?? data.requesterUserId) === uid;
  });
  if (!change.parentUserIds.includes(uid) || own.length === 0) throw new HttpsError("permission-denied", "Only an affected parent can review this proposal.");
  for (const item of own) {
    const booking = item.data()!;
    if (booking.childId) {
      if (typeof booking.childId !== "string" || !documentId.safeParse(booking.childId).success)
        changePrecondition("Reservation child metadata must be reconciled.");
      const child = await transaction.get(firestore.collection("children").doc(booking.childId));
      const guardians: unknown = child.data()?.guardianUserIds;
      if (!Array.isArray(guardians) || !guardians.includes(uid)) throw new HttpsError("permission-denied", "Current guardian authority is required.");
    }
  }
  return { role: "parent" as const, bookingIds: own.map((item) => item.id).sort() };
}

export function changeStillCurrent(state: TripChangeState, change: StoredTripChange, proposalId: string) {
  return state.available && Date.parse(change.terms.departureAt) > Date.now() &&
    state.trip.driverUserId === change.driverUserId && state.trip.pendingChangeId === proposalId &&
    state.revision === change.expectedRevision && tripChangeHash(state.terms) === tripChangeHash(change.originalTerms) &&
    tripChangeHash(state.items.map((item) => item.snapshot.id).sort()) === tripChangeHash([...change.bookingIds].sort()) &&
    tripChangeHash([...new Set(state.items.map((item) => item.parentUserId))].sort()) === tripChangeHash([...change.parentUserIds].sort());
}

export function tripChangeView(state: TripChangeState, change: StoredTripChange, proposalId: string, uid: string,
  ownBookingIds: string[] = []) {
  const driver = state.trip.driverUserId === uid && change.driverUserId === uid;
  const current = changeStillCurrent(state, change, proposalId);
  const open = ["pending", "confirmed"].includes(change.status);
  return { tripId: change.tripId, proposalId, revision: change.revision,
    status: open && !current ? "outdated" : change.status,
    originalTerms: change.originalTerms, terms: change.terms,
    currentTerms: state.terms, parentCount: change.parentUserIds.length,
    acceptedParentCount: Object.values(change.decisions).filter((item) => item.decision === "accept").length,
    decision: Object.hasOwn(change.decisions, uid) ? change.decisions[uid].decision : null,
    bookingIds: driver ? change.bookingIds : ownBookingIds,
    canRespond: !driver && current && change.status === "pending" && !Object.hasOwn(change.decisions, uid),
    canWithdraw: driver && ["pending", "confirmed"].includes(change.status) && state.trip.pendingChangeId === proposalId,
    applied: false, applicationImplemented: false,
    createdAt: change.createdAt.toDate().toISOString() };
}
