import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..'), input = process.argv[2]; assert(input?.startsWith('/'));
const folder = resolve(root, 'docs/release/evidence/ios-fixture-pass-d56-2026-11-05');
const source = 'd56cec66555cfb69a9f5ca336a637f99917376ed';
const api = path => JSON.parse(execFileSync('gh', ['api', `repos/MohamedRed/Sports-Green-Moove/${path}`], {encoding: 'utf8'}));
const run = api('actions/runs/42111120252'), job = api('actions/jobs/127539367855');
assert.equal(run.head_sha, source); assert.equal(run.conclusion, 'success'); assert.equal(job.run_id, run.id);
assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
for (const name of ['Compile app and all fixture test bundles', 'Run every built fixture test without rebuilding', 'Dispose isolated simulator'])
  assert.equal(job.steps.find(row => row.name === name)?.conclusion, 'success');
const artifacts = api(`actions/runs/${run.id}/artifacts`); assert.equal(artifacts.total_count, 0);
const log = readFileSync(resolve(input, 'sgm-ios-d56-terminal-20261105.log'), 'utf8');
const selected = log.split('\n').filter(line => line.includes('\tRun every built fixture test without rebuilding\t') &&
  /Test Case '|Executed \d+ tests|\*\* TEST|: error:/.test(line));
const cases = selected.flatMap(line => {
  const match = line.match(/Test Case '-\[([^ ]+) ([^\]]+)\]' (passed|failed) \(([\d.]+) seconds\)/);
  return match ? [{suite: match[1], name: match[2], status: match[3], seconds: Number(match[4])}] : [];
});
assert.equal(cases.length, 11); assert.equal(new Set(cases.map(row => row.name)).size, 11);
assert(cases.every(row => row.status === 'passed')); assert(!selected.some(line => line.includes(': error:')));
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), records = [], files = [];
mkdirSync(folder, {recursive: true}); assert(!existsSync(resolve(folder, 'summary.json')));
function record(file, value) {
  const bytes = typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n';
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes));
  writeFileSync(resolve(folder, file), bytes, {flag: 'wx'}); records.push({file, sha256: sha(bytes)});
}
record('terminal-job.json', {runId: run.id, jobId: job.id, sourceCommit: source, status: job.status, conclusion: job.conclusion,
  startedAt: job.started_at, completedAt: job.completed_at, steps: job.steps.map(({name, conclusion}) => ({name, conclusion}))});
record('cases.json', cases); record('selected-tests.txt', selected.join('\n') + '\n');
record('artifacts.json', {total_count: artifacts.total_count});
const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', source, '--', 'ios', '.github/workflows/ios-mvp-verification.yml'],
  {cwd: root, encoding: 'utf8'}).trim().split('\n').filter(path => /\.(swift|yml)$/.test(path));
for (const path of paths) {
  const bytes = execFileSync('git', ['show', source + ':' + path], {cwd: root}), hash = sha(bytes);
  const archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(archive)) writeFileSync(archive, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(archive)), hash); files.push({path, commit: source, sha256: hash});
}
record('source-sha256.json', {files});
record('summary.json', {checkedAt: '2026-11-05', sourceCommit: source, runId: run.id, jobId: job.id, sdkBuild: 'success',
  fixtureTests: 'success', conclusion: 'success', plannedCases: 11, passedCases: 11, failedCases: 0, deadlineMinutes: 50,
  disposal: 'success', artifactCount: 0, newMedia: 0, sourceFixtureGateAccepted: true,
  laterInputWaitCandidateAccepted: false, nativeServiceIntegrationAccepted: false, physicalDeviceAccepted: false,
  releaseComplete: false, records: [...records]});
console.log('Retained all eleven successful d56 screen cases, SDK build, disposal and zero artifacts; later input-wait candidate and physical/service acceptance remain separate.');
