import XCTest

@MainActor func verifyClubRequest(in app: XCUIApplication) {
    let request = app.buttons["groups.join.action"]
    XCTAssertTrue(request.waitForExistence(timeout: 6)); request.tap()
    let status = app.staticTexts["membership.status.club-tennis"]
    XCTAssertTrue(status.waitForExistence(timeout: 6)); XCTAssertEqual(status.label, "En attente")
    XCTAssertFalse(request.exists)
    app.buttons["membership.club.club-tennis"].tap()
    XCTAssertTrue(app.staticTexts["membership.detail.status"].waitForExistence(timeout: 6))
    XCTAssertEqual(app.staticTexts["membership.detail.status"].label, "En attente")
}
@MainActor func verifyMembershipReview(in app: XCUIApplication) {
    let entry = app.buttons["membership.review.entry"]
    XCTAssertTrue(entry.waitForExistence(timeout: 6)); entry.tap()
    let club = app.buttons["membership.review.club.club-tennis"]
    XCTAssertTrue(club.waitForExistence(timeout: 6))
    print("SGM_MEMBERSHIP_CLUB_BEFORE_TAP enabled=\(club.isEnabled) hittable=\(club.isHittable) frame=\(club.frame)")
    club.tap()
    let approve = app.buttons["membership.approve.ui-parent_club-tennis"]
    let appeared = approve.waitForExistence(timeout: 6)
    if !appeared {
        print("SGM_MEMBERSHIP_REVIEW_MISSING_BEGIN")
        print(String(app.debugDescription.prefix(32_000)))
        print("SGM_MEMBERSHIP_REVIEW_MISSING_END")
    }
    XCTAssertTrue(appeared); approve.tap()
    XCTAssertTrue(app.alerts.buttons["Accepter"].waitForExistence(timeout: 6)); app.alerts.buttons["Accepter"].tap()
    let status = app.staticTexts["membership.review.status.ui-parent_club-tennis"]
    XCTAssertTrue(status.waitForExistence(timeout: 6))
    let accepted = NSPredicate(format: "label == %@", "Membre")
    XCTAssertTrue(expectationForMembership(accepted, object: status))
    XCTAssertFalse(approve.exists)
}
@MainActor private func expectationForMembership(_ predicate: NSPredicate, object: Any) -> Bool {
    XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: predicate, object: object)], timeout: 6) == .completed
}
