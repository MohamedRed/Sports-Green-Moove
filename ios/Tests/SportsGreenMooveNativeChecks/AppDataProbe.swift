import Foundation

actor AppDataProbe {
    private let suspended: Set<Int>
    private var calls: [String] = []
    private var pending: [Int: CheckedContinuation<Void, Error>] = [:]
    private var observers: [(Int, CheckedContinuation<Void, Never>)] = []

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

    private func notify() {
        let ready = observers.filter { $0.0 <= calls.count }
        observers.removeAll { $0.0 <= calls.count }
        for (_, continuation) in ready { continuation.resume() }
    }
}

struct AppDataFixtureGateway: FirebaseGateway {
    let isConfigured = true
    let probe: AppDataProbe
    private var unused: UnconfiguredFirebaseGateway { UnconfiguredFirebaseGateway() }

    func searchTrips() async throws -> [TripSummary] {
        let ordinal = try await probe.read("trips")
        return [appDataTrip("read-\(ordinal)")]
    }
    func listChildren() async throws -> [ChildSummary] {
        _ = try await probe.read("children")
        return [ChildSummary(id: "isolated-child", label: "Child", teamLabel: "Isolated team", trackingEnabled: true)]
    }
    func listClubSummaries() async throws -> [ClubSummary] { _ = try await probe.read("clubs"); return [] }
    func getActiveRide() async throws -> LiveRideSnapshot? { _ = try await probe.read("ride"); return nil }
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
    func suggestPlaces(input: String) async throws -> [PlaceSuggestion] { try await unused.suggestPlaces(input: input) }
    func resolvePlace(placeId: String) async throws -> ResolvedPlace { try await unused.resolvePlace(placeId: placeId) }
    func searchTripMatches(criteria: TripSearchCriteria) async throws -> [TripMatchSummary] {
        try await unused.searchTripMatches(criteria: criteria)
    }
    func createTrip(draft: TripPublishDraft) async throws -> String { try await unused.createTrip(draft: draft) }
    func requestBooking(trip: TripSummary, childId: String?, seats: Int) async throws -> String {
        try await unused.requestBooking(trip: trip, childId: childId, seats: seats)
    }
    func approveBooking(bookingId: String) async throws -> String { try await unused.approveBooking(bookingId: bookingId) }
    func startRide(tripId: String, bookingIds: [String]) async throws -> LiveRideSnapshot {
        try await unused.startRide(tripId: tripId, bookingIds: bookingIds)
    }
    func markPickup(rideSessionId: String, bookingId: String, childId: String) async throws -> String {
        try await unused.markPickup(rideSessionId: rideSessionId, bookingId: bookingId, childId: childId)
    }
    func markDropoff(rideSessionId: String, bookingId: String, childId: String) async throws -> String {
        try await unused.markDropoff(rideSessionId: rideSessionId, bookingId: bookingId, childId: childId)
    }
    func endRide(rideSessionId: String, distanceMeters: Int, passengersSharing: Int) async throws -> RideCompletionSummary {
        try await unused.endRide(rideSessionId: rideSessionId, distanceMeters: distanceMeters, passengersSharing: passengersSharing)
    }
    func getInbox() async throws -> InboxSummary { try await unused.getInbox() }
    func submitRating(rideSessionId: String, ratedUserId: String, score: Int, comment: String?) async throws -> String {
        try await unused.submitRating(rideSessionId: rideSessionId, ratedUserId: ratedUserId, score: score, comment: comment)
    }
    func createReport(submission: SupportSubmission) async throws -> String { try await unused.createReport(submission: submission) }
    func writeNativeLocationFallback(rideSessionId: String, role: AppRole) async throws {
        try await unused.writeNativeLocationFallback(rideSessionId: rideSessionId, role: role)
    }
    func stopNativeLocationFallback(rideSessionId: String) { unused.stopNativeLocationFallback(rideSessionId: rideSessionId) }
    func supportReports(uid: String, cursor: String?) async throws -> SupportPage<SupportReport> {
        try await unused.supportReports(uid: uid, cursor: cursor)
    }
    func supportReport(uid: String, reportId: String, cursor: String?) async throws -> SupportDetail {
        try await unused.supportReport(uid: uid, reportId: reportId, cursor: cursor)
    }
    func loadPendingReviews(cursor: String) async throws -> PendingReviewPage {
        try await unused.loadPendingReviews(cursor: cursor)
    }
}

func appDataTrip(_ id: String) -> TripSummary {
    TripSummary(id: id, title: "Isolated trip", club: "Isolated club", category: "Adults",
        departureLabel: "Tomorrow", seatsAvailable: 2, priceLabel: "4 EUR", reasons: [])
}
