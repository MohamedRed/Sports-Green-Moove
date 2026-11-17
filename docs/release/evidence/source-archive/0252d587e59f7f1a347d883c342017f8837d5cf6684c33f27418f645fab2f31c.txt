import Foundation
import Observation

@MainActor
@Observable
final class AppState {
    var selectedTab: AppTab = .home
    var overlay: AppOverlay?
    var selectedRole: AppRole = .parent {
        didSet {
            if selectedRole != oldValue {
                appDataRefreshId = nil; invalidateRideWork(); refreshAccountScope()
            }
        }
    }
    var darkTheme = false
    var session: AuthSession? {
        didSet {
            if session?.uid != oldValue?.uid || session?.roles != oldValue?.roles {
                invalidateRideWork(); refreshAccountScope()
            }
            if session?.uid != oldValue?.uid {
                appDataRefreshId = nil
                pendingRidePayment = nil
                noticeMessage = nil
                errorMessage = nil
            }
        }
    }
    var pendingRidePayment: RidePaymentTarget?
    var ridePaymentBusy = false
    var bookingBusy = false
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
    let searchActivity = SearchActivityState()
    var searchPlaceRequests: [SearchPlaceTarget: UUID] = [:]
    var searchLoading: Bool { searchActivity.busy || searchRequests.pending != nil || !searchPlaceRequests.isEmpty }
    var loading = false
    var appDataRefreshId: UUID?
    var errorMessage: String?
    var noticeMessage: String?
    var authenticationRestoreFailed = false
    var nativeLocationShutdown: Task<Void, Never>?
    var activeRidePermissionDisclosure: ActiveRidePermissionDisclosure?
    let rideRequests = RideRequestState()
    let accountWork = AccountWorkScope()
    let ridePermissions: any ActiveRidePermissionAuthorizing

    let auth: AuthGateway
    let firebase: FirebaseGateway
    let radar: RadarTrackingGateway
    let stripe: StripePaymentsGateway
    let authentication: AuthenticationState

    var isConfigured: Bool {
        auth.isConfigured && firebase.isConfigured
    }

    var accountAccess: AccountAccess? { accountWork.access }
    func refreshAccountScope() {
        resetSearchSession()
        accountWork.replace(session: session, role: selectedRole)
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

}
