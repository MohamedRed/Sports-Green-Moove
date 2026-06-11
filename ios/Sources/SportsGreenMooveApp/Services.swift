import Foundation
import Observation

@MainActor
protocol FirebaseGateway {
    func searchTrips() async throws -> [TripSummary]
    func startRide(tripId: String) async throws -> LiveRideSnapshot
    func writeNativeLocationFallback(rideSessionId: String) async throws
}

@MainActor
protocol RadarTrackingGateway {
    func startTripTracking(rideSessionId: String, role: AppRole) async throws
    func stopTripTracking(rideSessionId: String) async throws
}

@MainActor
protocol GoogleRoutesGateway {
    func explainRoute(for tripId: String) async throws -> [String]
}

@MainActor
protocol StripePaymentsGateway {
    func prepareRidePayment(amountCents: Int) async throws -> String
}

struct MockFirebaseGateway: FirebaseGateway {
    func searchTrips() async throws -> [TripSummary] {
        [
            TripSummary(
                id: "trip-u8-royal",
                title: "U8 NATIONAUX VS ROYAL OTTIGNIES SC",
                club: "Royal Ottignies",
                category: "U8",
                departureLabel: "07 NOV · 16h45",
                seatsAvailable: 2,
                priceLabel: "2,50 EUR",
                reasons: ["+6 min détour", "2 places disponibles", "Même équipe U8", "Suivi enfant disponible"]
            ),
            TripSummary(
                id: "trip-biereau",
                title: "ENTRAÎNEMENT U8 GROUPE B",
                club: "Collège du Biéreau",
                category: "U8",
                departureLabel: "10 NOV · 18h00",
                seatsAvailable: 1,
                priceLabel: "Gratuit",
                reasons: ["+9 min détour", "Même club", "Trajet gratuit"]
            )
        ]
    }

    func startRide(tripId: String) async throws -> LiveRideSnapshot {
        LiveRideSnapshot(
            rideSessionId: "ride-\(tripId)",
            status: "Actif",
            vehicleLastUpdateLabel: "Il y a 12 s",
            childLastUpdateLabel: "Il y a 35 s",
            etaLabel: "Arrivée estimée 16h38",
            stale: false
        )
    }

    func writeNativeLocationFallback(rideSessionId: String) async throws {
        _ = rideSessionId
    }
}

struct MockRadarTrackingGateway: RadarTrackingGateway {
    func startTripTracking(rideSessionId: String, role: AppRole) async throws {
        _ = (rideSessionId, role)
    }

    func stopTripTracking(rideSessionId: String) async throws {
        _ = rideSessionId
    }
}

struct MockGoogleRoutesGateway: GoogleRoutesGateway {
    func explainRoute(for tripId: String) async throws -> [String] {
        _ = tripId
        return ["Détour estimé: 6 min", "Distance supplémentaire: 800 m"]
    }
}

struct MockStripePaymentsGateway: StripePaymentsGateway {
    func prepareRidePayment(amountCents: Int) async throws -> String {
        "payment-intent-client-secret-\(amountCents)"
    }
}

@MainActor
@Observable
final class AppState {
    var selectedTab: AppTab = .home
    var overlay: AppOverlay?
    var selectedRole: AppRole = .parent
    var darkTheme = false
    var trips: [TripSummary] = []
    var activeRide: LiveRideSnapshot?
    var loading = false
    var errorMessage: String?

    let firebase: FirebaseGateway
    let radar: RadarTrackingGateway
    let googleRoutes: GoogleRoutesGateway
    let stripe: StripePaymentsGateway

    init(
        firebase: FirebaseGateway = MockFirebaseGateway(),
        radar: RadarTrackingGateway = MockRadarTrackingGateway(),
        googleRoutes: GoogleRoutesGateway = MockGoogleRoutesGateway(),
        stripe: StripePaymentsGateway = MockStripePaymentsGateway()
    ) {
        self.firebase = firebase
        self.radar = radar
        self.googleRoutes = googleRoutes
        self.stripe = stripe
    }

    @MainActor
    func selectTab(_ tab: AppTab) {
        selectedTab = tab
        overlay = nil
    }

    @MainActor
    func openOverlay(_ destination: AppOverlay) {
        overlay = destination
    }

    @MainActor
    func closeOverlay() {
        overlay = nil
    }

    @MainActor
    func toggleTheme() {
        darkTheme.toggle()
    }

    @MainActor
    func loadTrips() async {
        loading = true
        defer { loading = false }
        do {
            trips = try await firebase.searchTrips()
        } catch {
            errorMessage = "Impossible de charger les trajets."
        }
    }

    @MainActor
    func startRide(tripId: String) async {
        do {
            let ride = try await firebase.startRide(tripId: tripId)
            try await radar.startTripTracking(rideSessionId: ride.rideSessionId, role: selectedRole)
            activeRide = ride
            selectedTab = .trips
            overlay = .ride
        } catch {
            errorMessage = "Impossible de démarrer le suivi."
        }
    }
}
