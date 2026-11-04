import Foundation

#if os(iOS) && canImport(CoreLocation) && canImport(UserNotifications)
import CoreLocation
import UserNotifications
#endif

protocol ActiveRidePermissionAuthorizing: Sendable {
    @MainActor func ensureReadyForActiveRide() async throws
    @MainActor func cancelPending()
}

struct SystemRidePermissions: ActiveRidePermissionAuthorizing {
    @MainActor func ensureReadyForActiveRide() async throws {
        try await ActiveRidePermissionCoordinator.shared.ensureReadyForActiveRide()
    }
    @MainActor func cancelPending() { ActiveRidePermissionCoordinator.cancelPendingIfCreated() }
}

struct ActiveRidePermissionDisclosure: Identifiable, Equatable, Sendable {
    let id = UUID()
    let tripId: String?
}

enum ActiveRidePermissionCopy {
    static let title = "Suivi de course"
    static let body = "Pendant une course active, SPORTS GREEN-mOOVe partage votre position précise en arrière-plan pour afficher le véhicule, l'enfant, l'ETA et les alertes de position périmée aux parents."
    static let cancel = "Annuler"
    static let continueAction = "Continuer"
    static let canceled = "Suivi de course annulé avant l'autorisation de localisation."
    static let blocked = "Autorisez la localisation Toujours et les notifications pour démarrer une course suivie."
}

extension AppState {
    func requestActiveRideStart(tripId: String) {
        guard selectedRole == .driver, session?.roles.contains(.driver) == true, !rideRequests.busy else { return }
        activeRidePermissionDisclosure = ActiveRidePermissionDisclosure(tripId: tripId)
    }

    func requestActiveRideTracking() {
        guard selectedRole == .child, session?.roles.contains(.child) == true, !rideRequests.busy else { return }
        activeRidePermissionDisclosure = ActiveRidePermissionDisclosure(tripId: nil)
    }

    func cancelActiveRideStart() {
        rideRequests.invalidate()
        ridePermissions.cancelPending()
        activeRidePermissionDisclosure = nil
        noticeMessage = ActiveRidePermissionCopy.canceled
    }

    func confirmActiveRideStart() async {
        guard let pendingRide = activeRidePermissionDisclosure,
              pendingRide.tripId == nil ? selectedRole == .child : selectedRole == .driver,
              let request = beginRideRequest() else { return }
        activeRidePermissionDisclosure = nil
        defer { rideRequests.finish(request) }

        do {
            try await ridePermissions.ensureReadyForActiveRide()
            try requireCurrentRideRequest(request)
            await runRideStart(tripId: pendingRide.tripId, request: request)
        } catch {
            guard !Task.isCancelled, rideRequests.owns(request, uid: session?.uid, role: selectedRole) else { return }
            errorMessage = error.localizedDescription
        }
    }
}

#if os(iOS) && canImport(CoreLocation) && canImport(UserNotifications)
@MainActor
final class ActiveRidePermissionCoordinator: NSObject, CLLocationManagerDelegate {
    private static var existing: ActiveRidePermissionCoordinator?
    static var shared: ActiveRidePermissionCoordinator {
        if let existing { return existing }
        let result = ActiveRidePermissionCoordinator(); existing = result; return result
    }
    static func cancelPendingIfCreated() { existing?.cancelPending() }

    private let manager = CLLocationManager()
    private var authorizationContinuation: CheckedContinuation<Void, Error>?
    private var requestRevision = UUID()
    private var pendingRequest: UUID?

