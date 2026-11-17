import XCTest

final class EmergencyContactFlowTests: XCTestCase {
    @MainActor func testChildContactOpensFromHomeWithoutTrackingOrEditing() {
        let app = XCUIApplication()
        app.launchArguments = ["--sgm-ui-test-fixture", "--sgm-ui-route", "child-contact"]
        app.launch()
        let entry = app.buttons["emergency.entry"]
        XCTAssertTrue(entry.waitForExistence(timeout: 6)); entry.tap()
        XCTAssertTrue(app.staticTexts["emergency.contact.name"].waitForExistence(timeout: 6))
        XCTAssertEqual(app.staticTexts["emergency.contact.name"].label, "Contact fictif")
        XCTAssertFalse(app.textFields["emergency.name.input"].exists)
        XCTAssertFalse(app.textFields["emergency.phone.input"].exists)
        XCTAssertFalse(app.buttons["emergency.save"].exists)
        XCTAssertFalse(app.buttons["emergency.remove"].exists)
        XCTAssertTrue(app.buttons["emergency.phone.open"].isEnabled)
        XCTAssertEqual(app.alerts.count, 0)
    }
    @MainActor func testPersonalContactRequiresReviewAndPersistsItsRemoval() {
        let app = XCUIApplication()
        app.launchArguments = ["--sgm-ui-test-fixture", "--sgm-ui-route", "options"]
        app.launch()
        let entry = app.buttons["emergency.entry"]
        XCTAssertTrue(entry.waitForExistence(timeout: 6)); entry.tap()
        XCTAssertTrue(app.staticTexts["emergency.empty"].waitForExistence(timeout: 6))
        XCTAssertFalse(app.buttons["emergency.phone.open"].exists)
        app.textFields["emergency.name.input"].tap()
        app.textFields["emergency.name.input"].typeText("Contact fictif")
        app.textFields["emergency.phone.input"].tap()
        app.textFields["emergency.phone.input"].typeText("+32470000001")
        app.scrollViews.firstMatch.swipeUp()
        let save = app.buttons["emergency.save"]
        XCTAssertTrue(save.isEnabled); save.tap()
        XCTAssertTrue(app.buttons["emergency.confirm"].waitForExistence(timeout: 6))
        app.buttons["emergency.cancel"].tap()
        XCTAssertFalse(app.staticTexts["emergency.contact.name"].exists)
        save.tap(); app.buttons["emergency.confirm"].tap()
        let name = app.staticTexts["emergency.contact.name"]
        XCTAssertTrue(name.waitForExistence(timeout: 6)); XCTAssertEqual(name.label, "Contact fictif")
        XCTAssertEqual(app.staticTexts["emergency.contact.phone"].label, "+32470000001")
        XCTAssertTrue(app.buttons["emergency.phone.open"].isEnabled)
        app.scrollViews.firstMatch.swipeDown()
        app.buttons["emergency.back"].tap(); entry.tap()
        XCTAssertTrue(name.waitForExistence(timeout: 6))
        app.scrollViews.firstMatch.swipeUp()
        app.buttons["emergency.remove"].tap(); app.buttons["emergency.confirm"].tap()
        XCTAssertTrue(app.staticTexts["emergency.empty"].waitForExistence(timeout: 6))
        XCTAssertFalse(app.buttons["emergency.phone.open"].exists)
        app.scrollViews.firstMatch.swipeDown()
        app.buttons["emergency.back"].tap(); entry.tap()
        XCTAssertTrue(app.staticTexts["emergency.empty"].waitForExistence(timeout: 6))
        XCTAssertFalse(app.buttons["emergency.phone.open"].exists)
    }
}
