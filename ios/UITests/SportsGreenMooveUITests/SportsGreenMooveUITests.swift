import XCTest

final class SportsGreenMooveUITests: XCTestCase {
    func testAuthFlowIdentifiers() {
        let app = launch(route: "auth")
        assertExists("auth.screen", in: app)
        assertExists("auth.email.action", in: app)
        assertExists("auth.facebook.action", in: app)
        assertExists("auth.google.action", in: app)
    }

    func testPublishSearchAndBookingIdentifiers() {
        var app = launch(route: "publish")
        assertExists("publish.screen", in: app)
        assertExists("publish.next.action", in: app)

        app = launch(route: "search")
        assertExists("search.screen", in: app)
        assertExists("search.action", in: app)
        assertExists("booking.request.action", in: app)

        app = launch(route: "booking")
        tapButton(containing: "EN ATTENTE", in: app)
        assertExists("booking.approve.action", in: app)
    }

    func testActiveRideIdentifiers() {
        let app = launch(route: "ride")
        assertExists("active-ride.screen", in: app)
        assertExists("active-ride.pickup.action", in: app)
        assertExists("active-ride.dropoff.action", in: app)
        assertExists("active-ride.end.action", in: app)
        assertExists("active-ride.emergency-contact", in: app)
    }

    func testMessagesChatAndRatingIdentifiers() {
        let app = launch(route: "messages")
        assertExists("messages.screen", in: app)
        assertExists("messages.chat.tab", in: app)
        assertExists("messages.rating.tab", in: app)
        app.descendants(matching: .any)["messages.rating.tab"].tap()
        assertExists("messages.rating-prompt.action", in: app)
        assertExists("messages.rating-prompt.action.5", in: app)
    }

    func testSecondaryFlowIdentifiers() {
        var app = launch(route: "groups")
        assertExists("groups.screen", in: app)
        assertExists("groups.join.action", in: app)

        app = launch(route: "impact")
        assertExists("impact.screen", in: app)

        app = launch(route: "rewards")
        assertExists("rewards.screen", in: app)
        assertExists("rewards.withdraw.action", in: app)

        app = launch(route: "options")
        assertExists("options.screen", in: app)
        assertExists("options.support-report.action", in: app)

        app = launch(route: "payments")
        assertExists("payments.screen", in: app)
        assertExists("payments.payment.action", in: app)
    }

    private func launch(route: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--sgm-ui-test-fixture", "--sgm-ui-route", route]
        app.launch()
        return app
    }

    private func assertExists(_ identifier: String, in app: XCUIApplication) {
        let element = app.descendants(matching: .any)[identifier]
        XCTAssertTrue(element.waitForExistence(timeout: 6), "Missing UI identifier: \(identifier)")
    }

    private func tapButton(containing text: String, in app: XCUIApplication) {
        let button = app.buttons.containing(.staticText, identifier: text).firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 6), "Missing button containing: \(text)")
        button.tap()
    }
}
