import Foundation

private struct ConnectFixtureGateway: StripePaymentsGateway {
    let probe: AppDataProbe
    var isConfigured = true
    var link = "https://synthetic.example.invalid/onboarding"
    func createStripeAccount(email: String) async throws -> StripeConnectAccount {
        check(email == "driver@example.invalid", "Driver email was not captured or trimmed")
        _ = try await probe.read("account")
        return StripeConnectAccount(accountId: "acct_synthetic", reused: true)
    }
    func createStripeAccountLink(returnUrl: String, refreshUrl: String) async throws -> StripeConnectAccountLink {
        check(returnUrl == connectURLs.returnUrl && refreshUrl == connectURLs.refreshUrl, "Onboarding callbacks changed")
        _ = try await probe.read("link")
        return StripeConnectAccountLink(url: link, expiresAt: nil)
    }
    func prepareRidePayment(bookingId: String) async throws -> PaymentSheetConfig { throw CancellationError() }
    func ridePaymentStatus(bookingId: String, paymentIntentId: String) async throws -> RidePaymentState { throw CancellationError() }
}

private let connectURLs = (returnUrl: "https://synthetic.example.invalid/return", refreshUrl: "https://synthetic.example.invalid/refresh")

@MainActor
func checkPaymentScreenOwnership() async throws {
    var count = 0
    for boundary in [1, 2] {
        for failing in [false, true] {
            for revoke in ["logout", "other-uid", "same-uid", "role-roundtrip", "roles-revoked", "close", "cancel"] {
                let app = connectApp()
                let probe = AppDataProbe(suspended: [boundary])
                let controller = PaymentScreenController(access: app.accountAccess!)
                var opened: [URL] = []
                func start() async {
                    await controller.startConnect(email: " driver@example.invalid ", urls: connectURLs,
                        gateway: ConnectFixtureGateway(probe: probe), openURL: { opened.append($0) },
                        onError: { app.errorMessage = $0 }, onNotice: { app.noticeMessage = $0 })
                }
                let task = Task { await start() }
                await probe.waitForCall(boundary)
                check(controller.loading && app.accountWork.busy, "Onboarding did not retain account work")
                await start()
                if revoke == "cancel" { task.cancel() }
                else if revoke == "close" { controller.close(); controller.activate() }
                else if revoke == "role-roundtrip" { app.selectedRole = .parent; app.selectedRole = .driver }
                else if revoke == "roles-revoked" { app.session = connectSession(roles: [.parent]) }
                else {
                    app.signOut()
                    check(app.authenticating, "Login opened before driver onboarding settled")
                    await app.signIn(email: "unused@example.invalid", password: "unused")
                    check(app.session == nil, "Authentication crossed outstanding onboarding")
                    if revoke != "logout" { app.session = connectSession(uid: revoke == "same-uid" ? "isolated-driver" : "isolated-other") }
                }
                app.errorMessage = "Current error"; app.noticeMessage = "Current notice"
                await probe.release(boundary, failing: failing); await task.value
                let calls = await probe.names()
                check(calls == Array(["account", "link"].prefix(boundary)) && opened.isEmpty,
                    "Revoked onboarding opened a URL or issued extra requests")
                check(app.errorMessage == "Current error" && app.noticeMessage == "Current notice",
                    "Revoked onboarding changed current feedback")
                check(!app.accountWork.busy && !controller.loading, "Settled onboarding leaked its lease")
                if revoke != "close" && revoke != "cancel" { await start() }
                let finalCalls = await probe.names()
                check(finalCalls == calls, "Old view started work in another account generation")
                count += 1
            }
        }
    }
    await checkConnectValidationAndRetry()
    try await checkStalePaymentActions()
    print("Payment screen checks passed: \(count) delayed onboarding success/error boundaries; stale view actions, secure URLs, duplicate exclusion and explicit retry; synthetic gateways, no browser opened")
}

