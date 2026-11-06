import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {assertCurrentIosAutomatedEvidence, iosAutomatedEvidenceIds, validateIosFixtureGate} from '../scripts/qa/ios-fixture-release-evidence.mjs';
import {acceptIosFixtureGate} from '../scripts/qa/accept-ios-fixture-gate.mjs';
import {content} from '../partner-portal/content.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';

const root = resolve(import.meta.dirname, '..'), folder = 'docs/release/evidence/ios-fixture-gate-d56cec6-2026-11-05';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = path => JSON.parse(readFileSync(path));
const reference = {source: folder + '/summary.json', sha256: sha(readFileSync(resolve(root, folder, 'summary.json')))};

function fixture(t) {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-ios-gate-proof-'));
  t.after(() => rmSync(temp, {recursive: true, force: true}));
  const base = resolve(temp, folder); cpSync(resolve(root, folder), base, {recursive: true});
  const archive = resolve(temp, 'docs/release/evidence/source-archive'); mkdirSync(dirname(archive), {recursive: true});
  symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), archive);
  const sources = json(resolve(base, 'source-sha256.json')).files;
  for (const row of json(resolve(base, 'build-input-sha256.json')).files) {
    const bytes = sources.some(source => source.path === row.path) ? readFileSync(resolve(archive, row.sha256 + '.txt')) : readFileSync(resolve(root, row.path));
    assert.equal(sha(bytes), row.sha256);
    mkdirSync(dirname(resolve(temp, row.path)), {recursive: true}); writeFileSync(resolve(temp, row.path), bytes);
  }
  const workflow = sources.find(row => row.path === '.github/workflows/ios-mvp-verification.yml');
  mkdirSync(resolve(temp, '.github/workflows'), {recursive: true});
  writeFileSync(resolve(temp, workflow.path), readFileSync(resolve(archive, workflow.sha256 + '.txt')));
  return {root: temp, base, reference: structuredClone(reference)};
}
function rehashMutation(state, file, mutate) {
  const path = resolve(state.base, file), value = json(path); mutate(value);
  writeFileSync(path, JSON.stringify(value));
  if (file !== 'summary.json') {
    const reportPath = resolve(state.base, 'summary.json'), report = json(reportPath);
    report.records.find(row => row.file === file).sha256 = sha(readFileSync(path));
    writeFileSync(reportPath, JSON.stringify(report));
  }
  state.reference.sha256 = sha(readFileSync(resolve(state.base, 'summary.json')));
}
function passedManifest(state) {
  const manifest = json(resolve(root, 'docs/release/evidence-manifest.json')), report = json(resolve(state.base, 'summary.json'));
  for (const row of manifest.automatedUserFlowEvidence.items.filter(row => iosAutomatedEvidenceIds.includes(row.id))) {
    delete row.fixtureGateRecheck;
    row.status = 'passed'; row.fixtureGateProof = state.reference; row.appSourceCommit = report.sourceCommit;
    row.evidenceRefs = [state.reference.source.replace('docs/release/', ''),
      `https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/${report.runId}/job/${report.jobId}`];
  }
  return manifest;
}

