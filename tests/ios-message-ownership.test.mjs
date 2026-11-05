import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosMessageOwnership, iosMessageOwnershipProgress} from '../partner-portal/ios-message-ownership.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const app = 'ios/Sources/SportsGreenMooveApp/';
const folder = 'docs/release/evidence/ios-message-ownership-2026-11-05/';

test('the actual messages screen delegates to a generation-owned controller with private lifecycle disposal', () => {
  const source = read(app + 'MessagesScreen.swift');
  for (const fragment of ['.id(access.context.id)', 'State(initialValue: MessagesInboxState(access: access, gateway: gateway))',
    'if state.live', 'state.suspend()', 'state.close()', 'state.resume()', 'state.refresh()',
    'state.submit(review, score: score)', 'busy: !state.canSubmit', 'state.live ? state.inbox']) assert(source.includes(fragment));
  assert.doesNotMatch(source, /error.localizedDescription|appState.firebase.submitRating|func loadInbox|func submitReview/);
  const state = read(app + 'MessagesInboxState.swift');
  for (const fragment of ['access.begin()', 'access.finish(work)', 'access.owns(work)', 'generation == ticket',
    'gateway.getInbox(uid: access.context.uid)', 'gateway.submitRating(uid: access.context.uid',
    'reviews.items.contains(review)', 'requiresRefresh = true', 'reviews.prepareRefresh()', 'reviews.close()']) assert(state.includes(fragment));
  assert.doesNotMatch(state, /Task.sleep|repeat |while |UserDefaults|print\(|NSLog/);
});

test('inbox, continuation and rating gateway dispatch use the captured UID rather than adopting current auth', () => {
  const inbox = read(app + 'FirebaseInboxGateway.swift');
  assert(inbox.includes('func getInbox(uid: String)'));
  assert(inbox.includes('func loadPendingReviews(uid: String, cursor: String)'));
  assert.doesNotMatch(inbox, /guard let uid = Auth/);
  const gateway = read(app + 'FirebaseFeedbackGateway.swift').split('func createReport')[0];
  assert.equal((gateway.match(/Auth.auth\(\).currentUser\?\.uid == uid/g) ?? []).length, 2);
  assert.equal((gateway.match(/try Task.checkCancellation\(\)/g) ?? []).length, 2);
  assert(gateway.includes('id == "\\(rideSessionId)_\\(uid)_\\(ratedUserId)"'));
  const pending = read(app + 'PendingReviewsState.swift');
  for (const fragment of ['uid == access.context.uid', 'access.isCurrent, let work = access.begin()', 'access.finish(work)',
    'gateway.loadPendingReviews(uid: uid, cursor: cursor)', 'access.owns(work) else { close(); return }']) assert(pending.includes(fragment));
  assert(read('scripts/check-ios-support-concurrency.sh').includes('FirebaseFeedbackGateway.swift'));
});

test('retained actual baseline-method reproduction and executed controlled checks are source-bound, not SDK proof', () => {
  const report = JSON.parse(read(iosMessageOwnership.source));
  assert.equal(report.checkedAt, '2026-11-05');
  assert.equal(report.baselineCommit, '61c3f2048d478707494e4ad90f1819f0860842ef');
  assert.equal(report.localChecks.delayedBoundaries, 42);
  for (const key of ['nativePlanExitCode','signatureExitCode','regressionExitCode','uiSyntaxExitCode']) assert.equal(report.localChecks[key], 0);
  for (const log of report.logs) assert.equal(sha(read(folder + log.file)), log.sha256);
  assert.match(read(folder + 'baseline-result.txt'), /staleInboxRestored=true staleRatingNoticeRestored=true/);
  assert.match(read(folder + 'native-result.txt'), /MessagesInboxChecks passed: 42 delayed/);
  assert.match(read(folder + 'native-result.txt'), /SportsGreenMooveNativeChecks passed/);
  for (const key of ['sdkLinkedBuildAccepted','fixtureUiExecuted','fullConversationUiAccepted','nativeSignOutAccepted',
    'physicalDeviceAccepted','newNativeMediaPublished','releaseComplete']) assert.equal(report[key], false);
  for (const key of ['providerRequests','productionWrites','realPayments','newPhoneSessions']) assert.equal(report[key], 0);
  const manifest = JSON.parse(read(iosMessageOwnership.checksums));
  for (const file of manifest.files) assert.equal(sha(read('docs/release/evidence/source-archive/' + file.sha256 + '.txt')), file.sha256, file.path);
  assert.equal(sha(read('docs/release/evidence/source-archive/' + report.baselineSourceSha256 + '.txt')), report.baselineSourceSha256);
});

test('all eleven fixtures remain required with the explicit-refresh assertions, without new captures', () => {
  const path = 'ios/UITests/SportsGreenMooveUITests/';
  const cases = readdirSync(new URL('../' + path, import.meta.url)).filter(x => x.endsWith('.swift'))
    .flatMap(file => [...read(path + file).matchAll(/func (test\w+)\(/g)].map(m => m[1]));
  assert.equal(cases.length, 11); assert.equal(new Set(cases).size, 11);
  const fixture = read(path + 'SportsGreenMooveUITests.swift');
  assert(fixture.includes('let refresh = app.buttons["messages.refresh"]'));
  assert(fixture.includes('Aucun avis en attente.'));
  const gateway = read(app + 'UITestAppStateFactory.swift');
  assert(gateway.includes('reviewsUserId: "ui-user"'));
  assert(gateway.includes('"\\(rideSessionId)_\\(uid)_\\(ratedUserId)"'));
  const job = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON().jobs['ios-fixture-verification'];
  assert.equal(job['timeout-minutes'], 50);
  assert.equal(job.steps.filter(step => step.uses?.startsWith('actions/upload-artifact')).length, 1);
});

test('portal copy stays local-only and the new contract runs without weakening the original smoke commands', () => {
  assert.deepEqual(content.iosMessageOwnership, iosMessageOwnership);
  assert.deepEqual(content.updates.filter(x => x.source === iosMessageOwnershipProgress.source), [iosMessageOwnershipProgress]);
  assert.doesNotMatch(iosMessageOwnershipProgress.title + iosMessageOwnershipProgress.text, /Firebase|BrowserStack|SDK|Swift|CI\b/i);
  const path = 'tests/ios-message-ownership.test.mjs';
  const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['pull_request','push']) assert(web.on[event].paths.includes(path));
  assert(Object.values(web.jobs).some(job => job.steps.some(step => step.run?.includes(path))));
  const ios = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  assert(ios.on.pull_request.paths.includes(path));
  const evidence = JSON.parse(read('docs/release/evidence-manifest.json'));
  for (const id of ['ios_sdk_build_ci','ios_fixture_ui_ci'])
    assert.equal(evidence.automatedUserFlowEvidence.items.find(item => item.id === id).status, 'pending');
});
