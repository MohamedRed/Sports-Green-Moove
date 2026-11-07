import Foundation

#if DEBUG
@MainActor
enum UITestAppStateFactory {
    static var isEnabled: Bool {
        ProcessInfo.processInfo.arguments.contains("--sgm-ui-test-fixture")
    }

    static func make() -> AppState {
        let route = argumentValue(after: "--sgm-ui-route") ?? "home"
        let signedIn = route != "auth"
        let profile = route == "child-contact" ? Fixtures.childSession : route == "groups-review"
            ? AuthSession(uid: "ui-user", email: "manager@example.test", displayName: "Responsable Démo", roles: [.clubManager]) : Fixtures.session
        let auth = UITestAuthGateway(session: signedIn ? profile : nil)
        let state = AppState(
            auth: auth,
            firebase: UITestFirebaseGateway(),
            radar: UITestRadarGateway(),
            stripe: UITestStripeGateway(),
            authentication: AuthenticationState(makeStore: { UITestLogoutIntentStore() })
        )
        seed(state, route: route, signedIn: signedIn, profile: profile)
        return state
    }

    private static func seed(_ state: AppState, route: String, signedIn: Bool, profile: AuthSession) {
        state.session = signedIn ? profile : nil
        state.selectedRole = profile.roles[0]
        state.trips = [Fixtures.trip]
        state.children = [Fixtures.child, Fixtures.otherChild]
        state.clubSummaries = Fixtures.clubs
        state.activeRide = Fixtures.activeRide
        state.activeRideTrip = Fixtures.trip
        state.payableBookings = [Fixtures.payableBooking]
        state.driverBookingRequests = [Fixtures.bookingRequest]
        state.impactSummary = Fixtures.impact
        state.rewardSummary = Fixtures.rewards
        state.searchOrigin = Fixtures.origin
        state.searchDestination = Fixtures.destination

        switch route {
        case "auth":
            state.session = nil
        case "booking":
            state.selectedRole = .driver
            state.selectedTab = .trips
        case "publish":
            state.selectedRole = .driver
            state.selectedTab = .publish
        case "messages":
            state.selectedTab = .messages
        case "search":
            state.overlay = .search
        case "groups", "groups-review":
            state.overlay = .groups
        case "impact":
            state.overlay = .impact
        case "rewards":
            state.overlay = .rewards
        case "options":
            state.overlay = .options
        case "payments":
            state.overlay = .payments
        case "ride":
            state.overlay = .ride
        default:
            state.selectedTab = .home
        }
    }

    private static func argumentValue(after key: String) -> String? {
        let args = ProcessInfo.processInfo.arguments
        guard let index = args.firstIndex(of: key), args.indices.contains(index + 1) else { return nil }
        return args[index + 1]
    }
}

@MainActor private final class UITestLogoutIntentStore: LogoutIntentStore {
    private var required = false
    func requiresSignOut() throws -> Bool { required }
    func setRequiresSignOut(_ value: Bool) throws { required = value }
}

private enum Fixtures {
    static let childSession = AuthSession(uid: "ui-child-login", email: nil, displayName: "Enfant Démo", roles: [.child])
    static let session = AuthSession(uid: "ui-user", email: "parent@example.be", displayName: "Parent Démo",
        roles: [.parent, .driver])
    static let origin = ResolvedPlace(placeId: "origin", label: "Wavre", formattedAddress: "Rue du Stade 1, Wavre", lat: 50.715, lng: 4.612)
    static let destination = ResolvedPlace(placeId: "dest", label: "Ottignies", formattedAddress: "Avenue du Club 8, Ottignies", lat: 50.669, lng: 4.567)
    static let child = ChildSummary(id: "child-1", label: "Nora", teamLabel: "U8 Royal Ottignies", trackingEnabled: true)
    static let otherChild = ChildSummary(id: "child-2", label: "Maya", teamLabel: "U10 Royal Ottignies", trackingEnabled: true)
    static let clubs = [
        ClubSummary(id: "club-royal", name: "Royal Ottignies Sports", sport: "Football", memberCount: 89, roleLabel: "PARENT", initials: "RO", memberInitials: ["NO", "CO"], membershipStatus: "active", membershipActive: true),
        ClubSummary(id: "club-tennis", name: "Tennis Club Wavre", sport: "Tennis", memberCount: 56, roleLabel: nil, initials: "TC", memberInitials: []),
    ]
    static let route = MapRoutePreview(start: MapPoint(lat: 50.715, lng: 4.612), end: MapPoint(lat: 50.669, lng: 4.567))

