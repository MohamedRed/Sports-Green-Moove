import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {validateIosFixtureRecheck} from '../scripts/qa/ios-fixture-recheck.mjs';
import {iosAutomatedEvidenceIds} from '../scripts/qa/ios-fixture-release-evidence.mjs';
import {content} from '../partner-portal/content.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';
import {iosChildPresentation, iosChildPresentationProgress} from '../partner-portal/ios-child-presentation.mjs';

const root = process.cwd(), folder = 'docs/release/evidence/ios-child-presentation-2026-11-06/';
const read = path => readFileSync(new URL('../' + path, import.meta.url));
const json = path => JSON.parse(read(path)), sha = value => createHash('sha256').update(value).digest('hex');

test('the complete recheck compiles then executes ten passing iPhone cases and one parent invitation failure', () => {
  const source = 'docs/release/evidence/ios-fixture-recheck-cc1e6d7-2026-11-06/summary.json';
  const result = validateIosFixtureRecheck(root, {source, sha256: sha(read(source))});
  assert.deepEqual([result.passed, result.failed, result.assertionFailures], [10, 1, 3]);
  const report = json(folder + 'summary.json');
  for (const row of report.records) assert.equal(sha(read(folder + row.file)), row.sha256);
  assert.equal(report.sdkBuild, 'success'); assert.equal(report.childCodeCasePassed, true);
  assert.equal(report.parentInvitationCasePassed, false); assert.equal(report.deadlineMinutes, 50);
  assert.equal(report.correctedSdkUiAccepted, false); assert.equal(report.presentationCauseConfirmedByUiComparison, false);
  assert.equal(report.physicalDeviceAccepted, false); assert.equal(report.releaseComplete, false);
  const snapshot = read(folder + 'selected-accessibility.txt').toString();
  assert(snapshot.includes("Button, identifier: 'child-account.back'"));
  assert(snapshot.includes("Button, identifier: 'child-account.entry.parent'"));
  assert(snapshot.includes('No matches found'));
});

test('the presentation transports an immutable target in one sheet item, not independent target/open states', () => {
  const host = read('ios/Sources/SportsGreenMooveApp/GuardianContactPicker.swift').toString();
  assert(host.includes('@State private var accountPresentation: ChildAccountPresentation?'));
  assert(host.includes('accountPresentation = try ChildAccountPresentation(access: access, view: view)'));
  assert(host.includes('.sheet(item: $accountPresentation) { presentation in'));
  assert(host.includes('target: presentation.target')); assert(host.includes('.id(presentation.id)'));
  assert.doesNotMatch(host, /managingAccount|childTarget/);
  const model = read('ios/Sources/SportsGreenMooveApp/ChildAccountPresentation.swift').toString();
  for (const text of ['case parent(UUID, ChildAccountTarget)', 'view.ownerUid == access.context.uid',
    'access.context.grantedRoles == [.child]', 'self = .parent(UUID(), try ChildAccountTarget(view: view))']) assert(model.includes(text));
  assert.match(read(folder + 'native-checks.txt').toString(), /ChildAccountPresentationChecks passed:/);
  const sources = json(folder + 'source-sha256.json').files;
  for (const row of sources) {
    assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
    if (row.commit === 'candidate') {
      if (row.path.endsWith('/ChildAccountModels.swift')) {
        const original = read('docs/release/evidence/source-archive/' + row.sha256 + '.txt').toString();
        const presentation = model.replace('import Foundation\n\n', '');
        assert(original.includes(presentation));
        assert.equal(read(row.path).toString(), original.replace(presentation + '\n', ''));
      } else assert.equal(sha(read(row.path)), row.sha256);
    }
  }
});

test('the new failed attempt changes only the two pending iPhone records and preserves every old proof', () => {
  const prefix = 'docs/release/evidence/ios-recheck-recording-cc1e6d7-2026-11-06/';
  const before = json(prefix + 'manifest-before.json'), after = json(prefix + 'manifest-after.json');
  for (const key of Object.keys(before).filter(key => key !== 'automatedUserFlowEvidence')) assert.deepEqual(after[key], before[key]);
  for (const old of before.automatedUserFlowEvidence.items) {
    const row = after.automatedUserFlowEvidence.items.find(row => row.id === old.id);
    if (!iosAutomatedEvidenceIds.includes(old.id)) assert.deepEqual(row, old);
    else {
      assert.equal(row.status, 'pending');
      for (const ref of old.evidenceRefs) assert(row.evidenceRefs.includes(ref));
      assert(row.fixtureGateRecheck.source.includes('ios-fixture-recheck-cc1e6d7'));
    }
  }
});

test('the portal preserves the historical child pass and parent failure after the corrected gate', () => {
  assert.deepEqual(content.iosChildPresentation, iosChildPresentation);
  assert.equal(sha(read(iosChildPresentation.source)), iosChildPresentation.sha256);
  const {recent, previous} = partitionUpdates(content.updates);
  assert(previous.some(row => row.source === iosChildPresentationProgress.source));
  assert(recent.some(row => row.source.includes('ios-fixture-gate-d3c0f7a')));
  assert(previous.some(row => row.source.includes('ios-child-binding-2026-11-06')));
  assert(previous.some(row => row.source.includes('ios-child-account-2026-11-06')));
  assert.match(iosChildPresentationProgress.text, /en simulation/); assert.match(iosChildPresentationProgress.text, /reste à retester/);
  assert.doesNotMatch(iosChildPresentationProgress.title + iosChildPresentationProgress.text, /Firebase|BrowserStack|SDK|Swift|CI\b/);
});
