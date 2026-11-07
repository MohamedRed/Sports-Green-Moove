import XCTest

@MainActor func verifyOwnedChildBooking(in app: XCUIApplication) {
    let secondChild = app.buttons["search.child.child-2"], consent = app.buttons["search.consent"]
    XCTAssertTrue(secondChild.waitForExistence(timeout: 6)); secondChild.tap()
    XCTAssertEqual(consent.value as? String, "Non accordé")
    consent.tap(); XCTAssertEqual(consent.value as? String, "Accordé")
    app.buttons["search.action"].tap()
    let booking = app.buttons["booking.request.action"]
    XCTAssertTrue(booking.waitForExistence(timeout: 6))
    let search = app.scrollViews["search.screen"], navigation = app.otherElements["navigation.bar"]
    XCTAssertTrue(search.waitForExistence(timeout: 6)); XCTAssertTrue(navigation.waitForExistence(timeout: 6))
    for _ in 0..<3 {
        if booking.isHittable && search.frame.contains(booking.frame) && booking.frame.maxY <= navigation.frame.minY { break }
        search.swipeUp()
    }
    XCTAssertTrue(booking.isEnabled); XCTAssertTrue(booking.isHittable)
    XCTAssertTrue(search.frame.contains(booking.frame))
    XCTAssertLessThanOrEqual(booking.frame.maxY, navigation.frame.minY)
    print("SGM_OWNED_BOOKING_FRAMES action=\(booking.frame) navigation=\(navigation.frame)")
    booking.tap()
    XCTAssertFalse(app.scrollViews["messages.screen"].exists)
    let alert = app.alerts.firstMatch
    let appeared = alert.waitForExistence(timeout: 6)
    if !appeared {
        print("SGM_OWNED_BOOKING_ACCESSIBILITY_BEGIN")
        print(app.debugDescription.prefix(32_000))
        print("SGM_OWNED_BOOKING_ACCESSIBILITY_END")
    }
    XCTAssertTrue(appeared)
    XCTAssertTrue(alert.staticTexts["Demande envoyée: booking-child-2-2"].exists)
    alert.buttons["OK"].tap()
}
