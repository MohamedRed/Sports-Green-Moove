import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {validateIosFixtureGate} from './ios-fixture-release-evidence.mjs';

const [source, runText, jobText, date, logPath] = process.argv.slice(2);
assert.match(source ?? '', /^[a-f0-9]{40}$/); assert.match(date ?? '', /^\d{4}-\d{2}-\d{2}$/); assert(isAbsolute(logPath ?? ''));
const runId = Number(runText), jobId = Number(jobText); assert(Number.isSafeInteger(runId) && Number.isSafeInteger(jobId));
const root = resolve(import.meta.dirname, '../..'), relative = `docs/release/evidence/ios-fixture-gate-${source.slice(0, 7)}-${date}`;
const folder = resolve(root, relative), api = path => JSON.parse(execFileSync('gh', ['api', `repos/MohamedRed/Sports-Green-Moove/${path}`], {encoding: 'utf8'}));
const run = api(`actions/runs/${runId}`), job = api(`actions/jobs/${jobId}`);
assert.equal(run.head_sha, source); assert.equal(job.head_sha, source); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
assert.equal(job.run_id, runId); assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
const artifacts = api(`actions/runs/${runId}/artifacts`); assert.equal(artifacts.total_count, 0);
const selected = readFileSync(logPath, 'utf8').split('\n').filter(line =>
  /Test Case '|Executed \d+ tests|\*\* TEST|: error:/.test(line) && !line.includes('check-ios-'));
const cases = selected.flatMap(line => {
  const match = line.match(/Test Case '-\[([^ ]+) ([^\]]+)\]' (passed|failed) \(([\d.]+) seconds\)/);
  return match ? [{suite: match[1], name: match[2], status: match[3], seconds: Number(match[4])}] : [];
});
assert.equal(cases.length, 11); assert(cases.every(row => row.status === 'passed'));
mkdirSync(folder, {recursive: true}); assert(!existsSync(resolve(folder, 'summary.json')));
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), records = [], sourceFiles = [], inputs = [];
function record(file, value) {
  const bytes = typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n';
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes));
  writeFileSync(resolve(folder, file), bytes, {flag: 'wx'}); records.push({file, sha256: sha(bytes)});
}
record('terminal-job.json', {sourceCommit: source, runId, jobId, status: job.status, conclusion: job.conclusion,
  startedAt: job.started_at, completedAt: job.completed_at, steps: job.steps.map(({name, conclusion}) => ({name, conclusion}))});
record('cases.json', cases); record('selected-tests.txt', selected.join('\n') + '\n'); record('artifacts.json', {total_count: artifacts.total_count});
const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', source, '--', 'ios', '.github/workflows/ios-mvp-verification.yml'],
  {cwd: root, encoding: 'utf8'}).trim().split('\n').filter(path => path !== 'ios/README.md');
for (const path of paths) {
  const bytes = execFileSync('git', ['show', source + ':' + path], {cwd: root}), hash = sha(bytes);
  if (path.startsWith('ios/')) inputs.push({path, sha256: hash});
  if (!/\.(swift|yml)$/.test(path)) continue;
  const archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(archive)) writeFileSync(archive, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(archive)), hash); sourceFiles.push({path, commit: source, sha256: hash});
}
record('source-sha256.json', {files: sourceFiles}); record('build-input-sha256.json', {files: inputs});
record('summary.json', {schemaVersion: 2, checkedAt: date, sourceCommit: source, runId, jobId, conclusion: 'success',
  sdkBuild: 'success', fixtureTests: 'success', plannedCases: 11, passedCases: 11, failedCases: 0, deadlineMinutes: 50,
  disposal: 'success', artifactCount: 0, newMedia: 0, sourceFixtureGateAccepted: true,
  nativeServiceIntegrationAccepted: false, physicalDeviceAccepted: false, releaseComplete: false, records: [...records]});
const reference = {source: relative + '/summary.json', sha256: sha(readFileSync(resolve(folder, 'summary.json')))};
validateIosFixtureGate(root, reference, {matchCurrentSources: false});
console.log(JSON.stringify({reference, sourceCommit: source, historicalGateValidated: true, currentSourcesNotYetAccepted: true}));
