import Foundation

@MainActor
func checkRideBoundaries() async {
    func make(_ probe: RideLifecycleProbe, role: AppRole = .driver) -> (AppState, RideLocalStops) {
        let stops = RideLocalStops()
        let app = AppState(auth: UnconfiguredAuthGateway(),
            firebase: AppDataFixtureGateway(probe: AppDataProbe(), rides: probe, rideStops: stops),
            radar: RideRadarFixture(probe: probe, stops: stops),
            authentication: AuthenticationState(makeStore: { MemoryLogoutIntentStore() }),
            ridePermissions: RidePermissionFixture(probe: probe, stops: stops))
        app.session = AuthSession(uid: "isolated-a", email: nil, displayName: nil, roles: [role])
        app.selectedRole = role
        return (app, stops)
    }
    func start(_ app: AppState) async {
        if app.selectedRole == .child { await app.startAccessibleRideTrackingAfterPermissionGate() }
        else { await app.startRideAfterPermissionGate(tripId: "isolated-trip") }
    }

    var boundaries = 0
    for role in [AppRole.driver, .child] {
        let stages = [role == .driver ? "start-ride" : "get-ride", "radar", "native-start"]
        for (index, stage) in stages.enumerated() {
            for fail in [false, true] {
                for revocation in ["logout", "new-uid", "same-uid", "role-roundtrip", "roles-revoked", "cancel"] {
                    let probe = RideLifecycleProbe(suspended: stage)
                    let (app, stops) = make(probe, role: role)
                    let beforeStops = stops.native
                    let task = Task { await start(app) }
                    await probe.wait()
                    if revocation == "cancel" { task.cancel() }
                    else if revocation == "role-roundtrip" { app.selectedRole = .parent; app.selectedRole = role }
                    else if revocation == "roles-revoked" {
                        app.session = AuthSession(uid: "isolated-a", email: nil, displayName: nil, roles: [.parent])
                    } else {
                        app.signOut()
                        check(app.authenticating, "Authentication opened before abandoned ride work settled")
                        await app.signIn(email: "synthetic@example.invalid", password: "unused")
                        check(app.session == nil, "Login replaced identity while old tracking work was unsettled")
                        if revocation != "logout" {
                            app.session = AuthSession(uid: revocation == "same-uid" ? "isolated-a" : "isolated-b",
                                email: nil, displayName: nil, roles: [role])
                        }
                    }
                    app.errorMessage = "Current notice"; app.loading = true
                    await probe.release(failing: fail)
                    await task.value
                    let calls = await probe.names()
                    check(calls == Array(stages.prefix(index + 1)), "Revoked ride work continued into another service")
                    check(app.activeRide == nil && app.overlay == nil && app.errorMessage == "Current notice" && app.loading,
                        "Stale ride success/error changed current account state or unrelated loading")
                    check(!app.rideRequests.busy, "Settled ride work retained its pending gate")
                    if revocation != "cancel" || index > 0 {
                        check(stops.native > beforeStops && stops.radar > 0, "Revoked tracking did not stop local services")
                    }
                    boundaries += 1
                }
            }
        }
    }

    for fail in [false, true] {
        let probe = RideLifecycleProbe(suspended: "permission")
        let (app, stops) = make(probe)
        app.requestActiveRideStart(tripId: "isolated-trip")
        let task = Task { await app.confirmActiveRideStart() }
        await probe.wait(); app.signOut(); await probe.release(failing: fail); await task.value
        let calls = await probe.names()
        check(calls == ["permission"], "Late permission response started a signed-out ride")
        check(stops.permissions > 0 && app.activeRidePermissionDisclosure == nil && app.errorMessage == nil,
            "Revoked permission work changed signed-out state")
    }

    let passenger = RidePassengerStatus(bookingId: "isolated-booking", childId: "isolated-child", label: "Synthetic child",
        pickupStatus: "pending", dropoffStatus: "pending")
    for stage in ["end-ride", "pickup", "dropoff", "get-ride"] {
        for fail in [false, true] {
            let probe = RideLifecycleProbe(suspended: stage)
            let (app, _) = make(probe)
            app.activeRide = isolatedRide()
            let task = Task {
                if stage == "end-ride" { await app.endActiveRide() }
                else if stage == "dropoff" { await app.markDropoff(passenger) }
                else { await app.markPickup(passenger) }
            }
            await probe.wait(); app.signOut(); app.errorMessage = "Current notice"; app.loading = true
            await probe.release(failing: fail); await task.value
            let expected = stage == "get-ride" ? ["pickup", "get-ride"] : [stage]
            let calls = await probe.names()
            check(calls == expected, "Old passenger/completion work continued after sign-out")
            check(app.activeRide == nil && app.errorMessage == "Current notice" && app.loading,
                "Old passenger/completion result changed signed-out state")
        }
    }

    let probe = RideLifecycleProbe(suspended: "start-ride")
    let (app, _) = make(probe)
    let first = Task { await start(app) }
    await probe.wait()
    await start(app)
    let calls = await probe.names()
    check(calls == ["start-ride"], "Duplicate start replaced pending work")
    await probe.release(failing: true); await first.value
    check(app.errorMessage != nil && !app.rideRequests.busy, "Current failure did not permit an explicit new attempt")
    await start(app)
    check(app.activeRide?.rideSessionId == "isolated-ride" && app.overlay == .ride, "Current start failed after explicit retry")
    print("Ride lifecycle checks passed: \(boundaries) delayed startup boundaries, permission revocation, passenger/end isolation, local stops, duplicate denial and explicit retry; isolated services only")
}
