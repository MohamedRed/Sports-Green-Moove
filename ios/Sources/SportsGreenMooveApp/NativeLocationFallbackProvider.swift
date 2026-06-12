import Foundation

#if os(iOS) && canImport(CoreLocation)
import CoreLocation

@MainActor
final class NativeLocationFallbackProvider: NSObject, CLLocationManagerDelegate {
    static let shared = NativeLocationFallbackProvider()

    private let manager = CLLocationManager()
    private var authorizationContinuation: CheckedContinuation<Void, Error>?
    private var locationContinuation: CheckedContinuation<CLLocation, Error>?

    private override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.allowsBackgroundLocationUpdates = true
        manager.pausesLocationUpdatesAutomatically = false
    }

    func currentLocationPayload(rideSessionId: String, role: AppRole) async throws -> [String: Any] {
        try await ensureAuthorization()
        let location = try await requestLocation()
        return payload(rideSessionId: rideSessionId, role: role, location: location)
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

    private func requestLocation() async throws -> CLLocation {
        try await withCheckedThrowingContinuation { continuation in
            if let existing = locationContinuation {
                existing.resume(throwing: ProviderConfigurationError(message: "Capture GPS déjà en cours."))
            }
            locationContinuation = continuation
            manager.requestLocation()
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard let continuation = authorizationContinuation else { return }
        authorizationContinuation = nil
        switch manager.authorizationStatus {
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

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last, let continuation = locationContinuation else { return }
        locationContinuation = nil
        continuation.resume(returning: location)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard let continuation = locationContinuation else { return }
        locationContinuation = nil
        continuation.resume(throwing: error)
    }

    private func payload(rideSessionId: String, role: AppRole, location: CLLocation) -> [String: Any] {
        var data: [String: Any] = [
            "rideSessionId": rideSessionId,
            "role": role == .child ? "child" : "driver",
            "lat": location.coordinate.latitude,
            "lng": location.coordinate.longitude,
            "accuracyM": max(location.horizontalAccuracy, 0),
            "capturedAt": Int(location.timestamp.timeIntervalSince1970 * 1000),
        ]
        if location.speed >= 0 { data["speedMps"] = location.speed }
        if location.course >= 0 { data["headingDeg"] = location.course }
        return data
    }
}
#endif
