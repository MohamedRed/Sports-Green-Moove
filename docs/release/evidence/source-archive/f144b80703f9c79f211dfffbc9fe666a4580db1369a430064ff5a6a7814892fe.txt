import Foundation

@MainActor
func checkPublishOwnership() async {
    let probe = AppDataProbe(suspended: [1])
    let app = AppState(auth: UnconfiguredAuthGateway(),
        firebase: AppDataFixtureGateway(probe: AppDataProbe(), publications: probe),
        authentication: AuthenticationState(makeStore: { MemoryLogoutIntentStore() }))
    app.session = AuthSession(uid: "isolated-driver", email: nil, displayName: nil, roles: [.driver])
    app.selectedRole = .driver
    let controller = PublishController(access: app.accountAccess!)
    let task = Task {
        await controller.publish(draft: isolatedPublishDraft(), firebase: app.firebase,
            onNotice: { app.noticeMessage = $0 }, onError: { app.errorMessage = $0 }, onPublished: { _ in })
    }
    await probe.waitForCall(1)
    app.signOut()
    await probe.release(1)
    await task.value
    FileHandle.standardError.write(Data("Publish logout reproduction: restoredNotice=\(app.noticeMessage != nil)\n".utf8))
    check(app.noticeMessage == nil && app.errorMessage == nil, "Late publication changed signed-out UI")
    await checkAccountWorkScope()
    await checkPublishBoundaries()
}

func isolatedPublishDraft() -> TripPublishDraft {
    let origin = ResolvedPlace(placeId: "isolated-origin", label: "Origin", formattedAddress: "Isolated origin", lat: 50, lng: 4)
    let destination = ResolvedPlace(placeId: "isolated-destination", label: "Destination", formattedAddress: "Isolated destination", lat: 51, lng: 5)
    return TripPublishDraft(title: "Synthetic trip", sport: "Synthetic sport", clubName: "Synthetic club",
        teamName: "Synthetic team", clubId: "isolated-club", teamId: "isolated-team", category: "Adults",
        departureAtIso: "2026-11-30T12:00:00Z", origin: origin, destination: destination,
        pickupRadiusM: 1000, seatsTotal: 2, seatsAvailable: 2, baggage: "medium", returnTrip: false,
        priceCents: 400, supportsVehicleTracking: true, supportsChildTracking: false, co2SavedKgEstimate: 1)
}
