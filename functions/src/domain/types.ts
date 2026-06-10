export type UserRole = "parent" | "driver" | "child" | "clubManager" | "admin";

export type TripStatus = "draft" | "published" | "full" | "cancelled" | "completed";

export type BookingStatus = "requested" | "approved" | "declined" | "cancelled" | "completed";

export type LatLng = {
  lat: number;
  lng: number;
};

export type Trip = {
  id: string;
  driverUserId: string;
  status: TripStatus;
  clubId: string;
  teamId: string;
  category: string;
  departureAt: string;
  arrivalBy?: string;
  origin: LatLng;
  destination: LatLng;
  pickupRadiusM: number;
  seatsTotal: number;
  seatsAvailable: number;
  baggage: "small" | "medium" | "large";
  returnTrip: boolean;
  priceCents: number;
  driverRating: number;
  driverVerified: boolean;
  supportsVehicleTracking: boolean;
  supportsChildTracking: boolean;
  co2SavedKgEstimate: number;
  blockedUserIds?: string[];
};

export type SearchRequest = {
  requesterUserId: string;
  childUserId?: string;
  clubId?: string;
  teamId?: string;
  category?: string;
  desiredDepartureAt: string;
  origin: LatLng;
  destination: LatLng;
  seatsNeeded: number;
  baggage: "small" | "medium" | "large";
  returnTrip: boolean;
  requireChildTracking: boolean;
  guardianConsent: boolean;
  maxDetourMinutes?: number;
  maxPickupDistanceM?: number;
};

export type RouteComparison = {
  baselineDurationSeconds: number;
  baselineDistanceMeters: number;
  detourDurationSeconds: number;
  detourDistanceMeters: number;
  pickupDistanceMeters: number;
  scheduleDeltaMinutes: number;
};

export type RankedTrip = {
  trip: Trip;
  score: number;
  route: RouteComparison;
  reasons: string[];
};

export type LocationSource = "radar" | "nativeFallback" | "manual";

export type LocationUpdate = {
  rideSessionId: string;
  userId: string;
  role: "driver" | "child";
  lat: number;
  lng: number;
  accuracyM: number;
  speedMps?: number;
  headingDeg?: number;
  batteryPct?: number;
  capturedAt: number;
  uploadedAt: number;
  source: LocationSource;
};

export type Co2Factors = {
  gramsPerKmByCar: number;
  sharedRideCreditRatio: number;
};

export type RewardLedgerEntry = {
  id: string;
  userId: string;
  type:
    | "ridePayment"
    | "driverEarning"
    | "co2Bonus"
    | "referralBonus"
    | "manualAdjustment"
    | "payout"
    | "refund";
  amountCents: number;
  currency: "eur";
  sourceId: string;
  createdAt: string;
};
