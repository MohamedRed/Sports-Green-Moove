import Foundation

#if os(iOS) && canImport(CoreLocation) && canImport(UserNotifications)
import CoreLocation
import UserNotifications
#endif

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
        activeRidePermissionDisclosure = ActiveRidePermissionDisclosure(tripId: tripId)
    }

    func requestActiveRideTracking() {
        activeRidePermissionDisclosure = ActiveRidePermissionDisclosure(tripId: nil)
    }

    func cancelActiveRideStart() {
        activeRidePermissionDisclosure = nil
        noticeMessage = ActiveRidePermissionCopy.canceled
    }

    func confirmActiveRideStart() async {
        guard let pendingRide = activeRidePermissionDisclosure else { return }
        activeRidePermissionDisclosure = nil

        do {
            try await ActiveRidePermissionCoordinator.shared.ensureReadyForActiveRide()
            if let tripId = pendingRide.tripId {
                await startRideAfterPermissionGate(tripId: tripId)
            } else {
                await startAccessibleRideTrackingAfterPermissionGate()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#if os(iOS) && canImport(CoreLocation) && canImport(UserNotifications)
@MainActor
final class ActiveRidePermissionCoordinator: NSObject, CLLocationManagerDelegate {
    static let shared = ActiveRidePermissionCoordinator()

    private let manager = CLLocationManager()
    private var authorizationContinuation: CheckedContinuation<Void, Error>?

    private override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.allowsBackgroundLocationUpdates = true
        manager.pausesLocationUpdatesAutomatically = false
    }

    func ensureReadyForActiveRide() async throws {
        try await ensureAlwaysLocationAuthorization()
        try await ensureNotificationAuthorization()
        let notificationSettings = await UNUserNotificationCenter.current().notificationSettings()
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
        try await withCheckedThrowingContinuation { continuation in
            if let existing = authorizationContinuation {
                existing.resume(throwing: ProviderConfigurationError(message: "Demande d'autorisation localisation déjà en cours."))
            }
            authorizationContinuation = continuation
            manager.requestAlwaysAuthorization()
        }
    }

    private func ensureNotificationAuthorization() async throws {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            return
        case .notDetermined:
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
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

    func ensureReadyForActiveRide() async throws {
        throw ProviderConfigurationError(message: "Le suivi de course requiert l'environnement iOS.")
    }
}
#endif
