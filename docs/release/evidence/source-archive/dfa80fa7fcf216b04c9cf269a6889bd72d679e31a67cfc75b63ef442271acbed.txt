import XCTest

@MainActor func verifyOwnedChildBooking(in app: XCUIApplication) {
    let secondChild = app.buttons["search.child.child-2"], consent = app.buttons["search.consent"]
    XCTAssertTrue(secondChild.waitForExistence(timeout: 6)); secondChild.tap()
    XCTAssertEqual(consent.value as? String, "Non accordé")
    consent.tap(); XCTAssertEqual(consent.value as? String, "Accordé")
    app.buttons["search.action"].tap()
    let booking = app.buttons["booking.request.action"]
    XCTAssertTrue(booking.waitForExistence(timeout: 6)); booking.tap()
    let alert = app.alerts.firstMatch
    XCTAssertTrue(alert.waitForExistence(timeout: 6))
    XCTAssertTrue(alert.staticTexts["Demande envoyée: booking-child-2-2"].exists)
    alert.buttons["OK"].tap()
}
