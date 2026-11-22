import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..'), input = process.argv[2];
assert(input?.startsWith('/'));
const folder = resolve(root, 'docs/release/evidence/ios-fixture-failure-d51-2026-11-05');
assert(!existsSync(resolve(folder, 'summary.json'))); mkdirSync(folder, {recursive: true});
const json = value => JSON.stringify(value, null, 2) + '\n';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const write = (name, value) => writeFileSync(resolve(folder, name), value, {flag: 'wx'});
const records = [], files = [];
const outcomes = [];
for (const [name, runId, source, resultFile, logFile, artifactsFile] of [
  ['eef', 42026680118, 'eef1c4cb1f7b4f773ddfbf8a47a28e767a85564a', 'sgm-ios-eef-terminal-run-20261105.json',
    'sgm-ios-eef-terminal-20261105.log', 'sgm-ios-eef-artifacts-20261105.json'],
  ['d51', 42030107261, 'd51c0f8c50fd2c148bf751bec07a4a380bac0ae4', 'sgm-ios-d51-latest-20261105.json',
    'sgm-ios-d51-terminal-20261105.log', 'sgm-ios-d51-artifacts-20261105.json'],
]) {
  const original = JSON.parse(readFileSync(resolve(input, resultFile))), artifacts = JSON.parse(readFileSync(resolve(input, artifactsFile)));
  assert.equal(original.status, 'completed'); assert.equal(original.headSha, source); assert.equal(artifacts.total_count, 0);
  const job = original.jobs[0]; assert.equal(job.steps.find(row => row.name === 'Compile app and all fixture test bundles').conclusion, 'success');
  assert.equal(job.steps.find(row => row.name === 'Dispose isolated simulator').conclusion, 'success');
  const lines = readFileSync(resolve(input, logFile), 'utf8').split('\n').filter(line =>
    line.includes('\tRun every built fixture test without rebuilding\t') && /Test Case '|Executed \d+ tests|: error:|\*\* TEST/.test(line));
  const cases = lines.flatMap(line => {
    const match = line.match(/Test Case '-\[([^ ]+) ([^\]]+)\]' (passed|failed) \(([\d.]+) seconds\)/);
    return match ? [{suite: match[1], name: match[2], status: match[3], seconds: Number(match[4])}] : [];
  });
  if (name === 'eef') {assert.equal(original.conclusion, 'cancelled'); assert.equal(cases.length, 1);}
  else {assert.equal(original.conclusion, 'failure'); assert.equal(cases.length, 11); assert.equal(cases.filter(row => row.status === 'failed').length, 3);}
  for (const [file, bytes] of [[name + '-run.json', json(original)], [name + '-selected-tests.txt', lines.join('\n') + '\n'],
    [name + '-artifacts.json', json(artifacts)], [name + '-cases.json', json(cases)]]) {
    assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes));
    write(file, bytes); records.push({file, sha256: sha(bytes)});
  }
  const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', source, '--', 'ios', '.github/workflows/ios-mvp-verification.yml'],
    {cwd: root, encoding: 'utf8'}).trim().split('\n');
  for (const path of paths) {
    const bytes = execFileSync('git', ['show', source + ':' + path], {cwd: root}); const hash = sha(bytes);
    const archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
    if (!existsSync(archive)) writeFileSync(archive, bytes, {flag: 'wx'});
    assert.equal(sha(readFileSync(archive)), hash); files.push({path, commit: source, sha256: hash});
  }
  outcomes.push({runId, commit: source, conclusion: original.conclusion, sdkBuild: 'success', fixtureCasesCompleted: cases.length,
    passedCases: cases.filter(row => row.status === 'passed').length, failedCases: cases.filter(row => row.status === 'failed').length,
    plannedCases: 11, disposal: 'success', artifactCount: 0});
}
write('source-sha256.json', json({files}));
write('summary.json', json({checkedAt: '2026-11-05', scope: 'terminal-sdk-build-and-fixture-results-not-real-service-or-physical',
  outcomes, records, deadlineMinutes: 50, plannedCases: 11, newMedia: 0, fullFixtureGateAccepted: false,
  nativeServiceIntegrationAccepted: false, physicalDeviceAccepted: false, releaseComplete: false}));
console.log('Retained EEF partial deadline and D51 full eleven-case failure, with zero artifacts and successful disposal.');
