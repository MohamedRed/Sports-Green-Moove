import Foundation

protocol AuthGateway: Sendable {
    var isConfigured: Bool { get }
    func currentSession() async throws -> AuthSession?
    func signIn(email: String, password: String) async throws -> AuthSession
    func signUp(name: String, email: String, password: String) async throws -> AuthSession
    func signOut() throws
}

protocol FirebaseGateway: Sendable {
    var isConfigured: Bool { get }
    func searchTrips() async throws -> [TripSummary]
    func suggestPlaces(input: String) async throws -> [PlaceSuggestion]
    func resolvePlace(placeId: String) async throws -> ResolvedPlace
    func searchTripMatches(criteria: TripSearchCriteria) async throws -> [TripMatchSummary]
    func requestBooking(tripId: String) async throws -> String
    func startRide(tripId: String) async throws -> LiveRideSnapshot
    func getActiveRide() async throws -> LiveRideSnapshot?
    func getPayableBookings() async throws -> [PayableBookingSummary]
    func writeNativeLocationFallback(rideSessionId: String, role: AppRole) async throws
}

protocol RadarTrackingGateway: Sendable {
    var isConfigured: Bool { get }
    func startTripTracking(rideSessionId: String, role: AppRole) async throws
    func stopTripTracking(rideSessionId: String) async throws
}

protocol GoogleRoutesGateway: Sendable {
    var isConfigured: Bool { get }
    func explainRoute(for tripId: String) async throws -> [String]
}

protocol StripePaymentsGateway: Sendable {
    var isConfigured: Bool { get }
    func prepareRidePayment(bookingId: String) async throws -> PaymentSheetConfig
}

struct ProviderConfigurationError: LocalizedError, Sendable {
    let message: String

    var errorDescription: String? { message }
}
