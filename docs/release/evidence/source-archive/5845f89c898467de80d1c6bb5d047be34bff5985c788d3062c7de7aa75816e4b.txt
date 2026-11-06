import Foundation

func check(_ condition: @autoclosure () -> Bool, _ message: String) {
    if !condition() { fatalError(message) }
}
for field in ["form", "origin-input", "destination-input", "resolved-origin", "resolved-destination"] {
    for stage in ["prepared", "completed"] {
        let app = UITestAppStateFactory.make(route: "search"), access = app.accountAccess!
        app.activateSearch(access: access)
        var form = SearchFormState.initial()
        form.childUserId = "child-1"; form.guardianConsent = true
        let request = app.prepareSearch(form: form, access: access)!
        if stage == "completed" { await app.runSearch(request); check(app.searchMatches.count == 1, "Fixture did not search") }
        // Replay the exact deferred callback from the retained old SearchScreen after a newer request.
        switch field {
        case "origin-input": app.invalidatePlace(.origin)
        case "destination-input": app.invalidatePlace(.destination)
        default: app.invalidateSearch()
        }
        if stage == "prepared" { await app.runSearch(request) }
        check(app.searchRequests.pending == nil && app.searchRequests.completed == nil && app.searchMatches.isEmpty,
            "The old callback no longer erases the newer request")
        print("Deferred selection observation: \(field)/\(stage) erased newer search")
    }
}
print("Deferred search baseline observed: 10 reordered callbacks erase newer searches; controlled order, not a native-screen diagnosis")
