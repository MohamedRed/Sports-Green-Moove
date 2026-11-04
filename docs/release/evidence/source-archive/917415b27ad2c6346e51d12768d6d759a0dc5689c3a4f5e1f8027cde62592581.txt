import Foundation

#if os(iOS) && canImport(CoreLocation)
import CoreLocation
import os

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
    let id: UUID
    let rideSessionId: String
    let role: String
    let upload: @Sendable (NativeLocationBatchUpdate) async throws -> Void
}

private struct LocationCallbackScope: Sendable {
    let managerId: ObjectIdentifier
    let owner: UUID
}

@MainActor
final class NativeLocationFallbackProvider: NSObject, CLLocationManagerDelegate {
    static let shared = NativeLocationFallbackProvider()

    private var manager: CLLocationManager?
    private var authorizationContinuation: CheckedContinuation<Void, Error>?
    private var locationContinuation: CheckedContinuation<NativeLocationReading, Error>?
    private var continuousSession: ContinuousFallbackSession?
    private let state = LocationSessionState()
    nonisolated private let callbackOwner = OSAllocatedUnfairLock<LocationCallbackScope?>(initialState: nil)
    private var uploads: [UUID: Task<Void, Never>] = [:]

    var hasPendingWork: Bool { state.hasPendingWork }
    func awaitShutdown() async { await state.waitUntilIdle() }

    private override init() {
        super.init()
    }

    private func currentLocationUpdate(rideSessionId: String, role: String, id: UUID,
        manager: CLLocationManager) async throws -> NativeLocationBatchUpdate {
        try state.requireCurrent(id)
        try await ensureAuthorization(using: manager)
        try state.requireCurrent(id)
        let location = try await requestLocation(using: manager)
        try state.requireCurrent(id)
        return NativeLocationBatchUpdate(
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
        upload: @escaping @Sendable (NativeLocationBatchUpdate) async throws -> Void
    ) async throws {
        let id = try state.begin(ride: rideSessionId)
        let manager = CLLocationManager()
        self.manager = manager
        let scope = LocationCallbackScope(managerId: ObjectIdentifier(manager), owner: id)
        callbackOwner.withLock { $0 = scope }
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.allowsBackgroundLocationUpdates = true
        manager.pausesLocationUpdatesAutomatically = false
        defer { state.finishStart(id) }
        try await withTaskCancellationHandler {
            do {
                let firstUpdate = try await currentLocationUpdate(rideSessionId: rideSessionId, role: role, id: id, manager: manager)
                try state.requireCurrent(id)
                try await upload(firstUpdate)
                try state.requireCurrent(id)
                continuousSession = ContinuousFallbackSession(id: id, rideSessionId: rideSessionId, role: role, upload: upload)
                manager.startUpdatingLocation()
            } catch {
                if state.owns(id) { stopAllUpdates() }
                throw error
            }
        } onCancel: {
            Task { @MainActor in
                if self.state.owns(id) { self.stopAllUpdates() }
            }
        }
    }

    func stopContinuousUpdates(rideSessionId: String) {
        guard state.revoke(ride: rideSessionId) else { return }
        clearUpdates()
    }

    func stopAllUpdates() {
        state.revoke()
        clearUpdates()
    }

    private func clearUpdates() {
        callbackOwner.withLock { $0 = nil }
        continuousSession = nil
        let stopped = manager; manager = nil
        stopped?.delegate = nil
        stopped?.stopUpdatingLocation()
        let authorization = authorizationContinuation; authorizationContinuation = nil
        let location = locationContinuation; locationContinuation = nil
        authorization?.resume(throwing: CancellationError())
        location?.resume(throwing: CancellationError())
        for task in uploads.values { task.cancel() }
    }

    private func ensureAuthorization(using manager: CLLocationManager) async throws {
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

    private func requestLocation(using manager: CLLocationManager) async throws -> NativeLocationReading {
        try Task.checkCancellation()
        return try await withCheckedThrowingContinuation { continuation in
            guard locationContinuation == nil else {
                continuation.resume(throwing: ProviderConfigurationError(message: "Capture GPS déjà en cours."))
                return
            }
            locationContinuation = continuation
            manager.requestLocation()
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard let id = owner(for: manager) else { return }
        let rawStatus = manager.authorizationStatus.rawValue
        Task { @MainActor in
            guard self.state.owns(id) else { return }
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
        case .none:
            continuation.resume(throwing: ProviderConfigurationError(message: "Statut localisation iOS inconnu."))
        @unknown default:
            continuation.resume(throwing: ProviderConfigurationError(message: "Statut localisation iOS inconnu."))
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let id = owner(for: manager) else { return }
        guard let location = locations.last else { return }
        let reading = NativeLocationReading(location: location)
        Task { @MainActor in
            guard self.state.owns(id) else { return }
            self.handleLocationUpdate(reading)
        }
    }

    private func handleLocationUpdate(_ location: NativeLocationReading) {
        if let continuation = locationContinuation {
            locationContinuation = nil
            continuation.resume(returning: location)
        }
        guard let session = continuousSession else { return }
        let update = NativeLocationBatchUpdate(
            rideSessionId: session.rideSessionId,
            role: session.role,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracyM: location.accuracyM,
            capturedAtMs: location.capturedAtMs,
            speedMps: location.speedMps,
            headingDeg: location.headingDeg
        )
        let uploadId = UUID()
        uploads[uploadId] = Task {
            defer { uploads.removeValue(forKey: uploadId) }
            guard !Task.isCancelled, state.owns(session.id) else { return }
            do {
                let work = try state.beginUpload(session.id)
                defer { state.finishUpload(work) }
                try await session.upload(update)
            } catch { }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard let id = owner(for: manager) else { return }
        let message = error.localizedDescription
        Task { @MainActor in
            guard self.state.owns(id) else { return }
            self.handleLocationFailure(message: message)
        }
    }

    private func handleLocationFailure(message: String) {
        guard let continuation = locationContinuation else { return }
        locationContinuation = nil
        continuation.resume(throwing: ProviderConfigurationError(message: message))
    }

    nonisolated private func owner(for manager: CLLocationManager) -> UUID? {
        let managerId = ObjectIdentifier(manager)
        return callbackOwner.withLock { scope in
            scope?.managerId == managerId ? scope?.owner : nil
        }
    }
}
#endif
