import Foundation
import Observation

@MainActor
@Observable
final class AppState {
    var selectedTab: AppTab = .home
    var overlay: AppOverlay?
    var selectedRole: AppRole = .parent {
        didSet {
            if selectedRole != oldValue { appDataRefreshId = nil; invalidateRideWork() }
        }
    }
    var darkTheme = false
    var session: AuthSession? {
        didSet {
            if session?.uid != oldValue?.uid || session?.roles != oldValue?.roles { invalidateRideWork() }
            if session?.uid != oldValue?.uid {
                appDataRefreshId = nil
                invalidateSearch()
                searchPlaceRequests.removeAll()
                searchOrigin = nil
                searchDestination = nil
                originSuggestions = []
                destinationSuggestions = []
                pendingRidePayment = nil
                noticeMessage = nil
                errorMessage = nil
            }
        }
    }
    var pendingRidePayment: RidePaymentTarget?
    var ridePaymentBusy = false
    var ridePaymentState: RidePaymentState = .pending
    var trips: [TripSummary] = []
    var children: [ChildSummary] = []
    var clubSummaries: [ClubSummary] = []
    var activeRide: LiveRideSnapshot?
    var activeRideTrip: TripSummary?
    var payableBookings: [PayableBookingSummary] = []
    var driverBookingRequests: [BookingRequestSummary] = []
    var impactSummary: ImpactSummary = .empty
    var rewardSummary: RewardSummary = .empty
    var searchOrigin: ResolvedPlace?
    var searchDestination: ResolvedPlace?
    var originSuggestions: [PlaceSuggestion] = []
    var destinationSuggestions: [PlaceSuggestion] = []
    var searchMatches: [TripMatchSummary] = []
    var searchRequests = SearchRequestState()
    var searchPlaceRequests: [SearchPlaceTarget: UUID] = [:]
    var searchLoading: Bool { searchRequests.pending != nil || !searchPlaceRequests.isEmpty }
    var loading = false
    var appDataRefreshId: UUID?
    var errorMessage: String?
    var noticeMessage: String?
    var authenticationRestoreFailed = false
    var activeRidePermissionDisclosure: ActiveRidePermissionDisclosure?
    let rideRequests = RideRequestState()
    let ridePermissions: any ActiveRidePermissionAuthorizing

    let auth: AuthGateway
    let firebase: FirebaseGateway
    let radar: RadarTrackingGateway
    let stripe: StripePaymentsGateway
    let authentication: AuthenticationState

    var isConfigured: Bool {
        auth.isConfigured && firebase.isConfigured
    }

    init(
        auth: AuthGateway,
        firebase: FirebaseGateway,
        radar: RadarTrackingGateway = UnconfiguredRadarTrackingGateway(),
        stripe: StripePaymentsGateway = UnconfiguredStripePaymentsGateway(),
        authentication: AuthenticationState? = nil,
        ridePermissions: any ActiveRidePermissionAuthorizing = SystemRidePermissions()
    ) {
        self.auth = auth
        self.firebase = firebase
        self.radar = radar
        self.stripe = stripe
        self.authentication = authentication ?? AuthenticationState()
        self.ridePermissions = ridePermissions
    }

    func selectTab(_ tab: AppTab) {
        selectedTab = tab
        overlay = nil
    }

    func openOverlay(_ destination: AppOverlay) {
        overlay = destination
    }

    func closeOverlay() {
        overlay = nil
    }

    func toggleTheme() {
        darkTheme.toggle()
    }

    func handleTripAction(tripId: String) async {
        if selectedRole == .driver {
            requestActiveRideStart(tripId: tripId)
        } else if selectedRole == .child {
            requestActiveRideTracking()
        } else {
            guard let trip = trips.first(where: { $0.id == tripId }) else { return }
            await requestBooking(trip: trip, childId: nil, seats: 1)
        }
    }

    func requestBooking(trip: TripSummary, childId: String?, seats: Int) async {
        let uid = session?.uid
        do {
            let bookingId = try await firebase.requestBooking(trip: trip, childId: childId, seats: seats)
            guard session?.uid == uid else { return }
            noticeMessage = "Demande envoyée: \(bookingId)"
        } catch {
            guard session?.uid == uid else { return }
            if error is BookingReviewRequiredError { searchMatches.removeAll { $0.summary == trip } }
            errorMessage = error.localizedDescription
        }
    }

    func approveBooking(_ request: BookingRequestSummary) async {
        loading = true
        defer { loading = false }
        do {
            _ = try await firebase.approveBooking(bookingId: request.bookingId)
            noticeMessage = "Demande approuvée."
            await refreshAppData()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

}
