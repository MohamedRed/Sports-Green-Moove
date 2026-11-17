import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosProfileFixtureResult, iosProfileFixtureResultProgress} from '../partner-portal/ios-profile-fixture-result.mjs';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const folder = 'docs/release/evidence/ios-profile-fixture-84aa134-2026-11-04/';
const workflow = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
const job = workflow.jobs['ios-fixture-verification'];

test('the source-bound profile fixture pass preserves the first-launch failure and all seven outcomes', () => {
  const report = JSON.parse(read(iosProfileFixtureResult.source));
  assert.equal(report.sourceCommit, '84aa1349933844f78fd9180d33583301f0c35e1f');
  assert.equal(report.runId, 41876307906);
  assert.equal(report.jobId, 126746062980);
  assert.equal(report.conclusion, 'failure');
  assert.equal(report.sdkLinkedBuildAccepted, true);
  assert.equal(report.simulatorDisposal, 'success');
  assert.equal(report.firstLaunchFailureCause, 'unknown');
  const suite = report.fixtureSuite;
  assert.deepEqual([suite.total, suite.passed, suite.failed, suite.skipped], [7, 6, 1, 0]);
  assert.equal(new Set(suite.cases.map(item => item.name)).size, 7);
  assert.equal(suite.cases.filter(item => item.result === 'passed').length, 6);
  assert.equal(suite.cases.find(item => item.name === 'testAuthFlowIdentifiers').result, 'passed');
  assert.deepEqual(suite.cases.filter(item => item.result === 'failed').map(item => item.name),
    ['testExplicitConsentAndChildChangeInvalidateResults']);
  assert.match(report.failure.stage, /launch before consent assertions/);
  assert.equal(report.authProfileFixtureCaseAccepted, true);
  for (const key of ['fullFixtureGateAccepted', 'currentCandidateSdkAccepted', 'realProviderAuthenticationAccepted',
    'physicalDeviceEvidenceAccepted', 'newNativeMediaPublished', 'releaseComplete']) assert.equal(report[key], false);
  const log = read(folder + 'fixture-log.txt');
  assert.equal(createHash('sha256').update(log).digest('hex'), report.provenance.fixtureLogSha256);
  assert.match(log, /Timed out while launching application via Xcode/);
  assert.match(log, /Executed 7 tests, with 1 failure/);
  assert.deepEqual(content.iosProfileFixtureResult, iosProfileFixtureResult);
  const update = iosProfileFixtureResultProgress;
  assert.deepEqual(content.updates.filter(item => item.source === update.source), [update]);
  assert.doesNotMatch(update.title + update.text, /Firebase|BrowserStack|Xcode|SDK|Swift|CI\b/i);
  for (const id of [update.flow, ...update.coversFlows]) assert(content.flows.some(flow => flow.id === id));
});

test('DEBUG fixture initialization keeps fonts but returns before explicit production provider setup', () => {
  const app = read('ios/Sources/SportsGreenMooveApp/SportsGreenMooveApp.swift');
  const fixture = app.indexOf('if UITestAppStateFactory.isEnabled {\n');
  const returned = app.indexOf('return', fixture);
  const debugEnd = app.indexOf('#endif', returned);
  assert(fixture > app.indexOf('SGMFontRegistrar.registerFonts()'));
  assert(app.lastIndexOf('#if DEBUG', fixture) > app.indexOf('SGMFontRegistrar.registerFonts()'));
  assert(returned > fixture && debugEnd > returned);
  assert(app.indexOf('NativeFacebookLifecycle.configureIfAvailable()') > debugEnd);
  assert(app.indexOf('NativeGoogleMapsLifecycle.configureIfAvailable()') > debugEnd);
  assert(app.indexOf('AppRuntime.makeAppState()') > debugEnd);
  assert.equal((app.match(/UITestBootDiagnostics.record\(/g) ?? []).length, 4);
  for (const phase of ['begin', 'fonts-ready', 'fixture-state-ready', 'window-ready']) {
    assert(app.includes(`UITestBootDiagnostics.record("${phase}")`));
  }
  const diagnostic = read('ios/Sources/SportsGreenMooveApp/UITestBootDiagnostics.swift');
  assert.match(diagnostic, /#if DEBUG\s+import OSLog/);
  assert.match(diagnostic, /subsystem: "be.sportgreenmoove.fixture.boot"/);
  assert.match(diagnostic, /logger.notice\("phase=\\\(phase, privacy: \.public\)"\)/);
  assert.doesNotMatch(diagnostic, /uid|email|token|password|location|credential|UserDefaults/i);
});

test('one cold simulator is booted before compilation, with failure-only static phase logs and unchanged disposal', () => {
  const index = phrase => job.steps.findIndex(step => step.name.includes(phrase));
  const boot = job.steps[index('Boot isolated simulator')];
  assert(index('Create isolated') < index('Boot isolated'));
  assert(index('Boot isolated') < index('Compile app'));
  assert.match(boot.run, /xcrun simctl boot "\$PHONE_ID"\s+xcrun simctl bootstatus "\$PHONE_ID" -b/);
  const logs = job.steps[index('Observe fixture startup')];
  assert.equal(logs.if, "${{ failure() && steps.phone.outputs.id != '' }}");
  assert.match(logs.run, /--predicate 'subsystem == "be.sportgreenmoove.fixture.boot"'/);
  assert(index('Run every built') < index('Observe fixture startup'));
  assert(index('Observe fixture startup') < index('Dispose isolated'));
  assert.equal(job['timeout-minutes'], 50);
  assert.equal(job.steps.at(-1).if, "${{ always() && steps.phone.outputs.id != '' }}");
  const commands = job.steps.map(step => step.run ?? '').join('\n');
  assert.doesNotMatch(commands, /simctl launch|only-testing|skip-testing|retry|test-iterations|execution-time-allowance|\|\| true/);
  for (const file of ['SportsGreenMooveUITests', 'SearchConsentFlowTests']) {
    const source = read(`ios/UITests/SportsGreenMooveUITests/${file}.swift`);
    assert.equal((source.match(/func test\w+\(/g) ?? []).length, file === 'SearchConsentFlowTests' ? 2 : 5);
    assert.doesNotMatch(source, /XCTSkip|retry/);
  }
  const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  assert(workflow.on.pull_request.paths.includes('tests/ios-fixture-launch.test.mjs'));
  for (const event of ['push', 'pull_request']) assert(web.on[event].paths.includes('tests/ios-fixture-launch.test.mjs'));
  assert(Object.values(web.jobs).some(job => job.steps.some(step => step.run?.includes('tests/ios-fixture-launch.test.mjs'))));
});
