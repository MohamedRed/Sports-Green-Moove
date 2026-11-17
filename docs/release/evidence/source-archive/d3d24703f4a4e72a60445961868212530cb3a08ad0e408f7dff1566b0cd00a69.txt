import Foundation

@MainActor func ownedSearchApp(_ probe: AppDataProbe, booking: AppDataProbe? = nil, match: TripMatchSummary? = nil) -> AppState {
    let app = AppState(auth: UnconfiguredAuthGateway(),
        firebase: AppDataFixtureGateway(probe: AppDataProbe(), publications: probe, searches: probe, searchResult: match, bookings: booking),
        authentication: AuthenticationState(makeStore: { MemoryLogoutIntentStore() }))
    app.session = .init(uid: "isolated-owner", email: nil, displayName: nil, roles: [.parent, .driver])
    app.activateSearch(access: app.accountAccess!)
    app.searchOrigin = isolatedPublishDraft().origin; app.searchDestination = isolatedPublishDraft().destination
    return app
}
func ownedSearchForm() -> SearchFormState {
    var form = SearchFormState.initial(); form.childUserId = "isolated-child"; form.seatsNeeded = 2; form.guardianConsent = true; return form
}
@MainActor func ownedSearchAction(_ method: String, app: AppState, access: AccountAccess, request: SearchRequestState.Request?) async {
    if method == "matches" { if let request { await app.runSearch(request) }; return }
    let target: SearchPlaceTarget = method.hasSuffix("destination") ? .destination : .origin
    if method.hasPrefix("suggest") { await app.suggestPlaces(input: "Synthetic address", target: target, access: access) }
    else {
        await app.selectPlace(.init(placeId: "isolated-origin", label: "Synthetic address", mainText: nil, secondaryText: nil), target: target, access: access)
    }
}
@MainActor func checkSearchOwnership() async throws {
    var count = 0
    for method in ["suggest-origin", "suggest-destination", "resolve-origin", "resolve-destination", "matches"] {
        for failing in [false, true] {
            for revoke in ["logout", "same-uid", "other-uid", "role-roundtrip", "roles-revoked", "new-generation", "close", "background", "cancel"] {
                let probe = AppDataProbe(suspended: [1]), app = ownedSearchApp(probe), access = app.accountAccess!
                let suggestion = PlaceSuggestion(placeId: "isolated-origin", label: "Synthetic address", mainText: nil, secondaryText: nil)
                app.originSuggestions = [suggestion]; app.destinationSuggestions = [suggestion]
                let form = ownedSearchForm(), request = method == "matches" ? app.prepareSearch(form: form, access: access) : nil
                let task = Task { await ownedSearchAction(method, app: app, access: access, request: request) }
                await probe.waitForCall(1)
                check(app.accountWork.busy && app.searchLoading, "Search released an unsettled callback")
                await ownedSearchAction(method, app: app, access: access, request: request)
                switch revoke {
                case "role-roundtrip": app.selectedRole = .driver; app.selectedRole = .parent
                case "new-generation": app.refreshAccountScope()
                case "roles-revoked": app.session = .init(uid: "isolated-owner", email: nil, displayName: nil, roles: [.child])
                case "close", "background": app.suspendSearch(access: access)
                case "cancel": task.cancel()
                default:
                    app.signOut()
                    if revoke != "logout" {
                        app.session = .init(uid: revoke == "same-uid" ? "isolated-owner" : "other-owner", email: nil, displayName: nil, roles: [.parent, .driver])
                    }
                }
                app.originSuggestions = []; app.destinationSuggestions = []; app.searchOrigin = nil; app.searchDestination = nil; app.searchMatches = []
                app.errorMessage = "Current feedback"; app.noticeMessage = "Current notice"
                if let fresh = app.accountAccess, fresh.context != access.context {
                    app.activateSearch(access: fresh)
                    check(fresh.begin() == nil, "A new search generation crossed unfinished work")
                }
                if revoke != "cancel" { await ownedSearchAction(method, app: app, access: access, request: request) }
                check(app.accountWork.busy && app.searchLoading, "Search invalidation released its lease too early")
                await probe.release(1, failing: failing); await task.value
                let calls = await probe.names()
                check(calls.count == 1 && !app.accountWork.busy && !app.searchLoading, "Search duplicated work or failed to drain")
                check(app.originSuggestions.isEmpty && app.destinationSuggestions.isEmpty && app.searchOrigin == nil &&
                    app.searchDestination == nil && app.searchMatches.isEmpty, "Delayed search restored private state")
                check(app.errorMessage == "Current feedback" && app.noticeMessage == "Current notice", "Delayed search changed a newer view's feedback")
                count += 1
            }
        }
    }
    try await checkCurrentOwnedSearch()
    print("SearchOwnershipChecks passed: \(count) delayed address/detail/match success/error cases; account/role generations, close, background, cancellation, duplicate exclusion and actual callback drainage")
}

