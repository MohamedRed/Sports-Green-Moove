import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {parseDocument} from 'yaml';
import {requiredUserFlowChecks, requiredAutomatedFlowEvidence} from '../scripts/release-evidence-requirements.mjs';
import {content} from '../partner-portal/content.mjs';
import {iosMvpBaseline, iosMvpProgress, iosMvpBlocker} from '../partner-portal/ios-mvp-baseline.mjs';
import {iosFixtureObservation, iosFixtureProgress, iosFixtureLaunchProgress} from '../partner-portal/ios-fixture-observation.mjs';
import {iosFixturePass, iosFixturePassProgress} from '../partner-portal/ios-fixture-pass.mjs';
import {iosCurrentFixturePass, iosCurrentFixturePassProgress} from '../partner-portal/ios-current-fixture-pass.mjs';

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
  assert.equal(report.terminalBuildResult.conclusion, 'failure');
  assert.equal(report.terminalBuildResult.exitCode, 65);
  assert.equal(report.terminalBuildResult.compilerErrors.length, 2);
  assert.equal(report.terminalBuildResult.simulatorDisposal, 'success');
  assert.equal(report.sourceReviewGaps.length, 4);
  assert.deepEqual(content.iosMvpBaseline, iosMvpBaseline);
  const baseline = content.updates.find(update => update.title === iosMvpProgress.title && update.source === iosMvpProgress.source);
  assert.deepEqual(baseline, iosMvpProgress);
  assert(content.blockers.some(blocker => blocker.id === iosMvpBlocker.id));
  for (const id of [iosMvpProgress.flow, ...iosMvpProgress.coversFlows]) {
    assert(content.flows.some(flow => flow.id === id), id);
  }
  assert.doesNotMatch([iosMvpProgress.title, iosMvpProgress.text, iosMvpBlocker.title, iosMvpBlocker.text,
    iosMvpBlocker.next].join(' '), /Firebase|BrowserStack|Xcode|SDK|Foundation|Swift|CI\b/i);
});

test('iPhone verification is bounded public compute with only the approved one-day capture storage', () => {
  assert.deepEqual(document.errors, []);
  assert.deepEqual(workflow.permissions, {contents: 'read'});
  assert.equal(job['runs-on'], 'macos-26-intel');
  assert.equal(job['timeout-minutes'], 50);
  assert.equal(job.if, "${{ github.event.repository.visibility == 'public' && github.event.repository.private == false }}");
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.deepEqual(job.steps.filter(step => step.uses).map(step => step.uses), ['actions/checkout@v6', 'actions/upload-artifact@v4']);
  assert.equal(job.steps[0].with['persist-credentials'], false);
  assert.doesNotMatch(text, /secrets\.|actions\/cache|cache:|continue-on-error|appetize|app-store/i);
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.with['retention-days'], 1);
  assert.equal(upload.with.name, 'iphone-fixture-captures');
  assert.equal(upload.with['include-hidden-files'], false);
});

