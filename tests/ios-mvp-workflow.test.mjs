import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {parseDocument} from 'yaml';
import {requiredUserFlowChecks} from '../scripts/release-evidence-requirements.mjs';
import {content} from '../partner-portal/content.mjs';
import {iosMvpBaseline, iosMvpProgress, iosMvpBlocker} from '../partner-portal/ios-mvp-baseline.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const path = '.github/workflows/ios-mvp-verification.yml';
const text = read(path);
const document = parseDocument(text);
const workflow = document.toJSON();
const job = workflow.jobs['ios-fixture-verification'];

test('the two-platform baseline keeps logic proof separate from app, phone and release acceptance', () => {
  const report = JSON.parse(read(iosMvpBaseline.source));
  assert.deepEqual(report.requiredPlatforms, ['android', 'ios']);
  assert.equal(report.localNativeChecks.exitCode, 0);
  assert.equal(createHash('sha256').update(read('docs/release/evidence/ios-mvp-baseline-2026-11-04/native-checks.log')).digest('hex'),
    report.localNativeChecks.logSha256);
  assert.match(report.localNativeChecks.scope, /not an iOS application build/);
  for (const key of ['iosAppBuildAccepted', 'iosFixtureUiAccepted', 'iosEndToEndFlowsAccepted',
    'physicalDeviceEvidenceAccepted', 'productionWrites', 'realPaymentExercised', 'releaseComplete']) {
    assert.equal(report[key], false, key);
  }
  assert.equal(report.hostedBuildStarted.statusAtObservation, 'in_progress');
  assert.equal(report.sourceReviewGaps.length, 4);
  assert.deepEqual(content.iosMvpBaseline, iosMvpBaseline);
  assert.deepEqual(content.updates[0], iosMvpProgress);
  assert(content.blockers.some(blocker => blocker.id === iosMvpBlocker.id));
  for (const id of [iosMvpProgress.flow, ...iosMvpProgress.coversFlows]) {
    assert(content.flows.some(flow => flow.id === id), id);
  }
  assert.doesNotMatch([iosMvpProgress.title, iosMvpProgress.text, iosMvpBlocker.title, iosMvpBlocker.text,
    iosMvpBlocker.next].join(' '), /Firebase|BrowserStack|Xcode|SDK|Foundation|Swift|CI\b/i);
});

test('iPhone verification is bounded standard public compute, without paid storage or credentials', () => {
  assert.deepEqual(document.errors, []);
  assert.deepEqual(workflow.permissions, {contents: 'read'});
  assert.equal(job['runs-on'], 'macos-26-intel');
  assert.equal(job['timeout-minutes'], 35);
  assert.equal(job.if, "${{ github.event.repository.visibility == 'public' && github.event.repository.private == false }}");
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.deepEqual(job.steps.filter(step => step.uses).map(step => step.uses), ['actions/checkout@v6']);
  assert.equal(job.steps[0].with['persist-credentials'], false);
  assert.doesNotMatch(text, /secrets\.|upload-artifact|actions\/cache|cache:|continue-on-error|appetize|app-store/i);
});

test('full SDK project and unchanged fixture tests run once without signing or production configuration', () => {
  const commands = job.steps.map(step => step.run ?? '').join('\n');
  assert.match(commands, /bash scripts\/check-ios-native-plan\.sh/);
  assert.match(commands, /xcodegen generate --spec project\.yml/);
  assert.match(commands, /xcrun simctl create SGM-MVP-iPhone com\.apple\.CoreSimulator\.SimDeviceType\.iPhone-16/);
  assert.match(commands, /xcodebuild test/);
  assert.match(commands, /-project SportsGreenMoove\.xcodeproj/);
  assert.match(commands, /-destination "platform=iOS Simulator,id=\$PHONE_ID"/);
  assert.match(commands, /-parallel-testing-enabled NO/);
  assert.match(commands, /CODE_SIGNING_ALLOWED=NO/);
  assert.doesNotMatch(commands, /retry|only-testing|skip-testing|\|\| true|swift build|GoogleService-Info/);
  const cleanup = job.steps.at(-1);
  assert.equal(cleanup.if, "${{ always() && steps.phone.outputs.id != '' }}");
  assert.equal(cleanup.run, 'xcrun simctl delete "$PHONE_ID"');
  const fixtures = read('ios/UITests/SportsGreenMooveUITests/SportsGreenMooveUITests.swift');
  assert.equal((fixtures.match(/func test\w+\(/g) ?? []).length, 5);
  assert.match(fixtures, /--sgm-ui-test-fixture/);
});

test('iOS changes trigger verification and web smoke checks its constraints', () => {
  assert.deepEqual(requiredUserFlowChecks.find(check => check.workflowName === workflow.name), {
    workflowName: 'iOS MVP Verification', name: job.name, acceptableConclusions: ['SUCCESS'],
  });
  for (const source of ['ios/**', 'scripts/check-ios-native-plan.sh', 'tests/ios-mvp-workflow.test.mjs', path]) {
    assert(workflow.on.pull_request.paths.includes(source), source);
  }
  const smoke = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['pull_request', 'push']) {
    assert(smoke.on[event].paths.includes(path));
    assert(smoke.on[event].paths.includes('tests/ios-mvp-workflow.test.mjs'));
  }
  assert(Object.values(smoke.jobs).some(group => group.steps.some(step =>
    step.run === 'node --test tests/ios-mvp-workflow.test.mjs')));
  const routine = parseDocument(read('.github/workflows/native-ci.yml')).toJSON();
  for (const name of ['ios-native-checks', 'ios-native-ui']) {
    assert.equal(routine.jobs[name].if, '${{ false }}');
  }
});
