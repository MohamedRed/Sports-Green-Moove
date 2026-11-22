import Foundation

@MainActor private final class ShutdownAuthentication: AuthGateway {
    nonisolated let isConfigured = true
    var failSignOut = false
    var calls: [String] = []
    var providerUid: String? = "isolated-driver"
    func currentSession() async throws -> AuthIdentity? { calls.append("restore"); return nil }
    func signIn(email: String, password: String) async throws -> AuthIdentity { identity("email") }
    func signUp(name: String, email: String, password: String) async throws -> AuthIdentity { identity("signup") }
    func signInWithGoogle() async throws -> AuthIdentity { identity("google") }
    func signInWithFacebook() async throws -> AuthIdentity { identity("facebook") }
    func signOut() throws {
        if failSignOut { throw AuthenticationFailure.storage }
        providerUid = nil
    }
    private func identity(_ name: String) -> AuthIdentity {
        calls.append(name); providerUid = "isolated-new-parent"
        return AuthIdentity(uid: "isolated-new-parent", email: nil)
    }
}

@MainActor func checkLocationShutdown() async {
    var checked = 0
    for mode in ["start", "upload", "both"] {
        for sdkFailure in [false, true] {
            let native = LocationSessionState()
            let auth = ShutdownAuthentication()
            let store = MemoryLogoutIntentStore()
            let stops = RideLocalStops()
            let app = AppState(auth: auth,
                firebase: AppDataFixtureGateway(probe: AppDataProbe(), rideStops: stops, locationShutdown: native),
                authentication: AuthenticationState(makeStore: { store }))
            app.session = AuthSession(uid: "isolated-driver", email: nil, displayName: "Driver", roles: [.driver])
            app.selectedRole = .driver
            app.trips = [appDataTrip("private-trip")]
            app.activeRide = isolatedRide(); app.activeRideTrip = app.trips[0]
            app.children = [ChildSummary(id: "private-child", label: "Child", teamLabel: "Team", trackingEnabled: true)]
            app.noticeMessage = "Private notice"; app.overlay = .ride
            let owner = try! native.begin(ride: "isolated-ride")
            let upload = mode == "start" ? nil : try! native.beginUpload(owner)
            if mode == "upload" { native.finishStart(owner) }
            auth.failSignOut = sdkFailure
            app.signOut()
            await app.signIn(email: "isolated@example.invalid", password: "synthetic")
            FileHandle.standardError.write(Data("Native shutdown reproduction: mode=\(mode), pending=\(native.hasPendingWork), authenticationCalls=\(auth.calls.count)\n".utf8))
            check(auth.calls.isEmpty, "Authentication started before the previous location request settled")
            check(app.session == nil && app.accountWork.context == nil && app.activeRide == nil && app.activeRideTrip == nil,
                "Sign-out retained account or active-ride ownership")
            check(app.trips.isEmpty && app.children.isEmpty && app.noticeMessage == nil && app.overlay == nil,
                "Sign-out retained private data")
            check(!native.owns(owner) && stops.native > 0 && store.required, "Sign-out did not stop capture and persist logout intent")
            check(app.authenticating && app.authenticationStatus == "Déconnexion en cours...", "Unsettled location work did not block login")
            await app.signUp(name: "Synthetic Parent", email: "isolated@example.invalid", password: "synthetic")
            await app.signInWithGoogle(); await app.signInWithFacebook(); await app.bootstrap()
            check(auth.calls.isEmpty, "Another authentication path bypassed location shutdown")
            let drain = app.nativeLocationShutdown
            check(drain != nil, "Pending work has no retained shutdown task")
            app.signOut(); drain?.cancel()
            check(app.authenticating, "Repeated or cancelled cleanup reopened authentication")
            if mode != "upload" { native.finishStart(owner) }
            if mode == "both" { check(native.hasPendingWork && app.authenticating, "Finishing only the start discarded its upload") }
            if let upload { native.finishUpload(upload) }
            await drain?.value
            check(!native.hasPendingWork && app.nativeLocationShutdown == nil, "Actual completion did not release cleanup")
            if sdkFailure {
                check(app.authenticationCleanupRequired && app.authenticating, "Location completion hid failed SDK sign-out")
                await app.signIn(email: "isolated@example.invalid", password: "synthetic")
                check(auth.calls.isEmpty, "Failed SDK cleanup allowed login")
                auth.failSignOut = false; app.signOut()
            }
            check(!app.authenticating && auth.providerUid == nil && store.required, "Settled cleanup did not permit an explicit fresh login")
            await app.signIn(email: "isolated@example.invalid", password: "synthetic")
            check(auth.calls == ["email"] && app.session?.uid == "isolated-new-parent" && !store.required,
                "Fresh login did not work after all previous work settled")
            checked += 1
        }
    }
    let native = LocationSessionState()
    let app = AppState(auth: ShutdownAuthentication(),
        firebase: AppDataFixtureGateway(probe: AppDataProbe(), locationShutdown: native),
        authentication: AuthenticationState(makeStore: { MemoryLogoutIntentStore() }))
    app.session = AuthSession(uid: "isolated-driver", email: nil, displayName: nil, roles: [.driver, .parent])
    app.selectedRole = .driver
    let owner = try! native.begin(ride: "isolated-role-change")
    let upload = try! native.beginUpload(owner); native.finishStart(owner)
    app.selectedRole = .parent
    check(app.beginRideRequest() == nil, "A new role started ride work before location shutdown")
    app.selectedRole = .driver
    check(app.tripActionBusy, "Trip actions remained enabled while previous location work was unsettled")
    app.requestActiveRideStart(tripId: "isolated-trip")
    check(app.activeRidePermissionDisclosure == nil, "An unsettled location upload opened a new tracking permission flow")
    native.finishUpload(upload); await app.nativeLocationShutdown?.value
    check(!app.tripActionBusy, "Trip actions stayed disabled after native work settled")
    let next = app.beginRideRequest()
    check(next != nil, "Role change remained blocked after actual completion")
    if let next { app.rideRequests.finish(next) }
    print("LocationShutdownChecks passed: \(checked) delayed start/upload states, all five login paths, repeated/cancelled cleanup, SDK failure and role-change admission")
}
