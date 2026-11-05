import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..'), input = process.argv[2];
assert(input?.startsWith('/'));
const dir = resolve(root, 'docs/release/evidence/verification-followup-aac-2026-11-05');
const source = 'aac8de64f2da97b638079103a77a02d2b367d83f';
const api = path => JSON.parse(execFileSync('gh', ['api', `repos/MohamedRed/Sports-Green-Moove/${path}`], {encoding: 'utf8'}));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n', records = [];
mkdirSync(dir, {recursive: true}); assert(!existsSync(resolve(dir, 'summary.json')));
const attributes = resolve(dir, '.gitattributes');
if (!existsSync(attributes)) writeFileSync(attributes, 'deadline-baseline.txt -text -whitespace\n', {flag: 'wx'});
function record(file, value) {
  const bytes = typeof value === 'string' ? value : json(value);
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes));
  const path = resolve(dir, file);
  if (existsSync(path)) assert.equal(readFileSync(path, 'utf8'), bytes, 'Retained evidence must not change');
  else writeFileSync(path, bytes, {flag: 'wx'});
  records.push({file, sha256: sha(bytes)});
}
const metadata = api('actions/artifacts/13445937454'), bytes = readFileSync(resolve(input, 'sgm-aac-chat-network-13445937454.zip'));
assert.equal(metadata.workflow_run.head_sha, source); assert.equal(metadata.workflow_run.id, 42091345380);
assert.equal(metadata.digest, 'sha256:' + sha(bytes));
const retainedArchive = resolve(dir, 'android-artifact.zip');
if (!existsSync(retainedArchive)) writeFileSync(retainedArchive, bytes, {flag: 'wx'});
assert.equal(sha(readFileSync(retainedArchive)), sha(bytes));
record('android-artifact.json', {id: metadata.id, name: metadata.name, digest: metadata.digest,
  sizeBytes: metadata.size_in_bytes, runId: metadata.workflow_run.id, sourceCommit: source});
const archive = resolve(input, 'sgm-aac-chat-network-13445937454.zip');
const zip = path => JSON.parse(execFileSync('unzip', ['-p', archive,
  'focused-safety-ui/chat-network-recovery/' + path], {encoding: 'utf8'}));
const outcome = zip('network-readiness/outcome.json'); assert.equal(outcome.sampleCount, 60);
assert.equal(outcome.flowCompleted, false); assert.equal(outcome.testAppsAbsent, true);
assert.equal(outcome.failureKind, 'capability-command-unavailable');
const samples = Array.from({length: outcome.sampleCount}, (_, i) => zip(`network-readiness/sample-${String(i).padStart(3, '0')}.json`));
for (const [index, row] of samples.entries()) {
  assert.equal(row.index, index); assert.equal(row.runId, outcome.runId); assert.equal(row.ready, false);
  const wifi = row.availableCapabilities.filter(value => value.transports.includes('wifi'));
  assert.equal(wifi.length, 1); assert.equal(wifi[0].validated, false);
}
const defaultWifi = samples.filter(row => row.active.transports.join(',') === 'wifi' && !row.active.validated);
const defaultCellular = samples.filter(row => row.active.transports.join(',') === 'cellular' && row.active.validated);
assert.equal(defaultWifi.length, 5); assert.equal(defaultCellular.length, 55);
const history = zip('network-readiness/chat-network-validation-before.json');
const wifi = history.groups.find(row => row.transportMatched && row.transports.includes('wifi')); assert(wifi);
assert.equal(wifi.events.filter(row => row.probe === 'dns' && row.result === 'failure').length, 2);
assert.equal(wifi.events.filter(row => row.errorKind === 'dns-resolution').length, 3);
record('android-outcome.json', outcome); record('android-first-sample.json', samples[0]);
record('android-last-sample.json', samples.at(-1)); record('android-validation-history.json', history);
record('android-sample-summary.json', {sourceCommit: source, sampleCount: samples.length,
  allSamplesReady: false, defaultWifiUnvalidatedSamples: defaultWifi.length,
  defaultCellularValidatedSamples: defaultCellular.length, allAvailableWifiUnvalidated: true,
  snapshotNotAtomic: true, finalCommandFailureCauseDistinguished: false,
  liveBudgetExhaustionFlagAbsent: !Object.hasOwn(outcome, 'commandBudgetExhausted'), rootCauseConfirmed: false});
const android = api('actions/jobs/127469877171'); assert.equal(android.conclusion, 'failure');
assert.equal(android.run_id, 42091345380); assert.equal(android.status, 'completed');
record('android-job.json', {runId: android.run_id, jobId: android.id, sourceCommit: source,
  status: android.status, conclusion: android.conclusion, startedAt: android.started_at,
  completedAt: android.completed_at, steps: android.steps.map(({name, conclusion}) => ({name, conclusion}))});
const linux = api('actions/jobs/127469877249'), run = api('actions/runs/42091345475');
assert.equal(run.head_sha, source); assert.equal(linux.run_id, run.id);
const step = linux.steps.find(row => row.name === 'Verify iPhone search-to-booking contract without provider calls');
assert.equal(step.status, 'completed'); assert.equal(step.conclusion, 'success');
record('linux-contract-step.json', {runId: run.id, jobId: linux.id, sourceCommit: source, step: step.name,
  status: step.status, conclusion: step.conclusion, startedAt: step.started_at, completedAt: step.completed_at,
  wholeWorkflowAcceptedByThisRecord: false, nativeSdkAccepted: false, phoneAccepted: false});
for (const [file, name] of [['deadline-baseline.txt', 'sgm-readiness-deadline-baseline-20261105.log'],
  ['deadline-recheck.txt', 'sgm-readiness-deadline-recheck-20261105.log']]) {
  const value = readFileSync(resolve(input, name), 'utf8');
  assert(value.includes(file.includes('baseline') ? '# fail 3' : '# pass 21')); record(file, value);
}
const paths = ['scripts/qa/wait-disposable-wifi.mjs', 'tests/network-bootstrap-observation.test.mjs'];
const files = [];
function freeze(path, commit) {
  const bytes = commit ? execFileSync('git', ['show', `${commit}:${path}`], {cwd: root}) : readFileSync(resolve(root, path));
  const hash = sha(bytes), target = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(target)) writeFileSync(target, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(target)), hash); files.push({path, ...(commit ? {commit} : {}), sha256: hash});
}
for (const path of paths) freeze(path);
freeze(paths[0], source);
for (const path of ['ios/project.yml', 'functions/src/domain/teamPushRegistration.ts', 'functions/src/services/teamPushProvider.ts']) freeze(path, source);
record('source-sha256.json', {files});
record('summary.json', {checkedAt: '2026-11-05', sourceCommit: source,
  scope: 'controlled-linux-contract-pass-and-failed-android-network-prerequisite',
  linuxControlledContractStepAccepted: true, androidAppFlowExecuted: false, androidNetworkRootCauseConfirmed: false,
  deadlineClassificationRegressionReproduced: true, localDeadlineChecksPassed: true,
  actualFailureReclassifiedRetroactively: false, wifiReadinessPredicateChanged: false, wifiBudgetIncreased: false,
  dnsConfigurationChanged: false, newNetworkProbes: 0, newPhoneSessions: 0, providerRequests: 0, productionWrites: 0,
  iphoneClosedAppNotificationsImplemented: false, notificationPolicyChanged: false,
  sdkBuildAccepted: false, fixtureUiAccepted: false, physicalDeviceAccepted: false, releaseComplete: false, records: [...records]});
console.log('Retained the actual controlled Linux pass and unvalidated Wi-Fi/DNS history; deadline classification fix is local, not a network repair.');
