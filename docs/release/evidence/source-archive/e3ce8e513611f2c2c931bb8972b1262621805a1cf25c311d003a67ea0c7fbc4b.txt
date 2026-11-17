import XCTest

@MainActor func verifyParentReservations(in app: XCUIApplication) {
    let trips = app.buttons["Trajets"]
    XCTAssertTrue(trips.waitForExistence(timeout: 6)); trips.tap()
    XCTAssertTrue(app.descendants(matching: .any)["reservations.screen"].waitForExistence(timeout: 6))
    let more = app.buttons["reservations.more"]
    XCTAssertTrue(more.waitForExistence(timeout: 6))
    XCTAssertFalse(app.staticTexts["Aucune réservation."].exists)
    more.tap()
    let cancel = app.buttons["reservations.cancel.parent-reservation"]
    XCTAssertTrue(cancel.waitForExistence(timeout: 6)); XCTAssertTrue(cancel.isEnabled)
    cancel.tap()
    let confirmation = app.alerts["Annuler cette réservation ?"]
    XCTAssertTrue(confirmation.waitForExistence(timeout: 6))
    confirmation.buttons["Conserver"].tap()
    XCTAssertTrue(confirmation.waitForNonExistence(timeout: 6))
    XCTAssertFalse(app.staticTexts["reservations.confirmed"].exists)
    XCTAssertTrue(cancel.isEnabled)
    cancel.tap()
    XCTAssertTrue(confirmation.waitForExistence(timeout: 6))
    let confirm = confirmation.buttons["Confirmer l’annulation"]
    XCTAssertTrue(confirm.isEnabled)
    confirm.tap()
    XCTAssertTrue(app.staticTexts["reservations.confirmed"].waitForExistence(timeout: 6))
    XCTAssertFalse(cancel.exists)
    app.buttons["reservations.resolve"].tap()
    XCTAssertTrue(more.waitForExistence(timeout: 6)); more.tap()
    let history = app.buttons["Historique"]
    XCTAssertTrue(history.waitForExistence(timeout: 6)); history.tap()
    XCTAssertTrue(app.staticTexts["Annulée"].waitForExistence(timeout: 6))
    XCTAssertFalse(cancel.exists)
}
