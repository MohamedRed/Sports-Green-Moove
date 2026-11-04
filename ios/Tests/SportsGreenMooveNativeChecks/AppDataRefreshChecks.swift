import Foundation

@MainActor
func checkAppDataRefresh() async {
    let parentReads = ["trips", "children", "clubs", "ride", "payable", "impact", "rewards"]
    func state(_ probe: AppDataProbe) -> AppState {
        let result = AppState(auth: UnconfiguredAuthGateway(), firebase: AppDataFixtureGateway(probe: probe),
            authentication: AuthenticationState(makeStore: { MemoryLogoutIntentStore() }))
        result.session = AuthSession(uid: "isolated-parent-a", email: nil, displayName: nil, roles: [.parent])
        return result
    }
    func hasNoPrivateData(_ app: AppState) -> Bool {
        app.trips.isEmpty && app.children.isEmpty && app.clubSummaries.isEmpty && app.activeRide == nil &&
        app.activeRideTrip == nil && app.payableBookings.isEmpty && app.driverBookingRequests.isEmpty &&
        app.impactSummary == .empty && app.rewardSummary == .empty
    }
    func expectReads(_ probe: AppDataProbe, _ expected: [String], _ message: String) async {
        let names = await probe.names()
        check(names == expected, message)
    }

    let signedOutProbe = AppDataProbe()
    let signedOut = state(signedOutProbe)
    signedOut.signOut()
    await signedOut.refreshAppData()
    await expectReads(signedOutProbe, [], "Signed-out refresh called a provider")

    for oldFails in [false, true] {
        for step in 1...parentReads.count {
            let probe = AppDataProbe(suspended: [step])
            let app = state(probe)
            app.trips = [appDataTrip("last-complete")]
            let request = Task { await app.refreshAppData() }
            await probe.waitForCall(step)
            check(app.trips.map(\.id) == ["last-complete"] && app.children.isEmpty &&
                app.impactSummary == .empty, "Partial refresh was exposed before every read completed")
            app.signOut()
            check(!app.refreshingAppData && hasNoPrivateData(app), "Sign-out retained refresh state or private data")
            await probe.release(step, failing: oldFails)
            await request.value
            check(hasNoPrivateData(app) && app.errorMessage == nil, "Late read restored signed-out data")
            await expectReads(probe, Array(parentReads.prefix(step)), "Revoked refresh issued another provider read")
        }
    }

    for returnToSameUid in [false, true] {
        let probe = AppDataProbe(suspended: [1])
        let app = state(probe)
        let request = Task { await app.refreshAppData() }
        await probe.waitForCall(1)
        app.signOut()
        app.session = AuthSession(uid: returnToSameUid ? "isolated-parent-a" : "isolated-parent-b", email: nil,
            displayName: nil, roles: [.parent])
        app.trips = [appDataTrip("current-account")]
        app.errorMessage = "Current account notice"
        await probe.release(1)
        await request.value
        check(app.trips.map(\.id) == ["current-account"] && app.errorMessage == "Current account notice",
            "An old refresh survived an account change or same-UID reauthentication")
        await expectReads(probe, ["trips"], "Account-revoked refresh continued")
    }

    let roleProbe = AppDataProbe(suspended: [1])
    let roleState = state(roleProbe)
    let oldRole = Task { await roleState.refreshAppData() }
    await roleProbe.waitForCall(1)
    roleState.selectedRole = .driver
    roleState.selectedRole = .parent
    await roleProbe.release(1)
    await oldRole.value
    check(hasNoPrivateData(roleState) && !roleState.refreshingAppData,
        "Returning to the same role revived a revoked request")
    await expectReads(roleProbe, ["trips"], "Role-revoked refresh continued")

    for oldFails in [false, true] {
        let probe = AppDataProbe(suspended: [1, 2])
        let app = state(probe)
        let old = Task { await app.refreshAppData() }
        await probe.waitForCall(1)
        let current = Task { await app.refreshAppData() }
        await probe.waitForCall(2)
        app.loading = true
        await probe.release(1, failing: oldFails)
        await old.value
        check(app.loading && app.refreshingAppData && app.errorMessage == nil && hasNoPrivateData(app),
            "Old success or failure cleared a newer request's busy state or changed data")
        await probe.release(2)
        await current.value
        check(app.trips.map(\.id) == ["read-2"] && app.children.count == 1 &&
            app.impactSummary.totalCo2Kg == 3 && app.rewardSummary.balanceCents == 42,
            "Latest complete refresh was not applied")
        check(app.loading && !app.refreshingAppData && app.errorMessage == nil,
            "Current refresh changed another operation's busy state or retained its own")
        await expectReads(probe, ["trips"] + parentReads, "Superseded request made extra reads")
    }

    let lateProbe = AppDataProbe(suspended: [1])
    let lateState = state(lateProbe)
    let older = Task { await lateState.refreshAppData() }
    await lateProbe.waitForCall(1)
    await lateState.refreshAppData()
    await lateProbe.release(1, failing: true)
    await older.value
    check(lateState.trips.map(\.id) == ["read-2"] && lateState.errorMessage == nil,
        "An old error erased a newer successful result")

    let cancelProbe = AppDataProbe(suspended: [1])
    let cancelledState = state(cancelProbe)
    let cancelled = Task { await cancelledState.refreshAppData() }
    await cancelProbe.waitForCall(1)
    cancelled.cancel()
    await cancelProbe.release(1)
    await cancelled.value
    check(hasNoPrivateData(cancelledState) && !cancelledState.refreshingAppData && cancelledState.errorMessage == nil,
        "Cancelled read applied data or displayed a misleading failure")
    await expectReads(cancelProbe, ["trips"], "Cancelled refresh continued provider reads")

    let failureProbe = AppDataProbe(suspended: [6])
    let failureState = state(failureProbe)
    failureState.trips = [appDataTrip("last-complete")]
    let failed = Task { await failureState.refreshAppData() }
    await failureProbe.waitForCall(6)
    await failureProbe.release(6, failing: true)
    await failed.value
    check(failureState.trips.map(\.id) == ["last-complete"] && failureState.children.isEmpty &&
        failureState.impactSummary == .empty && failureState.errorMessage != nil && !failureState.refreshingAppData,
        "Failure exposed a partial snapshot or failed to end current busy state")
    await failureState.refreshAppData()
    check(failureState.errorMessage == nil && failureState.children.count == 1,
        "An explicit new refresh could not recover from a current failure")

    let driverProbe = AppDataProbe()
    let driverState = state(driverProbe)
    driverState.selectedRole = .driver
    driverState.children = [ChildSummary(id: "old-child", label: "Old", teamLabel: "Old", trackingEnabled: true)]
    await driverState.refreshAppData()
    await expectReads(driverProbe, ["trips", "clubs", "ride", "payable", "impact", "rewards", "requests"],
        "Driver refresh used a changed role or loaded parent-only children")
    check(driverState.children.isEmpty, "Completed driver refresh retained parent-only child data")
    print("App-data refresh checks passed: seven logout boundaries, atomic snapshots, account/role ABA, latest request, cancellation and retry; isolated gateways only")
}
