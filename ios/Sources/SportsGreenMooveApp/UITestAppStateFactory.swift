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
        let auth = UITestAuthGateway(session: signedIn ? Fixtures.session : nil)
        let state = AppState(
            auth: auth,
            firebase: UITestFirebaseGateway(),
            radar: UITestRadarGateway(),
            stripe: UITestStripeGateway()
        )
        seed(state, route: route, signedIn: signedIn)
        return state
    }

    private static func seed(_ state: AppState, route: String, signedIn: Bool) {
        state.session = signedIn ? Fixtures.session : nil
        state.trips = [Fixtures.trip]
        state.children = [Fixtures.child]
        state.clubSummaries = Fixtures.clubs
        state.activeRide = Fixtures.activeRide
        state.activeRideTrip = Fixtures.trip
        state.payableBookings = [Fixtures.payableBooking]
        state.driverBookingRequests = [Fixtures.bookingRequest]
        state.impactSummary = Fixtures.impact
        state.rewardSummary = Fixtures.rewards
        state.searchOrigin = Fixtures.origin
        state.searchDestination = Fixtures.destination
        state.searchMatches = [Fixtures.match]

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
        case "groups":
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

private enum Fixtures {
    static let session = AuthSession(uid: "ui-user", email: "parent@example.be")
    static let origin = ResolvedPlace(placeId: "origin", label: "Wavre", formattedAddress: "Rue du Stade 1, Wavre", lat: 50.715, lng: 4.612)
    static let destination = ResolvedPlace(placeId: "dest", label: "Ottignies", formattedAddress: "Avenue du Club 8, Ottignies", lat: 50.669, lng: 4.567)
    static let child = ChildSummary(id: "child-1", label: "Nora", teamLabel: "U8 Royal Ottignies", trackingEnabled: true)
    static let clubs = [
        ClubSummary(id: "club-royal", name: "Royal Ottignies Sports", sport: "Football", memberCount: 89, roleLabel: "PARENT", initials: "RO", memberInitials: ["NO", "CO"]),
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
        reviews: [InboxReviewPrompt(id: "review-1", rideSessionId: "ride-session-1", ratedUserId: "driver-1", title: "Avis conducteur", prompt: "Notez le trajet.", initials: "DR")]
    )
}

private struct UITestAuthGateway: AuthGateway {
    let session: AuthSession?
    var isConfigured: Bool { true }
    func currentSession() async throws -> AuthSession? { session }
    func signIn(email: String, password: String) async throws -> AuthSession { Fixtures.session }
    func signUp(name: String, email: String, password: String) async throws -> AuthSession { Fixtures.session }
    func signInWithGoogle() async throws -> AuthSession { Fixtures.session }
    func signInWithFacebook() async throws -> AuthSession { Fixtures.session }
    func signOut() throws {}
}

private struct UITestFirebaseGateway: FirebaseGateway {
    var isConfigured: Bool { true }
    func searchTrips() async throws -> [TripSummary] { [Fixtures.trip] }
    func listChildren() async throws -> [ChildSummary] { [Fixtures.child] }
    func listClubSummaries() async throws -> [ClubSummary] { Fixtures.clubs }
    func suggestPlaces(input: String) async throws -> [PlaceSuggestion] { [PlaceSuggestion(placeId: "place-1", label: input, mainText: input, secondaryText: "Belgique")] }
    func resolvePlace(placeId: String) async throws -> ResolvedPlace { Fixtures.origin }
    func searchTripMatches(criteria: TripSearchCriteria) async throws -> [TripMatchSummary] { [Fixtures.match] }
    func createTrip(draft: TripPublishDraft) async throws -> String { "trip-created" }
    func requestBooking(tripId: String, childId: String?) async throws -> String { "booking-created" }
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
    func getInbox() async throws -> InboxSummary { Fixtures.inbox }
    func submitRating(rideSessionId: String, ratedUserId: String, score: Int, comment: String?) async throws -> String { "rating-1" }
    func createReport(subjectType: String, subjectId: String?, reason: String, description: String, emergency: Bool) async throws -> String { "report-1" }
    func writeNativeLocationFallback(rideSessionId: String, role: AppRole) async throws {}
    func stopNativeLocationFallback(rideSessionId: String) {}
}

private struct UITestRadarGateway: RadarTrackingGateway {
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
}
#endif
