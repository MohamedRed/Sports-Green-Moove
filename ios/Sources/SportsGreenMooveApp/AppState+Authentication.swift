import Foundation

extension AppState {
    var authenticating: Bool { authentication.busy }
    var authenticationCleanupRequired: Bool { authentication.cleanupRequired }
    var authenticationStatus: String {
        authentication.finishingSignOut ? "Déconnexion en cours..." : "Connexion en cours..."
    }

    func bootstrap() async {
        guard isConfigured else { errorMessage = "Connexion indisponible."; return }
        guard !authenticating else { return }
        if session != nil { await refreshAppData(); return }
        await authenticate(changesIdentity: false) { try await self.auth.currentSession() }
    }

    func signIn(email: String, password: String) async {
        guard session == nil else { return }
        await authenticate { try await self.auth.signIn(email: email, password: password) }
    }

    func signUp(name: String, email: String, password: String) async {
        guard session == nil else { return }
        await authenticate { try await self.auth.signUp(name: name, email: email, password: password) }
    }

    func signInWithGoogle() async {
        guard session == nil else { return }
        await authenticate { try await self.auth.signInWithGoogle() }
    }

    func signInWithFacebook() async {
        guard session == nil else { return }
        await authenticate { try await self.auth.signInWithFacebook() }
    }

    func signOut() {
        let cleared = authentication.signOut(using: auth)
        session = nil
        trips = []; children = []; clubSummaries = []
        activeRide = nil; activeRideTrip = nil
        payableBookings = []; driverBookingRequests = []
        impactSummary = .empty; rewardSummary = .empty
        activeRidePermissionDisclosure = nil
        authenticationRestoreFailed = false
        selectedTab = .home; overlay = nil
        errorMessage = cleared ? nil : AuthenticationCopy.cleanup
    }

    private func authenticate(changesIdentity: Bool = true, _ action: @MainActor () async throws -> AuthSession?) async {
        let result = await authentication.perform(using: auth, changesIdentity: changesIdentity,
            onBegin: { self.errorMessage = nil; self.authenticationRestoreFailed = false },
            action: action, apply: { self.session = $0 })
        switch result {
        case .applied(let id, let accepted):
            guard authentication.owns(id), accepted != nil, session == accepted else { return }
            await refreshAppData()
        case .failed(let id, let message):
            if authentication.owns(id) {
                errorMessage = message
                authenticationRestoreFailed = !changesIdentity && message == AuthenticationCopy.failed
            }
        case .signedOut(let id):
            if authentication.owns(id), errorMessage == AuthenticationCopy.cleanup { errorMessage = nil }
        case .ignored:
            break
        }
    }
}
