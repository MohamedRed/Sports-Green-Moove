import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {validateIosFixtureRecheck} from './ios-fixture-recheck.mjs';

const [source, runText, jobText, date, logPath] = process.argv.slice(2);
assert.match(source ?? '', /^[a-f0-9]{40}$/); assert.match(date ?? '', /^\d{4}-\d{2}-\d{2}$/); assert(isAbsolute(logPath ?? ''));
const runId = Number(runText), jobId = Number(jobText), root = resolve(import.meta.dirname, '../..');
const api = path => JSON.parse(execFileSync('gh', ['api', `repos/MohamedRed/Sports-Green-Moove/${path}`], {encoding: 'utf8'}));
const run = api(`actions/runs/${runId}`), job = api(`actions/jobs/${jobId}`), artifacts = api(`actions/runs/${runId}/artifacts`);
assert.equal(run.head_sha, source); assert.equal(job.head_sha, source); assert.equal(run.status, 'completed');
assert.equal(run.conclusion, 'failure'); assert.equal(job.run_id, runId); assert.equal(job.conclusion, 'failure');
assert.equal(artifacts.total_count, 0);
const selected = readFileSync(logPath, 'utf8').split('\n').filter(line =>
  /Test Case '|Executed \d+ tests|\*\* TEST|: error:/.test(line) && !line.includes('check-ios-'));
const cases = selected.flatMap(line => {
  const match = line.match(/Test Case '-\[([^ ]+) ([^\]]+)\]' (passed|failed) \(([\d.]+) seconds\)/);
  return match ? [{suite: match[1], name: match[2], status: match[3], seconds: Number(match[4])}] : [];
});
assert.equal(cases.length, 11); assert(cases.some(row => row.status === 'failed'));
const relative = `docs/release/evidence/ios-fixture-recheck-${source.slice(0, 7)}-${date}`, folder = resolve(root, relative);
assert(!existsSync(folder)); mkdirSync(folder);
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), records = [];
function record(file, value) {
  const bytes = typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n';
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes));
  writeFileSync(resolve(folder, file), bytes, {flag: 'wx'}); records.push({file, sha256: sha(bytes)});
}
record('terminal-job.json', {sourceCommit: source, runId, jobId, status: job.status, conclusion: job.conclusion,
  startedAt: job.started_at, completedAt: job.completed_at, steps: job.steps.map(({name, conclusion}) => ({name, conclusion}))});
record('cases.json', cases); record('selected-tests.txt', selected.join('\n') + '\n'); record('artifacts.json', {total_count: 0});
const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', source, '--', 'ios', '.github/workflows/ios-mvp-verification.yml'],
  {cwd: root, encoding: 'utf8'}).trim().split('\n').filter(path => /\.(swift|yml)$/.test(path));
const files = paths.map(path => {
  const bytes = execFileSync('git', ['show', `${source}:${path}`], {cwd: root}), hash = sha(bytes);
  const target = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(target)) writeFileSync(target, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(target)), hash); return {path, commit: source, sha256: hash};
});
record('source-sha256.json', {files});
record('summary.json', {schemaVersion: 1, checkedAt: date, sourceCommit: source, runId, jobId,
  conclusion: 'failure', sdkBuild: 'success', casesExecuted: cases.length,
  passed: cases.filter(row => row.status === 'passed').length, failed: cases.filter(row => row.status === 'failed').length,
  assertionFailures: selected.filter(line => /: error: -\[SportsGreenMooveUITests\./.test(line)).length,
  disposal: 'success', deadlineMinutes: 50, artifactCount: 0, newMedia: 0,
  causeConfirmed: false, physicalDeviceAccepted: false, releaseComplete: false, records: [...records]});
const reference = {source: relative + '/summary.json', sha256: sha(readFileSync(resolve(folder, 'summary.json')))};
validateIosFixtureRecheck(root, reference); console.log(JSON.stringify({reference, passed: cases.filter(row => row.status === 'passed').length}));
