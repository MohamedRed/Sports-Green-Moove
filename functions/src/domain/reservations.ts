import { z } from "zod";
import { chatDocumentIdSchema as documentId } from "./chatReference.js";
import type { Trip } from "./types.js";

export const reservationSchema = z.object({
  tripId: documentId, driverUserId: documentId,
  parentUserId: documentId.optional(), requesterUserId: documentId.optional(),
  childId: documentId.optional(), childLabel: z.string().optional(), note: z.string().optional(),
  seats: z.number().int().min(1).max(8),
  status: z.enum(["requested", "approved", "declined", "cancelled", "completed"]),
  paymentStatus: z.string().optional(), refundStatus: z.string().optional(),
}).refine((booking) => Boolean(booking.parentUserId ?? booking.requesterUserId), "Booking owner is missing.");
export type Reservation = z.infer<typeof reservationSchema>;
export type ReservationAction = "approve" | "decline" | "cancel";

export function reservationActions(
  uid: string, role: "parent" | "driver", booking: Reservation & { id: string }, trip: Trip,
  activeRide: { bookingIds?: string[] } | null | undefined,
): ReservationAction[] {
  if (role === "driver") {
    return booking.driverUserId === uid && trip.driverUserId === uid && booking.status === "requested" && booking.paymentStatus !== "paid" &&
      trip.status === "published" && !trip.activeRideSessionId && !trip.pendingChangeId ? ["approve", "decline"] : [];
  }
  if ((booking.parentUserId ?? booking.requesterUserId) !== uid) return [];
  if (booking.status === "requested") return ["cancel"];
  if (booking.status !== "approved") return [];
  if (trip.activeRideSessionId && (!activeRide || !Array.isArray(activeRide.bookingIds) || activeRide.bookingIds.includes(booking.id))) return [];
  return ["cancel"];
}
