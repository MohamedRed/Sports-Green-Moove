export type PassengerState = {
  bookingId: string;
  childId: string;
  pickupStatus: "pending" | "pickedUp";
  dropoffStatus: "pending" | "droppedOff";
};

export function passengersReadyForCompletion(bookingIds: readonly string[], passengers: readonly PassengerState[]): boolean {
  return bookingIds.length === passengers.length && new Set(bookingIds).size === bookingIds.length &&
    bookingIds.every((bookingId) => passengers.filter((passenger) => passenger.bookingId === bookingId &&
      passenger.pickupStatus === "pickedUp" && passenger.dropoffStatus === "droppedOff").length === 1);
}

type Transition<T> = { ok: true; passengers: T[] } | { ok: false; message: string };

export function transitionPassenger<T extends PassengerState>(
  passengers: readonly T[],
  bookingId: string,
  childId: string,
  event: "pickup" | "dropoff",
): Transition<T> {
  const matches = passengers.filter((passenger) => passenger.bookingId === bookingId);
  if (matches.length !== 1 || matches[0].childId !== childId) {
    return { ok: false, message: "Passenger must match exactly one attached booking and child." };
  }
  const passenger = matches[0];
  if (passenger.dropoffStatus !== "pending") {
    return { ok: false, message: "Passenger has already been dropped off." };
  }
  if (event === "pickup" && passenger.pickupStatus !== "pending") {
    return { ok: false, message: "Pickup has already been confirmed." };
  }
  if (event === "dropoff" && passenger.pickupStatus !== "pickedUp") {
    return { ok: false, message: "Pickup must be confirmed before dropoff." };
  }
  return {
    ok: true,
    passengers: passengers.map((item) => item.bookingId !== bookingId || item.childId !== childId
      ? item
      : event === "pickup" ? { ...item, pickupStatus: "pickedUp" } : { ...item, dropoffStatus: "droppedOff" }),
  };
}
