import Foundation

actor RideLifecycleProbe {
    private let suspended: String
    private var calls: [String] = []
    private var pending: CheckedContinuation<Void, Error>?
    private var observer: CheckedContinuation<Void, Never>?
    private var didSuspend = false

    init(suspended: String) { self.suspended = suspended }

    func step(_ name: String) async throws {
        calls.append(name)
        if name == suspended, !didSuspend {
            didSuspend = true
            try await withCheckedThrowingContinuation { continuation in
                pending = continuation
                observer?.resume(); observer = nil
            }
        }
    }

    func wait() async {
        if pending != nil { return }
        await withCheckedContinuation { observer = $0 }
    }

    func release(failing: Bool = false) {
        guard let pending else { preconditionFailure("Missing ride checkpoint") }
        self.pending = nil
        if failing { pending.resume(throwing: ProviderConfigurationError(message: "Isolated ride failure")) }
        else { pending.resume() }
    }

    func names() -> [String] { calls }
}

@MainActor final class RideLocalStops {
    var native = 0
    var radar = 0
    var permissions = 0
}

struct RideRadarFixture: RadarTrackingGateway {
    let isConfigured = true
    let probe: RideLifecycleProbe
    let stops: RideLocalStops
    @MainActor func stopLocalTracking() { stops.radar += 1 }
    func startTripTracking(rideSessionId: String, role: AppRole) async throws { try await probe.step("radar") }
    func stopTripTracking(rideSessionId: String) async throws { try await probe.step("radar-stop") }
}

struct RidePermissionFixture: ActiveRidePermissionAuthorizing {
    let probe: RideLifecycleProbe
    let stops: RideLocalStops
    @MainActor func ensureReadyForActiveRide() async throws { try await probe.step("permission") }
    @MainActor func cancelPending() { stops.permissions += 1 }
}

func isolatedRide() -> LiveRideSnapshot {
    LiveRideSnapshot(rideSessionId: "isolated-ride", tripId: "isolated-trip", status: "active",
        vehicleLastUpdateLabel: "Isolated vehicle", childLastUpdateLabel: nil, etaLabel: "Isolated ETA",
        stale: false, passengers: [])
}
