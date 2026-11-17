import Foundation

struct BookingProbeSubmission: Equatable, Sendable {
    let uid: String
    let trip: TripSummary
    let childId: String?
    let seats: Int
}

actor AppDataProbe {
    private let suspended: Set<Int>
    private var calls: [String] = []
    private var pending: [Int: CheckedContinuation<Void, Error>] = [:]
    private var observers: [(Int, CheckedContinuation<Void, Never>)] = []
    private var submissions: [BookingProbeSubmission] = []

    init(suspended: Set<Int> = []) { self.suspended = suspended }

    func read(_ name: String) async throws -> Int {
        calls.append(name)
        let ordinal = calls.count
        if suspended.contains(ordinal) {
            try await withCheckedThrowingContinuation { continuation in
                pending[ordinal] = continuation
                notify()
            }
        } else { notify() }
        return ordinal
    }

    func waitForCall(_ count: Int) async {
        if calls.count >= count { return }
        await withCheckedContinuation { observers.append((count, $0)) }
    }

    func release(_ ordinal: Int, failing: Bool = false) {
        guard let continuation = pending.removeValue(forKey: ordinal) else {
            preconditionFailure("Requested app-data checkpoint was not suspended")
        }
        if failing { continuation.resume(throwing: ProviderConfigurationError(message: "Isolated read failure")) }
        else { continuation.resume() }
    }

    func names() -> [String] { calls }
    func capture(_ submission: BookingProbeSubmission) { submissions.append(submission) }
    func capturedBookings() -> [BookingProbeSubmission] { submissions }

    private func notify() {
        let ready = observers.filter { $0.0 <= calls.count }
        observers.removeAll { $0.0 <= calls.count }
        for (_, continuation) in ready { continuation.resume() }
    }
}

struct AppDataFixtureGateway: FirebaseGateway {
    func guardianContacts(uid: String, cursor: String?) async throws -> GuardianContactPage { throw EmergencyContactError.unavailable }
    func emergencyContact(uid: String, scope: EmergencyContactScope) async throws -> EmergencyContactView? { throw EmergencyContactError.unavailable }
    func saveEmergencyContact(uid: String, operation: EmergencyContactOperation) async throws -> Int64 { throw EmergencyContactError.unavailable }
    let isConfigured = true
    let probe: AppDataProbe
    var profiles: ProfileInitializationProbe? = nil
    var rides: RideLifecycleProbe? = nil
    var rideStops: RideLocalStops? = nil
    var publications: AppDataProbe? = nil
    var searches: AppDataProbe? = nil
    var searchResult: TripMatchSummary? = nil
    var bookings: AppDataProbe? = nil
    var bookingStatus = "approved"
    var expectedBookingTrip: TripSummary? = nil
    var bookingReviewRequired = false
    var locationShutdown: LocationSessionState? = nil
    private var unused: UnconfiguredFirebaseGateway { UnconfiguredFirebaseGateway() }

    func initializeProfile(identity: AuthIdentity, displayName: String?) async throws -> AuthSession {
        if let profiles { return try await profiles.prepare(identity, displayName: displayName) }
        return AuthSession(uid: identity.uid, email: identity.email, displayName: displayName, roles: [.parent])
    }