@MainActor
private func checkConnectValidationAndRetry() async {
    for failingAt in [1, 2] {
        let app = connectApp(), probe = AppDataProbe(suspended: [failingAt])
        let controller = PaymentScreenController(access: app.accountAccess!)
        var opened = 0
        func start() async {
            await controller.startConnect(email: "driver@example.invalid", urls: connectURLs,
                gateway: ConnectFixtureGateway(probe: probe), openURL: { _ in opened += 1 },
                onError: { app.errorMessage = $0 }, onNotice: { app.noticeMessage = $0 })
        }
        let task = Task { await start() }
        await probe.waitForCall(failingAt); await probe.release(failingAt, failing: true); await task.value
        check(app.errorMessage != nil && opened == 0 && !app.accountWork.busy, "Current onboarding failure was hidden")
        await start()
        check(app.errorMessage == nil && opened == 1 && app.noticeMessage != nil && !app.accountWork.busy,
            "Current onboarding explicit retry could not open its link")
    }
    for invalid in ["email", "unconfigured", "missing-urls", "http-return", "credentials-refresh", "http-link", "credentials-link", "empty-host", "parent", "closed"] {
        let app = connectApp(), probe = AppDataProbe()
        if invalid == "parent" { app.selectedRole = .parent }
        let controller = PaymentScreenController(access: app.accountAccess!)
        var urls: (returnUrl: String, refreshUrl: String)? = connectURLs
        if invalid == "missing-urls" { urls = nil }
        if invalid == "http-return" { urls?.returnUrl = "http://synthetic.example.invalid/return" }
        if invalid == "credentials-refresh" { urls?.refreshUrl = "https://synthetic@synthetic.example.invalid/refresh" }
        var gateway = ConnectFixtureGateway(probe: probe)
        if invalid == "unconfigured" { gateway.isConfigured = false }
        if invalid == "http-link" { gateway.link = "http://synthetic.example.invalid/onboarding" }
        if invalid == "credentials-link" { gateway.link = "https://synthetic@synthetic.example.invalid/onboarding" }
        if invalid == "empty-host" { gateway.link = "https:///" }
        if invalid == "closed" { controller.close() }
        var opened = false
        await controller.startConnect(email: invalid == "email" ? " " : "driver@example.invalid", urls: urls,
            gateway: gateway, openURL: { _ in opened = true },
            onError: { app.errorMessage = $0 }, onNotice: { app.noticeMessage = $0 })
        let calls = await probe.names()
        check(!opened && !app.accountWork.busy, "Invalid onboarding opened a URL or leaked work")
        check(calls.count == (["http-link", "credentials-link", "empty-host"].contains(invalid) ? 2 : 0),
            "Invalid onboarding unexpectedly called a provider")
    }
    let app = connectApp()
    let controller = PaymentScreenController(access: app.accountAccess!)
    controller.close(); controller.activate()
    check(controller.acceptsAction, "Current closed view could not reactivate")
    let ownController = PaymentScreenController(access: app.accountAccess!)
    await ownController.startConnect(email: "driver@example.invalid", urls: connectURLs,
        gateway: ConnectFixtureGateway(probe: AppDataProbe()), openURL: { _ in app.signOut() },
        onError: { app.errorMessage = $0 }, onNotice: { app.noticeMessage = $0 })
    check(app.errorMessage == nil && app.noticeMessage == nil && !app.accountWork.busy,
        "URL callback revocation restored old feedback")
    let before = connectApp(), probe = AppDataProbe()
    let beforeController = PaymentScreenController(access: before.accountAccess!)
    var notices = 0
    await beforeController.startConnect(email: "driver@example.invalid", urls: connectURLs,
        gateway: ConnectFixtureGateway(probe: probe), openURL: { _ in fatalError("Revoked callback opened a browser") },
        onError: { _ in before.signOut() }, onNotice: { _ in notices += 1 })
    let calls = await probe.names()
    check(calls.isEmpty && notices == 0 && !before.accountWork.busy, "Initial feedback revocation issued stale work")
}

@MainActor
private func checkStalePaymentActions() async throws {
    let probe = AppDataProbe()
    let app = AppState(auth: UnconfiguredAuthGateway(), firebase: AppDataFixtureGateway(probe: AppDataProbe()),
        stripe: PaymentOwnershipGateway(probe: probe), authentication: AuthenticationState(makeStore: { MemoryLogoutIntentStore() }))
    app.session = connectSession()
    let access = app.accountAccess!
    app.signOut(); app.session = connectSession()
    let booking = PayableBookingSummary(id: "isolated-booking", tripId: "synthetic-trip", title: "Synthetic", club: "Synthetic",
        dateLabel: "Tomorrow", timeLabel: "12:00", seats: 1, amountCents: 400, amountLabel: "4 EUR", paymentStatus: "unpaid")
    await app.payRide(booking, access: access)
    app.pendingRidePayment = try RidePaymentTarget(ownerUid: "isolated-driver", bookingId: booking.id, amountCents: 400, config: isolatedPaymentConfig())
    await app.verifyRidePayment(access: access)
    let calls = await probe.names()
    check(calls.isEmpty && !app.accountWork.busy && app.noticeMessage == nil, "Stale payment screen issued requests under a fresh session")
}

private func connectSession(uid: String = "isolated-driver", roles: [AppRole] = [.driver, .parent]) -> AuthSession {
    AuthSession(uid: uid, email: "driver@example.invalid", displayName: nil, roles: roles)
}

@MainActor
private func connectApp() -> AppState {
    let app = AppState(auth: UnconfiguredAuthGateway(), firebase: AppDataFixtureGateway(probe: AppDataProbe()),
        authentication: AuthenticationState(makeStore: { MemoryLogoutIntentStore() }))
    app.session = connectSession(); app.selectedRole = .driver
    return app
}
