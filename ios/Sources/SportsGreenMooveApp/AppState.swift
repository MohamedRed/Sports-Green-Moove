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
    var activeRide: LiveRideSnapshot?
    var payableBookings: [PayableBookingSummary] = []
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
            activeRide = nil
            payableBookings = []
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
            activeRide = try await firebase.getActiveRide()
            payableBookings = try await firebase.getPayableBookings()
        } catch {
            errorMessage = "Impossible de charger les données Firebase."
        }
    }

    func handleTripAction(tripId: String) async {
        if selectedRole == .driver {
            await startRide(tripId: tripId)
        } else {
            await requestBooking(tripId: tripId)
        }
    }

    private func requestBooking(tripId: String) async {
        do {
            let bookingId = try await firebase.requestBooking(tripId: tripId)
            noticeMessage = "Demande envoyée: \(bookingId)"
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func startRide(tripId: String) async {
        do {
            let ride = try await firebase.startRide(tripId: tripId)
            activeRide = ride
            selectedTab = .trips
            overlay = .ride
            if radar.isConfigured {
                try await radar.startTripTracking(rideSessionId: ride.rideSessionId, role: selectedRole)
            } else {
                try await firebase.writeNativeLocationFallback(rideSessionId: ride.rideSessionId, role: selectedRole)
                noticeMessage = "Suivi GPS natif activé."
            }
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
