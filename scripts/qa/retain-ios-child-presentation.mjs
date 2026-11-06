import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';

const [logPath, nativePath] = process.argv.slice(2);
for (const path of [logPath, nativePath]) assert(isAbsolute(path ?? ''));
const root = resolve(import.meta.dirname, '../..'), relative = 'docs/release/evidence/ios-child-presentation-2026-11-06';
const base = resolve(root, relative); assert(!existsSync(base));
const source = 'cc1e6d7a494c8aa534d94ee9c9b8d2815092b461';
const api = path => JSON.parse(execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/' + path], {encoding: 'utf8', timeout: 60000}));
const run = api('actions/runs/42297306643'), job = api('actions/jobs/128170594680');
assert.equal(run.head_sha, source); assert.equal(job.head_sha, source);
assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure'); assert.equal(job.run_id, run.id);
for (const [name, result] of [['Compile app and all fixture test bundles', 'success'],
  ['Run every built fixture test without rebuilding', 'failure'], ['Dispose isolated simulator', 'success']])
  assert.equal(job.steps.find(row => row.name === name).conclusion, result);
assert.equal(api('actions/runs/' + run.id + '/artifacts').total_count, 0);
const log = readFileSync(logPath, 'utf8'), native = readFileSync(nativePath);
assert(native.includes('ChildAccountPresentationChecks passed:')); assert(native.includes('SportsGreenMooveNativeChecks passed'));
assert(native.includes('OwnedPlacesAdapterChecks passed:'));
const selected = log.split('\n').filter(line => /Test Case '|Executed \d+ tests|\*\* TEST|: error:/.test(line));
const cases = selected.flatMap(line => {
  const match = /Test Case '-\[([^ ]+) ([^\]]+)\]' (passed|failed) \(([\d.]+) seconds\)/.exec(line);
  return match ? [{suite: match[1], name: match[2], status: match[3], seconds: Number(match[4])}] : [];
});
assert.equal(cases.length, 11); assert.equal(cases.filter(row => row.status === 'passed').length, 10);
assert.equal(cases.find(row => row.status === 'failed').name, 'testParentChoosesVerifiedChildBeyondFirstPageAndSavesTheirContact');
const failures = selected.filter(line => /: error:/.test(line)); assert.equal(failures.length, 3);
const context = log.split('\n').filter(line => /child-account\.back|child-invitation\.share|child-account\.entry\.parent/.test(line));
const sha = value => createHash('sha256').update(value).digest('hex'), records = [];
mkdirSync(base, {recursive: true});
function save(file, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes.toString()));
  writeFileSync(resolve(base, file), bytes, {flag: 'wx'}); records.push({file, sha256: sha(bytes)});
}
save('terminal-job.json', {sourceCommit: source, runId: run.id, jobId: job.id, status: job.status, conclusion: job.conclusion,
  startedAt: job.started_at, completedAt: job.completed_at, steps: job.steps.map(({name, conclusion}) => ({name, conclusion}))});
save('cases.json', cases); save('selected-tests.txt', selected.join('\n') + '\n');
save('selected-accessibility.txt', context.join('\n') + '\n'); save('native-checks.txt', native);
const files = [];
for (const path of ['ios/Sources/SportsGreenMooveApp/GuardianContactPicker.swift', 'ios/Sources/SportsGreenMooveApp/ChildAccountModels.swift',
  'ios/Sources/SportsGreenMooveApp/ChildAccountScreen.swift', 'ios/UITests/SportsGreenMooveUITests/ChildAccountFlowChecks.swift']) {
  const bytes = execFileSync('git', ['show', source + ':' + path], {cwd: root}), hash = sha(bytes), archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (existsSync(archive)) assert.equal(sha(readFileSync(archive)), hash); else writeFileSync(archive, bytes, {flag: 'wx'});
  files.push({path, commit: source, sha256: hash});
}
for (const path of ['ios/Sources/SportsGreenMooveApp/GuardianContactPicker.swift', 'ios/Sources/SportsGreenMooveApp/ChildAccountModels.swift',
  'ios/Tests/SportsGreenMooveNativeChecks/ChildAccountStateChecks.swift']) {
  const bytes = readFileSync(resolve(root, path)), hash = sha(bytes), archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (existsSync(archive)) assert.equal(sha(readFileSync(archive)), hash); else writeFileSync(archive, bytes, {flag: 'wx'});
  files.push({path, commit: 'candidate', sha256: hash});
}
save('source-sha256.json', {files});
save('summary.json', {checkedAt: '2026-11-06', sourceCommit: source, runId: run.id, jobId: job.id,
  sdkBuild: 'success', fixtureUi: 'failure', casesExecuted: 11, passed: 10, failed: 1, assertionFailures: 3,
  childCodeCasePassed: true, parentInvitationCasePassed: false, disposal: 'success', artifactCount: 0, deadlineMinutes: 50,
  nativePresentationChecksPassed: true, presentationCauseConfirmedByUiComparison: false,
  correctedSdkUiAccepted: false, physicalDeviceAccepted: false, releaseComplete: false, records: [...records]});
console.log(JSON.stringify({source: relative + '/summary.json', sha256: sha(readFileSync(resolve(base, 'summary.json')))}));
