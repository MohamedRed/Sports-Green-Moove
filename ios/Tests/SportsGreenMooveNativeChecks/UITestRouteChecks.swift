import Foundation

#if DEBUG
@MainActor func checkUITestRouteOwnership() async {
    let publication = UITestAppStateFactory.make(route: "publish")
    print("Fixture publication seed: driver=\(publication.selectedRole == .driver), origin=\(publication.searchOrigin != nil), destination=\(publication.searchDestination != nil)")
    check(publication.selectedRole == .driver && publication.accountAccess?.context.role == .driver,
        "Publication fixture must establish its final driver generation")
    check(publication.searchOrigin != nil && publication.searchDestination != nil,
        "Publication fixture must seed resolved places after the final role transition")
    let controller = PublishController(access: publication.accountAccess!)
    controller.seedPlaces(origin: publication.searchOrigin, destination: publication.searchDestination)
    check(controller.origin != nil && controller.destination != nil, "Actual publication controller must receive both fixture places")
    for route in ["home", "booking", "messages", "search", "groups", "groups-review", "impact", "rewards", "options", "payments", "ride", "child-contact"] {
        let app = UITestAppStateFactory.make(route: route)
        let role: AppRole = route == "booking" ? .driver : route == "groups-review" ? .clubManager : route == "child-contact" ? .child : .parent
        check(app.selectedRole == role && app.accountAccess?.context.role == role, "Fixture route has the wrong current owner: \(route)")
        check(app.searchOrigin != nil && app.searchDestination != nil, "Fixture route discarded its seeded places: \(route)")
    }
    let app = UITestAppStateFactory.make(route: "search"), access = app.accountAccess!
    app.activateSearch(access: access)
    var form = SearchFormState.initial()
    form.childUserId = "child-2"; form.seatsNeeded = 2; form.requireChildTracking = false; form.guardianConsent = true
    let request = app.prepareSearch(form: form, access: access)!
    await app.runSearch(request)
    check(app.searchMatches.count == 1 && app.searchRequests.completed?.owner == access.context, "Fixture search must return an owned match")
    await app.requestSearchMatch(app.searchMatches[0], form: form, access: access)
    check(app.noticeMessage == "Demande envoyée: booking-child-2-2" && app.errorMessage == nil,
        "Actual fixture booking must retain its exact second-child/two-seat confirmation")
    check(!app.bookingBusy && !app.accountWork.busy, "Fixture booking must drain its work")
    print("UI fixture ownership checks passed: thirteen established route owners and actual second-child/two-seat booking confirmation; no native screen or provider")
}
#endif
