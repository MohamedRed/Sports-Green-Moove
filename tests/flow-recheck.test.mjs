import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { content } from '../partner-portal/content.mjs';
import { validateCurrentNativeBlocker, validateFlowRecheck } from '../scripts/qa/flow-recheck-evidence.mjs';
import { validateNativeTerminalRecheck } from '../scripts/qa/native-terminal-recheck-evidence.mjs';
import { validateNativeBootRecheck } from '../scripts/qa/native-boot-recheck-evidence.mjs';
import { validateNativeRideCompletionRecheck } from '../scripts/qa/native-ride-completion-recheck-evidence.mjs';
import { validateNativeScheduleCollectionRecheck } from '../scripts/qa/native-schedule-collection-recheck-evidence.mjs';

test('earlier full replay failed at ride completion without replacing the older network failure', () => {
  const run = validateNativeRideCompletionRecheck(process.cwd(), content.nativeRideCompletionRecheck);
  assert.equal(run.conclusion, 'failure');
  assert.notEqual(content.nativeRideCompletionRecheck.source, content.nativeNetworkPreparationRecheck.source);
  const update = content.updates.find(item => item.source === content.nativeRideCompletionRecheck.source.replace('run.json', 'README.md'));
  assert.match(update.text, /cause reste à vérifier/);
  assert.equal(update.flow, 'ride-lifecycle');
});
test('the later pre-correction ride pass cannot hide a failed copy or prove a network repair', () => {
  const run = validateNativeScheduleCollectionRecheck(process.cwd(), content.nativeScheduleCollectionRecheck);
  assert.equal(run.conclusion, 'failure');
  const update = content.updates.find(item => item.source === content.nativeScheduleCollectionRecheck.source.replace('run.json', 'README.md'));
  assert.match(update.text, /Avant la correction/); assert.match(update.text, /copie des captures bloque/);
  assert.notEqual(content.nativeScheduleCollectionRecheck.source, content.nativeRideCompletionRecheck.source);
});

