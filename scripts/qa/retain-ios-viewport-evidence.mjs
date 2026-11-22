import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {content} from '../../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '../..'), input = process.argv[2]; assert(input?.startsWith('/'));
const folder = resolve(root, 'docs/release/evidence/ios-viewport-35f-2026-11-05');
const source = '35f23fc6ae4f5fba8bc93ded64050df4d38b6d46';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => readFileSync(resolve(input, name), 'utf8');
const api = path => JSON.parse(execFileSync('gh', ['api', `repos/MohamedRed/Sports-Green-Moove/${path}`], {encoding: 'utf8'}));
const log = read('sgm-ios-35f-terminal-observation-20261105.log');
const cases = [...log.matchAll(/Test Case '-\[SportsGreenMooveUITests\.(\w+) (\w+)\]' (passed|failed) \(([\d.]+) seconds\)\./g)]
  .map(([, suite, name, status, seconds]) => ({suite, name, status, seconds: Number(seconds)}));
assert.equal(cases.length, 11); assert.equal(cases.filter(row => row.status === 'passed').length, 9);
assert.deepEqual(cases.filter(row => row.status === 'failed').map(row => row.name), [
  'testTrackingAndSeatChangesInvalidateTheAcceptedSelection', 'testMessagesChatAndRatingIdentifiers']);
assert.equal(cases.find(row => row.name === 'testPublishSearchAndBookingIdentifiers').status, 'passed');
const failures = log.split('\n').filter(line => /: error: -\[SportsGreenMooveUITests\./.test(line)); assert.equal(failures.length, 4);
const snapshot = log.slice(log.indexOf('SGM_OWNED_BOOKING_ACCESSIBILITY_BEGIN'), log.indexOf('SGM_OWNED_BOOKING_ACCESSIBILITY_END'));
assert(snapshot.includes("identifier: 'messages.screen'")); assert(!snapshot.includes("identifier: 'search.screen'"));
const run = api('actions/runs/42100296847'), job = api('actions/jobs/127503931215');
assert.equal(run.head_sha, source); assert.equal(run.conclusion, 'failure'); assert.equal(job.status, 'completed');
assert.equal(job.run_id, run.id); assert.equal(job.conclusion, 'failure');
for (const [name, conclusion] of [['Compile app and all fixture test bundles', 'success'],
  ['Run every built fixture test without rebuilding', 'failure'], ['Dispose isolated simulator', 'success']])
  assert.equal(job.steps.find(row => row.name === name).conclusion, conclusion);
const artifacts = api(`actions/runs/${run.id}/artifacts`); assert.equal(artifacts.total_count, 0);
const annotations = api(`check-runs/${job.id}/annotations`).map(({annotation_level, message}) => ({annotation_level, message}));
assert(annotations.some(row => row.message.includes('exit code 65')));
const native = read('sgm-ios-viewport-route-recheck-20261105.log');
for (const marker of ['SportsGreenMooveNativeChecks passed', 'TeamChat send readiness passed: four settled read boundaries',
  'Actual fixture booking retains search navigation after its exact acknowledgement']) assert(native.includes(marker));
const baseline = read('sgm-ios-viewport-contract-baseline-20261105.log'); assert(baseline.includes('# fail 3'));
const recheck = read('sgm-ios-viewport-contract-recheck-20261105.log'); assert(recheck.includes('# fail 0'));
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
record('booking-accessibility.txt', snapshot); record('annotations.json', annotations);
record('artifacts.json', {total_count: artifacts.total_count}); record('native-recheck.txt', native);
record('source-contract-baseline.txt', baseline); record('source-contract-recheck.txt', recheck);
const paths = ['ios/Sources/SportsGreenMooveApp/AppShell.swift', 'ios/Sources/SportsGreenMooveApp/SGMNavigation.swift',
  'ios/Sources/SportsGreenMooveApp/SGMComponents.swift', 'ios/Sources/SportsGreenMooveApp/TeamChatState.swift',
  'ios/UITests/SportsGreenMooveUITests/OwnedSearchFlowChecks.swift', 'ios/UITests/SportsGreenMooveUITests/TeamChatFlowChecks.swift',
  'ios/Tests/SportsGreenMooveNativeChecks/TeamChatEditingChecks.swift', 'ios/Tests/SportsGreenMooveNativeChecks/UITestRouteChecks.swift'];
const files = [];
for (const commit of [source, null]) for (const path of paths) {
  const bytes = commit ? execFileSync('git', ['show', `${commit}:${path}`], {cwd: root}) : readFileSync(resolve(root, path));
  const hash = sha(bytes), target = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(target)) writeFileSync(target, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(target)), hash); files.push({path, commit: commit ?? 'candidate', sha256: hash});
}
assert.equal(files.find(row => row.path.endsWith('TeamChatState.swift') && row.commit === source).sha256,
  files.find(row => row.path.endsWith('TeamChatState.swift') && row.commit === 'candidate').sha256);
