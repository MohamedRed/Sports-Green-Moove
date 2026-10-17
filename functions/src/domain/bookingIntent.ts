import type { Trip } from "./types.js";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { chatDocumentIdSchema } from "./chatReference.js";
import { tripChangeHash, tripChangeTermsSchema } from "./tripChanges.js";

const contextKeys = ["driverUserId", "clubId", "teamId", "category", "pickupRadiusM", "baggage",
  "returnTrip", "supportsVehicleTracking", "supportsChildTracking", "seatsTotal", "appliedChangeId"] as const;
const contextSchema = z.object({
  driverUserId: chatDocumentIdSchema, seatsTotal: z.number().int().min(1).max(8),
  clubId: chatDocumentIdSchema.nullish(), teamId: chatDocumentIdSchema.nullish(), category: z.string().max(80).nullish(),
  pickupRadiusM: z.number().int().min(100).max(10_000).nullish(), baggage: z.enum(["small", "medium", "large"]).nullish(),
  returnTrip: z.boolean().nullish(), supportsVehicleTracking: z.boolean().nullish(), supportsChildTracking: z.boolean().nullish(),
  appliedChangeId: z.string().regex(/^[a-f0-9]{64}$/).nullish(),
}).strict();
export const bookingIntentSnapshotSchema = z.object({ terms: tripChangeTermsSchema, context: contextSchema }).strict();
export type BookingIntentSnapshot = z.infer<typeof bookingIntentSnapshotSchema>;
const metadata = z.object({ driverUserId: chatDocumentIdSchema, seatsTotal: z.number().int().min(1).max(8),
  seatsAvailable: z.number().int().min(0).max(8), appliedChangeId: z.string().regex(/^[a-f0-9]{64}$/).nullish(),
}).refine((trip) => trip.seatsAvailable <= trip.seatsTotal);

export function bookingIntentSnapshot(trip: Trip): BookingIntentSnapshot {
  metadata.parse(trip);
  const time = (value: unknown) => value instanceof Timestamp ? value.toDate().toISOString() :
    value instanceof Date ? value.toISOString() : value;
  const terms = tripChangeTermsSchema.parse({ departureAt: time(trip.departureAt), arrivalBy: time(trip.arrivalBy) ?? null,
    origin: trip.origin, destination: trip.destination, priceCents: trip.priceCents });
  return bookingIntentSnapshotSchema.parse({ terms,
    context: Object.fromEntries(contextKeys.map((key) => [key, trip[key] ?? null])) });
}

export function bookingSnapshotRevision(snapshot: BookingIntentSnapshot): string {
  return tripChangeHash({ terms: { ...snapshot.terms, departureAt: new Date(snapshot.terms.departureAt).toISOString(),
    arrivalBy: snapshot.terms.arrivalBy ? new Date(snapshot.terms.arrivalBy).toISOString() : null },
    context: Object.fromEntries(contextKeys.map((key) => [key, snapshot.context[key] ?? null])) });
}

export const bookingIntentRevision = (trip: Trip): string => bookingSnapshotRevision(bookingIntentSnapshot(trip));
