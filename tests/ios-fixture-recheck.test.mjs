import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {assertIosPassPostdatesRecheck, iosRecheckFolder, validateIosFixtureRecheck} from '../scripts/qa/ios-fixture-recheck.mjs';
import {assertCurrentIosAutomatedEvidence, iosAutomatedEvidenceIds} from '../scripts/qa/ios-fixture-release-evidence.mjs';
import {recordIosFixtureRecheck} from '../scripts/qa/record-ios-fixture-recheck.mjs';
import {content} from '../partner-portal/content.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';

const root = resolve(import.meta.dirname, '..'), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = path => JSON.parse(readFileSync(path));
const reference = {source: iosRecheckFolder + '/summary.json', sha256: sha(readFileSync(resolve(root, iosRecheckFolder, 'summary.json')))};
function fixture(t) {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-ios-recheck-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  const base = resolve(temp, iosRecheckFolder); cpSync(resolve(root, iosRecheckFolder), base, {recursive: true});
  symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), resolve(temp, 'docs/release/evidence/source-archive'));
  return {root: temp, base, reference: structuredClone(reference)};
}
function mutate(state, file, change) {
  const path = resolve(state.base, file), value = json(path); change(value); writeFileSync(path, JSON.stringify(value));
  if (file !== 'summary.json') {
    const summary = json(resolve(state.base, 'summary.json'));
    summary.records.find(row => row.file === file).sha256 = sha(readFileSync(path));
    writeFileSync(resolve(state.base, 'summary.json'), JSON.stringify(summary));
  }
  state.reference.sha256 = sha(readFileSync(resolve(state.base, 'summary.json')));
}
test('latest terminal recheck retains ten passes, the single initial-search assertion and successful disposal', () => {
  const report = validateIosFixtureRecheck(root, reference);
  assert.equal(report.passed, 10); assert.equal(report.failed, 1); assert.equal(report.assertionFailures, 1);
  assert.equal(report.sourceCommit, '385a6a4418848b46f4ea522c2903ee22be8b1ee6');
  const cases = json(resolve(root, iosRecheckFolder, 'cases.json'));
  assert.deepEqual(cases.filter(row => row.status === 'failed').map(row => row.name), ['testTrackingAndSeatChangesInvalidateTheAcceptedSelection']);
  assert.match(readFileSync(resolve(root, iosRecheckFolder, 'selected-tests.txt'), 'utf8'), /SearchConsentFlowTests.swift:30: error:/);
  const recorded = json(resolve(root, 'docs/release/evidence/ios-recheck-recording-385a6a4-2026-11-05/manifest-after.json'));
  assert(recorded.automatedUserFlowEvidence.items.filter(row => iosAutomatedEvidenceIds.includes(row.id)).every(row => row.status === 'pending'));
  assertCurrentIosAutomatedEvidence();
});
for (const [file, change] of [
  ['summary.json', row => row.passed = 11], ['summary.json', row => row.failed = 0],
  ['summary.json', row => row.assertionFailures = 0], ['summary.json', row => row.causeConfirmed = true],
  ['summary.json', row => row.deadlineMinutes = 51], ['summary.json', row => row.physicalDeviceAccepted = true],
  ['summary.json', row => row.records.pop()], ['cases.json', rows => rows.pop()],
  ['cases.json', rows => rows[0].name = rows[1].name], ['artifacts.json', row => row.total_count = 1],
  ['terminal-job.json', row => row.conclusion = 'success'], ['terminal-job.json', row => row.completedAt = 'not-a-date'],
  ['terminal-job.json', row => row.steps.find(step => step.name === 'Dispose isolated simulator').conclusion = 'failure'],
  ['source-sha256.json', row => row.files[0].commit = '0'.repeat(40)],
]) test('negative evidence fails closed even with rehashed mutation: ' + file + ':' + change.toString(), t => {
  const state = fixture(t); mutate(state, file, change); assert.throws(() => validateIosFixtureRecheck(state.root, state.reference));
});
test('changing a pending label back to passed cannot inherit the earlier successful gate', () => {
  const manifest = json(resolve(root, 'docs/release/evidence/ios-recheck-recording-385a6a4-2026-11-05/manifest-after.json'));
  for (const row of manifest.automatedUserFlowEvidence.items.filter(row => iosAutomatedEvidenceIds.includes(row.id))) row.status = 'passed';
  const proof = manifest.automatedUserFlowEvidence.items.find(row => row.id === iosAutomatedEvidenceIds[0]).fixtureGateProof;
  assert.throws(() => assertIosPassPostdatesRecheck(root, reference, proof.source), /later failed iPhone recheck/);
  assert.throws(() => assertCurrentIosAutomatedEvidence(manifest));
  manifest.automatedUserFlowEvidence.items.find(row => row.id === iosAutomatedEvidenceIds[0]).fixtureGateRecheck.sha256 = '0'.repeat(64);
  assert.throws(() => assertCurrentIosAutomatedEvidence(manifest));
});
test('the recheck ordering guard permits a later gate rather than permanently freezing progress', t => {
  const state = fixture(t), source = 'docs/release/evidence/later-pass/summary.json';
  const directory = resolve(state.root, 'docs/release/evidence/later-pass'); mkdirSync(directory);
  const {completedAt} = validateIosFixtureRecheck(state.root, state.reference);
  for (const offset of [-1000, 0]) {
    writeFileSync(resolve(directory, 'terminal-job.json'), JSON.stringify({completedAt: new Date(Date.parse(completedAt) + offset).toISOString()}));
    assert.throws(() => assertIosPassPostdatesRecheck(state.root, state.reference, source));
  }
  writeFileSync(resolve(directory, 'terminal-job.json'), JSON.stringify({completedAt: new Date(Date.parse(completedAt) + 1000).toISOString()}));
  assert.doesNotThrow(() => assertIosPassPostdatesRecheck(state.root, state.reference, source));
});
test('recording changes only current iPhone acceptance and preserves every historical reference and other requirement', t => {
  const state = fixture(t), folder = 'docs/release/evidence/ios-automated-acceptance-f61e0f7-2026-11-05';
  const manifestPath = resolve(state.root, 'docs/release/evidence-manifest.json');
  const before = json(resolve(root, folder, 'manifest-after.json')); writeFileSync(manifestPath, JSON.stringify(before));
  const priorName = 'docs/release/evidence/automated-user-flow-evidence-2026-11-05.json';
  cpSync(resolve(root, priorName), resolve(state.root, priorName));
  assert.equal(recordIosFixtureRecheck(state.root, reference.source).status, 'pending');
  const after = json(manifestPath);
  for (const key of Object.keys(before).filter(key => key !== 'automatedUserFlowEvidence')) assert.deepEqual(after[key], before[key]);
  for (const old of before.automatedUserFlowEvidence.items) {
    const current = after.automatedUserFlowEvidence.items.find(row => row.id === old.id);
    if (!iosAutomatedEvidenceIds.includes(old.id)) assert.deepEqual(current, old);
    else {assert.equal(current.status, 'pending'); for (const ref of old.evidenceRefs) assert(current.evidenceRefs.includes(ref));}
  }
  const bytes = readFileSync(manifestPath); assert.throws(() => recordIosFixtureRecheck(state.root, reference.source));
  assert.deepEqual(readFileSync(manifestPath), bytes);
  assert.deepEqual(readFileSync(resolve(state.root, priorName)), readFileSync(resolve(root, priorName)));
});
test('portal retains the partial simulation result and earlier success without erasing either', () => {
  const {recent, previous} = partitionUpdates(content.updates);
  const note = [...recent, ...previous].find(row => row.source === iosRecheckFolder + '/README.md'); assert(note);
  assert.match(note.text, /10 essais sur 11.*simulation/); assert.match(note.text, /recherche/);
  assert.doesNotMatch(note.title + note.text, /Firebase|BrowserStack|Android|SDK|CI\b/);
  assert(previous.some(row => row.source === 'docs/release/evidence/ios-automated-acceptance-f61e0f7-2026-11-05/README.md'));
});
