import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {posix, resolve} from 'node:path';
import {parseDocument} from 'yaml';
import {assertIosPassPostdatesRecheck, validateIosFixtureRecheck} from './ios-fixture-recheck.mjs';

const repository = resolve(import.meta.dirname, '../..');
export const iosAutomatedEvidenceIds = ['ios_sdk_build_ci', 'ios_fixture_ui_ci'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = path => typeof path === 'string' && !path.includes('\\') && !posix.isAbsolute(path) &&
  posix.normalize(path) === path && !path.split('/').includes('..');
const json = (root, path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

export function iosBuildInputPaths(root) {
  const paths = [];
  function walk(path) {
    for (const entry of readdirSync(resolve(root, path), {withFileTypes: true})) {
      const file = path + '/' + entry.name;
      if (entry.isDirectory()) walk(file);
      else {assert(entry.isFile(), 'Build inputs cannot be symlinks'); paths.push(file);}
    }
  }
  for (const path of ['ios/Sources', 'ios/Tests', 'ios/UITests']) walk(path);
  for (const entry of readdirSync(resolve(root, 'ios'), {withFileTypes: true})) {
    if (!/\.(swift|yml)$/.test(entry.name)) continue;
    assert(entry.isFile(), 'Root build inputs cannot be symlinks'); paths.push('ios/' + entry.name);
  }
  return paths.sort();
}

export function validateIosFixtureGate(root, reference, {matchCurrentSources = true} = {}) {
  assert(canonical(reference?.source) && /^docs\/release\/evidence\/[^/]+\/summary\.json$/.test(reference.source));
  const folder = posix.dirname(reference.source), read = file => readFileSync(resolve(root, folder, file));
  assert.match(reference.sha256, /^[a-f0-9]{64}$/); assert.equal(sha(read('summary.json')), reference.sha256);
  const report = json(root, reference.source), files = new Map();
  for (const row of report.records) {
    assert(canonical(row.file) && !row.file.includes('/')); assert(!files.has(row.file));
    assert.equal(sha(read(row.file)), row.sha256, row.file); files.set(row.file, row.sha256);
  }
  for (const name of ['terminal-job.json', 'cases.json', 'selected-tests.txt', 'artifacts.json', 'source-sha256.json', 'build-input-sha256.json'])
    assert(files.has(name), 'Missing exact fixture evidence: ' + name);
  assert.equal(report.schemaVersion, 2); assert.match(report.sourceCommit, /^[a-f0-9]{40}$/);
  assert.match(report.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(report.checkedAt).toISOString().slice(0, 10), report.checkedAt);
  assert(Number.isSafeInteger(report.runId) && report.runId > 0); assert(Number.isSafeInteger(report.jobId) && report.jobId > 0);
  assert.equal(report.conclusion, 'success'); assert.equal(report.sdkBuild, 'success'); assert.equal(report.fixtureTests, 'success');
  assert.equal(report.plannedCases, 11); assert.equal(report.passedCases, 11); assert.equal(report.failedCases, 0);
  assert.equal(report.deadlineMinutes, 50); assert.equal(report.disposal, 'success');
  assert.equal(report.sourceFixtureGateAccepted, true); assert.equal(report.artifactCount, 0); assert.equal(report.newMedia, 0);
  for (const key of ['nativeServiceIntegrationAccepted', 'physicalDeviceAccepted', 'releaseComplete']) assert.equal(report[key], false);
  const job = JSON.parse(read('terminal-job.json')); assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  assert.equal(job.sourceCommit, report.sourceCommit); assert.equal(job.runId, report.runId); assert.equal(job.jobId, report.jobId);
  for (const name of ['Compile app and all fixture test bundles', 'Run every built fixture test without rebuilding', 'Dispose isolated simulator'])
    assert.equal(job.steps.find(row => row.name === name)?.conclusion, 'success');
  for (const name of ['Validate and collect only three approved synthetic captures', 'Retain approved iPhone captures for one day'])
    assert.equal(job.steps.find(row => row.name === name)?.conclusion, 'skipped');
  assert.equal(JSON.parse(read('artifacts.json')).total_count, 0);
  const source = JSON.parse(read('source-sha256.json')).files, archived = new Map();
  for (const row of source) {
    assert(canonical(row.path)); assert.equal(row.commit, report.sourceCommit); assert(!archived.has(row.path));
    assert.match(row.sha256, /^[a-f0-9]{64}$/);
    const bytes = readFileSync(resolve(root, 'docs/release/evidence/source-archive', row.sha256 + '.txt'));
    assert.equal(sha(bytes), row.sha256); archived.set(row.path, bytes);
  }
  const workflowPath = '.github/workflows/ios-mvp-verification.yml';
  const workflow = parseDocument(archived.get(workflowPath).toString()).toJSON();
  const gate = workflow.jobs['ios-fixture-verification']; assert.equal(gate['timeout-minutes'], 50); assert.equal(gate['runs-on'], 'macos-26');
  const cases = JSON.parse(read('cases.json')), expected = [...archived].filter(([path]) => path.startsWith('ios/UITests/'))
    .flatMap(([, bytes]) => [...bytes.toString().matchAll(/func (test\w+)\(/g)].map(match => match[1])).sort();
  assert.equal(expected.length, 11); assert.equal(cases.length, 11); assert(cases.every(row => row.status === 'passed'));
  assert.equal(new Set(cases.map(row => row.name)).size, 11); assert.deepEqual(cases.map(row => row.name).sort(), expected);
  const transcript = read('selected-tests.txt').toString(); assert(!transcript.includes(': error:'));
  for (const row of cases) assert(transcript.includes(` ${row.name}]' passed (`));
  const inputs = JSON.parse(read('build-input-sha256.json')).files;
  assert.equal(new Set(inputs.map(row => row.path)).size, inputs.length);
  for (const row of inputs) {assert(canonical(row.path) && row.path.startsWith('ios/')); assert.match(row.sha256, /^[a-f0-9]{64}$/);}
  assert.deepEqual(source.filter(row => row.path.startsWith('ios/')).map(row => row.path).sort(),
    inputs.filter(row => /\.(swift|yml)$/.test(row.path)).map(row => row.path).sort());
  for (const row of source.filter(row => row.path.startsWith('ios/')))
    assert.equal(inputs.find(input => input.path === row.path)?.sha256, row.sha256);
  if (matchCurrentSources) {
    assert.deepEqual(inputs.map(row => row.path).sort(), iosBuildInputPaths(root), 'Untested iPhone input inventory');
    for (const row of inputs) assert.equal(sha(readFileSync(resolve(root, row.path))), row.sha256, 'Untested iPhone input: ' + row.path);
    const current = parseDocument(readFileSync(resolve(root, workflowPath), 'utf8')).toJSON();
    for (const key of ['jobs', 'permissions', 'concurrency']) assert.deepEqual(current[key], workflow[key]);
  }
  return report;
}

export function assertCurrentIosAutomatedEvidence(manifest, {root = repository} = {}) {
  manifest ??= json(root, 'docs/release/evidence-manifest.json');
  const items = iosAutomatedEvidenceIds.map(id => {
    const rows = manifest.automatedUserFlowEvidence.items.filter(row => row.id === id); assert.equal(rows.length, 1); return rows[0];
  });
  for (const row of items) assert(['pending', 'passed'].includes(row.status));
  const rechecks = items.map(row => row.fixtureGateRecheck);
  if (rechecks.some(Boolean)) {
    assert.deepEqual(rechecks[0], rechecks[1]); validateIosFixtureRecheck(root, rechecks[0]);
  }
  if (items.every(row => row.status === 'pending')) return {status: 'pending'};
  assert(items.every(row => row.status === 'passed'), 'The complete fixture gate requires both source-bound entries');
  assert.deepEqual(items[0].fixtureGateProof, items[1].fixtureGateProof);
  const report = validateIosFixtureGate(root, items[0].fixtureGateProof);
  if (rechecks[0]) assertIosPassPostdatesRecheck(root, rechecks[0], items[0].fixtureGateProof.source);
  const url = `https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/${report.runId}/job/${report.jobId}`;
  for (const row of items) {
    assert.equal(row.appSourceCommit, report.sourceCommit);
    assert(row.evidenceRefs.includes(items[0].fixtureGateProof.source.replace('docs/release/', '')));
    assert(row.evidenceRefs.includes(url));
  }
  return {status: 'passed', sourceCommit: report.sourceCommit, runId: report.runId, jobId: report.jobId};
}
