import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname, posix, resolve} from 'node:path';
import {parseDocument} from 'yaml';

export const iosRecheckFolder = 'docs/release/evidence/ios-fixture-recheck-385a6a4-2026-11-05';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = path => typeof path === 'string' && !path.includes('\\') && !posix.isAbsolute(path) &&
  posix.normalize(path) === path && !path.split('/').includes('..');

export function validateIosFixtureRecheck(root, reference) {
  assert(canonical(reference?.source) && /^docs\/release\/evidence\/[^/]+\/summary\.json$/.test(reference.source));
  const base = resolve(root, dirname(reference.source)), bytes = file => readFileSync(resolve(base, file));
  assert.match(reference.sha256, /^[a-f0-9]{64}$/); assert.equal(sha(bytes('summary.json')), reference.sha256);
  const report = JSON.parse(bytes('summary.json')), files = new Set();
  for (const row of report.records) {
    assert(canonical(row.file) && !row.file.includes('/') && !files.has(row.file)); files.add(row.file);
    assert.equal(sha(bytes(row.file)), row.sha256, row.file);
  }
  for (const file of ['terminal-job.json', 'cases.json', 'selected-tests.txt', 'artifacts.json', 'source-sha256.json']) assert(files.has(file));
  assert.equal(report.schemaVersion, 1); assert.match(report.sourceCommit, /^[a-f0-9]{40}$/);
  assert.match(report.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(report.checkedAt).toISOString().slice(0, 10), report.checkedAt);
  assert.equal(report.conclusion, 'failure'); assert.equal(report.sdkBuild, 'success');
  assert.equal(report.casesExecuted, 11); assert(report.failed > 0); assert.equal(report.passed + report.failed, 11);
  assert.equal(report.deadlineMinutes, 50); assert.equal(report.disposal, 'success');
  for (const key of ['artifactCount', 'newMedia']) assert.equal(report[key], 0);
  for (const key of ['causeConfirmed', 'physicalDeviceAccepted', 'releaseComplete']) assert.equal(report[key], false);
  const job = JSON.parse(bytes('terminal-job.json')); assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  assert.equal(job.sourceCommit, report.sourceCommit); assert.equal(job.runId, report.runId); assert.equal(job.jobId, report.jobId);
  assert(Number.isSafeInteger(job.runId) && job.runId > 0); assert(Number.isSafeInteger(job.jobId) && job.jobId > 0);
  assert(Number.isFinite(Date.parse(job.completedAt))); assert(Date.parse(job.startedAt) < Date.parse(job.completedAt));
  for (const [name, conclusion] of [['Compile app and all fixture test bundles', 'success'],
    ['Run every built fixture test without rebuilding', 'failure'], ['Dispose isolated simulator', 'success'],
    ['Validate and collect only three approved synthetic captures', 'skipped'], ['Retain approved iPhone captures for one day', 'skipped']])
    assert.equal(job.steps.find(row => row.name === name)?.conclusion, conclusion);
  assert.equal(JSON.parse(bytes('artifacts.json')).total_count, 0);
  const cases = JSON.parse(bytes('cases.json')), source = JSON.parse(bytes('source-sha256.json')).files, expected = [], archivedSources = new Map();
  assert.equal(new Set(source.map(row => row.path)).size, source.length);
  for (const row of source) {
    assert(canonical(row.path)); assert.equal(row.commit, report.sourceCommit); assert.match(row.sha256, /^[a-f0-9]{64}$/);
    const archived = readFileSync(resolve(root, 'docs/release/evidence/source-archive', row.sha256 + '.txt'));
    assert.equal(sha(archived), row.sha256);
    archivedSources.set(row.path, archived);
    if (row.path.startsWith('ios/UITests/')) expected.push(...[...archived.toString().matchAll(/func (test\w+)\(/g)].map(match => match[1]));
  }
  const workflow = parseDocument(archivedSources.get('.github/workflows/ios-mvp-verification.yml').toString()).toJSON();
  assert.equal(workflow.jobs['ios-fixture-verification']['timeout-minutes'], 50);
  assert.equal(workflow.jobs['ios-fixture-verification']['runs-on'], 'macos-26');
  assert.equal(expected.length, 11); assert.equal(cases.length, 11);
  assert.deepEqual(cases.map(row => row.name).sort(), expected.sort());
  assert.equal(cases.filter(row => row.status === 'passed').length, report.passed);
  assert.equal(cases.filter(row => row.status === 'failed').length, report.failed);
  const transcript = bytes('selected-tests.txt').toString();
  for (const row of cases) assert(transcript.includes(` ${row.name}]' ${row.status} (`));
  assert.equal(transcript.split('\n').filter(line => /: error: -\[SportsGreenMooveUITests\./.test(line)).length, report.assertionFailures);
  return {...report, completedAt: job.completedAt};
}

export function assertIosPassPostdatesRecheck(root, reference, proofSource) {
  const observation = validateIosFixtureRecheck(root, reference);
  const job = JSON.parse(readFileSync(resolve(root, dirname(proofSource), 'terminal-job.json')));
  assert(Date.parse(job.completedAt) > Date.parse(observation.completedAt),
    'A later failed iPhone recheck invalidates the inherited pass');
}
