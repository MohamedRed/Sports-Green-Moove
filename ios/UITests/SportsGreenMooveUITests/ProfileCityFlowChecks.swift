import XCTest

@MainActor func verifyProfileCity(in app: XCUIApplication) {
    app.scrollViews.firstMatch.swipeUp()
    let row = app.buttons["profile.city"]
    guard row.waitForExistence(timeout: 6) else { XCTFail("Missing profile city entry"); return }
    XCTAssertTrue(waitForCityValue("Non renseignée", object: row))
    row.tap()
    let input = app.textFields["city.input"]
    guard input.waitForExistence(timeout: 6) else { XCTFail("Missing city editor"); return }
    input.tap(); input.typeText("Wavre")
    let save = app.buttons["city.save"]
    XCTAssertTrue(save.isEnabled); save.tap()
    let notice = app.staticTexts["city.notice"]
    XCTAssertTrue(notice.waitForExistence(timeout: 6)); XCTAssertEqual(notice.label, "Ville enregistrée.")
    app.buttons["city.back"].tap()
    XCTAssertTrue(waitForCityValue("Wavre", object: row))
    row.tap()
    XCTAssertTrue(input.waitForExistence(timeout: 6)); XCTAssertEqual(input.value as? String, "Wavre")
    app.buttons["city.remove"].tap()
    XCTAssertTrue(waitForCityLabel("Ville supprimée.", object: notice))
    app.buttons["city.back"].tap()
    XCTAssertTrue(waitForCityValue("Non renseignée", object: row))
}
@MainActor private func waitForCityValue(_ value: String, object: XCUIElement) -> Bool {
    XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", value), object: object)], timeout: 6) == .completed
}
@MainActor private func waitForCityLabel(_ label: String, object: XCUIElement) -> Bool {
    XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == %@", label), object: object)], timeout: 6) == .completed
}
