import XCTest

final class SearchConsentFlowTests: XCTestCase {
    @MainActor func testExplicitConsentAndChildChangeInvalidateResults() {
        let app = launchSearch()
        let consent = app.buttons["search.consent"]
        XCTAssertTrue(consent.waitForExistence(timeout: 6))
        XCTAssertEqual(consent.value as? String, "Non accordé")
        XCTAssertFalse(app.buttons["booking.request.action"].exists)
        app.buttons["search.action"].tap()
        let alert = app.alerts.firstMatch
        XCTAssertTrue(alert.waitForExistence(timeout: 6))
        XCTAssertTrue(alert.staticTexts["Votre consentement est nécessaire pour activer le suivi enfant."].exists)
        alert.buttons["OK"].tap()
        consent.tap()
        XCTAssertEqual(consent.value as? String, "Accordé")
        app.buttons["search.action"].tap()
        XCTAssertTrue(app.buttons["booking.request.action"].waitForExistence(timeout: 6))
        app.buttons["search.child.child-2"].tap()
        XCTAssertEqual(consent.value as? String, "Non accordé")
        XCTAssertFalse(app.buttons["booking.request.action"].exists)
    }

    @MainActor func testTrackingAndSeatChangesInvalidateTheAcceptedSelection() {
        let app = launchSearch()
        let consent = app.buttons["search.consent"]
        XCTAssertTrue(consent.waitForExistence(timeout: 6))
        consent.tap()
        app.buttons["search.action"].tap()
        XCTAssertTrue(app.buttons["booking.request.action"].waitForExistence(timeout: 6))
        app.buttons["search.child-tracking"].tap()
        XCTAssertEqual(consent.value as? String, "Non accordé")
        XCTAssertFalse(app.buttons["booking.request.action"].exists)
        consent.tap()
        app.buttons["search.action"].tap()
        XCTAssertTrue(app.buttons["booking.request.action"].waitForExistence(timeout: 6))
        app.buttons["search.seats.2"].tap()
        XCTAssertFalse(app.buttons["booking.request.action"].exists)
        XCTAssertEqual(consent.value as? String, "Accordé")
        verifyOwnedChildBooking(in: app)
    }

    @MainActor private func launchSearch() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--sgm-ui-test-fixture", "--sgm-ui-route", "search"]
        app.launch()
        return app
    }
}
