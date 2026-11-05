import XCTest

final class SportsGreenMooveUITests: XCTestCase {
    @MainActor func testAuthFlowIdentifiers() {
        let app = launch(route: "auth")
        assertExists("auth.screen", in: app)
        assertExists("auth.email.action", in: app)
        assertExists("auth.facebook.action", in: app)
        assertExists("auth.google.action", in: app)
        let email = app.textFields["auth.email.field"]
        XCTAssertTrue(email.waitForExistence(timeout: 6))
        email.tap(); email.typeText("parent@example.be")
        let password = app.secureTextFields["auth.password.field"]
        XCTAssertTrue(password.waitForExistence(timeout: 6))
        password.tap(); password.typeText("fixture-only\n")
        app.scrollViews.firstMatch.swipeUp()
        app.buttons["auth.email.action"].tap()
        assertExists("home.screen", in: app)
        captureApproved(.home, in: app)
        app.buttons["Profil"].tap()
        assertExists("profile.screen", in: app)
        XCTAssertEqual(app.staticTexts["profile.name"].label, "Parent Démo")
        XCTAssertTrue(app.buttons["profile.role.parent"].exists)
        XCTAssertTrue(app.buttons["profile.role.driver"].exists)
        XCTAssertFalse(app.buttons["profile.role.child"].exists)
        XCTAssertFalse(app.buttons["profile.role.clubManager"].exists)
        let received = app.staticTexts["profile.rating.count"]
        XCTAssertTrue(received.waitForExistence(timeout: 6))
        XCTAssertEqual(received.label, "2 avis reçus")
        XCTAssertTrue(app.descendants(matching: .any)["profile.rating.average"].exists)
        let refreshRatings = app.buttons["profile.rating.refresh"]
        XCTAssertTrue(refreshRatings.isEnabled); refreshRatings.tap()
        XCTAssertTrue(received.waitForExistence(timeout: 6))
        XCTAssertEqual(received.label, "2 avis reçus")
        captureApproved(.profile, in: app)
        verifyProfileCity(in: app)
    }

    @MainActor func testPublishSearchAndBookingIdentifiers() {
        var app = launch(route: "publish")
        assertExists("publish.screen", in: app)
        assertExists("publish.next.action", in: app)
        tapIdentifier("publish.next.action", in: app)
        tapIdentifier("publish.next.action", in: app)
        assertExists("publish.submit.action", in: app)

        app = launch(route: "search")
        assertExists("search.screen", in: app)
        assertExists("search.action", in: app)
        tapIdentifier("search.consent", in: app)
        tapIdentifier("search.action", in: app)
        assertExists("booking.request.action", in: app)

        app = launch(route: "booking")
        tapButton(containing: "EN ATTENTE", in: app)
        assertExists("booking.approve.action", in: app)
    }

    @MainActor func testActiveRideIdentifiers() {
        let app = launch(route: "ride")
        assertExists("active-ride.screen", in: app)
        assertExists("active-ride.pickup.action", in: app)
        assertExists("active-ride.dropoff.action", in: app)
        assertExists("active-ride.end.action", in: app)
        assertExists("active-ride.emergency-contact", in: app)
    }

    @MainActor func testMessagesChatAndRatingIdentifiers() {
        let app = launch(route: "messages")
        assertExists("messages.screen", in: app)
        assertExists("messages.chat.tab", in: app)
        assertExists("messages.rating.tab", in: app)
        app.descendants(matching: .any)["messages.rating.tab"].tap()
        assertExists("messages.rating-prompt.action", in: app)
        assertExists("messages.rating-prompt.action.5", in: app)
        let rating = app.buttons["messages.rating-prompt.action.5"]
        XCTAssertEqual(rating.label, "Noter 5 étoiles")
        XCTAssertTrue(rating.isEnabled)
        rating.tap()
        XCTAssertTrue(app.staticTexts["Avis envoyé."].waitForExistence(timeout: 6))
        XCTAssertFalse(app.descendants(matching: .any)["messages.rating-prompt.action"].exists)
        let refresh = app.buttons["messages.refresh"]
        XCTAssertTrue(refresh.isEnabled)
        refresh.tap()
        XCTAssertTrue(app.staticTexts["Aucun avis en attente."].waitForExistence(timeout: 6))
        XCTAssertFalse(app.descendants(matching: .any)["messages.rating-prompt.action"].exists)
        captureApproved(.rating, in: app)
        verifyTeamChat(in: app)
    }

    @MainActor func testSecondaryFlowIdentifiers() {
        var app = launch(route: "groups")
        assertExists("groups.screen", in: app)
        assertExists("groups.join.action", in: app)
        verifyClubRequest(in: app)
        app = launch(route: "groups-review")
        verifyMembershipReview(in: app)

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

    @MainActor private func launch(route: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--sgm-ui-test-fixture", "--sgm-ui-route", route]
        app.launch()
        return app
    }

    @MainActor private func assertExists(_ identifier: String, in app: XCUIApplication) {
        let element = app.descendants(matching: .any)[identifier]
        let exists = element.waitForExistence(timeout: 6)
        if !exists {
            print("SGM_FIXTURE_ACCESSIBILITY_BEGIN \(identifier)")
            print(String(app.debugDescription.prefix(32_000)))
            print("SGM_FIXTURE_ACCESSIBILITY_END")
        }
        XCTAssertTrue(exists, "Missing UI identifier: \(identifier)")
    }

    @MainActor private func tapButton(containing text: String, in app: XCUIApplication) {
        let button = app.buttons.containing(.staticText, identifier: text).firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 6), "Missing button containing: \(text)")
        button.tap()
    }

    @MainActor private func tapIdentifier(_ identifier: String, in app: XCUIApplication) {
        let element = app.descendants(matching: .any)[identifier]
        XCTAssertTrue(element.waitForExistence(timeout: 6), "Missing tappable identifier: \(identifier)")
        element.tap()
    }
}
