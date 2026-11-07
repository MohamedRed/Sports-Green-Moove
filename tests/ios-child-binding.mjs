import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';
import {iosChildBinding, iosChildBindingProgress} from '../partner-portal/ios-child-binding.mjs';

const root = new URL('../', import.meta.url), folder = 'docs/release/evidence/ios-child-binding-2026-11-06/';
const bytes = path => readFileSync(new URL(path, root));
const json = path => JSON.parse(bytes(path)), sha = value => createHash('sha256').update(value).digest('hex');

test('the iPhone compiler failure is source-bound, before every fixture case, not a deadline expiration', () => {
  const summary = json(folder + 'summary.json');
  for (const row of summary.records) assert.equal(sha(bytes(folder + row.file)), row.sha256, row.file);
  const job = json(folder + 'terminal-job.json');
  assert.equal(job.sourceCommit, '43aec2bf3a825bf4e0bfe90fd38305d435e430e3');
  assert.equal(job.runId, 42291733409); assert.equal(job.jobId, 128154620043);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  const step = name => job.steps.find(row => row.name === name).conclusion;
  assert.equal(step('Compile app and all fixture test bundles'), 'failure');
  assert.equal(step('Run every built fixture test without rebuilding'), 'skipped');
  assert.equal(step('Dispose isolated simulator'), 'success');
  assert.equal(summary.fixtureCasesExecuted, 0); assert.equal(summary.plannedCases, 11);
  assert.equal(summary.deadlineMinutes, 50); assert.equal(summary.timedOut, false);
  assert.equal(json(folder + 'artifacts.json').total_count, 0);
  const crash = bytes(folder + 'compiler-failure.txt').toString();
  assert.match(crash, /Apple Swift version 6\.3\.3/);
  assert.match(crash, /While evaluating request IRGenRequest.*ChildAccountScreen\.swift/);
  assert(crash.includes('$sSSScA_pSgIeAghgg_SSIeAghn_TR'));
  for (const key of ['bindingConversionCauseConfirmedByComparison', 'correctedSdkBuildAccepted',
    'correctedScreenFlowAccepted', 'physicalDeviceAccepted', 'releaseComplete']) assert.equal(summary[key], false);
});

test('the candidate changes only the binding closure and retains the actual guarded edit method', () => {
  const paths = json(folder + 'source-sha256.json').files;
  for (const row of paths) assert.equal(sha(bytes('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
  const screen = paths.find(row => row.path.endsWith('/ChildAccountScreen.swift'));
  const original = bytes('docs/release/evidence/source-archive/' + screen.sha256 + '.txt').toString();
  assert.equal(original.split('set: state.edit').length, 2);
  assert.equal(bytes(screen.path).toString(), original.replace('set: state.edit', 'set: { state.edit($0) }'));
  for (const row of paths.filter(row => row !== screen)) {
    if (row.path === '.github/workflows/ios-mvp-verification.yml') {
      const originalWorkflow = parseDocument(bytes('docs/release/evidence/source-archive/' + row.sha256 + '.txt').toString()).toJSON();
      const currentWorkflow = parseDocument(bytes(row.path).toString()).toJSON();
      const addedPaths = currentWorkflow.on.pull_request.paths;
      assert.deepEqual(addedPaths.filter(path => originalWorkflow.on.pull_request.paths.includes(path)), originalWorkflow.on.pull_request.paths);
      assert.equal(new Set(addedPaths).size, addedPaths.length);
      currentWorkflow.on.pull_request.paths = originalWorkflow.on.pull_request.paths;
      assert.deepEqual(currentWorkflow, originalWorkflow);
    } else assert.equal(sha(bytes(row.path)), row.sha256);
  }
  assert.doesNotMatch(bytes(screen.path).toString(), /assumeIsolated|unsafeBitCast|nonisolated|@unchecked|MainActor\.run/);
});

test('the existing web command runs the binding regression without changing the native workload', () => {
  const workflow = parseDocument(bytes('.github/workflows/web-integration-smoke.yml').toString()).toJSON();
  for (const event of ['pull_request', 'push']) assert(workflow.on[event].paths.includes('tests/ios-child-binding.mjs'));
  assert(workflow.jobs.smoke.steps.some(row => row.run?.includes('tests/ios-child-account.test.mjs')));
  assert(bytes('tests/ios-child-account.test.mjs').toString().includes("import './ios-child-binding.mjs'"));
});

test('the portal shows the pending iPhone correction and distinct Android interruption without losing history', () => {
  const {recent, previous} = partitionUpdates(content.updates);
  assert.deepEqual(content.iosChildBinding, iosChildBinding);
  assert.equal(sha(bytes(iosChildBinding.source)), iosChildBinding.sha256);
  assert(content.updates.some(row => row.source === iosChildBindingProgress.source));
  assert(recent.some(row => row.flow === 'child-emergency' || row.coversFlows?.includes('child-emergency')));
  assert(content.updates.some(row => row.source.includes('native-cutoff-142-2026-11-06')));
  assert(recent.some(row => row.flow === 'native-startup' || row.coversFlows?.includes('native-startup')));
  for (const source of ['ios-child-account-2026-11-06', 'ios-fixture-gate-6fb6487', 'ios-fixture-recheck-9640d8b'])
    assert(previous.some(row => row.source.includes(source)));
  assert.equal(content.flows.length, 34);
  assert.match(iosChildBindingProgress.text, /n’ont pas pu démarrer/);
  assert.match(iosChildBindingProgress.text, /reste à faire/);
  assert.doesNotMatch(iosChildBindingProgress.title + iosChildBindingProgress.text, /Firebase|BrowserStack|SDK|Swift|CI\b/);
});
