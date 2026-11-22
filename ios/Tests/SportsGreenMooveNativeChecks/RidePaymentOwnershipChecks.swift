import Foundation

struct PaymentOwnershipGateway: StripePaymentsGateway {
    let isConfigured = true
    let probe: AppDataProbe
    var state: RidePaymentState = .recorded
    func createStripeAccount(email: String) async throws -> StripeConnectAccount {
        throw CancellationError()
    }
    func createStripeAccountLink(returnUrl: String, refreshUrl: String) async throws -> StripeConnectAccountLink {
        throw CancellationError()
    }
    func prepareRidePayment(bookingId: String) async throws -> PaymentSheetConfig {
        _ = try await probe.read("prepare")
        return isolatedPaymentConfig()
    }
    func ridePaymentStatus(bookingId: String, paymentIntentId: String) async throws -> RidePaymentState {
        check(bookingId == "isolated-booking" && paymentIntentId == "pi_isolated", "Payment correlation changed")
        _ = try await probe.read("status")
        return state
    }
}

func isolatedPaymentConfig() -> PaymentSheetConfig {
    PaymentSheetConfig(bookingId: "isolated-booking", paymentIntentId: "pi_isolated",
        clientSecret: "synthetic-unused", publishableKey: "synthetic-unused", amountCents: 400, currency: "eur")
}

@MainActor
func checkRidePaymentOwnership() async throws {
    let probe = AppDataProbe(suspended: [1])
    let reads = AppDataProbe()
    let app = AppState(auth: UnconfiguredAuthGateway(), firebase: AppDataFixtureGateway(probe: reads),
        stripe: PaymentOwnershipGateway(probe: probe),
        authentication: AuthenticationState(makeStore: { MemoryLogoutIntentStore() }))
    let session = AuthSession(uid: "isolated-parent", email: nil, displayName: nil, roles: [.parent])
    app.session = session
    app.pendingRidePayment = try RidePaymentTarget(ownerUid: session.uid, bookingId: "isolated-booking",
        amountCents: 400, config: isolatedPaymentConfig())
    let task = Task { await app.verifyRidePayment() }
    await probe.waitForCall(1)
    app.signOut()
    app.session = session
    await probe.release(1)
    await task.value
    let followups = await reads.names()
    FileHandle.standardError.write(Data("Payment logout reproduction: restoredNotice=\(app.noticeMessage != nil), followups=\(followups.count)\n".utf8))
    check(app.noticeMessage == nil && app.errorMessage == nil && followups.isEmpty,
        "Old payment response changed the reauthenticated account")
    try await checkPaymentBoundaries()
    try await checkCurrentPaymentStatuses()
    print("Ride payment ownership checks passed; synthetic status gateway only")
}

@MainActor
private func checkPaymentBoundaries() async throws {
    var count = 0
    for method in ["prepare", "status"] {
        for failing in [false, true] {
            for revoke in ["logout", "other-uid", "same-uid", "role-roundtrip", "roles-revoked", "cancel"] {
                let probe = AppDataProbe(suspended: [1])
                let reads = AppDataProbe()
                let app = paymentApp(probe: probe, reads: reads)
                if method == "status" { app.pendingRidePayment = try paymentTarget() }
                func execute() async {
                    if method == "prepare" { await app.payRide(paymentBooking()) }
                    else { await app.verifyRidePayment() }
                }
                let task = Task { await execute() }
                await probe.waitForCall(1)
                check(app.accountWork.busy && app.ridePaymentBusy, "Payment did not retain its account work")
                await execute()
                if revoke == "cancel" { task.cancel() }
                else if revoke == "role-roundtrip" { app.selectedRole = .driver; app.selectedRole = .parent }
                else if revoke == "roles-revoked" {
                    app.session = AuthSession(uid: "isolated-parent", email: nil, displayName: nil, roles: [.driver])
                } else {
                    app.signOut()
                    check(app.authenticating, "Login opened before outstanding payment work settled")
                    await app.signIn(email: "synthetic@example.invalid", password: "unused")
                    check(app.session == nil, "Authentication crossed outstanding payment work")
                    if revoke != "logout" {
                        app.session = paymentSession(uid: revoke == "same-uid" ? "isolated-parent" : "isolated-other")
                    }
                }
                if revoke != "cancel", let access = app.accountAccess {
                    check(access.begin() == nil, "New generation began before old payment work settled")
                }
                app.noticeMessage = "Current notice"
                app.errorMessage = "Current error"
                await probe.release(1, failing: failing)
                await task.value
                let calls = await probe.names()
                let followups = await reads.names()
                check(calls == [method] && followups.isEmpty, "Revoked payment issued duplicate or follow-up work")
                check(app.noticeMessage == "Current notice" && app.errorMessage == "Current error",
                    "Revoked payment changed current account feedback")
                check(app.ridePaymentState == .pending && !app.ridePaymentBusy && !app.accountWork.busy,
                    "Revoked payment applied state or leaked unsettled work")
                count += 1
            }
        }
    }
    print("Payment boundaries passed: \(count) delayed preparation/status success/error cases; no SDK presentation or payment requests")
}

