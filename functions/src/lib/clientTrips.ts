import type { ClientRideSnapshot, ClientTripSummary, ClientTripStatus, Trip } from "../domain/types.js";

function formatDateParts(value: string): { dateLabel: string; timeLabel: string; departureLabel: string; status: ClientTripStatus } {
  const departure = new Date(value);
  if (Number.isNaN(departure.getTime())) {
    return { dateLabel: "DATE À CONFIRMER", timeLabel: "--h--", departureLabel: "DATE À CONFIRMER", status: "upcoming" };
  }

  const day = departure.toLocaleDateString("fr-BE", { weekday: "short", day: "2-digit", month: "short" }).replace(".", "");
  const dateLabel = day.toUpperCase();
  const timeLabel = departure
    .toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit", hour12: false })
    .replace(":", "h");
  const status: ClientTripStatus = departure.getTime() < Date.now() ? "past" : "upcoming";

  return {
    dateLabel,
    timeLabel,
    departureLabel: `${dateLabel.replace(/^[A-ZÀ-ÿ]{3}\\s/, "")} · ${timeLabel}`,
    status,
  };
}

function priceLabel(priceCents: number): string {
  if (priceCents === 0) return "Gratuit";
  return `${(priceCents / 100).toFixed(2).replace(".", ",")} EUR`;
}

function distanceLabel(trip: Trip): string {
  if (typeof trip.distanceKm === "number" && Number.isFinite(trip.distanceKm)) {
    return `${trip.distanceKm.toFixed(1)} km`;
  }
  return "Distance à confirmer";
}

export function toClientTripSummary(trip: Trip): ClientTripSummary {
  const dates = formatDateParts(trip.departureAt);
  const seatsLabel = `${trip.seatsAvailable} ${trip.seatsAvailable > 1 ? "places" : "place"}`;

  return {
    id: trip.id,
    title: trip.title ?? `${trip.category} · Trajet sportif`,
    club: trip.clubName ?? trip.clubId,
    category: trip.category,
    sport: trip.sport ?? "Football",
    departureLabel: dates.departureLabel,
    dateLabel: dates.dateLabel,
    timeLabel: dates.timeLabel,
    distanceLabel: distanceLabel(trip),
    seatsAvailable: trip.seatsAvailable,
    seatsLabel,
    priceLabel: priceLabel(trip.priceCents),
    passengerInitials: trip.passengerInitials ?? [],
    reasons: [
      seatsLabel,
      trip.supportsVehicleTracking ? "Suivi véhicule disponible" : "Suivi véhicule à confirmer",
      trip.supportsChildTracking ? "Suivi enfant disponible" : "Suivi enfant non inclus",
    ],
    status: dates.status,
  };
}

export function toClientRideSnapshot(rideSessionId: string, status: string): ClientRideSnapshot {
  return {
    rideSessionId,
    status: status === "active" ? "Actif" : status,
    vehicleLastUpdateLabel: "En attente du premier point GPS",
    childLastUpdateLabel: null,
    etaLabel: "ETA à calculer",
    stale: true,
  };
}
