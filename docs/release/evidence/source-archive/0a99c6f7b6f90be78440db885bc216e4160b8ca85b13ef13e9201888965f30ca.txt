import Foundation

func check(_ condition: @autoclosure () -> Bool, _ message: String) {
    if !condition() { fatalError(message) }
}
let fields = ["form", "origin-input", "destination-input", "resolved-origin", "resolved-destination"]

@MainActor func selectionFixture() -> (AppState, SearchSelectionState, AccountAccess) {
    let app = UITestAppStateFactory.make(route: "search"), access = app.accountAccess!
    app.activateSearch(access: access)
    let selection = SearchSelectionState(appState: app, access: access)
    selection.reconcileChildren(app.children); selection.form.guardianConsent = true
    return (app, selection, access)
}
@MainActor func edit(_ field: String, app: AppState, selection: SearchSelectionState) {
    switch field {
    case "form": selection.form.seatsNeeded = selection.form.seatsNeeded == 1 ? 2 : 1
    case "origin-input": selection.originInput += "changed"
    case "destination-input": selection.destinationInput += "changed"
    default:
        let value = field == "resolved-origin" ? app.searchOrigin! : app.searchDestination!
        let changed = ResolvedPlace(placeId: value.placeId + "-changed", label: value.label,
            formattedAddress: value.formattedAddress, lat: value.lat + 0.001, lng: value.lng)
        if field == "resolved-origin" { app.searchOrigin = changed } else { app.searchDestination = changed }
    }
}

var currentCases = 0, invalidatedCases = 0
for field in fields {
    for stage in ["prepared", "completed"] {
        let (app, selection, access) = selectionFixture(), origin = app.searchOrigin, destination = app.searchDestination
        edit(field, app: app, selection: selection)
        // Resolving the edited query is a distinct state transition before starting the new search.
        if app.searchOrigin == nil { app.searchOrigin = origin }
        if app.searchDestination == nil { app.searchDestination = destination }
        let request = app.prepareSearch(form: selection.form, access: access)!
        if stage == "completed" { await app.runSearch(request) }
        await Task.yield()
        if stage == "prepared" { await app.runSearch(request) }
        check(app.searchMatches.count == 1 && app.searchRequests.completed == request.context,
            "A new search was erased by its already-applied selection change: \(field)/\(stage)")
        currentCases += 1
        edit(field, app: app, selection: selection)
        check(app.searchMatches.isEmpty && app.searchRequests.completed == nil && app.searchRequests.pending == nil,
            "A genuine new edit retained previous booking authority: \(field)/\(stage)")
        invalidatedCases += 1
    }
}
var delayedCases = 0
for field in fields {
    let probe = AppDataProbe(suspended: [1]), app = ownedSearchApp(probe), access = app.accountAccess!
    let selection = SearchSelectionState(appState: app, access: access); selection.form = ownedSearchForm()
    let request = app.prepareSearch(form: selection.form, access: access)!
    let pending = Task { await app.runSearch(request) }; await probe.waitForCall(1)
    edit(field, app: app, selection: selection)
    check(app.searchRequests.pending == nil && app.accountWork.busy && app.searchLoading,
        "Edit retained authority or released the unsettled callback: \(field)")
    await probe.release(1, failing: false); await pending.value
    check(app.searchMatches.isEmpty && app.searchRequests.completed == nil && !app.accountWork.busy && !app.searchLoading,
        "An obsolete response restored matches or failed to drain: \(field)")
    delayedCases += 1
}
let (sameApp, sameSelection, sameAccess) = selectionFixture()
let same = sameApp.prepareSearch(form: sameSelection.form, access: sameAccess)!
await sameApp.runSearch(same)
let unchangedForm = sameSelection.form, unchangedOrigin = sameApp.searchOrigin, unchangedDestination = sameApp.searchDestination
sameSelection.form = unchangedForm; sameSelection.originInput = ""; sameSelection.destinationInput = ""
sameApp.searchOrigin = unchangedOrigin; sameApp.searchDestination = unchangedDestination
sameSelection.reconcileChildren(sameApp.children)
check(sameApp.searchRequests.completed == same.context && sameApp.searchMatches.count == 1 && sameSelection.form.guardianConsent,
    "Unchanged bindings or child reconciliation revoked a current search")
sameSelection.form.seatsNeeded = 2; sameSelection.form.seatsNeeded = 1
check(sameApp.searchRequests.completed == nil && sameApp.searchMatches.isEmpty,
    "A reverted edit restored old booking authority without another search")
sameSelection.form.childUserId = "child-2"
check(!sameSelection.form.guardianConsent, "Another child retained consent")
sameSelection.form.guardianConsent = true; sameSelection.form.requireChildTracking.toggle()
check(!sameSelection.form.guardianConsent, "Changed tracking retained consent")
sameSelection.reset(children: [])
check(sameSelection.form.childUserId == nil && !sameSelection.form.guardianConsent &&
    sameSelection.originInput.isEmpty && sameSelection.destinationInput.isEmpty, "Reset kept private selections or consent")

let (freshApp, oldSelection, _) = selectionFixture()
freshApp.refreshAccountScope(); let freshAccess = freshApp.accountAccess!; freshApp.activateSearch(access: freshAccess)
freshApp.searchOrigin = unchangedOrigin; freshApp.searchDestination = unchangedDestination
let fresh = freshApp.prepareSearch(form: unchangedForm, access: freshAccess)!
for field in ["form", "origin-input", "destination-input"] { edit(field, app: freshApp, selection: oldSelection) }
check(freshApp.searchRequests.pending == fresh && freshApp.searchOrigin == unchangedOrigin && freshApp.searchDestination == unchangedDestination,
    "A stale selection owner revoked the newer account generation")
await freshApp.runSearch(fresh)
check(freshApp.searchMatches.count == 1, "The new account generation could not finish its own search")
print("Synchronous selection checks passed: \(currentCases) new searches preserved, \(invalidatedCases) genuine edits revoked, \(delayedCases) delayed responses drained; same-value, reverted edit, consent, reset and account-generation guards")
print("Search screen root cause remains unconfirmed; no native UI, real map, provider or physical flow executed")
