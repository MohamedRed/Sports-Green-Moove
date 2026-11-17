import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { bookingIntentSnapshotSchema, bookingSnapshotRevision } from "./bookingIntent.js";
import { chatDocumentIdSchema } from "./chatReference.js";
import { tripChangeHash } from "./tripChanges.js";
import type { ClientTripSummary } from "./types.js";

export const bookingRequestIdSchema = z.uuid().transform((value) => value.toLowerCase());
export const bookingRequestSchema = z.object({
  tripId: chatDocumentIdSchema, childId: chatDocumentIdSchema.optional(),
  seats: z.number().int().min(1).max(8).default(1), note: z.string().optional(),
  expectedBookingIntent: bookingIntentSnapshotSchema, clientRequestId: bookingRequestIdSchema,
  requesterUserId: chatDocumentIdSchema,
});
export type BookingRequestInput = z.infer<typeof bookingRequestSchema>;
export type BookingRequestReceipt = {
  uid: string; clientRequestId: string; state: "committed" | "abandoned";
  fingerprint?: string;
  response?: { bookingId: string; clientRequestId: string; status: "requested"; trip: ClientTripSummary };
};
export const bookingRequestDocumentId = (uid: string, clientRequestId: string) => tripChangeHash({ uid, clientRequestId });
export const bookingRequestFingerprint = (data: BookingRequestInput) => tripChangeHash({
  tripId: data.tripId, childId: data.childId ?? null, seats: data.seats, note: data.note ?? null,
  termsRevision: bookingSnapshotRevision(data.expectedBookingIntent),
});

export function requireReceiptOwner(receipt: BookingRequestReceipt, uid: string, clientRequestId: string) {
  const response = receipt.response;
  if (receipt.uid !== uid || receipt.clientRequestId !== clientRequestId ||
      !["committed", "abandoned"].includes(receipt.state) ||
      (receipt.state === "committed" && (!chatDocumentIdSchema.safeParse(response?.bookingId).success ||
        response?.clientRequestId !== clientRequestId || response?.status !== "requested" ||
        !chatDocumentIdSchema.safeParse(response?.trip?.id).success ||
        !bookingIntentSnapshotSchema.safeParse(response?.trip?.bookingIntent).success ||
        !/^[a-f0-9]{64}$/.test(receipt.fingerprint ?? "")))) {
    throw new HttpsError("internal", "Booking request receipt must be reconciled.");
  }
}
