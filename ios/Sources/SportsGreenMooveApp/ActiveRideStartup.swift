import Foundation

struct ActiveRideStartResult: Sendable {
    let ride: LiveRideSnapshot
    let notice: String
}

@MainActor func startTrackedRide(
    firebase: FirebaseGateway,
    radar: RadarTrackingGateway,
    tripId: String,
    role: AppRole,
    bookingIds: [String],
    requireCurrent: () throws -> Void
) async throws -> ActiveRideStartResult {
    try requireCurrent()
    let ride = try await firebase.startRide(tripId: tripId, bookingIds: bookingIds)
    try requireCurrent()
    return try await startTrackingForRide(ride, firebase: firebase, radar: radar, role: role, requireCurrent: requireCurrent)
}

@MainActor func startAccessibleRideTracking(
    firebase: FirebaseGateway,
    radar: RadarTrackingGateway,
    role: AppRole,
    requireCurrent: () throws -> Void
) async throws -> ActiveRideStartResult {
    try requireCurrent()
    guard let ride = try await firebase.getActiveRide() else {
        throw ProviderConfigurationError(message: "Aucune course active accessible pour démarrer le suivi.")
    }
    try requireCurrent()
    return try await startTrackingForRide(ride, firebase: firebase, radar: radar, role: role, requireCurrent: requireCurrent)
}

@MainActor private func startTrackingForRide(
    _ ride: LiveRideSnapshot,
    firebase: FirebaseGateway,
    radar: RadarTrackingGateway,
    role: AppRole,
    requireCurrent: () throws -> Void
) async throws -> ActiveRideStartResult {
    do {
        try requireCurrent()
        let radarStarted: Bool
        if radar.isConfigured {
            radarStarted = (try? await radar.startTripTracking(rideSessionId: ride.rideSessionId, role: role)) != nil
        } else {
            radarStarted = false
        }
        try requireCurrent()

        try await firebase.writeNativeLocationFallback(rideSessionId: ride.rideSessionId, role: role)
        try requireCurrent()

        let notice = radarStarted
            ? "Suivi Radar et secours GPS Firebase activés."
            : "Secours GPS Firebase activé."
        return ActiveRideStartResult(ride: ride, notice: notice)
    } catch {
        if error is CancellationError || Task.isCancelled {
            firebase.stopAllNativeLocationFallback()
            radar.stopLocalTracking()
        }
        throw error
    }
}

@MainActor func endTrackedRide(
    firebase: FirebaseGateway,
    radar: RadarTrackingGateway,
    rideSessionId: String,
    distanceMeters: Int,
    passengersSharing: Int,
    requireCurrent: () throws -> Void
) async throws -> RideCompletionSummary {
    try requireCurrent()
    let completion = try await firebase.endRide(
        rideSessionId: rideSessionId,
        distanceMeters: distanceMeters,
        passengersSharing: passengersSharing
    )
    try requireCurrent()
    firebase.stopNativeLocationFallback(rideSessionId: rideSessionId)
    if radar.isConfigured {
        try? await radar.stopTripTracking(rideSessionId: rideSessionId)
    }
    try requireCurrent()
    return completion
}
