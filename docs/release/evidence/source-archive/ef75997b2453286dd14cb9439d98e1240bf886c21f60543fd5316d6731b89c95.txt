import Foundation

@MainActor
func checkBookingOwnership() async {
    var restored = 0
    for method in ["request", "approve"] {
        let probe = AppDataProbe(suspended: [1]), reads = AppDataProbe()
        let app = AppState(auth: UnconfiguredAuthGateway(), firebase: AppDataFixtureGateway(probe: reads, bookings: probe),
            authentication: AuthenticationState(makeStore: { MemoryLogoutIntentStore() }))
        let session = AuthSession(uid: "isolated-owner", email: nil, displayName: nil, roles: [.parent, .driver])
        app.session = session
        app.selectedRole = method == "request" ? .parent : .driver
        let task = Task {
            if method == "request" {
                await app.requestBooking(trip: appDataTrip("isolated-trip"), childId: "isolated-child", seats: 2)
            } else { await app.approveBooking(isolatedBookingRequest()) }
        }
        await probe.waitForCall(1)
        app.signOut(); app.session = session
        await probe.release(1); await task.value
        let followups = await reads.names()
        FileHandle.standardError.write(Data("Booking logout reproduction: action=\(method), restoredNotice=\(app.noticeMessage != nil), followups=\(followups.count)\n".utf8))
        if app.noticeMessage != nil || app.errorMessage != nil || !followups.isEmpty { restored += 1 }
    }
    check(restored == 0, "An old booking response changed the reauthenticated account")
    await checkBookingBoundaries()
    await checkCurrentBookings()
    print("Booking ownership checks passed; synthetic gateways only")
}

@MainActor
private func checkBookingBoundaries() async {
    var count = 0
    for method in ["request", "approve"] {
        for failing in [false, true] {
            for revoke in ["logout", "other-uid", "same-uid", "role-roundtrip", "roles-revoked", "cancel"] {
                let probe = AppDataProbe(suspended: [1]), reads = AppDataProbe()
                let app = bookingApp(probe: probe, reads: reads, method: method)
                func run() async { await executeBooking(app, method: method) }
                let task = Task { await run() }
                await probe.waitForCall(1)
                check(app.bookingBusy && app.accountWork.busy, "Booking did not retain unsettled account work")
                await run()
                if revoke == "cancel" { task.cancel() }
                else if revoke == "role-roundtrip" {
                    let original = app.selectedRole
                    app.selectedRole = original == .parent ? .driver : .parent
                    app.selectedRole = original
                } else if revoke == "roles-revoked" {
                    app.session = AuthSession(uid: "isolated-owner", email: nil, displayName: nil, roles: [.child])
                } else {
                    app.signOut()
                    check(app.authenticating, "Login opened before booking settlement")
                    await app.signIn(email: "unused@example.invalid", password: "unused")
                    check(app.session == nil, "Sign-in crossed an outstanding booking")
                    if revoke != "logout" {
                        app.session = bookingSession(uid: revoke == "same-uid" ? "isolated-owner" : "isolated-other")
                    }
                }
                app.noticeMessage = "Current notice"; app.errorMessage = "Current error"
                await probe.release(1, failing: failing); await task.value
                let calls = await probe.names(), followups = await reads.names()
                check(calls == [method] && followups.isEmpty, "Revoked booking issued duplicate or follow-up work")
                check(app.noticeMessage == "Current notice" && app.errorMessage == "Current error",
                    "Revoked booking changed another generation's feedback")
                check(!app.bookingBusy && !app.accountWork.busy, "Booking settlement leaked work")
                count += 1
            }
        }
    }
    print("Booking boundaries passed: \(count) delayed request/approval success/error cases; immutable account and role generations, cancellation, duplicate denial and drain")
}

