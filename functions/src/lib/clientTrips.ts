import type {
  ClientMapRoutePreview,
  ClientRidePassengerStatus,
  ClientRideSnapshot,
  ClientTripSummary,
  ClientTripStatus,
  LocationSource,
  Trip,
} from "../domain/types.js";

type LiveTripLocation = {
  uploadedAt?: number;
  capturedAt?: number;
  source?: LocationSource;
};

type LiveTripSnapshot = {
  vehicle?: LiveTripLocation;
  children?: Record<string, LiveTripLocation | undefined>;
  meta?: {
    tripId?: string;
    radar?: {
      etaSeconds?: number;
      etaDistanceMeters?: number;
      updatedAt?: number;
    };
  };
};

type RidePassengerSnapshot = {
  bookingId?: string;
  childId?: string;
  label?: string;
  pickupStatus?: string;
  dropoffStatus?: string;
};

type RideSessionSnapshot = {
  tripId?: string;
  passengers?: RidePassengerSnapshot[];
  passengerStatuses?: Record<string, {
    pickupStatus?: string;
    dropoffStatus?: string;
  } | undefined>;
};

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
    mapPreview: toClientMapRoutePreview(trip),
  };
}

export function toClientMapRoutePreview(trip: Trip, encodedPolyline?: string): ClientMapRoutePreview {
  return {
    start: trip.origin,
    end: trip.destination,
    ...(encodedPolyline ? { encodedPolyline } : {}),
  };
}

export function toClientRideSnapshot(
  rideSessionId: string,
  status: string,
  live?: LiveTripSnapshot | null,
  ride?: RideSessionSnapshot | null,
  now = Date.now(),
): ClientRideSnapshot {
  const vehicle = live?.vehicle;
  const child = latestChildLocation(live?.children);
  const vehicleAgeMs = ageMs(vehicle, now);

  return {
    rideSessionId,
    ...(ride?.tripId ?? live?.meta?.tripId ? { tripId: ride?.tripId ?? live?.meta?.tripId } : {}),
    status: status === "active" ? "Actif" : status,
    vehicleLastUpdateLabel: locationLabel(vehicle, now, "En attente du premier point GPS"),
    childLastUpdateLabel: child ? locationLabel(child, now, "Enfant en attente") : null,
    etaLabel: etaLabel(live?.meta?.radar?.etaSeconds),
    stale: vehicleAgeMs == null || vehicleAgeMs > 90_000,
    passengers: ridePassengers(ride),
  };
}

function ridePassengers(ride: RideSessionSnapshot | null | undefined): ClientRidePassengerStatus[] {
  return (ride?.passengers ?? []).flatMap((passenger) => {
    const bookingId = passenger.bookingId;
    const childId = passenger.childId;
    if (!bookingId || !childId) return [];

    const overrides = ride?.passengerStatuses?.[childId] ?? ride?.passengerStatuses?.[bookingId];
    return [{
      bookingId,
      childId,
      label: passenger.label ?? `Enfant ${childId.slice(-4).toUpperCase()}`,
      pickupStatus: normalizePickupStatus(overrides?.pickupStatus ?? passenger.pickupStatus),
      dropoffStatus: normalizeDropoffStatus(overrides?.dropoffStatus ?? passenger.dropoffStatus),
    }];
  });
}

function normalizePickupStatus(status: string | undefined): ClientRidePassengerStatus["pickupStatus"] {
  return status === "pickedUp" ? "pickedUp" : "pending";
}

function normalizeDropoffStatus(status: string | undefined): ClientRidePassengerStatus["dropoffStatus"] {
  return status === "droppedOff" ? "droppedOff" : "pending";
}

function latestChildLocation(children: LiveTripSnapshot["children"]): LiveTripLocation | null {
  if (!children) return null;
  return Object.values(children).reduce<LiveTripLocation | null>((latest, item) => {
    if (!item) return latest;
    if (!latest) return item;
    return locationTime(item) > locationTime(latest) ? item : latest;
  }, null);
}

function locationLabel(location: LiveTripLocation | undefined, now: number, fallback: string): string {
  if (!location) return fallback;
  return `${sourceLabel(location.source)} · ${elapsedLabel(ageMs(location, now) ?? 0)}`;
}

function sourceLabel(source: LocationSource | undefined): string {
  if (source === "radar") return "Radar";
  if (source === "nativeFallback") return "Secours GPS";
  if (source === "manual") return "Manuel";
  return "GPS";
}

function etaLabel(etaSeconds: number | undefined): string {
  if (typeof etaSeconds !== "number" || !Number.isFinite(etaSeconds) || etaSeconds <= 0) {
    return "ETA à calculer";
  }
  const minutes = Math.max(1, Math.round(etaSeconds / 60));
  return `ETA ${minutes} min`;
}

function ageMs(location: LiveTripLocation | undefined, now: number): number | null {
  if (!location) return null;
  const timestamp = location.uploadedAt ?? location.capturedAt;
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return null;
  return Math.max(0, now - timestamp);
}

function locationTime(location: LiveTripLocation): number {
  return location.uploadedAt ?? location.capturedAt ?? 0;
}

function elapsedLabel(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 5) return "à l'instant";
  if (seconds < 60) return `il y a ${seconds} s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  return `il y a ${hours} h`;
}