test('terminal service success is separate from failed native replay and unstarted phone checkpoints', () => {
  const report = validateFlowRecheck(process.cwd(), content.flowRecheck);
  assert.equal(report.serviceGroupsPassed, 24); assert.equal(report.releaseComplete, false);
  assert.equal(content.flows.find(flow => flow.id === 'booking').status, 'partial');
  assert.equal(content.flows.find(flow => flow.id === 'booking').phone.checkedAt, '2026-10-18');
  const progress = content.updates.find(item => item.title === 'Les 24 essais côté données passent');
  assert.equal(progress.date, '2026-10-22');
  assert.match(progress.text, /interrompu/); assert.match(progress.text, /débloquer/);
});
test('completed replay removes its blocker but does not replace historical failures or finish release', () => {
  validateCurrentNativeBlocker(process.cwd(), content);
  const changed = structuredClone(content);
  changed.blockers.push({id: 'test-device-stability', text: 'Still blocked'});
  assert.throws(() => validateCurrentNativeBlocker(process.cwd(), changed));
  const missing = {...content, rideCompletionRecheck: content.nativeScheduleCollectionRecheck};
  assert.throws(() => validateCurrentNativeBlocker(process.cwd(), missing));
});
test('completed matrix is distinct from a cancelled focused job after verified fixture and policy restoration', () => {
  const report = validateNativeTerminalRecheck(process.cwd(), content.nativeTerminalRecheck);
  assert.equal(report.localFlowGroupsPassed, 36); assert.equal(report.primaryCopiesPassed, 16);
  assert.equal(report.fullCiPassed, false); assert.equal(report.rootCauseConfirmed, false);
});
test('later preparation failure retains its original negative receipt without replacing historical matrix success', () => {
  const directory = 'docs/release/evidence/native-preparation-3904dd80-2026-10-22/';
  const bytes = file => readFileSync(directory + file), json = file => JSON.parse(bytes(file));
  for (const [file, hash] of Object.entries(json('artifact-sha256.json')))
    assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), hash, file);
  const report = json('summary.json'), run = json('native-run.json'), setup = json('disposable-device-setup.json');
  assert.equal(run.headSha, report.sourceCommit); assert.equal(run.databaseId, report.runId);
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(run.jobs.find(job => job.databaseId === report.matrixJobId).conclusion, 'failure');
  const focused = run.jobs.filter(job => job.name.startsWith('Android focused safety UI tests / Isolated '));
  assert.equal(focused.length, 11); assert(focused.every(job => job.conclusion === 'success'));
  assert.equal(json('native-build-status.json').status, 0);
  assert.equal(setup.scope, 'failed-disposable-device-setup-not-flow-proof');
  assert.equal(setup.storePauseFailure.stage, 'stopped-verification');
  assert.equal(setup.storePauseFailure.observed.storeStopped, false); assert.equal(setup.storePauseFailure.restored, true);
  assert.equal(report.storeSettingsRestored, true); assert.equal(report.launcherRestorationVerified, false);
  for (const field of ['matrixExecuted', 'applicationRegressionProven', 'hostObserverExecuted', 'rootCauseConfirmed',
    'physicalDeviceAccepted', 'releaseComplete']) assert.equal(report[field], false);
  assert.deepEqual(report.newCapturesAccepted, []);
  const update = content.updates.find(row => row.source === directory + 'README.md');
  assert.equal(update.date, report.checkedAt); assert.match(update.text, /avant les parcours/);
});
test('latest boot failure and ten restored focused cases never imply a full replay or every host process gone', () => {
  const report = validateNativeBootRecheck(process.cwd(), content.nativeBootRecheck);
  assert.equal(report.matrixExecuted, false); assert.equal(report.focusedRestorationsVerified, 10);
  assert.equal(report.focusedHostGone, 9); assert.equal(report.focusedHostZombie, 1);
  assert.equal(report.allHostProcessesGone, false);
  const update = content.updates.find(row => row.source === dirname(content.nativeBootRecheck.source) + '/README.md');
  assert.match(update.text, /avant les parcours/);
});
test('historical boot evidence stays pinned to its original ten cases when current CI adds network recovery', () => {
  const source = readFileSync('scripts/qa/native-boot-recheck-evidence.mjs', 'utf8');
  assert(!source.includes("from './android-case-apks.mjs'"));
  const current = readFileSync('scripts/qa/android-case-apks.mjs', 'utf8');
  assert(current.includes('chat-network-recovery'));
  assert.equal(validateNativeBootRecheck(process.cwd(), content.nativeBootRecheck).focusedCasesPassed, 10);
});
test('the retained original boot log is tracked despite the general runtime-log ignore rule', () => {
  const path = 'docs/release/evidence/native-boot-bea9e0ee-2026-10-22/native-job.log';
  assert.equal(execFileSync('git', ['ls-files', '--error-unmatch', path], {encoding: 'utf8'}).trim(), path);
});
for (const [file, mutate] of [
  ['summary.json', row => { row.fullCiPassed = true; }],
  ['summary.json', row => { row.matrixExecuted = true; }],
  ['summary.json', row => { row.allHostProcessesGone = true; }],
  ['focused/native-startup-host.json', row => { row.finalState = 'gone'; }],
  ['focused/team-access-restore.json', row => { row.restoration.launcher = false; }],
  ['artifact-sha256.json', row => { delete row['native-job.log']; }],
]) test('latest boot evidence rejects unsupported state: ' + file + ' ' + mutate, t => {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-native-boot-')); t.after(() => rmSync(root, {recursive: true, force: true}));
  const base = dirname(content.nativeBootRecheck.source), target = resolve(root, base);
  cpSync(resolve(process.cwd(), base), target, { recursive: true });
  const path = resolve(target, file), row = JSON.parse(readFileSync(path)); mutate(row); writeFileSync(path, JSON.stringify(row));
  assert.throws(() => validateNativeBootRecheck(root, content.nativeBootRecheck));
});
for (const [file, mutate] of [
  ['summary.json', row => row.fullCiPassed = true],
  ['summary.json', row => row.emulatorProcessExitVerified = true],
  ['summary.json', row => row.earlierTransportFailureExplained = true],
  ['native-run.json', row => row.conclusion = 'success'],
  ['focused-results.json', row => row.isolatedFixtureCleanupVerified = false],
  ['copies/adb-pull-trip-consent-recovery.json', row => row.completed = false],
]) test('latest terminal record rejects unsupported state: ' + file + ' ' + mutate, t => {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-native-terminal-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const directory = dirname(content.nativeTerminalRecheck.source), target = resolve(root, directory);
  cpSync(resolve(process.cwd(), directory), target, { recursive: true });
  const path = resolve(target, file), row = JSON.parse(readFileSync(path)); mutate(row);
  writeFileSync(path, JSON.stringify(row));
  assert.throws(() => validateNativeTerminalRecheck(root, content.nativeTerminalRecheck));
});
for (const [file, mutate] of [
  ['summary.json', value => value.fullNativeReplayCompleted = true],
  ['summary.json', value => value.newPhoneFlowCompleted = true],
  ['summary.json', value => value.releaseComplete = true],
  ['summary.json', value => value.phoneHelperOutcome.rootCauseEstablished = true],
  ['web-run.json', value => value.conclusion = 'failure'],
  ['native-run.json', value => value.conclusion = 'success'],
  ['session-results.json', value => value.completed = true],
  ['cleanup.json', value => value.endpoints.closed = false],
]) test('rejects unsupported recheck state: ' + file + ' ' + mutate, t => {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-flow-recheck-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const directory = dirname(content.flowRecheck.source), target = resolve(root, directory);
  cpSync(resolve(process.cwd(), directory), target, {recursive: true});
  const path = resolve(target, file), value = JSON.parse(readFileSync(path)); mutate(value);
  writeFileSync(path, JSON.stringify(value));
  assert.throws(() => validateFlowRecheck(root, content.flowRecheck));
});
test('new phone controller contracts and retained results run in smoke without another provider request', () => {
  const workflow = readFileSync('.github/workflows/web-integration-smoke.yml', 'utf8');
  for (const file of ['tests/flow-recheck.test.mjs', 'tests/manual-booking-phone-checkpoints.test.mjs']) {
    assert.equal(workflow.split('"' + file + '"').length - 1, 2);
    assert(workflow.includes('node --test tests/booking-notice-atomicity.test.mjs tests/manual-booking-phone-checkpoints.test.mjs tests/flow-recheck.test.mjs'));
  }
});
