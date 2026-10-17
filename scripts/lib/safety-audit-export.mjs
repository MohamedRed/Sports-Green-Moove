const OMITTED = Symbol("omitted");

export function buildSafetyAuditExport({
  projectId,
  exportedAt = new Date().toISOString(),
  rideSessions = [],
  liveTrips = {},
  childProfiles = [],
  rewardLedger = [],
  reports = [],
}) {
  const aliases = createAliaser();
  return compact({
    exportType: "sports-green-moove.safety-audit",
    exportedAt,
    projectId,
    rideSessions: rideSessions.map((ride) => sanitizeRideSession(ride, aliases)),
    liveTrips: Object.fromEntries(
      Object.entries(liveTrips).map(([rideSessionId, liveTrip]) => [
        aliases.id("rideSession", rideSessionId),
        sanitizeLiveTrip(liveTrip, aliases),
      ]),
    ),
    childProfiles: childProfiles.map((child) => sanitizeChildProfile(child, aliases)),
    rewardLedger: rewardLedger.map((entry) => sanitizeRewardLedgerEntry(entry, aliases)),
    reports: reports.map((report) => sanitizeReport(report, aliases)),
  });
}

export function createAliaser() {
  const maps = new Map();
  return {
    id(kind, value) {
      if (typeof value !== "string" || value.trim().length === 0) return value;
      if (!maps.has(kind)) maps.set(kind, new Map());
      const scoped = maps.get(kind);
      if (!scoped.has(value)) scoped.set(value, `${kind}-${scoped.size + 1}`);
      return scoped.get(value);
    },
    ids(kind, values) {
      return Array.isArray(values) ? values.map((value) => this.id(kind, value)) : [];
    },
  };
}

function sanitizeRideSession({ id, data = {}, auditEvents = [] }, aliases) {
  return compact({
    id: aliases.id("rideSession", id),
    tripId: aliases.id("trip", data.tripId),
    bookingIds: aliases.ids("booking", data.bookingIds),
    driverUserId: aliases.id("user", data.driverUserId),
    participantUserIds: aliases.ids("user", data.participantUserIds),
    childUserIds: aliases.ids("child", data.childUserIds),
    status: data.status,
    guardianConsent: data.guardianConsent === true ? true : undefined,
    startedAt: coerceTimestamp(data.startedAt),
    completedAt: coerceTimestamp(data.completedAt),
    passengers: (data.passengers ?? []).map((passenger) => sanitizePassenger(passenger, aliases)),
    auditEvents: auditEvents.map((event) => sanitizeAuditEvent(event, aliases)),
  });
}

function sanitizePassenger(passenger, aliases) {
  return compact({
    bookingId: aliases.id("booking", passenger.bookingId),
    childId: aliases.id("child", passenger.childId),
    parentUserId: aliases.id("user", passenger.parentUserId),
    pickupStatus: passenger.pickupStatus,
    dropoffStatus: passenger.dropoffStatus,
  });
}

function sanitizeAuditEvent({ id, data = {} }, aliases) {
  return compact({
    id: aliases.id("auditEvent", id),
    source: data.source,
    eventType: data.eventType,
    action: data.action,
    type: data.type,
    radarStatus: data.radarStatus,
    reconciliationStatus: data.reconciliationStatus,
    bookingId: aliases.id("booking", data.bookingId),
    childId: aliases.id("child", data.childId),
    userId: aliases.id("user", data.userId),
    etaSeconds: finiteNumber(data.etaSeconds),
    etaDistanceMeters: finiteNumber(data.etaDistanceMeters),
    capturedAt: coerceTimestamp(data.capturedAt),
    recordedAt: coerceTimestamp(data.recordedAt),
  });
}

