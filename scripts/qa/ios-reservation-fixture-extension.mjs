import assert from 'node:assert/strict';

export function withRewardNavigationChecks(source) {
  const marker = '        assertExists("rewards.withdraw.action", in: app)\n';
  assert.equal(source.split(marker).length, 2);
  return source.replace(marker, marker + `        tapIdentifier("rewards.withdraw.action", in: app)
        assertExists("payments.screen", in: app)
        XCTAssertTrue(app.buttons["Continuer l'onboarding"].waitForExistence(timeout: 6))

        app = launch(route: "rewards-parent")
        tapIdentifier("rewards.withdraw.action", in: app)
        XCTAssertTrue(app.alerts.staticTexts["Les versements nécessitent un profil conducteur validé."].waitForExistence(timeout: 6))
        app.alerts.buttons["OK"].tap()
        assertExists("rewards.screen", in: app)
        XCTAssertFalse(app.descendants(matching: .any)["payments.screen"].exists)
`);
}

export function withParentReservationChecks(source) {
  const marker = '        assertExists("booking.approve.action", in: app)\n';
  assert.equal(source.split(marker).length, 2);
  return source.replace(marker, marker + '        app = launch(route: "home")\n        verifyParentReservations(in: app)\n');
}

export function withPaymentConnectIdentifier(source) {
  const original = '        XCTAssertTrue(app.buttons["Continuer l\'onboarding"].waitForExistence(timeout: 6))\n';
  assert.equal(source.split(original).length, 2);
  return source.replace(original, '        assertExists("payments.connect.action", in: app)\n' +
    '        XCTAssertTrue(app.buttons["payments.connect.action"].isEnabled)\n');
}
