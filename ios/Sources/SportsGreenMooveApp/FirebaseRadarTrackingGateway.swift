import Foundation

#if canImport(RadarSDK) && canImport(FirebaseAuth)
import FirebaseAuth
import RadarSDK

struct FirebaseRadarTrackingGateway: RadarTrackingGateway {
    let isConfigured: Bool

    init(publishableKey: String) {
        let key = publishableKey.trimmingCharacters(in: .whitespacesAndNewlines)
        self.isConfigured = !key.isEmpty
        if isConfigured, !Radar.isInitialized {
            Radar.initialize(publishableKey: key)
        }
    }

    func startTripTracking(rideSessionId: String, role: AppRole) async throws {
        try await startTripTrackingOnMain(rideSessionId: rideSessionId, role: role)
    }

    func stopTripTracking(rideSessionId: String) async throws {
        try await stopTripTrackingOnMain(rideSessionId: rideSessionId)
    }

    @MainActor
    private func startTripTrackingOnMain(rideSessionId: String, role: AppRole) async throws {
        guard !rideSessionId.isEmpty else {
            throw ProviderConfigurationError(message: "rideSessionId est requis pour Radar iOS.")
        }
        try ensureConfigured()

        let metadata = radarMetadata(rideSessionId: rideSessionId, role: role)
        Radar.setUserId(Auth.auth().currentUser?.uid)
        Radar.setMetadata(metadata)

        let options = RadarTripOptions(
            externalId: rideSessionId,
            destinationGeofenceTag: nil,
            destinationGeofenceExternalId: nil
        )
        options.metadata = metadata
        options.mode = .car
        options.startTracking = true

        try await awaitRadarTripResult(actionLabel: "démarrage") { completion in
            Radar.startTrip(
                options: options,
                trackingOptions: .presetContinuous,
                completionHandler: completion
            )
        }
    }

    @MainActor
    private func stopTripTrackingOnMain(rideSessionId: String) async throws {
        guard !rideSessionId.isEmpty else {
            throw ProviderConfigurationError(message: "rideSessionId est requis pour Radar iOS.")
        }
        try ensureConfigured()
        try await awaitRadarTripResult(actionLabel: "arrêt") { completion in
            Radar.completeTrip(completionHandler: completion)
        }
    }

    private func ensureConfigured() throws {
        guard isConfigured, Radar.isInitialized else {
            throw ProviderConfigurationError(message: "Radar iOS n'est pas configuré.")
        }
    }
}

private func radarMetadata(rideSessionId: String, role: AppRole) -> [String: String] {
    [
        "rideSessionId": rideSessionId,
        "role": role == .child ? "child" : "driver",
        "source": "nativeSdk",
    ]
}

@MainActor
private func awaitRadarTripResult(
    actionLabel: String,
    start: (@escaping (RadarStatus, RadarTrip?, [RadarEvent]?) -> Void) -> Void
) async throws {
    let status = await withCheckedContinuation { continuation in
        start { status, _, _ in
            continuation.resume(returning: status)
        }
    }
    guard status == .success else {
        throw ProviderConfigurationError(
            message: "Radar iOS a refusé: \(actionLabel) (\(Radar.stringForStatus(status)))."
        )
    }
}

#else
struct FirebaseRadarTrackingGateway: RadarTrackingGateway {
    let isConfigured = false

    init(publishableKey: String) {
        _ = publishableKey
    }

    func startTripTracking(rideSessionId: String, role: AppRole) async throws {
        _ = (rideSessionId, role)
        throw ProviderConfigurationError(message: "Radar iOS n'est pas configuré.")
    }

    func stopTripTracking(rideSessionId: String) async throws {
        _ = rideSessionId
    }
}
#endif
