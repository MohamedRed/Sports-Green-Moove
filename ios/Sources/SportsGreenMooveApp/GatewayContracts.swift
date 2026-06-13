import Foundation

protocol AuthGateway: Sendable {
    var isConfigured: Bool { get }
    func currentSession() async throws -> AuthSession?
    func signIn(email: String, password: String) async throws -> AuthSession
    func signUp(name: String, email: String, password: String) async throws -> AuthSession
    func signInWithGoogle() async throws -> AuthSession
    func signInWithFacebook() async throws -> AuthSession
    func signOut() throws
}

protocol FirebaseGateway: Sendable {
    var isConfigured: Bool { get }
    func searchTrips() async throws -> [TripSummary]
    func listChildren() async throws -> [ChildSummary]
    func suggestPlaces(input: String) async throws -> [PlaceSuggestion]
    func resolvePlace(placeId: String) async throws -> ResolvedPlace
    func searchTripMatches(criteria: TripSearchCriteria) async throws -> [TripMatchSummary]
    func createTrip(draft: TripPublishDraft) async throws -> String
    func requestBooking(tripId: String, childId: String?) async throws -> String
    func getDriverBookingRequests() async throws -> [BookingRequestSummary]
    func approveBooking(bookingId: String) async throws -> String
    func startRide(tripId: String, bookingIds: [String]) async throws -> LiveRideSnapshot
    func getActiveRide() async throws -> LiveRideSnapshot?
    func markPickup(rideSessionId: String, bookingId: String, childId: String) async throws -> String
    func markDropoff(rideSessionId: String, bookingId: String, childId: String) async throws -> String
    func endRide(rideSessionId: String, distanceMeters: Int, passengersSharing: Int) async throws -> RideCompletionSummary
    func getPayableBookings() async throws -> [PayableBookingSummary]
    func getInbox() async throws -> InboxSummary
    func submitRating(rideSessionId: String, ratedUserId: String, score: Int, comment: String?) async throws -> String
    func createReport(subjectType: String, subjectId: String?, reason: String, description: String, emergency: Bool) async throws -> String
    func writeNativeLocationFallback(rideSessionId: String, role: AppRole) async throws
    func stopNativeLocationFallback(rideSessionId: String)
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
    func createStripeAccount(email: String) async throws -> StripeConnectAccount
    func createStripeAccountLink(returnUrl: String, refreshUrl: String) async throws -> StripeConnectAccountLink
    func prepareRidePayment(bookingId: String) async throws -> PaymentSheetConfig
}

struct ProviderConfigurationError: LocalizedError, Sendable {
    let message: String

    var errorDescription: String? { message }
}
