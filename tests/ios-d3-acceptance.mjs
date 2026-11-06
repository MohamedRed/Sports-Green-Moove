import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {assertCurrentIosAutomatedEvidence, iosAutomatedEvidenceIds, validateIosFixtureGate} from '../scripts/qa/ios-fixture-release-evidence.mjs';
import {content} from '../partner-portal/content.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';
import {iosD3Acceptance, iosD3AcceptanceProgress} from '../partner-portal/ios-d3-acceptance.mjs';

const root = process.cwd(), prefix = 'docs/release/evidence/ios-automated-acceptance-d3c0f7a-2026-11-06/';
const read = path => readFileSync(new URL('../' + path, import.meta.url));
const json = path => JSON.parse(read(path)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
test('the corrected presentation builds and all eleven original iPhone screen cases pass', () => {
  const proof = validateIosFixtureGate(root, iosD3Acceptance, {matchCurrentSources: false});
  assert.equal(proof.sourceCommit, 'd3c0f7afd850dc9b7532386d67eca184f72656e6');
  assert.equal(proof.runId, 42305150736); assert.equal(proof.jobId, 128192527345);
  assert.equal(proof.passedCases, 11); assert.equal(proof.artifactCount, 0); assert.equal(proof.releaseComplete, false);
  const cases = json(iosD3Acceptance.source.replace('summary.json', 'cases.json'));
  assert.equal(cases.find(row => row.name === 'testParentChoosesVerifiedChildBeyondFirstPageAndSavesTheirContact').status, 'passed');
  assert.equal(cases.find(row => row.name === 'testChildContactOpensFromHomeWithoutTrackingOrEditing').status, 'passed');
  assertCurrentIosAutomatedEvidence();
});
test('the corrected acceptance changes only two entries and keeps every negative proof', () => {
  const receipt = json(prefix + 'summary.json'), before = json(prefix + 'manifest-before.json'), after = json(prefix + 'manifest-after.json');
  for (const [file, key] of [['manifest-before.json', 'manifestBeforeSha256'], ['manifest-after.json', 'manifestAfterSha256'], ['index-after.json', 'indexAfterSha256']])
    assert.equal(sha(read(prefix + file)), receipt[key]);
  assert.equal(sha(read(receipt.inheritedIndex.source)), receipt.inheritedIndex.sha256);
  assert.deepEqual(receipt.acceptedIds, iosAutomatedEvidenceIds); assert.equal(receipt.releaseComplete, false);
  for (const key of Object.keys(before).filter(key => !['generatedAt', 'automatedUserFlowEvidence'].includes(key))) assert.deepEqual(after[key], before[key]);
  for (const old of before.automatedUserFlowEvidence.items) {
    const row = after.automatedUserFlowEvidence.items.find(item => item.id === old.id);
    if (!iosAutomatedEvidenceIds.includes(old.id)) assert.deepEqual(row, old);
    else {
      assert.equal(old.status, 'pending'); assert.equal(row.status, 'passed');
      assert.deepEqual(row.fixtureGateRecheck, old.fixtureGateRecheck);
      assert(row.fixtureGateRecheck.source.includes('ios-fixture-recheck-cc1e6d7'));
      for (const reference of old.evidenceRefs) assert(row.evidenceRefs.includes(reference));
    }
  }
});
test('the current concise simulation result retains the parent failure in portal history', () => {
  assert.deepEqual(content.iosD3Acceptance, iosD3Acceptance);
  const {recent, previous} = partitionUpdates(content.updates);
  assert(recent.some(row => row.source === iosD3AcceptanceProgress.source));
  assert(previous.some(row => row.source.includes('ios-child-presentation-2026-11-06')));
  assert(previous.some(row => row.source.includes('ios-child-binding-2026-11-06')));
  assert.match(iosD3AcceptanceProgress.text, /en simulation/); assert.match(iosD3AcceptanceProgress.text, /restent à vérifier/);
  assert.doesNotMatch(iosD3AcceptanceProgress.title + iosD3AcceptanceProgress.text, /Firebase|BrowserStack|SDK|Swift|CI\b/);
  assert.equal(content.flows.length, 34);
});