    func searchTrips() async throws -> [TripSummary] {
        let ordinal = try await probe.read("trips")
        return [appDataTrip("read-\(ordinal)")]
    }
    func listChildren() async throws -> [ChildSummary] {
        _ = try await probe.read("children")
        return [ChildSummary(id: "isolated-child", label: "Child", teamLabel: "Isolated team", trackingEnabled: true)]
    }
    func listClubSummaries() async throws -> [ClubSummary] { _ = try await probe.read("clubs"); return [] }
    func getActiveRide() async throws -> LiveRideSnapshot? {
        if let rides { try await rides.step("get-ride"); return isolatedRide() }
        _ = try await probe.read("ride"); return nil
    }
    func getPayableBookings() async throws -> [PayableBookingSummary] { _ = try await probe.read("payable"); return [] }
    func getImpactSummary() async throws -> ImpactSummary {
        _ = try await probe.read("impact")
        return ImpactSummary(totalCo2Kg: 3, sharedDistanceKm: 4, rideCount: 1, months: [])
    }
    func getRewardSummary() async throws -> RewardSummary {
        _ = try await probe.read("rewards")
        return RewardSummary(balanceCents: 42, nextTierCents: 500, progress: 0.084, entries: [])
    }
    func getDriverBookingRequests() async throws -> [BookingRequestSummary] {
        _ = try await probe.read("requests"); return []
    }
    func suggestPlaces(uid: String, input: String) async throws -> [PlaceSuggestion] {
        if let publications {
            _ = try await publications.read("suggest")
            return [PlaceSuggestion(placeId: "isolated-origin", label: "Synthetic place", mainText: nil, secondaryText: nil)]
        }
        return try await unused.suggestPlaces(uid: uid, input: input)
    }
    func resolvePlace(uid: String, placeId: String) async throws -> ResolvedPlace {
        if let publications { _ = try await publications.read("resolve"); return isolatedPublishDraft().origin }
        return try await unused.resolvePlace(uid: uid, placeId: placeId)
    }
    func searchTripMatches(criteria: TripSearchCriteria) async throws -> [TripMatchSummary] {
        if let searches {
            _ = try await searches.read("matches")
            if let searchResult { return [searchResult] }
            let trip = appDataTrip("isolated-search-trip")
            return [.init(tripId: trip.id, score: 1, summary: trip, reasons: [], detourMinutes: nil, pickupDistanceMeters: nil)]
        }
        return try await unused.searchTripMatches(criteria: criteria)
    }
    func createTrip(draft: TripPublishDraft) async throws -> String {
        if let publications { _ = try await publications.read("publish"); return "isolated-trip" }
        return try await unused.createTrip(draft: draft)
    }
    func requestBooking(uid: String, trip: TripSummary, childId: String?, seats: Int) async throws -> String {
        if let bookings {
            check(uid == "isolated-owner", "Booking gateway changed its originating account")
            await bookings.capture(.init(uid: uid, trip: trip, childId: childId, seats: seats))
            if let expectedBookingTrip {
                check(trip == expectedBookingTrip && childId == nil && seats == 1, "Trip action adopted freshly loaded terms")
            } else { check(childId == "isolated-child" && seats == 2, "Booking lost its captured child or seats") }
            _ = try await bookings.read("request")
            if bookingReviewRequired { throw BookingReviewRequiredError() }
            return "isolated-booking"
        }
        return try await unused.requestBooking(uid: uid, trip: trip, childId: childId, seats: seats)
    }
    func approveBooking(uid: String, bookingId: String) async throws -> String {
        check(uid == "isolated-owner", "Booking approval changed its originating account")
        if let bookings { _ = try await bookings.read("approve"); return bookingStatus }
        return try await unused.approveBooking(uid: uid, bookingId: bookingId)
    }
    func startRide(tripId: String, bookingIds: [String]) async throws -> LiveRideSnapshot {
        if let rides { try await rides.step("start-ride"); return isolatedRide() }
        return try await unused.startRide(tripId: tripId, bookingIds: bookingIds)
    }
    func markPickup(rideSessionId: String, bookingId: String, childId: String) async throws -> String {
        if let rides { try await rides.step("pickup"); return "pickedUp" }
        return try await unused.markPickup(rideSessionId: rideSessionId, bookingId: bookingId, childId: childId)
    }
    func markDropoff(rideSessionId: String, bookingId: String, childId: String) async throws -> String {
        if let rides { try await rides.step("dropoff"); return "droppedOff" }
        return try await unused.markDropoff(rideSessionId: rideSessionId, bookingId: bookingId, childId: childId)
    }
    func endRide(rideSessionId: String, distanceMeters: Int, passengersSharing: Int) async throws -> RideCompletionSummary {
        if let rides {
            try await rides.step("end-ride")
            return RideCompletionSummary(rideSessionId: rideSessionId, co2SavedKg: 1, rewardCents: 1)
        }
        return try await unused.endRide(rideSessionId: rideSessionId, distanceMeters: distanceMeters, passengersSharing: passengersSharing)
    }
    func getInbox(uid: String) async throws -> InboxSummary { try await unused.getInbox(uid: uid) }
    func submitRating(uid: String, rideSessionId: String, ratedUserId: String, score: Int, comment: String?) async throws -> String {
        try await unused.submitRating(uid: uid, rideSessionId: rideSessionId, ratedUserId: ratedUserId, score: score, comment: comment)
    }
    func createReport(submission: SupportSubmission) async throws -> String { try await unused.createReport(submission: submission) }
    func writeNativeLocationFallback(rideSessionId: String, role: AppRole) async throws {
        if let rides { try await rides.step("native-start"); return }
        try await unused.writeNativeLocationFallback(rideSessionId: rideSessionId, role: role)
    }
    @MainActor func stopNativeLocationFallback(rideSessionId: String) { unused.stopNativeLocationFallback(rideSessionId: rideSessionId) }
    @MainActor func stopAllNativeLocationFallback() { rideStops?.native += 1; locationShutdown?.revoke() }
    @MainActor var nativeLocationWorkPending: Bool { locationShutdown?.hasPendingWork ?? false }
    @MainActor func awaitNativeLocationShutdown() async { await locationShutdown?.waitUntilIdle() }
    func supportReports(uid: String, cursor: String?) async throws -> SupportPage<SupportReport> {
        try await unused.supportReports(uid: uid, cursor: cursor)
    }
    func supportReport(uid: String, reportId: String, cursor: String?) async throws -> SupportDetail {
        try await unused.supportReport(uid: uid, reportId: reportId, cursor: cursor)
    }
    func loadPendingReviews(uid: String, cursor: String) async throws -> PendingReviewPage {
        try await unused.loadPendingReviews(uid: uid, cursor: cursor)
    }
}

func appDataTrip(_ id: String) -> TripSummary {
    TripSummary(id: id, title: "Isolated trip", club: "Isolated club", category: "Adults",
        departureLabel: "Tomorrow", seatsAvailable: 2, priceLabel: "4 EUR", reasons: [])
}
