import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {content} from '../../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '../..'), input = process.argv[2];
assert(input?.startsWith('/'));
const dir = resolve(root, 'docs/release/evidence/verification-boundaries-2026-11-05');
const repo = 'repos/MohamedRed/Sports-Green-Moove';
const api = path => JSON.parse(execFileSync('gh', ['api', `${repo}/${path}`], {encoding: 'utf8'}));
const sha = value => createHash('sha256').update(value).digest('hex');
const records = [], json = value => JSON.stringify(value, null, 2) + '\n';
mkdirSync(dir, {recursive: true}); assert(!existsSync(resolve(dir, 'summary.json')));
function record(file, value) {
  const bytes = typeof value === 'string' ? value : json(value);
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes));
  const path = resolve(dir, file);
  if (existsSync(path)) assert.equal(readFileSync(path, 'utf8'), bytes, 'Retained evidence must not change');
  else writeFileSync(path, bytes, {flag: 'wx'});
  records.push({file, sha256: sha(bytes)});
}
function jobRecord(runId, jobId, source) {
  const run = api(`actions/runs/${runId}`), job = api(`actions/jobs/${jobId}`);
  assert.equal(run.head_sha, source); assert.equal(job.run_id, runId); assert.equal(job.status, 'completed');
  return {runId, jobId, sourceCommit: source, status: job.status, conclusion: job.conclusion,
    url: job.html_url, startedAt: job.started_at, completedAt: job.completed_at,
    steps: job.steps.map(({name, conclusion, started_at, completed_at}) =>
      ({name, conclusion, startedAt: started_at, completedAt: completed_at}))};
}
const source = '584c61b61453878e1bd2631b48ca2fef5e9de4d4';
const linux = jobRecord(42085479173, 127449293466, source);
assert.equal(linux.conclusion, 'failure');
const raw = readFileSync(resolve(input, 'sgm-584-linux-search-contract-failure-20261105.log'), 'utf8');
assert(raw.includes('main.swift:30: Precondition failed'));
record('linux-job.json', {...linux, selectedFailure: 'main.swift:30: Precondition failed',
  compilationCompleted: true, requestComparisonFailed: true, responseGroupsExecuted: false,
  payloadEquivalenceEstablishedOnLinux: false, rootCauseConfirmed: false});

const android = jobRecord(42085479235, 127449295372, source);
assert.equal(android.conclusion, 'failure');
const archive = resolve(input, 'sgm-584-chat-network-13442587832.zip');
const zip = path => JSON.parse(execFileSync('unzip', ['-p', archive,
  `focused-safety-ui/chat-network-recovery/${path}`], {encoding: 'utf8'}));
const outcome = zip('network-readiness/outcome.json'), sample = zip('network-readiness/sample-058.json');
assert.equal(outcome.sampleCount, 59); assert.equal(outcome.failureKind, 'wifi-prerequisite-deadline');
assert.equal(outcome.flowCompleted, false); assert.equal(outcome.testAppsAbsent, true);
assert.equal(sample.ready, false); assert.equal(sample.wifiAvailable, true);
assert.deepEqual(sample.active.transports, ['cellular']);
assert.equal(sample.active.validated, true); assert.equal(Object.hasOwn(sample, 'availableCapabilities'), false);
record('android-job.json', {...android, artifactId: 13442587832, artifactSha256: sha(readFileSync(archive)),
  appFlowExecuted: false, rootCauseConfirmed: false, nondefaultWifiValidationKnown: false});
record('android-outcome.json', outcome); record('android-last-sample.json', sample);

const iphone = jobRecord(42080157901, 127433237718, '9ae6ea709da5f487a51a1542864d4cf4d0e8f4b1');
assert.equal(iphone.conclusion, 'cancelled');
assert.equal(iphone.steps.find(row => row.name === 'Compile app and all fixture test bundles').conclusion, 'cancelled');
assert.equal(iphone.steps.find(row => row.name === 'Run every built fixture test without rebuilding').conclusion, 'skipped');
assert.equal(iphone.steps.find(row => row.name === 'Dispose isolated simulator').conclusion, 'success');
const annotations = api('check-runs/127433237718/annotations').map(({annotation_level, message}) => ({annotation_level, message}));
assert(annotations.some(row => row.message.includes('maximum execution time of 50m0s')));
const artifacts = api('actions/runs/42080157901/artifacts'); assert.equal(artifacts.total_count, 0);
record('iphone-job.json', iphone); record('iphone-annotations.json', annotations);
record('iphone-artifacts.json', {total_count: artifacts.total_count});

const local = readFileSync(resolve(input, 'sgm-search-wire-json-recheck-20261105.log'), 'utf8');
for (const marker of ['Callable request bytes passed:', 'Search contract passed:', 'Search contract rejection passed:',
  'Search contract ownership passed:']) assert(local.includes(marker));
assert(!/error:|Fatal error|Precondition failed/.test(local)); record('local-contract.txt', local);
record('portal-before.json', {flows: content.flows.map(row => ({id: row.id, sha256: sha(JSON.stringify(row))})),
  updates: content.updates.map(row => sha(JSON.stringify(row))), blockers: sha(JSON.stringify(content.blockers))});
const paths = ['tests/fixtures/ios-search-contract/main.swift', 'scripts/qa/disposable-wifi-readiness.mjs',
  '.github/workflows/ios-mvp-verification.yml'];
const files = paths.map(path => {
  const bytes = readFileSync(resolve(root, path)), hash = sha(bytes);
  const archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(archive)) writeFileSync(archive, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(archive)), hash); return {path, sha256: hash};
});
record('source-sha256.json', {files});
record('summary.json', {checkedAt: '2026-11-05', scope: 'failed-verification-boundaries-and-unaccepted-candidates',
  localExactRequestAndResponseContractPassed: true, linuxExecutionAccepted: false,
  androidChatFlowExecuted: false, iphoneScreenTestsExecuted: false, iphoneDisposal: 'success',
  candidate: {runner: 'macos-26', standardPublicRunner: true, timeoutMinutes: 50, fixtureCases: 11,
    performanceImprovementProven: false, extraWorkers: 0, captureLimitChanged: false,
    readinessPredicateChanged: false, readinessBudgetChanged: false, availableNetworkCapabilitiesObservedOnlyOnNextRun: true},
  sdkBuildAccepted: false, fixtureUiAccepted: false, physicalDeviceAccepted: false,
  productionWrites: 0, newPhoneSessions: 0, providerRequests: 0, newMedia: 0, releaseComplete: false, records: [...records]});
console.log('Retained three actual stopped verification boundaries and the passing local wire contract; no native or release acceptance.');
