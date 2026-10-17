import type { Trip } from "./types.js";
import { z } from "zod";
import { chatDocumentIdSchema } from "./chatReference.js";
import { tripChangeHash, tripChangeTermsSchema } from "./tripChanges.js";

const contextKeys = ["driverUserId", "clubId", "teamId", "category", "pickupRadiusM", "baggage",
  "returnTrip", "supportsVehicleTracking", "supportsChildTracking", "seatsTotal", "appliedChangeId"] as const;
const metadata = z.object({ driverUserId: chatDocumentIdSchema, seatsTotal: z.number().int().min(1).max(8),
  seatsAvailable: z.number().int().min(0).max(8), appliedChangeId: z.string().regex(/^[a-f0-9]{64}$/).nullish(),
}).refine((trip) => trip.seatsAvailable <= trip.seatsTotal);

export function bookingIntentRevision(trip: Trip): string {
  metadata.parse(trip);
  const terms = tripChangeTermsSchema.parse({ departureAt: trip.departureAt, arrivalBy: trip.arrivalBy ?? null,
    origin: trip.origin, destination: trip.destination, priceCents: trip.priceCents });
  return tripChangeHash({ terms, context: Object.fromEntries(contextKeys.map((key) => [key, trip[key] ?? null])) });
}
