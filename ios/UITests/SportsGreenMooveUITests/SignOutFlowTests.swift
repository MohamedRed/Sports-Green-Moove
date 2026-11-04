import XCTest

final class SignOutFlowTests: XCTestCase {
    @MainActor func testProfileSignsOutToEmptyAuthentication() {
        let app = XCUIApplication()
        app.launchArguments = ["--sgm-ui-test-fixture", "--sgm-ui-route", "auth"]
        app.launch()
        let originalEmail = app.textFields["auth.email.field"]
        XCTAssertTrue(originalEmail.waitForExistence(timeout: 6))
        originalEmail.tap(); originalEmail.typeText("parent@example.be")
        let originalPassword = app.secureTextFields["auth.password.field"]
        XCTAssertTrue(originalPassword.waitForExistence(timeout: 6))
        originalPassword.tap(); originalPassword.typeText("fixture-only\n")
        app.scrollViews.firstMatch.swipeUp()
        app.buttons["auth.email.action"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["home.screen"].waitForExistence(timeout: 6))
        app.buttons["Profil"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["profile.screen"].waitForExistence(timeout: 6))
        XCTAssertEqual(app.staticTexts["profile.name"].label, "Parent Démo")
        app.scrollViews.firstMatch.swipeUp()
        let signOut = app.buttons["profile.sign-out.action"]
        XCTAssertTrue(signOut.waitForExistence(timeout: 6))
        XCTAssertTrue(signOut.isHittable)
        signOut.tap()
        XCTAssertTrue(app.descendants(matching: .any)["auth.screen"].waitForExistence(timeout: 6))
        XCTAssertFalse(app.descendants(matching: .any)["profile.screen"].exists)
        XCTAssertFalse(app.staticTexts["profile.name"].exists)
        XCTAssertFalse(app.descendants(matching: .any)["active-ride.screen"].exists)
        let email = app.textFields["auth.email.field"]
        XCTAssertTrue(email.waitForExistence(timeout: 6))
        let emailValue = email.value as? String ?? ""
        XCTAssertTrue(emailValue.isEmpty || emailValue == "votre@email.be")
        let password = app.secureTextFields["auth.password.field"]
        XCTAssertTrue(password.waitForExistence(timeout: 6))
        let passwordValue = password.value as? String ?? ""
        XCTAssertTrue(passwordValue.isEmpty || passwordValue == "Mot de passe")
        XCTAssertTrue(app.buttons["auth.email.action"].isEnabled)
    }
}
