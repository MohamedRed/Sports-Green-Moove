import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosCurrentFixtureFailure, iosCurrentFixtureFailureProgress} from '../partner-portal/ios-current-fixture-failure.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const json = path => JSON.parse(read(path));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const folder = 'docs/release/evidence/ios-fixture-failure-d51-2026-11-05/';
const report = json(iosCurrentFixtureFailure.source);
test('EEF partial cancellation and D51 full failure retain original source and terminal outcomes', () => {
  for (const row of report.records) assert.equal(sha(read(folder + row.file)), row.sha256);
  for (const row of json(iosCurrentFixtureFailure.checksums).files)
    assert.equal(sha(readFileSync(new URL('../docs/release/evidence/source-archive/' + row.sha256 + '.txt', import.meta.url))), row.sha256);
  const [eef, d51] = report.outcomes;
  assert.equal(eef.conclusion, 'cancelled'); assert.equal(eef.fixtureCasesCompleted, 1); assert.equal(eef.passedCases, 1);
  assert.equal(d51.conclusion, 'failure'); assert.equal(d51.fixtureCasesCompleted, 11); assert.equal(d51.passedCases, 8); assert.equal(d51.failedCases, 3);
  for (const row of report.outcomes) {assert.equal(row.sdkBuild, 'success'); assert.equal(row.disposal, 'success'); assert.equal(row.artifactCount, 0);}
  const cases = json(folder + 'd51-cases.json');
  assert.deepEqual(cases.filter(row => row.status === 'failed').map(row => row.name), [
    'testAuthFlowIdentifiers', 'testMessagesChatAndRatingIdentifiers', 'testSecondaryFlowIdentifiers']);
  const text = read(folder + 'd51-selected-tests.txt');
  assert.equal((text.match(/: error:/g) ?? []).length, 5);
  assert(text.includes('Missing profile city entry')); assert(text.includes('Message de test iso'));
  assert(text.includes('membership.approve.ui-parent_club-tennis'));
});
test('eleven cases, unchanged approved deadline, empty artifacts and unaccepted release remain distinct', () => {
  assert.equal(report.deadlineMinutes, 50); assert.equal(report.plannedCases, 11); assert.equal(report.newMedia, 0);
  for (const key of ['fullFixtureGateAccepted', 'nativeServiceIntegrationAccepted', 'physicalDeviceAccepted', 'releaseComplete']) assert.equal(report[key], false);
  const workflow = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  assert.equal(workflow.jobs['ios-fixture-verification']['timeout-minutes'], 50);
  for (const name of ['eef', 'd51']) {
    assert.equal(json(folder + name + '-artifacts.json').total_count, 0);
    const run = json(folder + name + '-run.json'); assert.equal(run.status, 'completed');
    for (const step of ['Validate and collect only three approved synthetic captures', 'Retain approved iPhone captures for one day'])
      assert.equal(run.jobs[0].steps.find(row => row.name === step).conclusion, 'skipped');
  }
  for (const id of ['ios_sdk_build_ci', 'ios_fixture_ui_ci'])
    assert.equal(json('docs/release/evidence-manifest.json').automatedUserFlowEvidence.items.find(row => row.id === id).status, 'pending');
});
test('one short public result preserves historical notes and does not introduce provider names or media', () => {
  assert.deepEqual(content.iosCurrentFixtureFailure, iosCurrentFixtureFailure);
  assert.deepEqual(content.updates.filter(row => row.source === iosCurrentFixtureFailureProgress.source), [iosCurrentFixtureFailureProgress]);
  assert.doesNotMatch(iosCurrentFixtureFailureProgress.title + iosCurrentFixtureFailureProgress.text, /Firebase|BrowserStack|SDK|Swift|CI\b/i);
  const workflow = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['pull_request', 'push']) assert(workflow.on[event].paths.includes('tests/ios-current-fixture-result.test.mjs'));
  assert(Object.values(workflow.jobs).some(job => job.steps.some(step => step.run?.includes('tests/ios-current-fixture-result.test.mjs'))));
});
