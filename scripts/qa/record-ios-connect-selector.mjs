import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {validateIosFixtureRecheck} from './ios-fixture-recheck.mjs';

const root = resolve(import.meta.dirname, '../..'), evidence = resolve(root, 'docs/release/evidence');
const folder = 'ios-connect-selector-2026-11-07', output = resolve(evidence, folder);
const read = path => readFileSync(resolve(root, path)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const prior = 'docs/release/evidence/ios-fixture-recheck-05cd3f7-2026-11-07/';
const reference = {source: prior + 'summary.json', sha256: sha(read(prior + 'summary.json'))};
const result = validateIosFixtureRecheck(root, reference);
assert.equal(result.passed, 10); assert.equal(result.failed, 1); assert.equal(result.assertionFailures, 1);
const files = JSON.parse(read(prior + 'source-sha256.json')).files;
const original = path => {const row = files.find(row => row.path === path); assert(row); return read('docs/release/evidence/source-archive/' + row.sha256 + '.txt').toString();};
const app = 'ios/Sources/SportsGreenMooveApp/', test = 'ios/UITests/SportsGreenMooveUITests/SportsGreenMooveUITests.swift';
const label = "Continuer l'onboarding", identifier = 'payments.connect.action';
assert(original(test).includes('app.buttons["' + label + '"].waitForExistence(timeout: 6)'));
assert(original(app + 'SGMComponents.swift').includes('Text(title.uppercased())'));
assert.notEqual(label, label.toUpperCase());
assert.equal(read(app + 'SGMComponents.swift').toString(), original(app + 'SGMComponents.swift'));
const control = read(app + 'PaymentsScreen.swift').toString();
assert.equal(control.replace(', testID: UITestIdentifier.paymentConnectAction', ''), original(app + 'PaymentsScreen.swift'));
assert(read(test).includes('assertExists("' + identifier + '", in: app)'));
assert(read(test).includes('XCTAssertTrue(app.buttons["' + identifier + '"].isEnabled)'));
assert(read(app + 'UITestIdentifiers.swift').includes('static let paymentConnectAction = "' + identifier + '"'));
assert(!existsSync(output)); mkdirSync(output);
const sources = [];
for (const path of [app + 'PaymentsScreen.swift', app + 'UITestIdentifiers.swift', test, 'scripts/qa/ios-reservation-fixture-extension.mjs']) {
  const bytes = read(path), hash = sha(bytes), archive = resolve(evidence, 'source-archive', hash + '.txt');
  if (!existsSync(archive)) writeFileSync(archive, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(archive)), hash); sources.push({path, commit: 'candidate', sha256: hash});
}
const sourceBytes = JSON.stringify({files: sources}, null, 2) + '\n';
writeFileSync(resolve(output, 'source-sha256.json'), sourceBytes, {flag: 'wx'});
const summary = {checkedAt: '2026-11-07', failedGate: reference, sdkBuild: 'success', passedCases: 10, failedCases: 1,
  assertionFailures: 1, failedCase: 'testSecondaryFlowIdentifiers', failedLine: 109,
  failedLabel: label, renderedTextTransform: 'title.uppercased()', stableIdentifier: identifier,
  originalActionAndTextPreserved: true, originalCases: 11, deadlineMinutes: 50, newCaptures: 0,
  correctedSdkUiAccepted: false, runtimeCauseConfirmedByComparison: false, physicalDeviceAccepted: false, releaseComplete: false,
  records: [{file: 'source-sha256.json', sha256: sha(sourceBytes)}]};
const bytes = JSON.stringify(summary, null, 2) + '\n'; writeFileSync(resolve(output, 'summary.json'), bytes, {flag: 'wx'});
console.log(JSON.stringify({source: 'docs/release/evidence/' + folder + '/summary.json', sha256: sha(bytes)}));
