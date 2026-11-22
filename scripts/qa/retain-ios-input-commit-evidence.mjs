import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {content} from '../../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '../..'), input = process.argv[2]; assert(input?.startsWith('/'));
const folder = resolve(root, 'docs/release/evidence/ios-input-commit-38b-2026-11-05');
const source = '38b558b932b12bc6d3a052815f539f5a01bd185f';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => readFileSync(resolve(input, file), 'utf8');
const api = path => JSON.parse(execFileSync('gh', ['api', `repos/MohamedRed/Sports-Green-Moove/${path}`], {encoding: 'utf8'}));
const log = read('sgm-ios-38b-terminal-20261105.log');
const cases = [...log.matchAll(/Test Case '-\[SportsGreenMooveUITests\.(\w+) (\w+)\]' (passed|failed) \(([\d.]+) seconds\)\./g)]
  .map(([, suite, name, status, seconds]) => ({suite, name, status, seconds: Number(seconds)}));
assert.equal(cases.length, 11); assert.equal(cases.filter(row => row.status === 'passed').length, 8);
assert.deepEqual(cases.filter(row => row.status === 'failed').map(row => row.name), [
  'testTrackingAndSeatChangesInvalidateTheAcceptedSelection', 'testActiveRideIdentifiers', 'testMessagesChatAndRatingIdentifiers']);
const failures = log.split('\n').filter(row => /: error: -\[SportsGreenMooveUITests\./.test(row)); assert.equal(failures.length, 5);
const rideFailures = failures.filter(row => row.includes('testActiveRideIdentifiers')); assert.equal(rideFailures.length, 1);
assert(rideFailures[0].includes('RideChatFlowChecks.swift:9:')); assert(rideFailures[0].includes('Premier message de course '));
const start = log.indexOf(rideFailures[0]), end = log.indexOf("Test Case '-[SportsGreenMooveUITests.SportsGreenMooveUITests testActiveRideIdentifiers]' failed", start);
assert(start >= 0 && end > start); const observation = log.slice(start, log.indexOf('\n', end));
assert.equal((observation.match(/Waiting 6.0s for "Premier message de course isolé" StaticText/g) ?? []).length, 2);
assert(observation.includes('Tap "ride-chat.back" Button'));
const run = api('actions/runs/42107112300'), job = api('actions/jobs/127525202735');
assert.equal(run.head_sha, source); assert.equal(run.conclusion, 'failure'); assert.equal(job.run_id, run.id);
assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
for (const [name, conclusion] of [['Compile app and all fixture test bundles', 'success'],
  ['Run every built fixture test without rebuilding', 'failure'], ['Dispose isolated simulator', 'success']])
  assert.equal(job.steps.find(row => row.name === name).conclusion, conclusion);
const artifacts = api(`actions/runs/${run.id}/artifacts`); assert.equal(artifacts.total_count, 0);
const annotations = api(`check-runs/${job.id}/annotations`).map(({annotation_level, message}) => ({annotation_level, message}));
assert(annotations.some(row => row.message.includes('exit code 65')));
const native = read('sgm-ios-input-commit-native-20261105.log'); assert(native.includes('SportsGreenMooveNativeChecks passed'));
assert(native.includes('RideChatBoundaryChecks passed: 84'));
mkdirSync(folder, {recursive: true}); assert(!existsSync(resolve(folder, 'summary.json')));
const records = [];
function record(file, value) {
  const bytes = typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n';
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes));
  writeFileSync(resolve(folder, file), bytes, {flag: 'wx'}); records.push({file, sha256: sha(bytes)});
}
record('terminal-job.json', {runId: run.id, jobId: job.id, sourceCommit: source, status: job.status,
  conclusion: job.conclusion, startedAt: job.started_at, completedAt: job.completed_at,
  steps: job.steps.map(({name, conclusion, started_at, completed_at}) => ({name, conclusion, startedAt: started_at, completedAt: completed_at}))});
record('cases.json', cases); record('selected-failures.txt', failures.join('\n') + '\n');
record('active-ride-input-observation.txt', observation); record('native-recheck.txt', native);
record('annotations.json', annotations); record('artifacts.json', {total_count: artifacts.total_count});
const paths = ['ios/UITests/SportsGreenMooveUITests/RideChatFlowChecks.swift', '.github/workflows/ios-mvp-verification.yml',
  'ios/Sources/SportsGreenMooveApp/RideChatThreadState.swift', 'ios/Sources/SportsGreenMooveApp/RideChatComposer.swift',
  'ios/Sources/SportsGreenMooveApp/RideChatMessageViews.swift', 'ios/Sources/SportsGreenMooveApp/UITestRideChat.swift'];
const files = [];
for (const commit of [source, null]) for (const path of paths) {
  const bytes = commit ? execFileSync('git', ['show', `${commit}:${path}`], {cwd: root}) : readFileSync(resolve(root, path));
  const hash = sha(bytes), target = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(target)) writeFileSync(target, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(target)), hash); files.push({path, commit: commit ?? 'candidate', sha256: hash});
}
for (const path of paths.slice(2)) assert.equal(files.find(row => row.path === path && row.commit === source).sha256,
  files.find(row => row.path === path && row.commit === 'candidate').sha256, 'Production and fixture message behavior must remain unchanged');
record('source-sha256.json', {files});
record('portal-before.json', {flows: content.flows.map(row => ({id: row.id, sha256: sha(JSON.stringify(row))})),
  updates: content.updates.map(row => sha(JSON.stringify(row))), blockers: sha(JSON.stringify(content.blockers))});
record('summary.json', {checkedAt: '2026-11-05', sourceCommit: source, runId: run.id, jobId: job.id,
  sdkBuild: 'success', conclusion: 'failure', casesExecuted: 11, passed: 8, failed: 3, assertionFailures: 5,
  activeRideInputAssertionFailures: 1, fullMessageObservedAfterSendAndReopen: true,
  persistentDraftLossProven: false, exactNativeInputDelayCauseConfirmed: false,
  productionComposerChanged: false, fixtureEchoChanged: false, candidateUiAccepted: false,
  fullNativeChecksPassed: true, deadlineMinutes: 50, waitSeconds: 6, artifactCount: 0, disposal: 'success',
  physicalDeviceAccepted: false, productionWrites: 0, providerRequests: 0, newPhoneSessions: 0,
  newMedia: 0, releaseComplete: false, records: [...records]});
console.log('Retained eight-of-eleven iPhone failure and the later exact message/reopen observations; bounded input readiness remains a native UI candidate, not a production composer change.');
