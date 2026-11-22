import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root = resolve(import.meta.dirname, '../..'), input = process.argv[2]; assert(input?.startsWith('/'));
const folder = resolve(root, 'docs/release/evidence/ios-fixture-pass-a37-2026-11-05');
mkdirSync(folder, {recursive: true}); assert(!existsSync(resolve(folder, 'summary.json')));
const sha = value => createHash('sha256').update(value).digest('hex'), json = value => JSON.stringify(value, null, 2) + '\n';
const records = [], files = [];
const record = (name, value) => {
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(value.toString()));
  writeFileSync(resolve(folder, name), value, {flag: 'wx'}); records.push({file: name, sha256: sha(value)});
};
const run = JSON.parse(readFileSync(resolve(input, 'sgm-ios-a37-terminal-20261105.json')));
const source = 'a37cdbf263642d2a9a26a0af3cf2b0363886bb97';
assert.equal(run.headSha, source); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
const job = run.jobs[0], stage = name => job.steps.find(row => row.name === name)?.conclusion;
for (const name of ['Compile app and all fixture test bundles', 'Run every built fixture test without rebuilding', 'Dispose isolated simulator']) assert.equal(stage(name), 'success');
const artifacts = JSON.parse(readFileSync(resolve(input, 'sgm-ios-a37-artifacts-20261105.json'))); assert.equal(artifacts.total_count, 0);
const selected = readFileSync(resolve(input, 'sgm-ios-a37-terminal-20261105.log'), 'utf8').split('\n')
  .filter(line => line.includes('\tRun every built fixture test without rebuilding\t') && /Test Case '|Executed \d+ tests|\*\* TEST|: error:/.test(line));
const cases = selected.flatMap(line => {
  const match = line.match(/Test Case '-\[([^ ]+) ([^\]]+)\]' (passed|failed) \(([\d.]+) seconds\)/);
  return match ? [{suite: match[1], name: match[2], status: match[3], seconds: Number(match[4])}] : [];
});
assert.equal(cases.length, 11); assert.equal(new Set(cases.map(row => row.name)).size, 11); assert(cases.every(row => row.status === 'passed'));
record('run.json', json(run)); record('artifacts.json', json(artifacts)); record('cases.json', json(cases)); record('selected-tests.txt', selected.join('\n') + '\n');
const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', source, '--', 'ios', '.github/workflows/ios-mvp-verification.yml'],
  {cwd: root, encoding: 'utf8'}).trim().split('\n').filter(path => /\.(swift|yml)$/.test(path));
for (const path of paths) {
  const bytes = execFileSync('git', ['show', source + ':' + path], {cwd: root}), hash = sha(bytes);
  const archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(archive)) writeFileSync(archive, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(archive)), hash); files.push({path, commit: source, sha256: hash});
}
record('source-sha256.json', json({files}));
record('summary.json', json({checkedAt: '2026-11-05', scope: 'source-bound-sdk-and-eleven-synthetic-iphone-screen-cases-not-current-search-or-physical',
  runId: 42064566624, jobId: job.databaseId, sourceCommit: source, conclusion: 'success', sdkBuild: 'success', fixtureTests: 'success',
  plannedCases: 11, passedCases: 11, failedCases: 0, deadlineMinutes: 50, disposal: 'success', artifactCount: 0, newMedia: 0,
  sourceFixtureGateAccepted: true, currentSearchCandidateAccepted: false, nativeServiceIntegrationAccepted: false,
  providerAuthenticationAccepted: false, physicalDeviceAccepted: false, releaseComplete: false, records: [...records]}));
console.log('Retained the exact successful SDK build, eleven passing fixture cases, disposal and empty artifacts for a37cdbf only.');