@MainActor private func checkCurrentOwnedSearch() async throws {
    let probe = AppDataProbe(), bookings = AppDataProbe()
    let intent = BookingIntentSnapshot(terms: .init(departureAt: "2026-11-30T12:00:00Z", arrivalBy: nil,
        origin: .init(lat: 50.5, lng: 4.5), destination: .init(lat: 50.6, lng: 4.6), priceCents: 400),
        context: .init(driverUserId: "isolated-driver", seatsTotal: 3, clubId: nil, teamId: nil, category: "U8",
            pickupRadiusM: nil, baggage: "medium", returnTrip: false, supportsVehicleTracking: true,
            supportsChildTracking: true, appliedChangeId: nil))
    let trip = TripSummary(id: "isolated-search-trip", title: "Trajet fictif", club: "Club fictif", category: "U8",
        departureLabel: "30 novembre", seatsAvailable: 3, priceLabel: "4 EUR", reasons: [], bookingIntent: intent)
    let match = TripMatchSummary(tripId: trip.id, score: 1, summary: trip, reasons: [], detourMinutes: nil, pickupDistanceMeters: nil)
    let app = ownedSearchApp(probe, booking: bookings, match: match), access = app.accountAccess!, form = ownedSearchForm()
    await app.suggestPlaces(input: "Synthetic address", target: .origin, access: access)
    check(app.originSuggestions.count == 1, "Owned address suggestions failed")
    let valid = app.originSuggestions[0]
    await app.selectPlace(valid, target: .origin, access: access)
    check(app.searchOrigin != nil && app.originSuggestions.isEmpty, "Owned address selection failed")
    await app.selectPlace(valid, target: .destination, access: access)
    let calls = await probe.names()
    check(calls == ["suggest", "resolve"], "Undisplayed address was resolved")
    let request = app.prepareSearch(form: form, access: access)!
    await app.runSearch(request)
    check(app.searchMatches == [match] && app.searchRequests.completed?.owner == access.context, "Current search did not retain its exact owner")
    var changed = form; changed.seatsNeeded = 1
    await app.requestSearchMatch(match, form: changed, access: access)
    let before = await bookings.names(); check(before.isEmpty, "Changed criteria reused old results")
    await app.requestSearchMatch(match, form: form, access: access)
    let captured = await bookings.capturedBookings()
    check(captured == [.init(uid: "isolated-owner", trip: trip, childId: "isolated-child", seats: 2)], "Booking changed displayed account, trip, child or seats")
    let payload = try bookingRequestPayload(trip: captured[0].trip, childId: captured[0].childId, seats: captured[0].seats)
    check(payload["tripId"] as? String == trip.id && payload["childId"] as? String == "isolated-child" &&
        payload["seats"] as? Int == 2 && payload["expectedBookingIntent"] is [String: Any], "Captured selection could not form the real booking payload")
    app.suspendSearch(access: access)
    check(app.searchMatches.isEmpty && app.searchRequests.completed == nil && app.originSuggestions.isEmpty, "Closed search retained bookable results")
    await app.requestSearchMatch(match, form: form, access: access)
    let unchanged = await bookings.capturedBookings(); check(unchanged == captured, "Closed search dispatched booking")
    app.refreshAccountScope(); let fresh = app.accountAccess!; app.activateSearch(access: fresh)
    app.searchOrigin = isolatedPublishDraft().origin; app.searchDestination = isolatedPublishDraft().destination
    app.suspendSearch(access: access)
    check(app.searchActivity.access?.context == fresh.context && app.searchOrigin != nil, "Old view closed a new search owner")
    await app.suggestPlaces(input: "Synthetic address", target: .origin, access: access)
    check(app.originSuggestions.isEmpty, "Stale view dispatched a new same-UID lookup")
    let oldContext = SearchRequestContext(owner: access.context, form: form, origin: app.searchOrigin!, destination: app.searchDestination!)
    var requests = SearchRequestState(); let old = requests.begin(oldContext)!
    check(!requests.finish(old, owner: fresh.context, succeeded: true), "Same UID replaced exact authentication generation")
    print("Current owned search passed: current address selection, undisplayed denial, exact two-seat child booking, changed-form denial, closed-screen denial and old-view/new-owner isolation")
}
