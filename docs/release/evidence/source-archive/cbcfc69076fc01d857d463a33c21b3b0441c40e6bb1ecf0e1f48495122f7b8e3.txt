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

protocol FirebaseGateway: AppDataGateway, InitializedProfileGateway, SupportGateway, MessagesGateway, EmergencyContactGateway, TeamChatGateway, RideChatGateway, ReceivedRatingsGateway, MembershipGateway, ProfileCityGateway {
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
    func createReport(submission: SupportSubmission) async throws -> String
    @MainActor func writeNativeLocationFallback(rideSessionId: String, role: AppRole) async throws
    @MainActor func stopNativeLocationFallback(rideSessionId: String)
    @MainActor func stopAllNativeLocationFallback()
    @MainActor var nativeLocationWorkPending: Bool { get }
    @MainActor func awaitNativeLocationShutdown() async
}

protocol RadarTrackingGateway: Sendable {
    var isConfigured: Bool { get }
    func startTripTracking(rideSessionId: String, role: AppRole) async throws
    func stopTripTracking(rideSessionId: String) async throws
    @MainActor func stopLocalTracking()
}
