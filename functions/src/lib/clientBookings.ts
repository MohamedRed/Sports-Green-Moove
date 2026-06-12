import type { BookingStatus, ClientBookingRequestSummary, Trip } from "../domain/types.js";
import { toClientTripSummary } from "./clientTrips.js";

type BookingRequestDocument = {
  id: string;
  tripId: string;
  parentUserId?: string;
  requesterUserId?: string;
  childId?: string;
  childLabel?: string;
  seats?: number;
  note?: string;
  status?: string;
};

export function toClientBookingRequestSummary(
  booking: BookingRequestDocument,
  trip: Trip,
): ClientBookingRequestSummary {
  const summary = toClientTripSummary(trip);
  return {
    bookingId: booking.id,
    tripId: booking.tripId,
    parentUserId: booking.parentUserId ?? booking.requesterUserId ?? "",
    childId: booking.childId,
    childLabel: booking.childLabel,
    seats: booking.seats ?? 1,
    note: booking.note,
    status: bookingStatus(booking.status),
    title: summary.title,
    club: summary.club,
    dateLabel: summary.dateLabel,
    timeLabel: summary.timeLabel,
    priceLabel: summary.priceLabel,
  };
}

function bookingStatus(status: string | undefined): BookingStatus {
  switch (status) {
    case "approved":
    case "declined":
    case "cancelled":
    case "completed":
      return status;
    default:
      return "requested";
  }
}
