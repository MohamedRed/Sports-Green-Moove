import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {validateIosFixtureRecheck} from '../scripts/qa/ios-fixture-recheck.mjs';
import {iosAutomatedEvidenceIds} from '../scripts/qa/ios-fixture-release-evidence.mjs';
import {content} from '../partner-portal/content.mjs';
import {iosConnectSelector} from '../partner-portal/ios-connect-selector.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url));
const json = path => JSON.parse(read(path)), sha = value => createHash('sha256').update(value).digest('hex');
const folder = 'docs/release/evidence/ios-connect-selector-2026-11-07/';
test('the complete 05 failure remains ten passes and one added Connect assertion, never a timeout or accepted fix', () => {
  const report = json(iosConnectSelector.source); assert.equal(sha(read(iosConnectSelector.source)), iosConnectSelector.sha256);
  const gate = validateIosFixtureRecheck(process.cwd(), report.failedGate);
  assert.deepEqual([gate.passed, gate.failed, gate.assertionFailures], [10, 1, 1]);
  assert.equal(report.failedLine, 109); assert.equal(report.originalCases, 11); assert.equal(report.deadlineMinutes, 50);
  assert.equal(report.sdkBuild, 'success'); assert.equal(report.correctedSdkUiAccepted, false);
  assert.equal(report.runtimeCauseConfirmedByComparison, false); assert.equal(report.releaseComplete, false);
  for (const row of report.records) assert.equal(sha(read(folder + row.file)), row.sha256);
  for (const row of json(folder + 'source-sha256.json').files) assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
});
test('the real driver button has a stable command target without changing its action, title or role gate', () => {
  const app = 'ios/Sources/SportsGreenMooveApp/';
  const paths = json('docs/release/evidence/ios-fixture-recheck-05cd3f7-2026-11-07/source-sha256.json').files;
  const original = paths.find(row => row.path === app + 'PaymentsScreen.swift');
  const current = read(app + 'PaymentsScreen.swift').toString();
  assert.equal(current.replace(', testID: UITestIdentifier.paymentConnectAction', ''),
    read('docs/release/evidence/source-archive/' + original.sha256 + '.txt').toString());
  assert(current.includes('if appState.selectedRole == .driver'));
  assert(read(app + 'SGMComponents.swift').includes('Text(title.uppercased())'));
  assert(read(app + 'UITestIdentifiers.swift').includes('static let paymentConnectAction = "payments.connect.action"'));
  const ui = read('ios/UITests/SportsGreenMooveUITests/SportsGreenMooveUITests.swift').toString();
  assert(ui.includes('assertExists("payments.connect.action", in: app)'));
  assert(ui.includes('XCTAssertTrue(app.buttons["payments.connect.action"].isEnabled)'));
  assert(!ui.includes('app.buttons["Continuer l\'onboarding"]'));
});
test('the latest failed run changes only two pending iPhone records and retains all historical proofs', () => {
  const prefix = 'docs/release/evidence/ios-recheck-recording-05cd3f7-2026-11-07/';
  const before = json(prefix + 'manifest-before.json'), after = json(prefix + 'manifest-after.json');
  for (const key of Object.keys(before).filter(key => key !== 'automatedUserFlowEvidence')) assert.deepEqual(after[key], before[key]);
  for (const old of before.automatedUserFlowEvidence.items) {
    const row = after.automatedUserFlowEvidence.items.find(item => item.id === old.id);
    if (iosAutomatedEvidenceIds.includes(old.id)) {
      assert.equal(row.status, 'pending'); assert(row.fixtureGateRecheck.source.includes('ios-fixture-recheck-05cd3f7'));
      for (const ref of old.evidenceRefs) assert(row.evidenceRefs.includes(ref));
    } else assert.deepEqual(row, old);
  }
  assert.deepEqual(content.iosConnectSelector, iosConnectSelector);
  assert.equal(content.updates.filter(row => row.source === folder + 'README.md').length, 0);
});
