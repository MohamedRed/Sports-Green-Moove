import Foundation

@MainActor
func checkRideLifecycleOwnership() async {
    let probe = RideLifecycleProbe(suspended: "start-ride")
    let stops = RideLocalStops()
    let app = AppState(auth: UnconfiguredAuthGateway(),
        firebase: AppDataFixtureGateway(probe: AppDataProbe(), rides: probe, rideStops: stops),
        radar: RideRadarFixture(probe: probe, stops: stops),
        authentication: AuthenticationState(makeStore: { MemoryLogoutIntentStore() }))
    app.session = AuthSession(uid: "isolated-driver", email: nil, displayName: nil, roles: [.driver])
    app.selectedRole = .driver
    let request = Task { await app.startRideAfterPermissionGate(tripId: "isolated-trip") }
    await probe.wait()
    app.signOut()
    await probe.release()
    await request.value
    let calls = await probe.names()
    let receipt = "Ride logout reproduction: restored=\(app.activeRide != nil), calls=\(calls.joined(separator: ","))\n"
    FileHandle.standardError.write(Data(receipt.utf8))
    check(app.activeRide == nil && calls == ["start-ride"], "Late ride start revived a signed-out account or activated tracking")
    await checkRideBoundaries()
}
