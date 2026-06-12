import Foundation

#if os(iOS) && canImport(CoreLocation)
import CoreLocation

struct NativeLocationFallbackUpdate: Encodable, Sendable {
    let rideSessionId: String
    let role: String
    let latitude: Double
    let longitude: Double
    let accuracyM: Double
    let capturedAtMs: Int
    let speedMps: Double?
    let headingDeg: Double?

    enum CodingKeys: String, CodingKey {
        case rideSessionId
        case role
        case latitude = "lat"
        case longitude = "lng"
        case accuracyM
        case capturedAtMs = "capturedAt"
        case speedMps
        case headingDeg
    }

    func callableBatchJson() throws -> String {
        let data = try JSONEncoder().encode([self])
        guard let json = String(data: data, encoding: .utf8) else {
            throw ProviderConfigurationError(message: "Encodage JSON localisation invalide.")
        }
        return json
    }
}

private struct NativeLocationReading: Sendable {
    let latitude: Double
    let longitude: Double
    let accuracyM: Double
    let capturedAtMs: Int
    let speedMps: Double?
    let headingDeg: Double?

    init(location: CLLocation) {
        latitude = location.coordinate.latitude
        longitude = location.coordinate.longitude
        accuracyM = max(location.horizontalAccuracy, 0)
        capturedAtMs = Int(location.timestamp.timeIntervalSince1970 * 1000)
        speedMps = location.speed >= 0 ? location.speed : nil
        headingDeg = location.course >= 0 ? location.course : nil
    }
}

private struct ContinuousFallbackSession: Sendable {
    let rideSessionId: String
    let role: String
    let upload: @Sendable (NativeLocationFallbackUpdate) async throws -> Void
}

@MainActor
final class NativeLocationFallbackProvider: NSObject, CLLocationManagerDelegate {
    static let shared = NativeLocationFallbackProvider()

    private let manager = CLLocationManager()
    private var authorizationContinuation: CheckedContinuation<Void, Error>?
    private var locationContinuation: CheckedContinuation<NativeLocationReading, Error>?
    private var continuousSession: ContinuousFallbackSession?

    private override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.allowsBackgroundLocationUpdates = true
        manager.pausesLocationUpdatesAutomatically = false
    }

    func currentLocationUpdate(rideSessionId: String, role: String) async throws -> NativeLocationFallbackUpdate {
        try await ensureAuthorization()
        let location = try await requestLocation()
        return NativeLocationFallbackUpdate(
            rideSessionId: rideSessionId,
            role: role,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracyM: location.accuracyM,
            capturedAtMs: location.capturedAtMs,
            speedMps: location.speedMps,
            headingDeg: location.headingDeg
        )
    }

    func startContinuousUpdates(
        rideSessionId: String,
        role: String,
        upload: @escaping @Sendable (NativeLocationFallbackUpdate) async throws -> Void
    ) async throws {
        let firstUpdate = try await currentLocationUpdate(rideSessionId: rideSessionId, role: role)
        try await upload(firstUpdate)
        continuousSession = ContinuousFallbackSession(
            rideSessionId: rideSessionId,
            role: role,
            upload: upload
        )
        manager.startUpdatingLocation()
    }

    func stopContinuousUpdates(rideSessionId: String) {
        guard continuousSession?.rideSessionId == rideSessionId else { return }
        continuousSession = nil
        manager.stopUpdatingLocation()
    }

    private func ensureAuthorization() async throws {
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            return
        case .notDetermined:
            try await withCheckedThrowingContinuation { continuation in
                authorizationContinuation = continuation
                manager.requestAlwaysAuthorization()
            }
        case .denied, .restricted:
            throw ProviderConfigurationError(message: "Autorisation localisation requise pour le suivi de course.")
        @unknown default:
            throw ProviderConfigurationError(message: "Statut localisation iOS inconnu.")
        }
    }

    private func requestLocation() async throws -> NativeLocationReading {
        try await withCheckedThrowingContinuation { continuation in
            if let existing = locationContinuation {
                existing.resume(throwing: ProviderConfigurationError(message: "Capture GPS déjà en cours."))
            }
            locationContinuation = continuation
            manager.requestLocation()
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let rawStatus = manager.authorizationStatus.rawValue
        Task { @MainActor in
            self.handleAuthorizationChange(rawStatus: rawStatus)
        }
    }

    private func handleAuthorizationChange(rawStatus: Int32) {
        guard let continuation = authorizationContinuation else { return }
        authorizationContinuation = nil
        switch CLAuthorizationStatus(rawValue: rawStatus) {
        case .authorizedAlways, .authorizedWhenInUse:
            continuation.resume(returning: ())
        case .denied, .restricted:
            continuation.resume(throwing: ProviderConfigurationError(message: "Autorisation localisation refusée."))
        case .notDetermined:
            authorizationContinuation = continuation
        @unknown default:
            continuation.resume(throwing: ProviderConfigurationError(message: "Statut localisation iOS inconnu."))
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        let reading = NativeLocationReading(location: location)
        Task { @MainActor in
            self.handleLocationUpdate(reading)
        }
    }

    private func handleLocationUpdate(_ location: NativeLocationReading) {
        if let continuation = locationContinuation {
            locationContinuation = nil
            continuation.resume(returning: location)
        }
        guard let session = continuousSession else { return }
        let update = NativeLocationFallbackUpdate(
            rideSessionId: session.rideSessionId,
            role: session.role,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracyM: location.accuracyM,
            capturedAtMs: location.capturedAtMs,
            speedMps: location.speedMps,
            headingDeg: location.headingDeg
        )
        Task {
            try? await session.upload(update)
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let message = error.localizedDescription
        Task { @MainActor in
            self.handleLocationFailure(message: message)
        }
    }

    private func handleLocationFailure(message: String) {
        guard let continuation = locationContinuation else { return }
        locationContinuation = nil
        continuation.resume(throwing: ProviderConfigurationError(message: message))
    }
}
#endif
