import { Filter, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { firestore } from "../lib/firebase.js";
import { reservationSchema } from "../domain/reservations.js";
import { changePrecondition, type TripChangeState } from "./tripChangeState.js";

export async function requireTripHistoryAccess(transaction: Transaction, state: TripChangeState, uid: string) {
  if (state.trip.driverUserId === uid) return;
  const page = await transaction.get(firestore.collection("bookings").where("tripId", "==", state.tripId)
    .where(Filter.or(Filter.where("parentUserId", "==", uid), Filter.where("requesterUserId", "==", uid))).limit(101));
  if (page.empty) throw new HttpsError("permission-denied", "Only the owning driver or an affected parent can read trip history.");
  if (page.size > 100) throw new HttpsError("resource-exhausted", "Too many reservations for a history access check.");
  const children = new Set<string>();
  for (const snapshot of page.docs) {
    const parsed = reservationSchema.safeParse(snapshot.data());
    if (!parsed.success || parsed.data.driverUserId !== state.trip.driverUserId ||
        (parsed.data.parentUserId && parsed.data.requesterUserId && parsed.data.parentUserId !== parsed.data.requesterUserId) ||
        (parsed.data.parentUserId ?? parsed.data.requesterUserId) !== uid) changePrecondition("Reservation ownership requires repair.");
    if (parsed.data.childId) children.add(parsed.data.childId);
  }
  const records = children.size ? await transaction.getAll(...[...children].map((id) => firestore.collection("children").doc(id))) : [];
  for (const child of records) {
    const guardians: unknown = child.data()?.guardianUserIds;
    if (!Array.isArray(guardians) || !guardians.includes(uid))
      throw new HttpsError("permission-denied", "Current guardian authority is required for trip history.");
  }
}