    static let trip = TripSummary(
        id: "trip-1",
        title: "U8 Nationaux vs Royal Ottignies SC",
        club: "Royal Ottignies",
        category: "U8",
        departureLabel: "Aujourd'hui 16h45",
        seatsAvailable: 2,
        priceLabel: "4,00 EUR",
        passengerInitials: ["NO"],
        reasons: ["+6 min détour", "Même équipe U8"],
        mapPreview: route
    )

    static let match = TripMatchSummary(
        tripId: trip.id,
        score: 91,
        summary: trip,
        reasons: trip.reasons,
        detourMinutes: 6,
        pickupDistanceMeters: 850
    )

    static let bookingRequest = BookingRequestSummary(
        bookingId: "booking-1",
        tripId: trip.id,
        parentUserId: "parent-123456",
        childId: child.id,
        childLabel: child.label,
        seats: 1,
        note: "Besoin d'un siège enfant.",
        status: "requested",
        title: trip.title,
        club: trip.club,
        dateLabel: trip.dateLabel,
        timeLabel: trip.timeLabel,
        priceLabel: trip.priceLabel
    )

    static let activeRide = LiveRideSnapshot(
        rideSessionId: "ride-session-1",
        tripId: trip.id,
        status: "active",
        vehicleLastUpdateLabel: "Il y a 1 min",
        childLastUpdateLabel: "Il y a 2 min",
        etaLabel: "Arrivée 17h05",
        stale: false,
        passengers: [RidePassengerStatus(bookingId: "booking-1", childId: child.id, label: child.label, pickupStatus: "pending", dropoffStatus: "pending")]
    )

    static let payableBooking = PayableBookingSummary(
        id: "booking-1",
        tripId: trip.id,
        title: trip.title,
        club: trip.club,
        dateLabel: trip.dateLabel,
        timeLabel: trip.timeLabel,
        seats: 1,
        amountCents: 400,
        amountLabel: "4,00 EUR",
        paymentStatus: "required"
    )

    static let impact = ImpactSummary(
        totalCo2Kg: 6.8,
        sharedDistanceKm: 412,
        rideCount: 9,
        months: [
            ImpactMonthSummary(label: "SEPT", valueKg: 1.4),
            ImpactMonthSummary(label: "OCT", valueKg: 2.2),
            ImpactMonthSummary(label: "NOV", valueKg: 3.2),
        ]
    )

    static let rewards = RewardSummary(
        balanceCents: 680,
        nextTierCents: 1_000,
        progress: 0.68,
        entries: [
            RewardEntrySummary(id: "reward-1", title: "Bonus CO₂", dateLabel: "07 NOV 2022", amountLabel: "+0,50€", positive: true),
            RewardEntrySummary(id: "reward-2", title: "Trajet payé", dateLabel: "03 NOV 2022", amountLabel: "+1,20€", positive: true),
        ]
    )

    static let inbox = InboxSummary(
        notifications: [],
        chats: [InboxChatSummary(id: "chat-1", sourceType: "trip", sourceId: "trip-1", title: "Coach U8", preview: "Départ confirmé.", dateLabel: "16h12", unreadCount: 1, initials: "CO")],
        reviews: [InboxReviewPrompt(id: "ride-session-1_ui-user_driver-1", rideSessionId: "ride-session-1", ratedUserId: "driver-1", title: "Avis conducteur", prompt: "Notez le trajet.", initials: "DR")],
        reviewsUserId: "ui-user"
    )
}

private struct UITestAuthGateway: AuthGateway {
    let session: AuthSession?
    var isConfigured: Bool { true }
    private var identity: AuthIdentity { AuthIdentity(uid: Fixtures.session.uid, email: Fixtures.session.email) }
    func currentSession() async throws -> AuthIdentity? { session.map { AuthIdentity(uid: $0.uid, email: $0.email) } }
    func signIn(email: String, password: String) async throws -> AuthIdentity { identity }
    func signUp(name: String, email: String, password: String) async throws -> AuthIdentity { identity }
    func signInWithGoogle() async throws -> AuthIdentity { identity }
    func signInWithFacebook() async throws -> AuthIdentity { identity }
    func signOut() throws {}
}