@MainActor
private func checkCurrentPaymentStatuses() async throws {
    for state in [RidePaymentState.pending, .recorded, .failed, .canceled, .review] {
        let probe = AppDataProbe(suspended: [1])
        let reads = AppDataProbe()
        let app = paymentApp(probe: probe, reads: reads, state: state)
        app.pendingRidePayment = try paymentTarget()
        let task = Task { await app.verifyRidePayment() }
        await probe.waitForCall(1)
        await app.verifyRidePayment()
        await probe.release(1)
        await task.value
        let calls = await probe.names()
        let followups = await reads.names()
        check(calls == ["status"], "Current status verification was duplicated")
        check(app.ridePaymentState == state && app.noticeMessage == state.message, "Current payment status was not applied")
        check(followups.isEmpty == (state != .recorded), "Only a recorded payment should refresh account data")
        check((app.pendingRidePayment == nil) == [.recorded, .failed, .canceled].contains(state), "Pending payment lifecycle changed")
        check(!app.accountWork.busy && !app.ridePaymentBusy, "Current payment completion leaked work")
    }
    let probe = AppDataProbe(suspended: [1])
    let app = paymentApp(probe: probe, reads: AppDataProbe(), state: .review)
    app.pendingRidePayment = try paymentTarget()
    let task = Task { await app.verifyRidePayment() }
    await probe.waitForCall(1)
    await probe.release(1, failing: true)
    await task.value
    check(app.errorMessage != nil && app.pendingRidePayment != nil && !app.accountWork.busy, "Current error lost explicit retry")
    await app.verifyRidePayment()
    check(app.errorMessage == nil && app.ridePaymentState == .review, "Explicit retry could not read current payment state")
    print("Current payment checks passed: five correlated states, duplicate exclusion, error and explicit retry")
}

private func paymentTarget() throws -> RidePaymentTarget {
    try RidePaymentTarget(ownerUid: "isolated-parent", bookingId: "isolated-booking", amountCents: 400, config: isolatedPaymentConfig())
}

private func paymentSession(uid: String = "isolated-parent") -> AuthSession {
    AuthSession(uid: uid, email: nil, displayName: nil, roles: [.parent, .driver])
}

private func paymentBooking() -> PayableBookingSummary {
    PayableBookingSummary(id: "isolated-booking", tripId: "isolated-trip", title: "Synthetic trip", club: "Synthetic club",
        dateLabel: "30 November", timeLabel: "12:00", seats: 1, amountCents: 400, amountLabel: "4 EUR", paymentStatus: "unpaid")
}

@MainActor
private func paymentApp(probe: AppDataProbe, reads: AppDataProbe, state: RidePaymentState = .recorded) -> AppState {
    let app = AppState(auth: UnconfiguredAuthGateway(), firebase: AppDataFixtureGateway(probe: reads),
        stripe: PaymentOwnershipGateway(probe: probe, state: state),
        authentication: AuthenticationState(makeStore: { MemoryLogoutIntentStore() }))
    app.session = paymentSession()
    return app
}
