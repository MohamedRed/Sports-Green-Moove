import Foundation

protocol AuthGateway: Sendable {
    var isConfigured: Bool { get }
    func currentSession() async throws -> AuthIdentity?
    func signIn(email: String, password: String) async throws -> AuthIdentity
    func signUp(name: String, email: String, password: String) async throws -> AuthIdentity
    func signInWithGoogle() async throws -> AuthIdentity
    func signInWithFacebook() async throws -> AuthIdentity
    @MainActor func signOut() throws
}

protocol FirebaseGateway: AppDataGateway, InitializedProfileGateway, SupportGateway, PendingReviewGateway {
    var isConfigured: Bool { get }
    func suggestPlaces(input: String) async throws -> [PlaceSuggestion]
    func resolvePlace(placeId: String) async throws -> ResolvedPlace
    func searchTripMatches(criteria: TripSearchCriteria) async throws -> [TripMatchSummary]
    func createTrip(draft: TripPublishDraft) async throws -> String
    func requestBooking(trip: TripSummary, childId: String?, seats: Int) async throws -> String
    func approveBooking(bookingId: String) async throws -> String
    func startRide(tripId: String, bookingIds: [String]) async throws -> LiveRideSnapshot
    func markPickup(rideSessionId: String, bookingId: String, childId: String) async throws -> String
    func markDropoff(rideSessionId: String, bookingId: String, childId: String) async throws -> String
    func endRide(rideSessionId: String, distanceMeters: Int, passengersSharing: Int) async throws -> RideCompletionSummary
    func getInbox() async throws -> InboxSummary
    func submitRating(rideSessionId: String, ratedUserId: String, score: Int, comment: String?) async throws -> String
    func createReport(submission: SupportSubmission) async throws -> String
    func writeNativeLocationFallback(rideSessionId: String, role: AppRole) async throws
    func stopNativeLocationFallback(rideSessionId: String)
}

protocol RadarTrackingGateway: Sendable {
    var isConfigured: Bool { get }
    func startTripTracking(rideSessionId: String, role: AppRole) async throws
    func stopTripTracking(rideSessionId: String) async throws
}

protocol StripePaymentsGateway: Sendable {
    var isConfigured: Bool { get }
    func createStripeAccount(email: String) async throws -> StripeConnectAccount
    func createStripeAccountLink(returnUrl: String, refreshUrl: String) async throws -> StripeConnectAccountLink
    func prepareRidePayment(bookingId: String) async throws -> PaymentSheetConfig
    func ridePaymentStatus(bookingId: String, paymentIntentId: String) async throws -> RidePaymentState
}
