import XCTest

@MainActor func verifyParentReservations(in app: XCUIApplication) {
    let trips = app.buttons["Trajets"]
    XCTAssertTrue(trips.waitForExistence(timeout: 6)); trips.tap()
    XCTAssertTrue(app.descendants(matching: .any)["reservations.screen"].waitForExistence(timeout: 6))
    let more = app.buttons["reservations.more"]
    XCTAssertTrue(more.waitForExistence(timeout: 6)); more.tap()
    let cancel = app.buttons["reservations.cancel.parent-reservation"]
    XCTAssertTrue(cancel.waitForExistence(timeout: 6)); XCTAssertTrue(cancel.isEnabled)
    cancel.tap()
    let keep = app.buttons["Conserver"]
    XCTAssertTrue(keep.waitForExistence(timeout: 6)); keep.tap()
    XCTAssertTrue(cancel.waitForExistence(timeout: 6)); cancel.tap()
    let confirm = app.buttons["reservations.cancel.confirm"]
    XCTAssertTrue(confirm.waitForExistence(timeout: 6)); confirm.tap()
    XCTAssertTrue(app.staticTexts["reservations.confirmed"].waitForExistence(timeout: 6))
    XCTAssertFalse(cancel.exists)
    app.buttons["reservations.resolve"].tap()
    XCTAssertTrue(more.waitForExistence(timeout: 6)); more.tap()
    let history = app.buttons["Historique"]
    XCTAssertTrue(history.waitForExistence(timeout: 6)); history.tap()
    XCTAssertTrue(app.staticTexts["Annulée"].waitForExistence(timeout: 6))
    XCTAssertFalse(cancel.exists)
}
