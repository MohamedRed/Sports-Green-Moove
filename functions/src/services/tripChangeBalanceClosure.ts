import { HttpsError } from "firebase-functions/v2/https";
import type { Transaction } from "firebase-admin/firestore";
import { firestore } from "../lib/firebase.js";

export async function cancellationBalance(transaction: Transaction, bookingId: string, booking: Record<string, unknown>) {
  if (booking.tripChangeBalanceId === undefined) return null;
  if (typeof booking.tripChangeBalanceId !== "string" || !/^[a-f0-9]{64}$/.test(booking.tripChangeBalanceId))
    throw new HttpsError("failed-precondition", "Trip change balance must be reconciled before cancellation.");
  const ref = firestore.collection("tripChangeBalances").doc(booking.tripChangeBalanceId), snapshot = await transaction.get(ref);
  const balance = snapshot.data();
  if (!balance || balance.bookingId !== bookingId || balance.tripId !== booking.tripId || balance.driverUserId !== booking.driverUserId ||
      balance.parentUserId !== (booking.parentUserId ?? booking.requesterUserId))
    throw new HttpsError("failed-precondition", "Trip change balance ownership must be reconciled before cancellation.");
  return ref;
}
