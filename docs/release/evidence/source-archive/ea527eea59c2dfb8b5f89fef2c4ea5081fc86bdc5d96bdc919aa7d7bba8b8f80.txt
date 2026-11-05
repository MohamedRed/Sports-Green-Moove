import XCTest

final class ParentEmergencyContactFlowTests: XCTestCase {
    @MainActor func testParentChoosesVerifiedChildBeyondFirstPageAndSavesTheirContact() {
        let app = XCUIApplication()
        app.launchArguments = ["--sgm-ui-test-fixture", "--sgm-ui-route", "options"]
        app.launch()
        let entry = app.buttons["emergency.entry"]
        XCTAssertTrue(entry.waitForExistence(timeout: 6)); entry.tap()
        XCTAssertTrue(app.staticTexts["emergency.empty"].waitForExistence(timeout: 6))
        let input = app.textFields["emergency.name.input"]
        input.tap(); input.typeText("Brouillon personnel")
        let choose = app.buttons["emergency.choose-target"]
        XCTAssertTrue(choose.waitForExistence(timeout: 6)); choose.tap()
        let keepEditing = app.buttons["Continuer la modification"]
        XCTAssertTrue(keepEditing.waitForExistence(timeout: 6)); keepEditing.tap()
        XCTAssertEqual(input.value as? String, "Brouillon personnel")
        XCTAssertFalse(app.descendants(matching: .any)["emergency.targets"].exists)
        choose.tap(); app.buttons["Abandonner les modifications"].tap()
        let more = app.buttons["emergency.targets.more"]
        XCTAssertTrue(more.waitForExistence(timeout: 6))
        XCTAssertFalse(app.staticTexts["Ancien profil"].exists)
        more.tap()
        let child = app.buttons["emergency.target." + String(format: "%064x", 21)]
        XCTAssertTrue(child.waitForExistence(timeout: 6)); XCTAssertTrue(child.isEnabled); child.tap()
        XCTAssertTrue(app.staticTexts["emergency.empty"].waitForExistence(timeout: 6))
        XCTAssertEqual(app.staticTexts["emergency.subject.child"].label, "Nora")
        XCTAssertEqual(app.staticTexts["emergency.subject.club"].label, "Royal Ottignies Sports")
        app.textFields["emergency.name.input"].tap(); app.textFields["emergency.name.input"].typeText("Contact enfant fictif")
        app.textFields["emergency.phone.input"].tap(); app.textFields["emergency.phone.input"].typeText("+32470000002")
        app.scrollViews.firstMatch.swipeUp(); app.buttons["emergency.save"].tap()
        XCTAssertTrue(app.buttons["emergency.confirm"].waitForExistence(timeout: 6)); app.buttons["emergency.confirm"].tap()
        let saved = app.staticTexts["emergency.contact.name"]
        XCTAssertTrue(saved.waitForExistence(timeout: 6)); XCTAssertEqual(saved.label, "Contact enfant fictif")
        app.scrollViews.firstMatch.swipeDown(); app.buttons["emergency.choose-target"].tap()
        let personal = app.buttons["emergency.targets.personal"]
        XCTAssertTrue(personal.waitForExistence(timeout: 6))
        let available = NSPredicate(format: "enabled == true")
        expectation(for: available, evaluatedWith: personal)
        waitForExpectations(timeout: 6); personal.tap()
        XCTAssertTrue(app.staticTexts["emergency.empty"].waitForExistence(timeout: 6))
        XCTAssertFalse(app.staticTexts["emergency.contact.name"].exists)
        XCTAssertFalse(app.buttons["emergency.phone.open"].exists)
        app.buttons["emergency.choose-target"].tap()
        XCTAssertTrue(more.waitForExistence(timeout: 6)); more.tap()
        XCTAssertTrue(child.waitForExistence(timeout: 6)); child.tap()
        XCTAssertTrue(saved.waitForExistence(timeout: 6)); XCTAssertEqual(saved.label, "Contact enfant fictif")
        XCTAssertEqual(app.staticTexts["emergency.contact.phone"].label, "+32470000002")
        app.scrollViews.firstMatch.swipeUp(); app.buttons["emergency.remove"].tap()
        XCTAssertTrue(app.buttons["emergency.confirm"].waitForExistence(timeout: 6)); app.buttons["emergency.confirm"].tap()
        XCTAssertTrue(app.staticTexts["emergency.empty"].waitForExistence(timeout: 6))
        XCTAssertFalse(app.buttons["emergency.phone.open"].exists)
    }
}
