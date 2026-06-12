import Foundation

struct ActiveRideStartResult: Sendable {
    let ride: LiveRideSnapshot
    let notice: String
}

func startTrackedRide(
    firebase: FirebaseGateway,
    radar: RadarTrackingGateway,
    tripId: String,
    role: AppRole,
    bookingIds: [String]
) async throws -> ActiveRideStartResult {
    let ride = try await firebase.startRide(tripId: tripId, bookingIds: bookingIds)
    let radarStarted: Bool
    if radar.isConfigured {
        radarStarted = (try? await radar.startTripTracking(rideSessionId: ride.rideSessionId, role: role)) != nil
    } else {
        radarStarted = false
    }

    try await firebase.writeNativeLocationFallback(rideSessionId: ride.rideSessionId, role: role)

    let notice = radarStarted
        ? "Suivi Radar et secours GPS Firebase activés."
        : "Secours GPS Firebase activé."
    return ActiveRideStartResult(ride: ride, notice: notice)
}

func endTrackedRide(
    firebase: FirebaseGateway,
    radar: RadarTrackingGateway,
    rideSessionId: String,
    distanceMeters: Int,
    passengersSharing: Int
) async throws -> RideCompletionSummary {
    let completion = try await firebase.endRide(
        rideSessionId: rideSessionId,
        distanceMeters: distanceMeters,
        passengersSharing: passengersSharing
    )
    firebase.stopNativeLocationFallback(rideSessionId: rideSessionId)
    if radar.isConfigured {
        try? await radar.stopTripTracking(rideSessionId: rideSessionId)
    }
    return completion
}
