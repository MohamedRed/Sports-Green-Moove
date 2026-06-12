export type UserRole = "parent" | "driver" | "child" | "clubManager" | "admin";

export type TripStatus = "draft" | "published" | "full" | "cancelled" | "completed";

export type BookingStatus = "requested" | "approved" | "declined" | "cancelled" | "completed";

export type LatLng = {
  lat: number;
  lng: number;
};

export type PlaceSuggestion = {
  placeId: string;
  label: string;
  mainText?: string;
  secondaryText?: string;
};

export type ResolvedPlace = PlaceSuggestion & {
  location: LatLng;
  formattedAddress: string;
};

export type Trip = {
  id: string;
  driverUserId: string;
  status: TripStatus;
  title?: string;
  sport?: string;
  clubName?: string;
  teamName?: string;
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
  distanceKm?: number;
  passengerInitials?: string[];
  regionGeohash?: string;
  blockedUserIds?: string[];
};

export type ClientTripStatus = "upcoming" | "past" | "pending";

export type ClientTripSummary = {
  id: string;
  title: string;
  club: string;
  category: string;
  sport: string;
  departureLabel: string;
  dateLabel: string;
  timeLabel: string;
  distanceLabel: string;
  seatsAvailable: number;
  seatsLabel: string;
  priceLabel: string;
  passengerInitials: string[];
  reasons: string[];
  status: ClientTripStatus;
};

export type ClientBookingSummary = {
  bookingId: string;
  tripId: string;
  status: BookingStatus;
};

export type ClientBookingRequestSummary = {
  bookingId: string;
  tripId: string;
  parentUserId: string;
  childId?: string;
  childLabel?: string;
  seats: number;
  note?: string;
  status: BookingStatus;
  title: string;
  club: string;
  dateLabel: string;
  timeLabel: string;
  priceLabel: string;
};

export type ClientRideSnapshot = {
  rideSessionId: string;
  status: string;
  vehicleLastUpdateLabel: string;
  childLastUpdateLabel: string | null;
  etaLabel: string;
  stale: boolean;
  passengers: ClientRidePassengerStatus[];
};

export type ClientRidePassengerStatus = {
  bookingId: string;
  childId: string;
  label: string;
  pickupStatus: "pending" | "pickedUp";
  dropoffStatus: "pending" | "droppedOff";
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
  departureWindowBeforeMinutes?: number;
  departureWindowAfterMinutes?: number;
  regionGeohashPrefixes?: string[];
  allowedClubIds?: string[];
  allowedTeamIds?: string[];
  enforceMemberships?: boolean;
};

export type RouteComparison = {
  baselineDurationSeconds: number;
  baselineDistanceMeters: number;
  detourDurationSeconds: number;
  detourDistanceMeters: number;
  pickupDistanceMeters: number;
  scheduleDeltaMinutes: number;
  finalDurationSeconds?: number;
  finalDistanceMeters?: number;
  finalEncodedPolyline?: string;
  driverToPickupDurationSeconds?: number;
  pickupToDropoffDurationSeconds?: number;
  dropoffToDestinationDurationSeconds?: number;
};

export type RankedTrip = {
  trip: Trip;
  score: number;
  route: RouteComparison;
  reasons: string[];
};

export type ClientSearchMatch = {
  tripId: string;
  score: number;
  route: RouteComparison;
  reasons: string[];
  summary: ClientTripSummary;
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