struct UITestFirebaseGateway: FirebaseGateway {
    let emergencyFixture = UITestEmergencyContacts()
    func initializeProfile(identity: AuthIdentity, displayName: String?) async throws -> AuthSession {
        identity.uid == Fixtures.childSession.uid ? Fixtures.childSession : Fixtures.session
    }
    func supportReports(uid: String, cursor: String?) async throws -> SupportPage<SupportReport> {
        try await UnconfiguredSupportGateway().supportReports(uid: uid, cursor: cursor)
    }
    func supportReport(uid: String, reportId: String, cursor: String?) async throws -> SupportDetail {
        try await UnconfiguredSupportGateway().supportReport(uid: uid, reportId: reportId, cursor: cursor)
    }
    var isConfigured: Bool { true }
    func searchTrips() async throws -> [TripSummary] { [Fixtures.trip] }
    func listChildren() async throws -> [ChildSummary] { [Fixtures.child, Fixtures.otherChild] }
    func listClubSummaries() async throws -> [ClubSummary] { Fixtures.clubs }
    func suggestPlaces(input: String) async throws -> [PlaceSuggestion] { [PlaceSuggestion(placeId: "place-1", label: input, mainText: input, secondaryText: "Belgique")] }
    func resolvePlace(placeId: String) async throws -> ResolvedPlace { Fixtures.origin }
    func searchTripMatches(criteria: TripSearchCriteria) async throws -> [TripMatchSummary] { [Fixtures.match] }
    func createTrip(draft: TripPublishDraft) async throws -> String { "trip-created" }
    func requestBooking(trip: TripSummary, childId: String?, seats: Int) async throws -> String { "booking-created" }
    func getDriverBookingRequests() async throws -> [BookingRequestSummary] { [Fixtures.bookingRequest] }
    func approveBooking(bookingId: String) async throws -> String { "approved" }
    func startRide(tripId: String, bookingIds: [String]) async throws -> LiveRideSnapshot { Fixtures.activeRide }
    func getActiveRide() async throws -> LiveRideSnapshot? { Fixtures.activeRide }
    func markPickup(rideSessionId: String, bookingId: String, childId: String) async throws -> String { "pickedUp" }
    func markDropoff(rideSessionId: String, bookingId: String, childId: String) async throws -> String { "droppedOff" }
    func endRide(rideSessionId: String, distanceMeters: Int, passengersSharing: Int) async throws -> RideCompletionSummary { RideCompletionSummary(rideSessionId: rideSessionId, co2SavedKg: 2.4, rewardCents: 50) }
    func getPayableBookings() async throws -> [PayableBookingSummary] { [Fixtures.payableBooking] }
    func getImpactSummary() async throws -> ImpactSummary { Fixtures.impact }
    func getRewardSummary() async throws -> RewardSummary { Fixtures.rewards }
    func getInbox(uid: String) async throws -> InboxSummary { Fixtures.inbox }
    func submitRating(uid: String, rideSessionId: String, ratedUserId: String, score: Int, comment: String?) async throws -> String {
        "\(rideSessionId)_\(uid)_\(ratedUserId)"
    }
    func createReport(submission: SupportSubmission) async throws -> String { "report-1" }
    func writeNativeLocationFallback(rideSessionId: String, role: AppRole) async throws {}
    @MainActor func stopNativeLocationFallback(rideSessionId: String) {}
    @MainActor func stopAllNativeLocationFallback() {}
    @MainActor var nativeLocationWorkPending: Bool { false }
    @MainActor func awaitNativeLocationShutdown() async {}
}

private struct UITestRadarGateway: RadarTrackingGateway {
    @MainActor func stopLocalTracking() {}
    var isConfigured: Bool { true }
    func startTripTracking(rideSessionId: String, role: AppRole) async throws {}
    func stopTripTracking(rideSessionId: String) async throws {}
}

private struct UITestStripeGateway: StripePaymentsGateway {
    var isConfigured: Bool { true }
    func createStripeAccount(email: String) async throws -> StripeConnectAccount { StripeConnectAccount(accountId: "acct_ui") }
    func createStripeAccountLink(returnUrl: String, refreshUrl: String) async throws -> StripeConnectAccountLink { StripeConnectAccountLink(url: returnUrl, expiresAt: nil) }
    func prepareRidePayment(bookingId: String) async throws -> PaymentSheetConfig {
        PaymentSheetConfig(bookingId: bookingId, paymentIntentId: "pi_ui", clientSecret: "pi_ui_secret", publishableKey: "pk_test_ui", amountCents: 400, currency: "eur")
    }
    func ridePaymentStatus(bookingId: String, paymentIntentId: String) async throws -> RidePaymentState { .pending }
}
#endif
