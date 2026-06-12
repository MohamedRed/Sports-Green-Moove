import Foundation

struct UnconfiguredAuthGateway: AuthGateway {
    let isConfigured = false

    func currentSession() async throws -> AuthSession? { nil }

    func signIn(email: String, password: String) async throws -> AuthSession {
        _ = (email, password)
        throw ProviderConfigurationError(message: "Firebase iOS n'est pas configuré.")
    }

    func signUp(name: String, email: String, password: String) async throws -> AuthSession {
        _ = (name, email, password)
        throw ProviderConfigurationError(message: "Firebase iOS n'est pas configuré.")
    }

    func signOut() throws {}
}

struct UnconfiguredFirebaseGateway: FirebaseGateway {
    let isConfigured = false

    func searchTrips() async throws -> [TripSummary] {
        throw ProviderConfigurationError(message: "Firestore iOS n'est pas configuré.")
    }

    func requestBooking(tripId: String) async throws -> String {
        _ = tripId
        throw ProviderConfigurationError(message: "Cloud Functions iOS n'est pas configuré.")
    }

    func startRide(tripId: String) async throws -> LiveRideSnapshot {
        _ = tripId
        throw ProviderConfigurationError(message: "Cloud Functions iOS n'est pas configuré.")
    }

    func getActiveRide() async throws -> LiveRideSnapshot? { nil }

    func writeNativeLocationFallback(rideSessionId: String) async throws {
        _ = rideSessionId
        throw ProviderConfigurationError(message: "Realtime Database iOS n'est pas configuré.")
    }
}

struct UnconfiguredRadarTrackingGateway: RadarTrackingGateway {
    let isConfigured = false

    func startTripTracking(rideSessionId: String, role: AppRole) async throws {
        _ = (rideSessionId, role)
        throw ProviderConfigurationError(message: "Radar iOS n'est pas configuré.")
    }

    func stopTripTracking(rideSessionId: String) async throws {
        _ = rideSessionId
    }
}

struct UnconfiguredGoogleRoutesGateway: GoogleRoutesGateway {
    let isConfigured = false

    func explainRoute(for tripId: String) async throws -> [String] {
        _ = tripId
        throw ProviderConfigurationError(message: "Google Routes n'est pas configuré côté iOS.")
    }
}

struct UnconfiguredStripePaymentsGateway: StripePaymentsGateway {
    let isConfigured = false

    func prepareRidePayment(bookingId: String) async throws -> PaymentSheetConfig {
        _ = bookingId
        throw ProviderConfigurationError(message: "Stripe iOS n'est pas configuré.")
    }
}
