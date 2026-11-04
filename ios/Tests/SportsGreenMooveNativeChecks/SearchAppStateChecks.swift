import Foundation

@MainActor
func checkSearchAppState() async {
    let state = AppState(auth: UnconfiguredAuthGateway(), firebase: UnconfiguredFirebaseGateway(),
        authentication: AuthenticationState(makeStore: { MemoryLogoutIntentStore() }))
    var form = SearchFormState.initial()
    check(state.prepareSearch(form: form) == nil, "Signed-out search is rejected before calling a provider")
    state.session = AuthSession(uid: "isolated-parent-a", email: nil, displayName: nil, roles: [.parent])
    state.searchOrigin = ResolvedPlace(placeId: "origin", label: "Origin", formattedAddress: "Isolated origin", lat: 50, lng: 4)
    state.searchDestination = ResolvedPlace(placeId: "destination", label: "Destination", formattedAddress: "Isolated destination", lat: 51, lng: 5)
    form.childUserId = "isolated-child-a"
    check(state.prepareSearch(form: form) == nil, "Missing consent never creates a request")
    check(state.errorMessage == form.validationMessage, "Consent validation is displayed rather than a provider error")
    form.guardianConsent = true
    let cancelled = state.prepareSearch(form: form)!
    check(state.searchLoading, "Prepared search exposes loading immediately")
    state.invalidateSearch()
    await state.runSearch(cancelled)
    check(!state.searchLoading && state.errorMessage == nil, "Revoked work is rejected before calling the unconfigured provider")
    let failed = state.prepareSearch(form: form)!
    await state.runSearch(failed)
    check(!state.searchLoading && state.searchRequests.completed == nil && state.errorMessage != nil,
        "An actual gateway failure clears pending work without accepting results")

    let accepted = state.prepareSearch(form: form)!
    check(state.searchRequests.finish(accepted, uid: state.session?.uid, succeeded: true), "Unit context can complete")
    let trip = TripSummary(id: "isolated-trip", title: "Isolated trip", club: "Isolated club", category: "U8",
        departureLabel: "Tomorrow", seatsAvailable: 3, priceLabel: "4 EUR", passengerInitials: [], reasons: [])
    let match = TripMatchSummary(tripId: trip.id, score: 1, summary: trip, reasons: [], detourMinutes: nil, pickupDistanceMeters: nil)
    state.searchMatches = [match]
    var changed = form
    changed.seatsNeeded = 2
    await state.requestSearchMatch(match, form: changed)
    check(state.errorMessage == "Les options ont changé. Relancez la recherche avant de réserver." && state.noticeMessage == nil,
        "A changed form is rejected before requestBooking can call the provider")
    state.session = AuthSession(uid: "isolated-parent-b", email: nil, displayName: nil, roles: [.parent])
    check(state.searchMatches.isEmpty && state.searchRequests.completed == nil && state.searchRequests.pending == nil,
        "Account changes revoke pending and completed results")
    check(state.searchOrigin == nil && state.searchDestination == nil && state.originSuggestions.isEmpty &&
        state.destinationSuggestions.isEmpty, "Account changes clear private place selections and suggestions")
    print("Search app-state checks passed: pre-call consent, revoked work, gateway failure and account isolation; no provider configured")
}