@MainActor
private func checkCurrentBookings() async {
    for method in ["request", "approve"] {
        let probe = AppDataProbe(suspended: [1]), reads = AppDataProbe()
        let app = bookingApp(probe: probe, reads: reads, method: method)
        app.loading = true
        let task = Task { await executeBooking(app, method: method) }
        await probe.waitForCall(1)
        await executeBooking(app, method: method)
        await probe.release(1, failing: true); await task.value
        check(app.errorMessage != nil && app.noticeMessage == nil && !app.bookingBusy, "Current booking error was hidden")
        await executeBooking(app, method: method)
        check(app.errorMessage == nil && app.noticeMessage != nil && app.loading && !app.accountWork.busy,
            "Explicit booking retry failed or cleared another operation's loading state")
        let calls = await probe.names(), followups = await reads.names()
        check(calls == [method, method] && followups.isEmpty == (method == "request"), "Current follow-up policy changed")
        let access = app.accountAccess!
        app.signOut(); app.session = bookingSession()
        await executeBooking(app, method: method, access: access)
        let after = await probe.names()
        check(after == calls && app.noticeMessage == nil && app.errorMessage == nil, "Old screen adopted a fresh same-UID account")
    }
    for role in [AppRole.child, .clubManager, .admin] {
        let probe = AppDataProbe()
        let app = bookingApp(probe: probe, reads: AppDataProbe(), method: "request")
        app.session = AuthSession(uid: "isolated-owner", email: nil, displayName: nil, roles: [role]); app.selectedRole = role
        let access = app.accountAccess!
        await app.requestBooking(trip: appDataTrip("isolated-trip"), childId: "isolated-child", seats: 2, access: access)
        await app.approveBooking(isolatedBookingRequest(), access: access)
        let calls = await probe.names()
        check(calls.isEmpty && !app.bookingBusy && !app.accountWork.busy, "Unrelated role could mutate bookings")
    }
    let probe = AppDataProbe(), reads = AppDataProbe()
    let invalid = AppState(auth: UnconfiguredAuthGateway(),
        firebase: AppDataFixtureGateway(probe: reads, bookings: probe, bookingStatus: "cancelled"),
        authentication: AuthenticationState(makeStore: { MemoryLogoutIntentStore() }))
    invalid.session = bookingSession(); invalid.selectedRole = .driver
    await invalid.approveBooking(isolatedBookingRequest())
    let followups = await reads.names()
    check(invalid.noticeMessage == nil && invalid.errorMessage != nil && followups.isEmpty, "Non-approved response was reported as approved")
    let terms = BookingIntentSnapshot(terms: .init(departureAt: "2026-11-30T12:00:00Z", arrivalBy: nil,
        origin: MapPoint(lat: 50, lng: 4), destination: MapPoint(lat: 51, lng: 5), priceCents: 400),
        context: .init(driverUserId: "isolated-driver", seatsTotal: 3, clubId: nil, teamId: nil, category: nil,
            pickupRadiusM: nil, baggage: nil, returnTrip: nil, supportsVehicleTracking: nil,
            supportsChildTracking: nil, appliedChangeId: nil))
    check(terms.isValid, "Captured booking terms are not a valid fixture")
    let captured = TripSummary(id: "isolated-trip", title: "Synthetic trip", club: "Synthetic club", category: "Adults",
        departureLabel: "30 November", seatsAvailable: 3, priceLabel: "4 EUR", reasons: [], bookingIntent: terms)
    let snapshotProbe = AppDataProbe()
    let snapshot = AppState(auth: UnconfiguredAuthGateway(),
        firebase: AppDataFixtureGateway(probe: AppDataProbe(), bookings: snapshotProbe, expectedBookingTrip: captured),
        authentication: AuthenticationState(makeStore: { MemoryLogoutIntentStore() }))
    snapshot.session = bookingSession()
    snapshot.trips = [TripSummary(id: captured.id, title: "Changed trip", club: captured.club, category: captured.category,
        departureLabel: "Changed departure", seatsAvailable: 1, priceLabel: "8 EUR", reasons: [])]
    await snapshot.handleTripAction(trip: captured, access: snapshot.accountAccess!)
    check(snapshot.noticeMessage != nil, "Captured trip action was not submitted")
    for revoked in [false, true] {
        let probe = AppDataProbe(suspended: [1])
        let app = AppState(auth: UnconfiguredAuthGateway(),
            firebase: AppDataFixtureGateway(probe: AppDataProbe(), bookings: probe, bookingReviewRequired: true),
            authentication: AuthenticationState(makeStore: { MemoryLogoutIntentStore() }))
        app.session = bookingSession()
        let trip = appDataTrip("isolated-trip")
        let match = TripMatchSummary(tripId: trip.id, score: 1, summary: trip, reasons: [], detourMinutes: nil, pickupDistanceMeters: nil)
        app.searchMatches = [match]
        let task = Task { await executeBooking(app, method: "request") }
        await probe.waitForCall(1)
        if revoked { app.signOut(); app.session = bookingSession(); app.searchMatches = [match] }
        await probe.release(1); await task.value
        check(app.searchMatches.isEmpty == !revoked, "Old booking review removed another generation's search results")
        check((app.errorMessage != nil) == !revoked, "Booking review error escaped its account context")
    }
    print("Current booking checks passed: explicit retry, unrelated loading preservation, stale-screen and role denial, strict approval status and captured displayed trip")
}

@MainActor
private func executeBooking(_ app: AppState, method: String, access: AccountAccess? = nil) async {
    guard let access = access ?? app.accountAccess else { return }
    if method == "request" {
        await app.requestBooking(trip: appDataTrip("isolated-trip"), childId: "isolated-child", seats: 2, access: access)
    } else { await app.approveBooking(isolatedBookingRequest(), access: access) }
}

private func bookingSession(uid: String = "isolated-owner") -> AuthSession {
    AuthSession(uid: uid, email: nil, displayName: nil, roles: [.parent, .driver])
}

@MainActor
private func bookingApp(probe: AppDataProbe, reads: AppDataProbe, method: String) -> AppState {
    let app = AppState(auth: UnconfiguredAuthGateway(), firebase: AppDataFixtureGateway(probe: reads, bookings: probe),
        authentication: AuthenticationState(makeStore: { MemoryLogoutIntentStore() }))
    app.session = bookingSession(); app.selectedRole = method == "request" ? .parent : .driver
    return app
}

func isolatedBookingRequest() -> BookingRequestSummary {
    BookingRequestSummary(bookingId: "isolated-booking", tripId: "isolated-trip", parentUserId: "isolated-parent",
        childId: "isolated-child", childLabel: "Synthetic child", seats: 2, note: nil, status: "requested",
        title: "Synthetic trip", club: "Synthetic club", dateLabel: "30 November", timeLabel: "12:00", priceLabel: "4 EUR")
}