record('source-sha256.json', {files});
record('portal-before.json', {flows: content.flows.map(row => ({id: row.id, sha256: sha(JSON.stringify(row))})),
  updates: content.updates.map(row => sha(JSON.stringify(row))), blockers: sha(JSON.stringify(content.blockers))});
const zip = resolve(input, 'sgm-chat-85e-artifact-20261105.zip');
const network = JSON.parse(execFileSync('unzip', ['-p', zip, 'local-ui-evidence/18403cd90ad1667098103dea9c80ff3d/local-chat-network-ui.json'], {encoding: 'utf8'}));
assert.equal(network.completed, false); assert.equal(network.failedPhase, 'network-preparation');
assert.equal(network.preparationFailure.hasDefaultDataSubscription, false); assert.equal(network.preparationFailure.backendReachable, true);
record('android85e-network-preparation.json', network);
record('android85e-artifact.json', {runId: 42103893899, jobId: 127513555417, artifactId: 13451901035,
  sourceCommit: '85ec9e9274344eefaf7ce63eef36869a22da3489', zipSha256: sha(readFileSync(zip)), newMediaPublished: 0});
const deviceJob = api('actions/jobs/127524723322'); assert.equal(deviceJob.conclusion, 'failure');
assert.equal(deviceJob.steps.find(row => row.name === 'Install the selected device image before reserving storage').conclusion, 'failure');
const downloadError = read('sgm-remote-stop-38b-terminal-20261105.log').split('\n')
  .filter(line => line.includes('Error reading Zip content from a SeekableByteChannel'));
assert.equal(downloadError.length, 1);
record('android38b-image-download.json', {runId: deviceJob.run_id, jobId: deviceJob.id,
  sourceCommit: '38b558b932b12bc6d3a052815f539f5a01bd185f', conclusion: 'failure',
  failedStep: 'Install the selected device image before reserving storage', selectedError: downloadError[0],
  appFlowExecuted: false, downloadCauseConfirmed: false});
record('summary.json', {checkedAt: '2026-11-05', sourceCommit: source, runId: run.id, jobId: job.id,
  sdkBuild: 'success', conclusion: 'failure', casesExecuted: 11, passed: 9, failed: 2, assertionFailures: 4,
  publicationCasePassed: true, bookingTapMessagesScreenObserved: true, exactBookingHitCoordinateKnown: false,
  sourceOverlayReplaced: true, currentNativeLayoutAccepted: false, currentNativeUiAccepted: false,
  settledReadBoundaries: 4, teamSendPolicyChanged: false, fullNativeChecksPassed: true,
  deadlineMinutes: 50, artifactCount: 0, disposal: 'success', physicalDeviceAccepted: false,
  productionWrites: 0, providerRequests: 0, newPhoneSessions: 0, newMedia: 0, releaseComplete: false, records: [...records]});
console.log('Retained actual iPhone failures and native logic positives; layout and readiness candidates await native UI, with both Android preparation failures kept separate.');
