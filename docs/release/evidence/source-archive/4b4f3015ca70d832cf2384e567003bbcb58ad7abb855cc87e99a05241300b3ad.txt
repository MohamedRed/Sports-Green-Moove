import XCTest

@MainActor func verifyActiveRideChat(in app: XCUIApplication) {
    let entry = app.buttons["ride-chat.active-entry"]
    XCTAssertTrue(entry.waitForExistence(timeout: 6)); entry.tap()
    XCTAssertTrue(app.staticTexts["ride-chat.empty"].waitForExistence(timeout: 6))
    let editor = app.textViews["ride-chat.composer"], body = "Premier message de course isolé"
    XCTAssertTrue(editor.waitForExistence(timeout: 6)); editor.tap(); editor.typeText(body)
    XCTAssertEqual(editor.value as? String, body)
    let send = app.buttons["ride-chat.send"]
    XCTAssertTrue(send.isEnabled); send.tap()
    XCTAssertTrue(app.staticTexts[body].waitForExistence(timeout: 6))
    XCTAssertEqual(editor.value as? String, "")
    app.buttons["ride-chat.back"].tap(); XCTAssertTrue(entry.waitForExistence(timeout: 6)); entry.tap()
    XCTAssertTrue(app.staticTexts[body].waitForExistence(timeout: 6))
    XCTAssertTrue(editor.waitForExistence(timeout: 6)); XCTAssertEqual(editor.value as? String, "")
    app.buttons["ride-chat.back"].tap()
}

@MainActor func verifyRideChat(in app: XCUIApplication) {
    app.descendants(matching: .any)["messages.chat.tab"].tap()
    let create = app.buttons["ride-chat.new"]
    XCTAssertTrue(create.waitForExistence(timeout: 6)); create.tap()
    func openBooking() {
        let more = app.buttons["ride-chat.bookings.more"]
        XCTAssertTrue(more.waitForExistence(timeout: 6)); more.tap()
        let booking = app.buttons["ride-chat.booking.booking-1"]
        XCTAssertTrue(booking.waitForExistence(timeout: 6)); booking.tap()
    }
    openBooking()
    let editor = app.textViews["ride-chat.composer"], expected = "Message de trajet isolé"
    XCTAssertTrue(editor.waitForExistence(timeout: 6)); editor.tap(); editor.typeText(expected)
    XCTAssertEqual(editor.value as? String, expected)
    app.buttons["ride-chat.back"].tap(); openBooking()
    XCTAssertTrue(editor.waitForExistence(timeout: 6)); XCTAssertEqual(editor.value as? String, expected)
    let history = app.scrollViews["ride-chat.messages"]
    XCTAssertEqual(history.value as? String, "50 messages")
    let earlier = app.buttons["ride-chat.earlier"]
    XCTAssertTrue(earlier.isEnabled); earlier.tap()
    let complete = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", "51 messages"), object: history)
    XCTAssertEqual(XCTWaiter.wait(for: [complete], timeout: 6), .completed)
    let send = app.buttons["ride-chat.send"]
    let enabled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: send)
    XCTAssertEqual(XCTWaiter.wait(for: [enabled], timeout: 6), .completed); send.tap()
    XCTAssertTrue(app.staticTexts[expected].waitForExistence(timeout: 6))
    XCTAssertEqual(editor.value as? String, "")
    app.buttons["ride-chat.back"].tap(); app.buttons["ride-chat.back"].tap()
    XCTAssertTrue(create.waitForExistence(timeout: 6))
    let conversation = app.buttons["ride-chat.row.booking.booking-1"]
    XCTAssertTrue(conversation.waitForExistence(timeout: 6)); conversation.tap()
    XCTAssertTrue(app.staticTexts[expected].waitForExistence(timeout: 6))
    XCTAssertTrue(editor.waitForExistence(timeout: 6)); XCTAssertEqual(editor.value as? String, "")
    app.buttons["ride-chat.back"].tap()
}
