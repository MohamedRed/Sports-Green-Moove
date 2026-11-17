import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {content} from '../../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '../..'), input = process.argv[2]; assert(input?.startsWith('/'));
const folder = resolve(root, 'docs/release/evidence/ios-fixture-failure-584-2026-11-05');
const source = '584c61b61453878e1bd2631b48ca2fef5e9de4d4';
const api = path => JSON.parse(execFileSync('gh', ['api', `repos/MohamedRed/Sports-Green-Moove/${path}`], {encoding: 'utf8'}));
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), json = value => JSON.stringify(value, null, 2) + '\n';
const log = readFileSync(resolve(input, 'sgm-ios-584-terminal-20261105.log'), 'utf8');
const cases = [...log.matchAll(/Test Case '-\[SportsGreenMooveUITests\.(\w+) (\w+)\]' (passed|failed) \(([\d.]+) seconds\)\./g)]
  .map(([, suite, name, status, seconds]) => ({suite, name, status, seconds: Number(seconds)}));
assert.equal(cases.length, 11); assert.equal(cases.filter(row => row.status === 'passed').length, 8);
assert.deepEqual(cases.filter(row => row.status === 'failed').map(row => row.name), [
  'testPersonalContactRequiresReviewAndPersistsItsRemoval', 'testTrackingAndSeatChangesInvalidateTheAcceptedSelection', 'testPublishSearchAndBookingIdentifiers']);
const failures = log.split('\n').filter(line => /: error: -\[SportsGreenMooveUITests\./.test(line)); assert.equal(failures.length, 5);
assert(log.includes('Executed 11 tests, with 5 failures (0 unexpected)'));
const run = api('actions/runs/42085479023'), job = api('actions/jobs/127462307445');
assert.equal(run.head_sha, source); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'cancelled');
assert.equal(job.run_id, run.id); assert.equal(job.conclusion, 'cancelled');
for (const [name, result] of [['Compile app and all fixture test bundles', 'success'],
  ['Run every built fixture test without rebuilding', 'failure'], ['Dispose isolated simulator', 'success']])
  assert.equal(job.steps.find(row => row.name === name).conclusion, result);
const artifacts = api(`actions/runs/${run.id}/artifacts`); assert.equal(artifacts.total_count, 0);
const annotations = api(`check-runs/${job.id}/annotations`).map(({annotation_level, message}) => ({annotation_level, message}));
assert(annotations.some(row => row.message.includes('50m0s'))); assert(annotations.some(row => row.message.includes('exit code 65')));
mkdirSync(folder, {recursive: true}); assert(!existsSync(resolve(folder, 'summary.json')));
const records = [];
function record(file, value) {
  const bytes = typeof value === 'string' ? value : json(value);
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes));
  writeFileSync(resolve(folder, file), bytes, {flag: 'wx'}); records.push({file, sha256: sha(bytes)});
}
record('terminal-job.json', {runId: run.id, jobId: job.id, sourceCommit: source, status: job.status,
  conclusion: job.conclusion, startedAt: job.started_at, completedAt: job.completed_at,
  steps: job.steps.map(({name, conclusion, started_at, completed_at}) => ({name, conclusion, startedAt: started_at, completedAt: completed_at}))});
record('annotations.json', annotations); record('artifacts.json', {total_count: artifacts.total_count});
record('cases.json', cases); record('selected-failures.txt', failures.join('\n') + '\n');
const baseline = readFileSync(resolve(input, 'sgm-ios-584-route-seed-execution-baseline-20261105.log'), 'utf8');
assert(baseline.includes('Fatal error: Publication fixture must seed resolved places after the final role transition'));
assert(!baseline.includes('error: type')); record('seed-baseline.txt', baseline.split('\n').filter(row => row.includes('Fatal error:')).join('\n') + '\n');
const native = readFileSync(resolve(input, 'sgm-ios-584-route-seed-recheck-20261105.log'), 'utf8');
for (const marker of ['Fixture publication seed: driver=true, origin=true, destination=true',
  'UI fixture ownership checks passed: thirteen', 'actual second-child/two-seat booking confirmation',
  'SportsGreenMooveNativeChecks passed', 'OwnedPlacesAdapterChecks passed']) assert(native.includes(marker));
record('native-recheck.txt', native);
const signature = readFileSync(resolve(input, 'sgm-ios-584-signature-recheck-20261105.log'), 'utf8');
assert(signature.includes('not an SDK build or phone test')); record('signature-recheck.txt', signature);
record('portal-before.json', {flows: content.flows.map(row => ({id: row.id, sha256: sha(JSON.stringify(row))})),
  updates: content.updates.map(row => sha(JSON.stringify(row))), blockers: sha(JSON.stringify(content.blockers))});
const paths = ['ios/Sources/SportsGreenMooveApp/UITestAppStateFactory.swift', 'ios/UITests/SportsGreenMooveUITests/EmergencyContactFlowTests.swift',
  'ios/UITests/SportsGreenMooveUITests/OwnedSearchFlowChecks.swift', 'ios/Tests/SportsGreenMooveNativeChecks/UITestRouteChecks.swift',
  'scripts/check-ios-native-plan.sh'];
const files = [];
for (const path of paths) for (const commit of [source, null]) {
  if (commit && path.endsWith('UITestRouteChecks.swift')) continue;
  const bytes = commit ? execFileSync('git', ['show', `${commit}:${path}`], {cwd: root}) : readFileSync(resolve(root, path));
  const hash = sha(bytes), target = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(target)) writeFileSync(target, bytes, {flag: 'wx'}); assert.equal(sha(readFileSync(target)), hash);
  files.push({path, commit: commit ?? 'candidate', sha256: hash});
}
record('source-sha256.json', {files});
record('summary.json', {checkedAt: '2026-11-05', sourceCommit: source, runId: run.id, jobId: job.id,
  conclusion: 'cancelled', sdkBuild: 'success', fixtureStep: 'failure', casesExecuted: 11, passed: 8, failed: 3,
  assertionFailures: 5, disposal: 'success', artifactCount: 0, deadlineMinutes: 50,
  publicationSeedOrderFailureReproduced: true, fixtureRoleAndPlacesChecksPassed: true,
  actualFixtureBookingConfirmationPassedLocally: true, emergencyNavigationCandidateOnly: true, bookingUiCauseConfirmed: false,
  candidateSdkAccepted: false, candidateUiAccepted: false, physicalDeviceAccepted: false,
  productionWrites: 0, providerRequests: 0, newPhoneSessions: 0, newMedia: 0, releaseComplete: false, records: [...records]});
console.log('Retained all eleven actual iPhone outcomes and the seed-order reproduction; candidates remain unaccepted by native UI.');
