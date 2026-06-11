import Foundation

@MainActor
protocol AuthGateway {
    var isConfigured: Bool { get }
    func currentSession() async throws -> AuthSession?
    func signIn(email: String, password: String) async throws -> AuthSession
    func signUp(name: String, email: String, password: String) async throws -> AuthSession
    func signOut() throws
}

@MainActor
protocol FirebaseGateway {
    var isConfigured: Bool { get }
    func searchTrips() async throws -> [TripSummary]
    func requestBooking(tripId: String) async throws -> String
    func startRide(tripId: String) async throws -> LiveRideSnapshot
    func getActiveRide() async throws -> LiveRideSnapshot?
    func writeNativeLocationFallback(rideSessionId: String) async throws
}

@MainActor
protocol RadarTrackingGateway {
    var isConfigured: Bool { get }
    func startTripTracking(rideSessionId: String, role: AppRole) async throws
    func stopTripTracking(rideSessionId: String) async throws
}

@MainActor
protocol GoogleRoutesGateway {
    var isConfigured: Bool { get }
    func explainRoute(for tripId: String) async throws -> [String]
}

@MainActor
protocol StripePaymentsGateway {
    var isConfigured: Bool { get }
    func prepareRidePayment(amountCents: Int) async throws -> String
}

struct ProviderConfigurationError: LocalizedError {
    let message: String

    var errorDescription: String? { message }
}
