import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';

const input = process.argv[2]; assert(isAbsolute(input ?? ''));
const root = resolve(import.meta.dirname, '../..'), relative = 'docs/release/evidence/ios-child-binding-2026-11-06';
const output = resolve(root, relative); assert(!existsSync(output));
const source = '43aec2bf3a825bf4e0bfe90fd38305d435e430e3';
const sha = value => createHash('sha256').update(value).digest('hex');
const api = path => JSON.parse(execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/' + path], {encoding: 'utf8', timeout: 60000}));
const run = api('actions/runs/42291733409'), job = api('actions/jobs/128154620043');
assert.equal(run.head_sha, source); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
assert.equal(job.run_id, run.id); assert.equal(job.head_sha, source); assert.equal(job.conclusion, 'failure');
for (const [name, result] of [['Compile app and all fixture test bundles', 'failure'],
  ['Run every built fixture test without rebuilding', 'skipped'], ['Dispose isolated simulator', 'success']])
  assert.equal(job.steps.find(row => row.name === name).conclusion, result);
const artifacts = api('actions/runs/' + run.id + '/artifacts'); assert.equal(artifacts.total_count, 0);
const original = readFileSync(input), log = original.toString();
assert(!/Test Case '-\[SportsGreenMooveUITests\./.test(log));
const selected = log.split('\n').filter(line => line.includes('\tCompile app and all fixture test bundles\t') &&
  /Command SwiftCompile failed|Please submit a bug report|Apple Swift version|While evaluating request IRGenRequest|While emitting IR SIL function|report_at_maximum_capacity|SmallVectorBase|DiagnosticHelper|\*\* TEST BUILD FAILED \*\*|Process completed with exit code 65/.test(line)).join('\n') + '\n';
assert(selected.includes('ChildAccountScreen.swift')); assert(selected.includes('$sSSScA_pSgIeAghgg_SSIeAghn_TR'));
assert(selected.includes('Apple Swift version 6.3.3')); assert(selected.includes('** TEST BUILD FAILED **'));
mkdirSync(output, {recursive: true}); const records = [];
function save(file, value) {
  const bytes = Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n';
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes));
  writeFileSync(resolve(output, file), bytes, {flag: 'wx'}); records.push({file, sha256: sha(bytes)});
}
save('terminal-job.json', {runId: run.id, jobId: job.id, sourceCommit: source, status: job.status,
  conclusion: job.conclusion, startedAt: job.started_at, completedAt: job.completed_at,
  steps: job.steps.map(({name, conclusion}) => ({name, conclusion}))});
save('compiler-failure.txt', selected);
save('artifacts.json', {total_count: artifacts.total_count});
const files = [];
for (const path of ['ios/Sources/SportsGreenMooveApp/ChildAccountScreen.swift',
  'ios/Sources/SportsGreenMooveApp/ChildAccountState.swift', '.github/workflows/ios-mvp-verification.yml']) {
  const bytes = execFileSync('git', ['show', source + ':' + path], {cwd: root}), hash = sha(bytes);
  const archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (existsSync(archive)) assert.equal(sha(readFileSync(archive)), hash); else writeFileSync(archive, bytes, {flag: 'wx'});
  files.push({path, commit: source, sha256: hash});
}
save('source-sha256.json', {files});
save('summary.json', {checkedAt: '2026-11-06', scope: 'sdk-compiler-crash-before-screen-tests-not-timeout-or-flow-proof',
  sourceCommit: source, runId: run.id, jobId: job.id, originalJobLogBytes: original.length, originalJobLogSha256: sha(original),
  sdkBuild: 'failure', compilerVersion: '6.3.3', compilerCrashFile: 'ChildAccountScreen.swift',
  compilerCrashSymbol: '$sSSScA_pSgIeAghgg_SSIeAghn_TR', fixtureCasesExecuted: 0, plannedCases: 11,
  disposal: 'success', artifactCount: 0, deadlineMinutes: 50, timedOut: false,
  bindingConversionCauseConfirmedByComparison: false, correctedSdkBuildAccepted: false,
  correctedScreenFlowAccepted: false, physicalDeviceAccepted: false, releaseComplete: false, records: [...records]});
console.log(JSON.stringify({source: relative + '/summary.json', sha256: sha(readFileSync(resolve(output, 'summary.json')))}));
