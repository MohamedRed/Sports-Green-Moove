import XCTest

@MainActor func verifyTeamChat(in app: XCUIApplication) {
    app.descendants(matching: .any)["messages.chat.tab"].tap()
    XCTAssertTrue(app.buttons["team-chat.entry"].waitForExistence(timeout: 6)); app.buttons["team-chat.entry"].tap()
    func openChoice(_ id: String) {
        let more = app.buttons["team-chat.choices-more"]
        XCTAssertTrue(more.waitForExistence(timeout: 6)); more.tap()
        let choice = app.buttons["team-chat.choice.\(id)"]
        XCTAssertTrue(choice.waitForExistence(timeout: 6)); choice.tap()
    }
    openChoice("ui-club"); openChoice("ui-team")
    XCTAssertTrue(app.staticTexts["U12 Ottignies"].waitForExistence(timeout: 6))
    let editor = app.textViews["team-chat.composer"]
    XCTAssertTrue(editor.waitForExistence(timeout: 6)); editor.tap(); editor.typeText("Message de test isolé")
    app.buttons["team-chat.back"].tap()
    openChoice("ui-team")
    XCTAssertTrue(editor.waitForExistence(timeout: 6))
    XCTAssertEqual(editor.value as? String, "Message de test isolé")
    let earlier = app.buttons["team-chat.earlier"]
    XCTAssertTrue(earlier.waitForExistence(timeout: 6)); earlier.tap()
    XCTAssertTrue(app.staticTexts["Rendez-vous au club."].waitForExistence(timeout: 6))
    let send = app.buttons["team-chat.send"]
    XCTAssertTrue(send.isEnabled); send.tap()
    XCTAssertTrue(app.staticTexts["Message de test isolé"].waitForExistence(timeout: 6))
    XCTAssertEqual(editor.value as? String, "")
}