function sanitizeLiveTrip(liveTrip, aliases) {
  if (!liveTrip || typeof liveTrip !== "object") return {};
  return compact({
    meta: sanitizeLiveTripMeta(liveTrip.meta, aliases),
    vehicle: sanitizeLocation(liveTrip.vehicle, aliases),
    children: Object.fromEntries(
      Object.entries(liveTrip.children ?? {}).map(([childId, location]) => [
        aliases.id("child", childId),
        sanitizeLocation(location, aliases),
      ]),
    ),
  });
}

function sanitizeLiveTripMeta(meta, aliases) {
  if (!meta || typeof meta !== "object") return undefined;
  return compact({
    tripId: aliases.id("trip", meta.tripId),
    driverUserId: aliases.id("user", meta.driverUserId),
    status: meta.status,
    radar: sanitizeRadarMeta(meta.radar),
    startedAt: coerceTimestamp(meta.startedAt),
    completedAt: coerceTimestamp(meta.completedAt),
  });
}

function sanitizeRadarMeta(radar) {
  if (!radar || typeof radar !== "object") return undefined;
  return compact({
    action: radar.action,
    eventType: radar.eventType,
    radarStatus: radar.radarStatus,
    etaSeconds: finiteNumber(radar.etaSeconds),
    etaDistanceMeters: finiteNumber(radar.etaDistanceMeters),
    updatedAt: coerceTimestamp(radar.updatedAt),
  });
}

function sanitizeLocation(location, aliases) {
  if (!location || typeof location !== "object") return undefined;
  return compact({
    userId: aliases.id("user", location.userId),
    source: location.source,
    role: location.role,
    accuracyM: finiteNumber(location.accuracyM),
    capturedAt: coerceTimestamp(location.capturedAt),
    uploadedAt: coerceTimestamp(location.uploadedAt),
  });
}

function sanitizeChildProfile({ id, data = {} }, aliases) {
  return compact({
    id: aliases.id("child", id),
    guardianConsent: data.guardianConsent === true,
    trackingEnabled: data.trackingEnabled === true,
    guardianUserIds: aliases.ids("user", data.guardianUserIds),
    clubIds: aliases.ids("club", data.clubIds),
    teamIds: aliases.ids("team", data.teamIds),
    createdAt: coerceTimestamp(data.createdAt),
    updatedAt: coerceTimestamp(data.updatedAt),
  });
}

function sanitizeRewardLedgerEntry({ id, data = {} }, aliases) {
  return compact({
    id: aliases.id("ledger", id),
    type: data.type,
    amountCents: finiteNumber(data.amountCents),
    currency: data.currency,
    userId: aliases.id("user", data.userId),
    sourceId: aliases.id("source", data.sourceId),
    bookingId: aliases.id("booking", data.bookingId),
    tripId: aliases.id("trip", data.tripId),
    createdAt: coerceTimestamp(data.createdAt),
  });
}

function sanitizeReport({ id, data = {} }, aliases) {
  return compact({
    id: aliases.id("report", id),
    type: data.type,
    eventType: data.eventType,
    eventId: aliases.id("event", data.eventId),
    reconciliationStatus: data.reconciliationStatus,
    ledgerId: aliases.id("ledger", data.ledgerId),
    transferId: aliases.id("transfer", data.transferId),
    createdAt: coerceTimestamp(data.createdAt),
  });
}

function compact(value) {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) => {
      if (child === OMITTED || child == null) return [];
      if (Array.isArray(child) && child.length === 0) return [];
      if (typeof child === "object" && !Array.isArray(child) && Object.keys(child).length === 0) return [];
      return [[key, child]];
    }),
  );
}

function finiteNumber(value) {
  return Number.isFinite(value) ? value : undefined;
}

function coerceTimestamp(value) {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (Number.isFinite(value.seconds)) {
    return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1_000_000)).toISOString();
  }
  if (Number.isFinite(value._seconds)) {
    return new Date(value._seconds * 1000 + Math.floor((value._nanoseconds ?? 0) / 1_000_000)).toISOString();
  }
  return undefined;
}
