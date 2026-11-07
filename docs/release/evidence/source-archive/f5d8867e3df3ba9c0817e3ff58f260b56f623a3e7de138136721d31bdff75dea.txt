import type { UserRole } from "./types.js";

type BookingAccessDocument = {
  driverUserId?: string;
  parentUserId?: string;
  requesterUserId?: string;
  paymentStatus?: string;
  status?: string;
};

type RideAccessDocument = {
  driverUserId?: string;
  participantUserIds?: string[];
  childUserIds?: string[];
};

export function uniqueUserIds(userIds: readonly (string | undefined)[]): string[] {
  return [...new Set(userIds.filter((userId): userId is string => Boolean(userId)))];
}

export function bookingParticipantUserIds(booking: BookingAccessDocument): string[] {
  return uniqueUserIds([booking.parentUserId ?? booking.requesterUserId, booking.driverUserId]);
}

export function rideParticipantUserIds(ride: RideAccessDocument): string[] {
  return uniqueUserIds([ride.driverUserId, ...(ride.participantUserIds ?? []), ...(ride.childUserIds ?? [])]);
}

export function canReadRide(uid: string, roleKeys: readonly UserRole[], ride: RideAccessDocument): boolean {
  return roleKeys.includes("admin") ||
    ride.driverUserId === uid ||
    Boolean(ride.participantUserIds?.includes(uid)) ||
    Boolean(ride.childUserIds?.includes(uid));
}

export function canCancelBooking(uid: string, roleKeys: readonly UserRole[], booking: BookingAccessDocument): boolean {
  return roleKeys.includes("admin") ||
    (roleKeys.includes("parent") && (booking.parentUserId ?? booking.requesterUserId) === uid) ||
    (roleKeys.includes("driver") && booking.driverUserId === uid);
}

export function isCancellableBookingStatus(status: string | undefined): boolean {
  return status === "requested" || status === "approved";
}

export function refundStatusForCancellation(paymentStatus: string | undefined): "notRequired" | "pending" {
  return paymentStatus === "paid" ? "pending" : "notRequired";
}
