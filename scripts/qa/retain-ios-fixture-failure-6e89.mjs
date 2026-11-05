import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {content} from '../../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '../..'), input = process.argv[2];
assert(input?.startsWith('/'), 'Supply the absolute retained terminal log path');
const folder = resolve(root, 'docs/release/evidence/ios-fixture-failure-6e89-2026-11-05');
const source = '6e898a90b23fc0c2ea8c951af02a7246c760ad84';
const api = path => JSON.parse(execFileSync('gh', ['api', `repos/MohamedRed/Sports-Green-Moove/${path}`], {encoding: 'utf8'}));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const log = readFileSync(input, 'utf8');
const cases = [...log.matchAll(/Test Case '-\[SportsGreenMooveUITests\.(\w+) (\w+)\]' (passed|failed) \(([\d.]+) seconds\)\./g)]
  .map(([, suite, name, status, seconds]) => ({suite, name, status, seconds: Number(seconds)}));
assert.equal(cases.length, 11); assert.equal(cases.filter(row => row.status === 'passed').length, 9);
assert.deepEqual(cases.filter(row => row.status === 'failed').map(row => row.name), [
  'testTrackingAndSeatChangesInvalidateTheAcceptedSelection', 'testPublishSearchAndBookingIdentifiers']);
const failures = log.split('\n').filter(line => /: error: -\[SportsGreenMooveUITests\./.test(line));
assert.equal(failures.length, 4); assert(log.includes('Executed 11 tests, with 4 failures (0 unexpected)'));
const run = api('actions/runs/42096199969'), job = api('actions/jobs/127490262040');
assert.equal(run.head_sha, source); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
assert.equal(job.run_id, run.id); assert.equal(job.conclusion, 'failure');
for (const [name, conclusion] of [['Compile app and all fixture test bundles', 'success'],
  ['Run every built fixture test without rebuilding', 'failure'], ['Dispose isolated simulator', 'success']])
  assert.equal(job.steps.find(row => row.name === name).conclusion, conclusion);
const artifacts = api(`actions/runs/${run.id}/artifacts`); assert.equal(artifacts.total_count, 0);
const annotations = api(`check-runs/${job.id}/annotations`).map(({annotation_level, message}) => ({annotation_level, message}));
assert(annotations.some(row => row.message.includes('exit code 65')));
assert(!annotations.some(row => row.message.includes('maximum execution time')));
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
record('annotations.json', annotations); record('artifacts.json', {total_count: artifacts.total_count});
record('portal-before.json', {flows: content.flows.map(row => ({id: row.id, sha256: sha(JSON.stringify(row))})),
  updates: content.updates.filter(row => row.source !== 'docs/release/evidence/ios-fixture-failure-6e89-2026-11-05/README.md')
    .map(row => sha(JSON.stringify(row))), blockers: sha(JSON.stringify(content.blockers))});
const paths = ['.github/workflows/ios-mvp-verification.yml', 'ios/Sources/SportsGreenMooveApp/UITestAppStateFactory.swift',
  'ios/UITests/SportsGreenMooveUITests/EmergencyContactFlowTests.swift',
  'ios/UITests/SportsGreenMooveUITests/OwnedSearchFlowChecks.swift', 'ios/UITests/SportsGreenMooveUITests/SportsGreenMooveUITests.swift'];
const files = paths.map(path => {
  const bytes = execFileSync('git', ['show', `${source}:${path}`], {cwd: root}), hash = sha(bytes);
  const target = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(target)) writeFileSync(target, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(target)), hash); return {path, commit: source, sha256: hash};
});
record('source-sha256.json', {files});
record('summary.json', {checkedAt: '2026-11-05', sourceCommit: source, runId: run.id, jobId: job.id,
  conclusion: 'failure', sdkBuild: 'success', fixtureStep: 'failure', casesExecuted: 11, passed: 9, failed: 2,
  assertionFailures: 4, disposal: 'success', artifactCount: 0, deadlineMinutes: 50, timedOut: false,
  emergencyCasePassedInThisRun: true, emergencyReliabilityAccepted: false, bookingUiCauseConfirmed: false,
  subsequentCandidateCommit: '35f23fc6ae4f5fba8bc93ded64050df4d38b6d46', subsequentCandidateUiAccepted: false,
  physicalDeviceAccepted: false, releaseComplete: false, productionWrites: 0, providerRequests: 0,
  newPhoneSessions: 0, newMedia: 0, records: [...records]});
console.log('Retained eleven iPhone outcomes: nine pass, two fail; no deadline cancellation or release acceptance.');
