import Foundation

@MainActor
func checkPublishBoundaries() async {
    var count = 0
    for method in ["publish", "suggest", "resolve"] {
        for failing in [false, true] {
            for revoke in ["logout", "other-uid", "same-uid", "role-roundtrip", "roles-revoked", "close", "cancel"] {
                let probe = AppDataProbe(suspended: [1])
                let app = AppState(auth: UnconfiguredAuthGateway(),
                    firebase: AppDataFixtureGateway(probe: AppDataProbe(), publications: probe),
                    authentication: AuthenticationState(makeStore: { MemoryLogoutIntentStore() }))
                app.session = AuthSession(uid: "isolated-a", email: nil, displayName: nil, roles: [.driver, .parent])
                app.selectedRole = .driver
                let access = app.accountAccess!
                let controller = PublishController(access: access)
                var refreshed = false
                func execute() async {
                    switch method {
                    case "publish":
                        await controller.publish(draft: isolatedPublishDraft(), firebase: app.firebase,
                            onNotice: { app.noticeMessage = $0 }, onError: { app.errorMessage = $0 },
                            onPublished: { _ in refreshed = true })
                    case "suggest":
                        await controller.suggestPlaces(input: "Synthetic place", target: .origin, firebase: app.firebase,
                            onError: { app.errorMessage = $0 })
                    default:
                        let suggestion = PlaceSuggestion(placeId: "isolated-origin", label: "Synthetic place", mainText: nil, secondaryText: nil)
                        await controller.select(suggestion, target: .origin, firebase: app.firebase,
                            onError: { app.errorMessage = $0 })
                    }
                }
                let task = Task { await execute() }
                await probe.waitForCall(1)
                check(app.accountWork.busy && controller.loading, "Publication did not register unsettled work")
                if revoke == "cancel" { task.cancel() }
                else if revoke == "close" { controller.close(); controller.activate() }
                else if revoke == "role-roundtrip" { app.selectedRole = .parent; app.selectedRole = .driver }
                else if revoke == "roles-revoked" {
                    app.session = AuthSession(uid: "isolated-a", email: nil, displayName: nil, roles: [.parent])
                } else {
                    app.signOut()
                    check(app.authenticating, "Login opened while old publication work was unsettled")
                    await app.signIn(email: "synthetic@example.invalid", password: "unused")
                    check(app.session == nil, "A sign-in replaced identity before publication drain")
                    if revoke != "logout" {
                        app.session = AuthSession(uid: revoke == "same-uid" ? "isolated-a" : "isolated-b", email: nil,
                            displayName: nil, roles: [.driver, .parent])
                    }
                }
                app.errorMessage = "Current account notice"
                await probe.release(1, failing: failing)
                await task.value
                check(app.noticeMessage == nil && app.errorMessage == "Current account notice" && !refreshed,
                    "Late publication success/error changed the current account or triggered a follow-up")
                check(controller.origin == nil && controller.originSuggestions.isEmpty && !app.accountWork.busy,
                    "Stale place data was applied or settled work retained its drain")
                let calls = await probe.names()
                check(calls == [method], "Revoked controller issued additional provider work")
                count += 1
            }
        }
    }
    for failing in [false, true] {
        let probe = AppDataProbe(suspended: [1])
        let app = AppState(auth: UnconfiguredAuthGateway(),
            firebase: AppDataFixtureGateway(probe: AppDataProbe(), publications: probe),
            authentication: AuthenticationState(makeStore: { MemoryLogoutIntentStore() }))
        app.session = AuthSession(uid: "isolated-current", email: nil, displayName: nil, roles: [.driver])
        app.selectedRole = .driver
        let controller = PublishController(access: app.accountAccess!)
        var refreshed = false
        func publish() async {
            await controller.publish(draft: isolatedPublishDraft(), firebase: app.firebase,
                onNotice: { app.noticeMessage = $0 }, onError: { app.errorMessage = $0 },
                onPublished: { access in
                    check(access.isCurrent, "Follow-up received another account's access")
                    refreshed = true
                })
        }
        let task = Task { await publish() }
        await probe.waitForCall(1)
        await publish()
        let before = await probe.names()
        check(before == ["publish"], "Duplicate publication issued another write")
        await probe.release(1, failing: failing); await task.value
        check(!controller.loading && !app.accountWork.busy, "Current completion retained a work lease")
        if failing {
            check(app.errorMessage != nil && !refreshed, "Current error was hidden or triggered refresh")
            app.errorMessage = nil
            await publish()
        }
        check(app.noticeMessage == "Trajet publié: isolated-trip" && refreshed, "Current publication or explicit retry was not applied")
        controller.close(); controller.activate()
        controller.seedPlaces(origin: isolatedPublishDraft().origin, destination: isolatedPublishDraft().destination)
        check(controller.origin != nil && controller.destination != nil, "Current controller could not reactivate")
    }
    print("Publication ownership checks passed: \(count) delayed success/error boundaries, account/role ABA, closed view and cancellation; synthetic gateways only")
}
