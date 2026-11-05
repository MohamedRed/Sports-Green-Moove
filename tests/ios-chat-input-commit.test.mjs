import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const json = path => JSON.parse(read(path)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const folder = 'docs/release/evidence/ios-input-commit-38b-2026-11-05/';
const passFolder = 'docs/release/evidence/ios-fixture-pass-d56-2026-11-05/';
const sourceBytes = row => read('docs/release/evidence/source-archive/' + row.sha256 + '.txt');
for (const dir of [folder, passFolder]) test('retained iPhone source and terminal observations are exact: ' + dir, () => {
  const report = json(dir + 'summary.json');
  for (const row of report.records) assert.equal(sha(read(dir + row.file)), row.sha256);
  for (const row of json(dir + 'source-sha256.json').files) assert.equal(sha(sourceBytes(row)), row.sha256);
  assert.equal(json(dir + 'terminal-job.json').status, 'completed');
  assert.equal(json(dir + 'artifacts.json').total_count, 0);
  assert.equal(report.physicalDeviceAccepted, false); assert.equal(report.releaseComplete, false);
});
test('38b fails only the immediate ride input observation, not the later exact sent/reopened message', () => {
  const report = json(folder + 'summary.json'), cases = json(folder + 'cases.json');
  assert.equal(report.casesExecuted, 11); assert.equal(report.passed, 8); assert.equal(report.failed, 3);
  assert.equal(cases.filter(row => row.status === 'passed').length, 8);
  assert.equal(report.assertionFailures, 5); assert.equal(report.activeRideInputAssertionFailures, 1);
  const observation = read(folder + 'active-ride-input-observation.txt');
  assert.equal((observation.match(/Waiting 6.0s for "Premier message de course isolé" StaticText/g) ?? []).length, 2);
  assert(observation.includes('Tap "ride-chat.back" Button'));
  for (const key of ['persistentDraftLossProven', 'exactNativeInputDelayCauseConfirmed', 'productionComposerChanged',
    'fixtureEchoChanged', 'candidateUiAccepted']) assert.equal(report[key], false);
  assert(read(folder + 'native-recheck.txt').includes('RideChatBoundaryChecks passed: 84'));
});
test('real typing and every original ride assertion remain unchanged with only bounded complete-value/enabled observations added', () => {
  const records = json(folder + 'source-sha256.json').files;
  const path = 'ios/UITests/SportsGreenMooveUITests/RideChatFlowChecks.swift';
  const previous = sourceBytes(records.find(row => row.path === path && row.commit !== 'candidate'));
  const candidate = read(path);
  const withoutWaits = candidate.replace('    XCTAssertTrue(waitForRideDraft(body, editor: editor))\n', '')
    .replace('    XCTAssertTrue(waitForRideDraft(expected, editor: editor))\n', '')
    .replace('    let enabled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: send)\n' +
      '    XCTAssertEqual(XCTWaiter.wait(for: [enabled], timeout: 6), .completed)\n', '')
    .replace(/\n@MainActor private func waitForRideDraft[\s\S]+$/, '');
  assert.equal(withoutWaits, previous);
  assert(candidate.includes('NSPredicate(format: "value == %@", expected)'));
  assert(candidate.includes('XCTWaiter.wait(for: [committed], timeout: 6)'));
  assert.doesNotMatch(candidate, /sleep\(|XCTSkip|setValue\(/);
  for (const row of records.filter(row => row.path.startsWith('ios/Sources/') && row.commit === 'candidate')) {
    assert.equal(sha(read(row.path)), row.sha256);
    assert.equal(records.find(old => old.path === row.path && old.commit !== 'candidate').sha256, row.sha256);
  }
});
test('d56 builds and passes the original eleven screen cases without accepting the later wait or physical/service flows', () => {
  const report = json(passFolder + 'summary.json'), cases = json(passFolder + 'cases.json');
  assert.equal(report.sourceCommit, 'd56cec66555cfb69a9f5ca336a637f99917376ed');
  assert.equal(report.runId, 42111120252); assert.equal(report.jobId, 127539367855);
  assert.equal(report.sdkBuild, 'success'); assert.equal(report.passedCases, 11); assert.equal(report.failedCases, 0);
  assert.equal(cases.length, 11); assert(cases.every(row => row.status === 'passed'));
  assert.deepEqual(cases.map(row => row.name), json(folder + 'cases.json').map(row => row.name));
  assert.equal(report.sourceFixtureGateAccepted, true); assert.equal(report.laterInputWaitCandidateAccepted, false);
  assert.equal(report.nativeServiceIntegrationAccepted, false);
  for (const name of ['Compile app and all fixture test bundles', 'Run every built fixture test without rebuilding', 'Dispose isolated simulator'])
    assert.equal(json(passFolder + 'terminal-job.json').steps.find(row => row.name === name).conclusion, 'success');
  const workflow = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  assert.equal(workflow.jobs['ios-fixture-verification']['timeout-minutes'], 50);
  const oldWorkflow = sourceBytes(json(passFolder + 'source-sha256.json').files.find(row => row.path === '.github/workflows/ios-mvp-verification.yml'));
  assert.deepEqual(workflow.jobs, parseDocument(oldWorkflow).toJSON().jobs);
});
test('the earlier full-pass simulation note and preceding failures remain in history', () => {
  const {previous} = partitionUpdates(content.updates);
  const news = previous.find(row => row.source === passFolder + 'README.md'); assert(news);
  assert.match(news.title, /11/); assert.match(news.text, /simulation/);
  assert.doesNotMatch(news.title + news.text, /Firebase|BrowserStack|Android|SDK|CI\b/);
  assert(previous.some(row => row.source === 'docs/release/evidence/ios-viewport-35f-2026-11-05/README.md'));
  assert(previous.some(row => row.source === 'docs/release/evidence/ios-input-controls-2026-11-05/README.md'));
});