    private override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.allowsBackgroundLocationUpdates = true
        manager.pausesLocationUpdatesAutomatically = false
    }

    private func cancelPending() {
        requestRevision = UUID()
        let pending = authorizationContinuation; authorizationContinuation = nil
        pending?.resume(throwing: CancellationError())
    }

    func ensureReadyForActiveRide() async throws {
        guard pendingRequest == nil else {
            throw ProviderConfigurationError(message: "Une autorisation est déjà en cours.")
        }
        let id = UUID(); requestRevision = id; pendingRequest = id
        defer { if pendingRequest == id { pendingRequest = nil } }
        func requireCurrent() throws {
            try Task.checkCancellation()
            guard requestRevision == id, pendingRequest == id else { throw CancellationError() }
        }
        try requireCurrent()
        try await ensureAlwaysLocationAuthorization()
        try requireCurrent()
        try await ensureNotificationAuthorization(requireCurrent: requireCurrent)
        try requireCurrent()
        let notificationSettings = await UNUserNotificationCenter.current().notificationSettings()
        try requireCurrent()
        guard ActiveRidePermissionPolicy.canStartActiveRide(
            ActiveRidePermissionSnapshot(
                hasForegroundLocation: manager.authorizationStatus == .authorizedAlways || manager.authorizationStatus == .authorizedWhenInUse,
                hasBackgroundLocation: manager.authorizationStatus == .authorizedAlways,
                hasNotifications: notificationSettings.authorizationStatus.allowsActiveRideAlerts
            )
        ) else {
            throw ProviderConfigurationError(message: ActiveRidePermissionCopy.blocked)
        }
    }

    private func ensureAlwaysLocationAuthorization() async throws {
        switch manager.authorizationStatus {
        case .authorizedAlways:
            return
        case .notDetermined, .authorizedWhenInUse:
            try await requestAlwaysAuthorization()
            guard manager.authorizationStatus == .authorizedAlways else {
                throw ProviderConfigurationError(message: ActiveRidePermissionCopy.blocked)
            }
        case .denied, .restricted:
            throw ProviderConfigurationError(message: ActiveRidePermissionCopy.blocked)
        @unknown default:
            throw ProviderConfigurationError(message: "Statut localisation iOS inconnu.")
        }
    }

    private func requestAlwaysAuthorization() async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            guard authorizationContinuation == nil else {
                continuation.resume(throwing: ProviderConfigurationError(message: "Demande d'autorisation localisation déjà en cours."))
                return
            }
            authorizationContinuation = continuation
            manager.requestAlwaysAuthorization()
        }
    }

    private func ensureNotificationAuthorization(requireCurrent: () throws -> Void) async throws {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        try requireCurrent()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            return
        case .notDetermined:
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            try requireCurrent()
            guard granted else {
                throw ProviderConfigurationError(message: ActiveRidePermissionCopy.blocked)
            }
        case .denied:
            throw ProviderConfigurationError(message: ActiveRidePermissionCopy.blocked)
        @unknown default:
            throw ProviderConfigurationError(message: "Statut notification iOS inconnu.")
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
        switch CLAuthorizationStatus(rawValue: rawStatus) {
        case .authorizedAlways:
            authorizationContinuation = nil
            continuation.resume(returning: ())
        case .authorizedWhenInUse:
            authorizationContinuation = nil
            continuation.resume(throwing: ProviderConfigurationError(message: ActiveRidePermissionCopy.blocked))
        case .denied, .restricted:
            authorizationContinuation = nil
            continuation.resume(throwing: ProviderConfigurationError(message: ActiveRidePermissionCopy.blocked))
        case .notDetermined:
            break
        case .none:
            authorizationContinuation = nil
            continuation.resume(throwing: ProviderConfigurationError(message: "Statut localisation iOS inconnu."))
        @unknown default:
            authorizationContinuation = nil
            continuation.resume(throwing: ProviderConfigurationError(message: "Statut localisation iOS inconnu."))
        }
    }
}

private extension UNAuthorizationStatus {
    var allowsActiveRideAlerts: Bool {
        switch self {
        case .authorized, .provisional, .ephemeral:
            return true
        case .denied, .notDetermined:
            return false
        @unknown default:
            return false
        }
    }
}
#else
struct ActiveRidePermissionCoordinator {
    static let shared = ActiveRidePermissionCoordinator()
    static func cancelPendingIfCreated() {}

    func ensureReadyForActiveRide() async throws {
        throw ProviderConfigurationError(message: "Le suivi de course requiert l'environnement iOS.")
    }
}
#endif
