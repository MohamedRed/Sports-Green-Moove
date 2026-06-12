import Foundation
import Observation

@MainActor
@Observable
final class AppState {
    var selectedTab: AppTab = .home
    var overlay: AppOverlay?
    var selectedRole: AppRole = .parent
    var darkTheme = false
    var session: AuthSession?
    var trips: [TripSummary] = []
    var children: [ChildSummary] = []
    var activeRide: LiveRideSnapshot?
    var activeRideTrip: TripSummary?
    var payableBookings: [PayableBookingSummary] = []
    var driverBookingRequests: [BookingRequestSummary] = []
    var searchOrigin: ResolvedPlace?
    var searchDestination: ResolvedPlace?
    var originSuggestions: [PlaceSuggestion] = []
    var destinationSuggestions: [PlaceSuggestion] = []
    var searchMatches: [TripMatchSummary] = []
    var searchLoading = false
    var loading = false
    var errorMessage: String?
    var noticeMessage: String?

    let auth: AuthGateway
    let firebase: FirebaseGateway
    let radar: RadarTrackingGateway
    let googleRoutes: GoogleRoutesGateway
    let stripe: StripePaymentsGateway

    var isConfigured: Bool {
        auth.isConfigured && firebase.isConfigured
    }

    init(
        auth: AuthGateway,
        firebase: FirebaseGateway,
        radar: RadarTrackingGateway = UnconfiguredRadarTrackingGateway(),
        googleRoutes: GoogleRoutesGateway = UnconfiguredGoogleRoutesGateway(),
        stripe: StripePaymentsGateway = UnconfiguredStripePaymentsGateway()
    ) {
        self.auth = auth
        self.firebase = firebase
        self.radar = radar
        self.googleRoutes = googleRoutes
        self.stripe = stripe
    }

    func bootstrap() async {
        guard isConfigured else {
            errorMessage = "Ajoutez GoogleService-Info.plist pour activer Firebase."
            return
        }

        do {
            session = try await auth.currentSession()
            if session != nil {
                await refreshAppData()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signIn(email: String, password: String) async {
        await authenticate { try await auth.signIn(email: email, password: password) }
    }

    func signUp(name: String, email: String, password: String) async {
        await authenticate { try await auth.signUp(name: name, email: email, password: password) }
    }

    func signOut() {
        do {
            try auth.signOut()
            session = nil
            trips = []
            children = []
            activeRide = nil
            activeRideTrip = nil
            payableBookings = []
            driverBookingRequests = []
            selectedTab = .home
            overlay = nil
        } catch {
            errorMessage = error.localizedDescription
        }
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

    func refreshAppData() async {
        loading = true
        defer { loading = false }
        do {
            trips = try await firebase.searchTrips()
            children = selectedRole == .parent ? try await firebase.listChildren() : []
            activeRide = try await firebase.getActiveRide()
            payableBookings = try await firebase.getPayableBookings()
            driverBookingRequests = selectedRole == .driver
                ? try await firebase.getDriverBookingRequests()
                : []
        } catch {
            errorMessage = "Impossible de charger les données Firebase."
        }
    }

    func handleTripAction(tripId: String) async {
        if selectedRole == .driver {
            await startRide(tripId: tripId)
        } else {
            await requestBooking(tripId: tripId, childId: nil)
        }
    }

    func requestBooking(tripId: String, childId: String?) async {
        do {
            let bookingId = try await firebase.requestBooking(tripId: tripId, childId: childId)
            noticeMessage = "Demande envoyée: \(bookingId)"
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func suggestPlaces(input: String, target: SearchPlaceTarget) async {
        searchLoading = true
        defer { searchLoading = false }
        do {
            let suggestions = try await firebase.suggestPlaces(input: input)
            switch target {
            case .origin:
                originSuggestions = suggestions
            case .destination:
                destinationSuggestions = suggestions
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func selectPlace(_ suggestion: PlaceSuggestion, target: SearchPlaceTarget) async {
        searchLoading = true
        defer { searchLoading = false }
        do {
            let place = try await firebase.resolvePlace(placeId: suggestion.placeId)
            switch target {
            case .origin:
                searchOrigin = place
                originSuggestions = []
            case .destination:
                searchDestination = place
                destinationSuggestions = []
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func runSearch(form: SearchFormState) async {
        guard let origin = searchOrigin, let destination = searchDestination else {
            errorMessage = "Choisissez un départ et une destination dans les suggestions."
            return
        }
        guard !form.requireChildTracking || !(form.childUserId ?? "").isEmpty else {
            errorMessage = "Choisissez un enfant pour activer le suivi enfant."
            return
        }

        searchLoading = true
        defer { searchLoading = false }
        do {
            searchMatches = try await firebase.searchTripMatches(
                criteria: TripSearchCriteria(
                    origin: origin,
                    destination: destination,
                    desiredDepartureAtIso: form.desiredDepartureAtIso,
                    seatsNeeded: form.seatsNeeded,
                    baggage: form.baggage,
                    returnTrip: form.returnTrip,
                    requireChildTracking: form.requireChildTracking,
                    guardianConsent: form.guardianConsent,
                    childUserId: form.childUserId
                )
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func requestSearchMatch(_ match: TripMatchSummary, childId: String?) async {
        await requestBooking(tripId: match.tripId, childId: childId)
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

    private func authenticate(_ action: () async throws -> AuthSession) async {
        loading = true
        defer { loading = false }
        do {
            session = try await action()
            await refreshAppData()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
