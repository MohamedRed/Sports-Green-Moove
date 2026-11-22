import { createHash } from "node:crypto";

export type BookingNoticeType = "bookingRequested" | "bookingApproved" | "bookingDeclined" | "bookingCancelled";
export function bookingNotificationId(type: BookingNoticeType, bookingId: string, userId: string): string {
  return "bookingDecision_" + createHash("sha256").update(JSON.stringify([type, bookingId, userId])).digest("hex");
}
