import assert from 'node:assert/strict';
import './ios-d3-acceptance.mjs';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {assertCurrentIosAutomatedEvidence, iosAutomatedEvidenceIds, validateIosFixtureGate} from '../scripts/qa/ios-fixture-release-evidence.mjs';
import {content} from '../partner-portal/content.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';
import {ios6fbAcceptance, ios6fbAcceptanceProgress} from '../partner-portal/ios-6fb-acceptance.mjs';

const root = resolve(import.meta.dirname, '..'), read = path => readFileSync(resolve(root, path));
const json = path => JSON.parse(read(path)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const folder = 'docs/release/evidence/ios-automated-acceptance-6fb6487-2026-11-06/';
test('the complete 6fb iPhone gate retains its exact inputs and follows the membership failure', () => {
  const report = validateIosFixtureGate(root, ios6fbAcceptance, {matchCurrentSources: false});
  assert.equal(report.runId, 42281015221); assert.equal(report.jobId, 128115060997);
  assert.equal(report.passedCases, 11); assert.equal(report.artifactCount, 0); assert.equal(report.releaseComplete, false);
  assertCurrentIosAutomatedEvidence();
  const job = json(ios6fbAcceptance.source.replace('summary.json', 'terminal-job.json'));
  const failed = json('docs/release/evidence/ios-fixture-recheck-9640d8b-2026-11-06/terminal-job.json');
  assert(Date.parse(job.completedAt) > Date.parse(failed.completedAt));
});
test('latest acceptance changes only the two entries and preserves immutable same-day indices', () => {
  const receipt = json(folder + 'summary.json'), before = json(folder + 'manifest-before.json'), after = json(folder + 'manifest-after.json');
  for (const [file, key] of [['manifest-before.json', 'manifestBeforeSha256'], ['manifest-after.json', 'manifestAfterSha256'], ['index-after.json', 'indexAfterSha256']])
    assert.equal(sha(read(folder + file)), receipt[key]);
  assert.equal(sha(read(receipt.inheritedIndex.source)), receipt.inheritedIndex.sha256);
  assert(receipt.inheritedIndex.source.endsWith('2026-11-06T-9640d8b-recheck.json'));
  assert.deepEqual(receipt.acceptedIds, iosAutomatedEvidenceIds); assert.equal(receipt.releaseComplete, false);
  for (const key of Object.keys(before).filter(key => !['generatedAt', 'automatedUserFlowEvidence'].includes(key))) assert.deepEqual(after[key], before[key]);
  for (const old of before.automatedUserFlowEvidence.items) {
    const row = after.automatedUserFlowEvidence.items.find(item => item.id === old.id);
    if (!iosAutomatedEvidenceIds.includes(old.id)) assert.deepEqual(row, old);
    else {
      assert.equal(row.status, 'passed'); assert.deepEqual(row.fixtureGateRecheck, old.fixtureGateRecheck);
      for (const ref of old.evidenceRefs) assert(row.evidenceRefs.includes(ref));
    }
  }
});
test('the portal preserves the source-6fb simulation result after later input changes', () => {
  const {recent, previous} = partitionUpdates(content.updates);
  assert(previous.some(row => row.source === ios6fbAcceptanceProgress.source));
  assert(content.updates.some(row => row.source.includes('ios-child-account-2026-11-06')));
  assert(recent.some(row => row.flow === 'child-emergency' || row.coversFlows?.includes('child-emergency')));
  for (const source of ['ios-fixture-gate-0fb9968', 'ios-fixture-recheck-9640d8b', 'ios-automated-acceptance-376addb'])
    assert(previous.some(row => row.source.includes(source)));
  assert.match(ios6fbAcceptanceProgress.text, /simulation/); assert.match(ios6fbAcceptanceProgress.text, /restent à vérifier/);
  assert.doesNotMatch(ios6fbAcceptanceProgress.title + ios6fbAcceptanceProgress.text, /Firebase|BrowserStack|Android|SDK|Swift|CI\b/);
  assert.equal(content.flows.length, 34);
});
