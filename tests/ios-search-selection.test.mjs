import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {searchSelectionFolder, validateSearchSelectionEvidence} from '../scripts/qa/ios-search-selection-evidence.mjs';
import {assertCurrentIosAutomatedEvidence, validateIosFixtureGate} from '../scripts/qa/ios-fixture-release-evidence.mjs';
import {content} from '../partner-portal/content.mjs';
import {assertIosFixtureWorkloadWithSelectionCheck} from '../scripts/qa/ios-fixture-workload-contract.mjs';

const root = resolve(import.meta.dirname, '..'), app = 'ios/Sources/SportsGreenMooveApp/';
const read = path => readFileSync(resolve(root, path), 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
test('controlled old callback order and current selection/ownership checks retain their exact source and limited scope', () => {
  assert.equal(validateSearchSelectionEvidence(root).newSearchesPreserved, 10); assertCurrentIosAutomatedEvidence();
});
for (const [file, change] of [
  ['summary.json', row => row.nativeScreenRootCauseConfirmed = true],
  ['summary.json', row => row.nativeSdkAccepted = true], ['summary.json', row => row.releaseComplete = true],
  ['summary.json', row => row.delayedResponsesDrained = 0],
  ['source-sha256.json', row => row.candidate[app + 'SearchSelectionState.swift'] = '0'.repeat(64)],
]) test('rehashed selection proof rejects ' + change.toString(), t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-search-selection-evidence-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  const base = resolve(temp, searchSelectionFolder); cpSync(resolve(root, searchSelectionFolder), base, {recursive: true});
  symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), resolve(temp, 'docs/release/evidence/source-archive'));
  const path = resolve(base, file), value = JSON.parse(readFileSync(path)); change(value); writeFileSync(path, JSON.stringify(value));
  const hashes = JSON.parse(readFileSync(resolve(base, 'artifact-sha256.json'))); hashes[file] = sha(readFileSync(path));
  writeFileSync(resolve(base, 'artifact-sha256.json'), JSON.stringify(hashes));
  assert.throws(() => validateSearchSelectionEvidence(temp));
});
test('all user selection writes invalidate synchronously and old view generations cannot clear current state', () => {
  const selection = read(app + 'SearchSelectionState.swift'), screen = read(app + 'SearchScreen.swift'), state = read(app + 'AppState.swift');
  for (const name of ['form', 'originInput', 'destinationInput']) assert(selection.includes(`if ${name} != oldValue && access.isCurrent`));
  for (const name of ['seatsNeeded', 'baggage', 'returnTrip', 'requireChildTracking', 'guardianConsent', 'childUserId', 'desiredDepartureAtIso'])
    assert(screen.includes('$selection.form.' + name));
  for (const name of ['originInput', 'destinationInput']) assert(screen.includes('$selection.' + name));
  for (const name of ['searchOrigin', 'searchDestination']) assert(state.includes(`if ${name} != oldValue { invalidateSearch() }`));
  assert.doesNotMatch(screen, /\.onChange\(of: (?:form|originInput|destinationInput|appState\.searchOrigin|appState\.searchDestination)\)/);
  assert(screen.includes('requestSearchMatch(match, form: submittedForm, access: access)'));
});
test('the existing screen assertions, waits and eleven-case gate are preserved; only bounded failure diagnosis is added', () => {
  const sources = JSON.parse(read(searchSelectionFolder + 'source-sha256.json'));
  const ui = 'ios/UITests/SportsGreenMooveUITests/SearchConsentFlowTests.swift';
  const original = read('docs/release/evidence/source-archive/' + sources.baseline[ui] + '.txt'), current = read(ui);
  const assertions = text => text.split('\n').map(row => row.trim()).filter(row => row.startsWith('XCTAssert'));
  assert.deepEqual(assertions(current).map(row => row.replace(', String(app.debugDescription.prefix(16_000))', '')), assertions(original));
  assert.equal((current.match(/func test\w+\(/g) ?? []).length, 2); assert(current.includes('verifyOwnedChildBooking(in: app)'));
  const workflow = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  assert.equal(workflow.jobs['ios-fixture-verification']['timeout-minutes'], 50);
  assert(workflow.jobs['ios-fixture-verification'].steps.some(row => row.run === 'node scripts/qa/check-ios-search-selection.mjs'));
});
test('the public note is local-only and preserves prior successes and failures without changing flow status', () => {
  const note = content.updates.find(row => row.source === searchSelectionFolder + 'README.md'); assert(note);
  assert.match(note.text, /en local/); assert.match(note.text, /pas encore sur iPhone/);
  assert.doesNotMatch(note.title + note.text, /Firebase|BrowserStack|Android|SDK|Swift|callback|CI\b/);
  for (const source of ['ios-fixture-recheck-385a6a4-2026-11-05', 'ios-automated-acceptance-f61e0f7-2026-11-05'])
    assert(content.updates.some(row => row.source === 'docs/release/evidence/' + source + '/README.md'));
  assert.equal(content.flows.length, 34);
});
test('the explicit extra native check cannot hide changed original jobs, resources, deadline or test commands', () => {
  const sources = JSON.parse(read(searchSelectionFolder + 'source-sha256.json'));
  const path = '.github/workflows/ios-mvp-verification.yml';
  const baseline = parseDocument(read('docs/release/evidence/source-archive/' + sources.baseline[path] + '.txt')).toJSON().jobs;
  const current = parseDocument(read(path)).toJSON().jobs;
  assertIosFixtureWorkloadWithSelectionCheck(current, baseline);
  for (const change of [
    job => job['timeout-minutes'] = 51, job => job['runs-on'] = 'macos-26-large',
    job => job.steps.find(row => row.name === 'Run every built fixture test without rebuilding').run = 'true',
    job => job.steps.push({name: 'Check immediate search selection invalidation', run: 'true'}),
  ]) {
    const altered = structuredClone(current); change(altered['ios-fixture-verification']);
    assert.throws(() => assertIosFixtureWorkloadWithSelectionCheck(altered, baseline));
  }
});
test('the later eleven-case pass predates this correction and cannot accept the current iPhone tree', () => {
  const folder = 'docs/release/evidence/ios-fixture-gate-959e70b-2026-11-06/';
  const reference = {source: folder + 'summary.json', sha256: sha(read(folder + 'summary.json'))};
  const report = validateIosFixtureGate(root, reference, {matchCurrentSources: false});
  assert.equal(report.sourceCommit, '959e70b41abb039037f94e6eeec8402b597b5bff'); assert.equal(report.passedCases, 11);
  const source = path => Object.fromEntries(JSON.parse(read(path)).files.filter(row => row.path.startsWith('ios/')).map(row => [row.path, row.sha256]));
  assert.deepEqual(source(folder + 'source-sha256.json'), source('docs/release/evidence/ios-fixture-recheck-385a6a4-2026-11-05/source-sha256.json'));
  assert.throws(() => validateIosFixtureGate(root, reference), /Untested iPhone input/);
  assertCurrentIosAutomatedEvidence();
  const note = content.updates.find(row => row.source === folder + 'README.md'); assert(note);
  assert.match(note.text, /sans la nouvelle correction/); assert.match(note.text, /simulation/);
});
