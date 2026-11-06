import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {assertCurrentIosAutomatedEvidence, iosAutomatedEvidenceIds, validateIosFixtureGate} from '../scripts/qa/ios-fixture-release-evidence.mjs';
import {content} from '../partner-portal/content.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';

const root = resolve(import.meta.dirname, '..');
const gate = 'docs/release/evidence/ios-fixture-gate-376addb-2026-11-06/';
const folder = 'docs/release/evidence/ios-automated-acceptance-376addb-2026-11-06/';
const read = path => readFileSync(resolve(root, path)), json = path => JSON.parse(read(path));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
test('the source 376 pass executes all eleven cases after the retained failed recheck', () => {
  const proof = {source: gate + 'summary.json', sha256: sha(read(gate + 'summary.json'))};
  const report = validateIosFixtureGate(root, proof, {matchCurrentSources: false});
  assert.equal(report.sourceCommit, '376addb0d2dcc98a0c145247afb40d80dc8bfd34');
  assert.equal(report.runId, 42261168465); assert.equal(report.jobId, 128041167527);
  assert.equal(report.passedCases, 11); assert.equal(report.artifactCount, 0); assert.equal(report.releaseComplete, false);
  const job = json(gate + 'terminal-job.json');
  assert.equal(job.steps.find(row => row.name === 'Check immediate search selection invalidation').conclusion, 'success');
  assert(Date.parse(job.completedAt) > Date.parse(json('docs/release/evidence/ios-fixture-recheck-385a6a4-2026-11-05/terminal-job.json').completedAt));
  assertCurrentIosAutomatedEvidence();
});
test('the exact acceptance snapshots change only two automated entries and retain every negative reference', () => {
  const receipt = json(folder + 'summary.json'), before = json(folder + 'manifest-before.json'), after = json(folder + 'manifest-after.json');
  for (const [file, key] of [['manifest-before.json', 'manifestBeforeSha256'], ['manifest-after.json', 'manifestAfterSha256'], ['index-after.json', 'indexAfterSha256']])
    assert.equal(sha(read(folder + file)), receipt[key]);
  assert.equal(sha(read(receipt.inheritedIndex.source)), receipt.inheritedIndex.sha256);
  assert.deepEqual(receipt.acceptedIds, iosAutomatedEvidenceIds); assert.equal(receipt.releaseComplete, false);
  for (const key of Object.keys(before).filter(key => !['generatedAt', 'automatedUserFlowEvidence'].includes(key))) assert.deepEqual(after[key], before[key]);
  const nonIos = rows => rows.filter(row => !iosAutomatedEvidenceIds.includes(row.id));
  assert.deepEqual(nonIos(after.automatedUserFlowEvidence.items), nonIos(before.automatedUserFlowEvidence.items));
  for (const row of after.automatedUserFlowEvidence.items.filter(row => iosAutomatedEvidenceIds.includes(row.id))) {
    const prior = before.automatedUserFlowEvidence.items.find(item => item.id === row.id);
    assert.equal(row.status, 'passed'); assert.deepEqual(row.fixtureGateRecheck, prior.fixtureGateRecheck);
    for (const ref of prior.evidenceRefs) assert(row.evidenceRefs.includes(ref));
  }
});
test('the concise current simulation note supersedes pending headlines without deleting the old observations', () => {
  const {recent, previous} = partitionUpdates(content.updates);
  const note = recent.find(row => row.source === folder + 'README.md'); assert(note);
  assert.match(note.text, /simulation/); assert.match(note.text, /restent à tester/);
  assert.doesNotMatch(note.title + note.text, /Firebase|BrowserStack|Android|SDK|Swift|CI\b/);
  for (const source of ['ios-search-selection-2026-11-06', 'ios-fixture-gate-959e70b-2026-11-06', 'ios-fixture-recheck-385a6a4-2026-11-05'])
    assert(previous.some(row => row.source === 'docs/release/evidence/' + source + '/README.md'));
  assert.equal(content.flows.length, 34);
});
