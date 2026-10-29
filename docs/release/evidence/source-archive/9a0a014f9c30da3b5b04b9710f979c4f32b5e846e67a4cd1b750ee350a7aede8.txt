import { z } from "zod";
import type { ClientInboxReviewPrompt, InboxDocument } from "./inbox.js";

export type ReviewTripContext = { tripId: string; title: string; departureAt: string; departureLabel: string };
const id = z.string().min(1).refine(value => !value.includes("/") && value !== "." && value !== ".." && Buffer.byteLength(value) <= 1500);
const details = z.object({
  title: z.string().trim().min(2).max(140),
  departureAt: z.iso.datetime({offset: true}),
});
const departure = new Intl.DateTimeFormat("fr-BE", {
  day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels",
});

export function pendingReviewTripIds(items: readonly ClientInboxReviewPrompt[], rides: readonly InboxDocument[]): string[] {
  const selected = new Set(items.map(item => item.rideSessionId));
  return [...new Set(rides.filter(ride => selected.has(ride.id) && id.safeParse(ride.data.tripId).success)
    .map(ride => ride.data.tripId as string))];
}

export function attachReviewTripContexts(items: readonly ClientInboxReviewPrompt[], rides: readonly InboxDocument[],
  trips: readonly InboxDocument[]): ClientInboxReviewPrompt[] {
  const rideMap = new Map(rides.map(ride => [ride.id, ride.data])), tripMap = new Map(trips.map(trip => [trip.id, trip.data]));
  return items.map(item => {
    const ride = rideMap.get(item.rideSessionId), tripId = ride?.tripId;
    const trip = typeof tripId === "string" ? tripMap.get(tripId) : undefined;
    const parsed = details.safeParse(trip);
    let tripContext: ReviewTripContext | null = null;
    if (ride?.status === "completed" && trip?.status === "completed" && parsed.success &&
        typeof ride.driverUserId === "string" && trip.driverUserId === ride.driverUserId &&
        trip.activeRideSessionId === item.rideSessionId && typeof tripId === "string") {
      tripContext = {tripId, title: parsed.data.title, departureAt: parsed.data.departureAt,
        departureLabel: departure.format(new Date(parsed.data.departureAt))};
    }
    return {...item, tripContext};
  });
}
