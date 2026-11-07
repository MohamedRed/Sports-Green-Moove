export type ManualPassengerAuditEvent = "pickup" | "dropoff";

export type ManualPassengerAuditInput<TRecordedAt> = {
  event: ManualPassengerAuditEvent;
  bookingId: string;
  childId: string;
  driverUserId: string;
  note?: string | null;
  recordedAt: TRecordedAt;
};

export function manualPassengerAuditEventId(
  event: ManualPassengerAuditEvent,
  bookingId: string,
  childId: string,
): string {
  return ["manual", event, bookingId, childId].map(firestoreIdSegment).join("_");
}

export function manualPassengerAuditEvent<TRecordedAt>(input: ManualPassengerAuditInput<TRecordedAt>) {
  return {
    source: "manual",
    eventType: input.event === "pickup" ? "passengerPickup" : "passengerDropoff",
    action: input.event,
    bookingId: input.bookingId,
    childId: input.childId,
    userId: input.driverUserId,
    note: normalizedAuditNote(input.note),
    capturedAt: input.recordedAt,
    recordedAt: input.recordedAt,
  };
}

function normalizedAuditNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function firestoreIdSegment(value: string): string {
  return value.replaceAll("/", "_").trim() || "unknown";
}