test('real eleven-case historical proof accepts only its exact source tree, including resources and workflow', t => {
  const state = fixture(t), report = validateIosFixtureGate(state.root, state.reference);
  assert.equal(report.passedCases, 11); assert.equal(report.sourceCommit, 'd56cec66555cfb69a9f5ca336a637f99917376ed');
  assert.equal(assertCurrentIosAutomatedEvidence(passedManifest(state), {root: state.root}).status, 'passed');
  assert.throws(() => validateIosFixtureGate(root, reference), /Untested iPhone input/);
});
for (const [file, mutate] of [
  ['summary.json', row => row.passedCases = 8],
  ['summary.json', row => row.plannedCases = 7],
  ['summary.json', row => row.physicalDeviceAccepted = true],
  ['summary.json', row => row.deadlineMinutes = 51],
  ['summary.json', row => row.checkedAt = '../../outside'],
  ['summary.json', row => row.sourceCommit = '0'.repeat(40)],
  ['cases.json', rows => rows.pop()],
  ['cases.json', rows => rows[0].status = 'skipped'],
  ['cases.json', rows => rows[0].name = rows[1].name],
  ['terminal-job.json', row => row.status = 'in_progress'],
  ['terminal-job.json', row => row.runId++],
  ['terminal-job.json', row => row.conclusion = 'failure'],
  ['terminal-job.json', row => row.steps.find(step => step.name === 'Compile app and all fixture test bundles').conclusion = 'failure'],
  ['terminal-job.json', row => row.steps.find(step => step.name === 'Dispose isolated simulator').conclusion = 'failure'],
  ['terminal-job.json', row => row.steps.find(step => step.name === 'Retain approved iPhone captures for one day').conclusion = 'success'],
  ['artifacts.json', row => row.total_count = 1],
  ['source-sha256.json', row => row.files[0].commit = '0'.repeat(40)],
  ['source-sha256.json', row => row.files[0].sha256 = '../outside'],
  ['build-input-sha256.json', row => row.files.pop()],
]) test('rehashed proof still rejects changed ' + file + ': ' + mutate.toString(), t => {
  const state = fixture(t); rehashMutation(state, file, mutate);
  assert.throws(() => validateIosFixtureGate(state.root, state.reference));
});
test('untested source, new build input, resource or workflow changes cannot inherit a past pass', t => {
  for (const file of ['ios/Sources/SportsGreenMooveApp/RideChatComposer.swift',
    'ios/Sources/SportsGreenMooveApp/NewUntestedFile.swift', 'ios/Sources/SportsGreenMooveApp/Resources/PrivacyInfo.xcprivacy',
    '.github/workflows/ios-mvp-verification.yml']) {
    const state = fixture(t), path = resolve(state.root, file);
    writeFileSync(path, file.endsWith('.yml') ? readFileSync(path, 'utf8').replace('timeout-minutes: 50', 'timeout-minutes: 51') : 'changed input');
    assert.throws(() => validateIosFixtureGate(state.root, state.reference), file);
  }
});
test('a passed label, mismatched source or mismatched gate references never substitutes for actual proof', t => {
  const state = fixture(t);
  for (const change of [
    rows => delete rows[0].fixtureGateProof,
    rows => rows[0].appSourceCommit = '0'.repeat(40),
    rows => rows[0].status = 'pending',
    rows => rows[1].fixtureGateProof = {...rows[1].fixtureGateProof, sha256: '0'.repeat(64)},
    rows => rows[0].evidenceRefs = [],
  ]) {
    const manifest = passedManifest(state); change(manifest.automatedUserFlowEvidence.items.filter(row => iosAutomatedEvidenceIds.includes(row.id)));
    assert.throws(() => assertCurrentIosAutomatedEvidence(manifest, {root: state.root}));
  }
});
test('a manually selected older automated index cannot overrule current iPhone pending or verified source state', () => {
  const output = JSON.parse(execFileSync(process.execPath, ['scripts/report-release-gaps.mjs', '--json', '--automated-evidence',
    'docs/release/evidence/automated-user-flow-evidence-2026-11-04.json'], {cwd: root, encoding: 'utf8'}));
  const current = assertCurrentIosAutomatedEvidence(); assert.deepEqual(output.iosFixtureGate, current);
  assert.deepEqual(output.automatedFlowEvidence.missing, current.status === 'passed' ? [] : iosAutomatedEvidenceIds);
  assert.equal(output.ok, false); assert(output.realDeviceRuns.byPlatform.ios.missing.length > 0);
});
test('acceptance refuses the old tree before writing any current manifest or index', () => {
  const path = resolve(root, 'docs/release/evidence-manifest.json'), before = readFileSync(path);
  assert.throws(() => execFileSync(process.execPath, ['scripts/qa/accept-ios-fixture-gate.mjs', reference.source], {cwd: root, stdio: 'pipe'}));
  assert.deepEqual(readFileSync(path), before);
});
test('actual acceptance updates only the two verified entries and preserves every unrelated release requirement', t => {
  const state = fixture(t), manifestPath = 'docs/release/evidence-manifest.json';
  const priorIndexPath = 'docs/release/evidence/automated-user-flow-evidence-2026-11-04T-location-shutdown.json';
  cpSync(resolve(root, 'docs/release/evidence/ios-automated-acceptance-f61e0f7-2026-11-05/manifest-before.json'), resolve(state.root, manifestPath));
  cpSync(resolve(root, priorIndexPath), resolve(state.root, priorIndexPath));
  const before = json(resolve(state.root, manifestPath)), prior = json(resolve(state.root, priorIndexPath));
  const result = acceptIosFixtureGate(state.root, reference.source); assert.deepEqual(result.accepted, iosAutomatedEvidenceIds);
  const after = json(resolve(state.root, manifestPath)); assert.equal(after.manifestStatus, 'in-progress');
  assert.equal(assertCurrentIosAutomatedEvidence(after, {root: state.root}).status, 'passed');
  for (const key of Object.keys(before).filter(key => !['generatedAt', 'automatedUserFlowEvidence'].includes(key))) assert.deepEqual(after[key], before[key]);
  const nonIos = rows => rows.filter(row => !iosAutomatedEvidenceIds.includes(row.id));
  assert.deepEqual(nonIos(after.automatedUserFlowEvidence.items), nonIos(before.automatedUserFlowEvidence.items));
  const index = json(resolve(state.root, 'docs/release/evidence/automated-user-flow-evidence-2026-11-05.json'));
  assert.deepEqual(nonIos(index.items), nonIos(prior.items)); assert.deepEqual(json(resolve(state.root, priorIndexPath)), prior);
  for (const row of after.automatedUserFlowEvidence.items.filter(row => iosAutomatedEvidenceIds.includes(row.id)))
    for (const ref of before.automatedUserFlowEvidence.items.find(old => old.id === row.id).evidenceRefs) assert(row.evidenceRefs.includes(ref));
  const bytes = readFileSync(resolve(state.root, manifestPath));
  assert.throws(() => acceptIosFixtureGate(state.root, reference.source)); assert.deepEqual(readFileSync(resolve(state.root, manifestPath)), bytes);
});
test('both real release commands reject an accepted label bound to a different iPhone source', t => {
  const state = fixture(t), path = resolve(state.root, 'claimed-current-manifest.json');
  writeFileSync(path, JSON.stringify(passedManifest(state)));
  for (const args of [
    ['scripts/report-release-gaps.mjs', '--json', '--manifest', path],
    ['scripts/validate-release-evidence.mjs', '--allow-placeholders', path],
  ]) assert.throws(() => execFileSync(process.execPath, args, {cwd: root, stdio: 'pipe'}),
    error => /Untested iPhone input/.test(String(error.stderr)));
});
test('actual f61 acceptance snapshots preserve every other requirement without freezing future manifest progress', () => {
  const base = resolve(root, 'docs/release/evidence/ios-automated-acceptance-f61e0f7-2026-11-05');
  const receipt = json(resolve(base, 'summary.json'));
  for (const [file, key] of [['manifest-before.json', 'manifestBeforeSha256'], ['manifest-after.json', 'manifestAfterSha256'], ['index-after.json', 'indexAfterSha256']])
    assert.equal(sha(readFileSync(resolve(base, file))), receipt[key]);
  assert.equal(sha(readFileSync(resolve(root, receipt.inheritedIndex.source))), receipt.inheritedIndex.sha256);
  const before = json(resolve(base, 'manifest-before.json')), after = json(resolve(base, 'manifest-after.json'));
  for (const key of Object.keys(before).filter(key => !['generatedAt', 'automatedUserFlowEvidence'].includes(key))) assert.deepEqual(after[key], before[key]);
  assert.deepEqual(receipt.acceptedIds, iosAutomatedEvidenceIds); assert.equal(receipt.releaseComplete, false);
  for (const row of after.automatedUserFlowEvidence.items.filter(row => iosAutomatedEvidenceIds.includes(row.id))) {
    assert.equal(row.status, 'passed'); assert.deepEqual(row.fixtureGateProof, receipt.fixtureGateProof);
    for (const ref of before.automatedUserFlowEvidence.items.find(old => old.id === row.id).evidenceRefs) assert(row.evidenceRefs.includes(ref));
  }
  assert.equal(validateIosFixtureGate(root, receipt.fixtureGateProof, {matchCurrentSources: false}).passedCases, 11);
  assertCurrentIosAutomatedEvidence();
  const {recent, previous} = partitionUpdates(content.updates);
  const note = [...recent, ...previous].find(row => row.source === 'docs/release/evidence/ios-automated-acceptance-f61e0f7-2026-11-05/README.md');
  assert(note); assert.match(note.text, /simulation/); assert.match(note.text, /notifications/);
  assert.doesNotMatch(note.title + note.text, /Firebase|BrowserStack|Android|SDK|CI\b/);
  assert(previous.some(row => row.source === 'docs/release/evidence/ios-fixture-pass-d56-2026-11-05/README.md'));
});
test('an incomplete manifest still reports missing iPhone evidence instead of borrowing an old pass or crashing', t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-ios-missing-proof-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  const path = resolve(temp, 'manifest.json'); writeFileSync(path, JSON.stringify({automatedUserFlowEvidence: {items: []}}));
  const report = JSON.parse(execFileSync(process.execPath, ['scripts/report-release-gaps.mjs', '--json', '--manifest', path,
    '--automated-evidence', 'docs/release/evidence/automated-user-flow-evidence-2026-11-04.json'], {cwd: root, encoding: 'utf8'}));
  assert.equal(report.iosFixtureGate.status, 'missing'); assert.deepEqual(report.automatedFlowEvidence.missing, iosAutomatedEvidenceIds);
  assert.equal(report.ok, false);
});
