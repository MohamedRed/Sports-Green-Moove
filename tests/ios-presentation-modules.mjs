import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const folder = 'docs/release/evidence/ios-presentation-modules-2026-11-06/';
const read = path => readFileSync(new URL('../' + path, import.meta.url));
const json = path => JSON.parse(read(path)), sha = value => createHash('sha256').update(value).digest('hex');
test('presentation guards remain outside gateway DTOs and compile in the real native plan', () => {
  const report = json(folder + 'summary.json');
  for (const row of report.records) assert.equal(sha(read(folder + row.file)), row.sha256);
  for (const row of json(folder + 'source-sha256.json').files) {
    assert.equal(sha(read(row.path)), row.sha256);
    assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
  }
  assert.match(read(folder + 'signatures-before.txt').toString(), /cannot find type 'AccountAccess' in scope/);
  assert.match(read(folder + 'signatures-after.txt').toString(), /Owned callable signature checks passed/);
  assert.doesNotMatch(read('ios/Sources/SportsGreenMooveApp/ChildAccountModels.swift').toString(), /AccountAccess|ChildAccountPresentation/);
  assert(read('scripts/check-ios-native-plan.sh').toString().includes('ChildAccountPresentation.swift'));
  for (const key of ['signatureFailureReproduced', 'originalSignatureHarnessPreserved', 'signatureChecksPassed',
    'nativePlanPassed', 'presentationGuardBytesPreserved', 'sharedDtoAccountDependencyRemoved']) assert.equal(report[key], true);
  for (const key of ['sdkUiAccepted', 'physicalDeviceAccepted', 'releaseComplete']) assert.equal(report[key], false);
});
