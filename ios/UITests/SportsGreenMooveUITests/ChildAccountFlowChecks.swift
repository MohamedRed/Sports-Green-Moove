import XCTest

@MainActor func checkChildCodeInExistingContactCase(_ app: XCUIApplication) {
    let entry = app.buttons["child-account.entry.child"]
    XCTAssertTrue(entry.waitForExistence(timeout: 6)); entry.tap()
    let create = app.buttons["child-account.create-code"]
    XCTAssertTrue(create.waitForExistence(timeout: 6)); XCTAssertFalse(app.buttons["child-account.approve"].exists)
    create.tap()
    let code = app.staticTexts["child-account.code"]
    XCTAssertTrue(code.waitForExistence(timeout: 6)); XCTAssertEqual(code.label, String(repeating: "c", count: 32))
    XCTAssertFalse(create.isEnabled)
    app.buttons["child-account.back"].tap()
    XCTAssertTrue(entry.waitForExistence(timeout: 6)); entry.tap()
    XCTAssertTrue(create.waitForExistence(timeout: 6)); XCTAssertFalse(code.exists)
    app.buttons["child-account.back"].tap()
}

@MainActor func checkParentInvitationInExistingContactCase(_ app: XCUIApplication) {
    app.scrollViews["emergency.screen"].swipeDown()
    let entry = app.buttons["child-account.entry.parent"]
    XCTAssertTrue(entry.waitForExistence(timeout: 6)); XCTAssertTrue(entry.isEnabled); entry.tap()
    let create = app.buttons["child-invitation.create"], share = app.buttons["child-invitation.share"]
    XCTAssertTrue(create.waitForExistence(timeout: 6))
    let enabled = NSPredicate(format: "enabled == true")
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: enabled, object: create)], timeout: 6), .completed)
    XCTAssertFalse(share.isEnabled); create.tap()
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: enabled, object: share)], timeout: 6), .completed)
    XCTAssertFalse(app.staticTexts["child-account.approved"].exists)
    app.buttons["child-invitation.refresh"].tap()
    let disabled = NSPredicate(format: "enabled == false")
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: disabled, object: share)], timeout: 6), .completed)
    let revoke = app.buttons["child-invitation.revoke"]
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: enabled, object: revoke)], timeout: 6), .completed); revoke.tap()
    XCTAssertTrue(app.staticTexts["Invitation révoquée"].waitForExistence(timeout: 6)); XCTAssertFalse(share.isEnabled)
    let input = app.textFields["child-account.input"]
    app.scrollViews["child-account.screen"].swipeUp()
    XCTAssertTrue(input.waitForExistence(timeout: 6)); input.tap(); input.typeText(String(repeating: "c", count: 32))
    app.scrollViews["child-account.screen"].swipeUp()
    let approve = app.buttons["child-account.approve"]
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: enabled, object: approve)], timeout: 6), .completed); approve.tap()
    XCTAssertTrue(app.staticTexts["child-account.approved"].waitForExistence(timeout: 6))
    app.scrollViews["child-account.screen"].swipeDown(); app.buttons["child-account.back"].tap()
}
