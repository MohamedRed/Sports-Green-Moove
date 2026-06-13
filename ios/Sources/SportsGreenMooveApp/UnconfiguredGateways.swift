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

    func signInWithGoogle() async throws -> AuthSession {
        throw ProviderConfigurationError(message: "Google Auth iOS n'est pas configuré.")
    }

    func signInWithFacebook() async throws -> AuthSession {
        throw ProviderConfigurationError(message: "Facebook Auth iOS n'est pas configuré.")
    }

    func signOut() throws {}
}

struct UnconfiguredFirebaseGateway: FirebaseGateway {
    let isConfigured = false

    func searchTrips() async throws -> [TripSummary] {
        throw ProviderConfigurationError(message: "Firestore iOS n'est pas configuré.")
    }

    func listChildren() async throws -> [ChildSummary] { [] }

    func suggestPlaces(input: String) async throws -> [PlaceSuggestion] {
        _ = input
        throw ProviderConfigurationError(message: "Google Places iOS n'est pas configuré.")
    }

    func resolvePlace(placeId: String) async throws -> ResolvedPlace {
        _ = placeId
        throw ProviderConfigurationError(message: "Google Places iOS n'est pas configuré.")
    }

    func searchTripMatches(criteria: TripSearchCriteria) async throws -> [TripMatchSummary] {
        _ = criteria
        throw ProviderConfigurationError(message: "Cloud Functions iOS n'est pas configuré.")
    }

    func createTrip(draft: TripPublishDraft) async throws -> String {
        _ = draft
        throw ProviderConfigurationError(message: "Cloud Functions iOS n'est pas configuré.")
    }

    func requestBooking(tripId: String, childId: String?) async throws -> String {
        _ = tripId
        _ = childId
        throw ProviderConfigurationError(message: "Cloud Functions iOS n'est pas configuré.")
    }

    func getDriverBookingRequests() async throws -> [BookingRequestSummary] { [] }

    func approveBooking(bookingId: String) async throws -> String {
        _ = bookingId
        throw ProviderConfigurationError(message: "Cloud Functions iOS n'est pas configuré.")
    }

    func startRide(tripId: String, bookingIds: [String]) async throws -> LiveRideSnapshot {
        _ = (tripId, bookingIds)
        throw ProviderConfigurationError(message: "Cloud Functions iOS n'est pas configuré.")
    }

    func getActiveRide() async throws -> LiveRideSnapshot? { nil }

    func markPickup(rideSessionId: String, bookingId: String, childId: String) async throws -> String {
        _ = (rideSessionId, bookingId, childId)
        throw ProviderConfigurationError(message: "Cloud Functions iOS n'est pas configuré.")
    }

    func markDropoff(rideSessionId: String, bookingId: String, childId: String) async throws -> String {
        _ = (rideSessionId, bookingId, childId)
        throw ProviderConfigurationError(message: "Cloud Functions iOS n'est pas configuré.")
    }

    func endRide(rideSessionId: String, distanceMeters: Int, passengersSharing: Int) async throws -> RideCompletionSummary {
        _ = (rideSessionId, distanceMeters, passengersSharing)
        throw ProviderConfigurationError(message: "Cloud Functions iOS n'est pas configuré.")
    }

    func getPayableBookings() async throws -> [PayableBookingSummary] { [] }

    func getInbox() async throws -> InboxSummary {
        throw ProviderConfigurationError(message: "Cloud Functions iOS n'est pas configuré.")
    }

    func submitRating(rideSessionId: String, ratedUserId: String, score: Int, comment: String?) async throws -> String {
        _ = (rideSessionId, ratedUserId, score, comment)
        throw ProviderConfigurationError(message: "Cloud Functions iOS n'est pas configuré.")
    }

    func createReport(subjectType: String, subjectId: String?, reason: String, description: String, emergency: Bool) async throws -> String {
        _ = (subjectType, subjectId, reason, description, emergency)
        throw ProviderConfigurationError(message: "Cloud Functions iOS n'est pas configuré.")
    }

    func writeNativeLocationFallback(rideSessionId: String, role: AppRole) async throws {
        _ = (rideSessionId, role)
        throw ProviderConfigurationError(message: "Realtime Database iOS n'est pas configuré.")
    }

    func stopNativeLocationFallback(rideSessionId: String) {
        _ = rideSessionId
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

struct UnconfiguredStripePaymentsGateway: StripePaymentsGateway {
    let isConfigured = false

    func createStripeAccount(email: String) async throws -> StripeConnectAccount {
        _ = email
        throw ProviderConfigurationError(message: "Stripe iOS n'est pas configuré.")
    }

    func createStripeAccountLink(returnUrl: String, refreshUrl: String) async throws -> StripeConnectAccountLink {
        _ = (returnUrl, refreshUrl)
        throw ProviderConfigurationError(message: "Stripe iOS n'est pas configuré.")
    }

    func prepareRidePayment(bookingId: String) async throws -> PaymentSheetConfig {
        _ = bookingId
        throw ProviderConfigurationError(message: "Stripe iOS n'est pas configuré.")
    }
}