test('full SDK project and unchanged fixture tests run once without signing or production configuration', () => {
  const commands = job.steps.map(step => step.run ?? '').join('\n');
  assert.match(commands, /bash scripts\/check-ios-native-plan\.sh/);
  assert.match(commands, /bash scripts\/check-ios-support-concurrency\.sh/);
  assert.match(commands, /xcodegen generate --spec project\.yml/);
  assert.match(commands, /xcrun simctl create SGM-MVP-iPhone com\.apple\.CoreSimulator\.SimDeviceType\.iPhone-16/);
  assert.match(commands, /xcodebuild test/);
  assert.equal((commands.match(/xcodebuild build-for-testing/g) ?? []).length, 1);
  assert.equal((commands.match(/xcodebuild test-without-building/g) ?? []).length, 1);
  assert.match(commands, /test "\$\{#runs\[@\]\}" -eq 1/);
  assert.match(commands, /-xctestrun "\$\{runs\[0\]\}"/);
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

test('support transports typed values across the continuation without suppressing concurrency checks', () => {
  const gateway = read('ios/Sources/SportsGreenMooveApp/FirebaseSupportGateway.swift');
  const boundary = read('ios/Sources/SportsGreenMooveApp/FirebaseCallableBoundary.swift');
  assert.match(gateway, /supportCall<Response: Sendable>/);
  assert.match(gateway, /input: \[String: String\]/);
  assert.match(gateway, /decode: @escaping @Sendable \(Any\) throws -> Response/);
  assert.match(gateway, /firebaseOwnedCall\(uid: uid, name: name, input: input\)/);
  assert.match(boundary, /let response: Response = try await withCheckedThrowingContinuation/);
  assert.match(boundary, /continuation.resume\(with: Result \{ try decode\(result\?\.data\) \}\)/);
  assert.equal((boundary.match(/Auth.auth\(\).currentUser\?\.uid == uid/g) ?? []).length, 2);
  assert.equal((boundary.match(/try Task.checkCancellation\(\)/g) ?? []).length, 2);
  assert.doesNotMatch(gateway + boundary, /@unchecked|@preconcurrency|resume\(returning: data\)|async throws -> Any/);
  assert.match(read('scripts/check-ios-support-concurrency.sh'), /-swift-version 6 -strict-concurrency=complete -warnings-as-errors/);
});

test('partial terminal iPhone proof preserves all seven outcomes without accepting a failed gate', () => {
  const report = JSON.parse(read(iosFixtureObservation.source));
  assert.equal(report.sourceCommit, '01a2f0585183f2a6d20b004f8f1cfd2374ca070b');
  assert.equal(report.runId, 41843194537);
  assert.equal(report.conclusion, 'cancelled');
  assert.equal(report.sdkLinkedAppCompiledAndLaunched, true);
  assert.equal(report.separateBuildStepAccepted, false);
  assert.equal(report.simulatorDisposal, 'success');
  assert.equal(report.testProcessFinalizationCause, 'unknown');
  const cases = report.fixtureSuite.cases;
  assert.equal(new Set(cases.map(item => item.name)).size, 7);
  assert.equal(cases.filter(item => item.result === 'passed').length, 6);
  assert.equal(cases.filter(item => item.result === 'failed').length, 1);
  for (const name of ['SportsGreenMooveUITests', 'SearchConsentFlowTests']) {
    const source = read(`ios/UITests/SportsGreenMooveUITests/${name}.swift`);
    assert.deepEqual(cases.filter(item => item.suite === name).map(item => item.name).sort(),
      [...source.matchAll(/func (test\w+)\(/g)].map(match => match[1]).sort());
  }
  assert.equal(report.fixtureSuite.failure.message,
    'XCTAssertTrue failed - Missing UI identifier: messages.rating-prompt.action.5');
  for (const key of ['fullUiGateAccepted', 'iosEndToEndFlowsAccepted', 'physicalDeviceEvidenceAccepted',
    'productionWrites', 'realPaymentExercised', 'newMediaPublished', 'releaseComplete']) assert.equal(report[key], false);
  for (const id of ['ios_sdk_build_ci', 'ios_fixture_ui_ci']) {
    assert(requiredAutomatedFlowEvidence.includes(id));
    for (const file of ['evidence-manifest.json', 'evidence-manifest.example.json']) {
      const manifest = JSON.parse(read(`docs/release/${file}`));
      assert.equal(manifest.automatedUserFlowEvidence.items.find(item => item.id === id).status, 'pending');
    }
  }
  assert.deepEqual(content.iosFixtureObservation, iosFixtureObservation);
  for (const update of [iosFixtureProgress, iosFixtureLaunchProgress]) {
    assert.deepEqual(content.updates.filter(item => item.source === update.source && item.flow === update.flow), [update]);
  }
  for (const id of [iosFixtureProgress.flow, ...iosFixtureProgress.coversFlows]) {
    assert(content.flows.some(flow => flow.id === id));
  }
  assert.doesNotMatch(iosFixtureProgress.title + iosFixtureProgress.text,
    /Firebase|BrowserStack|Xcode|SDK|Foundation|Swift|CI\b/i);
});

test('the 3e7cd40 SDK and seven-case fixture pass remains historical when later iPhone sources change', () => {
  const folder = 'docs/release/evidence/ios-fixture-pass-3e7cd40-2026-11-04/';
  const report = JSON.parse(read(iosCurrentFixturePass.source));
  assert.equal(report.sourceCommit, '3e7cd40e62798ba503c383e044e25231dc3072bd');
  assert.equal(report.runId, 41911781988); assert.equal(report.jobId, 126862422870);
  assert.equal(report.status, 'completed'); assert.equal(report.conclusion, 'success');
  for (const item of [report.build, report.fixtureExecution, report.simulatorDisposal]) assert.equal(item.conclusion, 'success');
  assert.equal(report.configuredMinutes, 50);
  assert.equal(report.fixtureSuite.executed, 7); assert.equal(report.fixtureSuite.failed, 0);
  assert.equal(report.fixtureSuite.passed, 7); assert(report.fixtureSuite.cases.every(item => item.result === 'passed'));
  assert.equal(new Set(report.fixtureSuite.cases.map(item => item.name)).size, 7);
  for (const suite of ['SportsGreenMooveUITests', 'SearchConsentFlowTests']) {
    assert.deepEqual(report.fixtureSuite.cases.filter(item => item.suite === suite).map(item => item.name).sort(),
      [...read(`ios/UITests/SportsGreenMooveUITests/${suite}.swift`).matchAll(/func (test\w+)\(/g)].map(match => match[1]).sort());
  }
  const sha = value => createHash('sha256').update(value).digest('hex');
  const sources = JSON.parse(read(iosCurrentFixturePass.checksums));
  assert.equal(sources.sourceCommit, report.sourceCommit);
  for (const item of sources.files) {
    assert.match(item.sha256, /^[a-f0-9]{64}$/);
  }
  assert(sources.files.some(item => sha(readFileSync(new URL('../' + item.path, import.meta.url))) !== item.sha256));
  assert.equal(sha(read(folder + report.provenance.selectedResult)), report.provenance.selectedResultSha256);
  assert.equal(report.captureCollection.conclusion, 'skipped'); assert.equal(report.captureUpload.conclusion, 'skipped');
  for (const key of ['iosEndToEndFlowsAccepted', 'physicalDeviceEvidenceAccepted', 'productionWrites',
    'realPaymentExercised', 'newMediaPublished', 'releaseComplete']) assert.equal(report[key], false);
  assert.deepEqual(content.iosCurrentFixturePass, iosCurrentFixturePass);
  assert.deepEqual(content.updates.filter(item => item.source === iosCurrentFixturePassProgress.source), [iosCurrentFixturePassProgress]);
  const manifest = JSON.parse(read('docs/release/evidence-manifest.json'));
  for (const id of ['ios_sdk_build_ci', 'ios_fixture_ui_ci']) {
    const item = manifest.automatedUserFlowEvidence.items.find(item => item.id === id);
    assert.equal(item.status, 'pending'); assert(item.evidenceRefs.includes(folder.replace('docs/release/', '') + 'summary.json'));
  }
  const previous = JSON.parse(read('docs/release/evidence/automated-user-flow-evidence-2026-06-16.json'));
  const index = JSON.parse(read('docs/release/evidence/automated-user-flow-evidence-2026-11-04.json'));
  const iosIds = ['ios_sdk_build_ci', 'ios_fixture_ui_ci'];
  assert.deepEqual(index.items.filter(item => !iosIds.includes(item.id)), previous.items);
  assert.equal(sha(read(index.inheritedEvidence.source)), index.inheritedEvidence.sha256);
  for (const item of index.items.filter(item => iosIds.includes(item.id))) {
    assert.equal(item.appSourceCommit, report.sourceCommit); assert.equal(item.status, 'passed');
  }
});

test('rating controls expose individual scores and the original UI test also verifies submission', () => {
  const card = read('ios/Sources/SportsGreenMooveApp/MessagesScreen.swift');
  assert.match(card, /\.accessibilityElement\(children: \.contain\)/);
  assert.match(card, /\.accessibilityLabel\("Noter \\\(score\)/);
  assert.match(card, /\.frame\(width: 44, height: 44\)/);
  const fixtures = read('ios/UITests/SportsGreenMooveUITests/SportsGreenMooveUITests.swift');
  assert.match(fixtures, /assertExists\("messages.rating-prompt.action.5", in: app\)/);
  assert.match(fixtures, /app.buttons\["messages.rating-prompt.action.5"\]/);
  assert.match(fixtures, /rating.tap\(\)/);
  assert.match(fixtures, /app.staticTexts\["Avis envoyé\."\].waitForExistence\(timeout: 6\)/);
  assert.match(fixtures, /app.debugDescription.prefix\(32_000\)/);
  assert.doesNotMatch(fixtures, /XCTSkip|retry|continueAfterFailure\s*=\s*false/);
  assert.equal((fixtures.match(/@MainActor func test/g) ?? []).length, 5);
});

test('the first full iPhone fixture pass is source-bound and never accepts the failed Android gate or later app changes', () => {
  const report = JSON.parse(read(iosFixturePass.source));
  const earlier = JSON.parse(read(iosFixtureObservation.source));
  assert.equal(report.sourceCommit, '55822999ff5d31b792c71bd78b6ae0e59a743851');
  assert.equal(report.runId, 41854694392);
  for (const result of [report, report.build, report.fixtureExecution]) assert.equal(result.conclusion, 'success');
  assert.equal(report.fixtureSuite.executed, 7);
  assert.equal(report.fixtureSuite.passed, 7);
  assert.equal(report.fixtureSuite.failed, 0);
  assert.equal(report.fixtureSuite.unexpectedFailures, 0);
  assert.deepEqual(report.fixtureSuite.cases.map(item => [item.suite, item.name]),
    earlier.fixtureSuite.cases.map(item => [item.suite, item.name]));
  assert(report.fixtureSuite.cases.every(item => item.result === 'passed'));
  assert.equal(report.ratingFixtureSubmissionVerified, true);
  assert.equal(report.simulatorDisposal, 'success');
  assert.equal(report.testedSourceBuildAndFixtureGatePassed, true);
  assert.equal(report.firstPartyCompilerWarnings.length, 6);
  assert.equal(report.sameSourceAndroidGate.conclusion, 'failure');
  assert.deepEqual(report.sameSourceAndroidGate.suiteExitStatuses, {ordinaryTests: 0, componentEvidence: 1, localReplay: 0});
  assert.equal(report.sameSourceAndroidGate.localReplay.groupsPassed, 37);
  assert.equal(report.sameSourceAndroidGate.localReplay.nativeCaseCount, 40);
  assert.match(report.sameSourceAndroidGate.originalArtifact.sha256, /^[a-f0-9]{64}$/);
  assert.equal(report.sameSourceAndroidGate.underlyingTransferCause, 'not established');
  const sources = JSON.parse(read(iosFixturePass.checksums));
  assert(Object.keys(sources).length >= 110);
  assert.equal(sources['ios/Sources/SportsGreenMooveApp/AppState.swift'],
    '91f4e4f49f6aa5a902bc68c59855f687f57b02284ed5119fc0308a43662c5dd7');
  assert.equal(Object.hasOwn(sources, 'ios/Sources/SportsGreenMooveApp/AppState+Data.swift'), false);
  for (const value of Object.values(sources)) assert.match(value, /^[a-f0-9]{64}$/);
  for (const key of ['laterAccountRefreshSourceCovered', 'releaseCandidateBuildAccepted', 'releaseCandidateFixtureGateAccepted',
    'iosEndToEndFlowsAccepted', 'physicalDeviceEvidenceAccepted', 'productionWrites', 'realPaymentExercised',
    'newMediaPublished', 'releaseComplete']) assert.equal(report[key], false, key);
  assert.deepEqual(content.iosFixturePass, iosFixturePass);
  assert.deepEqual(content.updates.filter(item => item.source === iosFixturePassProgress.source), [iosFixturePassProgress]);
  assert.doesNotMatch(iosFixturePassProgress.title + iosFixturePassProgress.text,
    /Firebase|BrowserStack|Swift|SDK|backend|Xcode|CI\b/i);
});

test('iOS changes trigger verification and web smoke checks its constraints', () => {
  assert.deepEqual(requiredUserFlowChecks.find(check => check.workflowName === workflow.name), {
    workflowName: 'iOS MVP Verification', name: job.name, acceptableConclusions: ['SUCCESS'],
  });
  for (const source of ['ios/**', 'scripts/check-ios-native-plan.sh', 'scripts/check-ios-support-concurrency.sh',
    'tests/fixtures/ios-support-concurrency/**', 'tests/ios-mvp-workflow.test.mjs', path]) {
    assert(workflow.on.pull_request.paths.includes(source), source);
  }
  const smoke = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['pull_request', 'push']) {
    assert(smoke.on[event].paths.includes(path));
    assert(smoke.on[event].paths.includes('tests/ios-mvp-workflow.test.mjs'));
  }
  assert(Object.values(smoke.jobs).some(group => group.steps.some(step =>
    step.run === 'node --test tests/ios-mvp-workflow.test.mjs tests/ios-search-consent.test.mjs tests/ios-app-data.test.mjs tests/ios-authentication.test.mjs tests/ios-initialized-profile.test.mjs tests/ios-location-stop.test.mjs tests/ios-fixture-launch.test.mjs tests/ios-ride-ownership.test.mjs tests/ios-account-work.test.mjs tests/ios-approved-captures.test.mjs tests/ios-location-shutdown.test.mjs tests/ios-search-ownership.test.mjs')));
  const routine = parseDocument(read('.github/workflows/native-ci.yml')).toJSON();
  for (const name of ['ios-native-checks', 'ios-native-ui']) {
    assert.equal(routine.jobs[name].if, '${{ false }}');
  }
});
