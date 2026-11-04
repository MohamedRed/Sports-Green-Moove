import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosAccountWork, iosAccountWorkProgress} from '../partner-portal/ios-account-work.mjs';
import {iosBuildTimeout, iosBuildTimeoutProgress} from '../partner-portal/ios-build-timeout.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = 'ios/Sources/SportsGreenMooveApp/';
const folder = 'docs/release/evidence/ios-account-work-2026-11-04/';

test('account work retains unsettled tokens across revocation and binds immutable identity generations', () => {
  const scope = read(app + 'AccountWorkScope.swift');
  assert.match(scope, /context = AccountContext\(id: UUID\(\), uid: session.uid, role: role, grantedRoles: session.roles\)/);
  assert.match(scope, /func clear\(\) \{ context = nil \}/);
  assert.match(scope, /!pending.values.contains\(where: \{ \$0 != context \}\)/);
  assert.match(scope, /pending\[work.id\] == work.context/);
  assert.match(scope, /guard !Task.isCancelled, self.context == context/);
  assert.match(scope, /session.roles.contains\(role\)/);
  const auth = read(app + 'AppState+Authentication.swift');
  assert.match(auth, /guard !rideRequests.busy, !accountWork.busy else/);
  assert.match(auth, /session == nil && \(rideRequests.busy \|\| accountWork.busy\)/);
  assert(auth.indexOf('accountWork.clear()') < auth.indexOf('authentication.signOut(using: auth)'));
  const refresh = read(app + 'AppState+Data.swift');
  assert.match(refresh, /func refreshAppData\(access: AccountAccess\) async/);
  assert.match(refresh, /let work = access.begin\(\)/);
  assert.match(refresh, /access.finish\(work\)/);
  assert.match(refresh, /try access.requireCurrent\(work\)/);
  assert.match(read(app + 'AppShell.swift'), /\.id\(access.context.id\)/);
});

test('publication binds its controller and validates every delayed callback before changing visible state', () => {
  const controller = read(app + 'PublishController.swift');
  assert.match(controller, /init\(access: AccountAccess\)/);
  assert.match(controller, /guard active, pending == nil, access.context.role == \.driver/);
  assert.match(controller, /active && revision == action.revision && pending\?\.id == action.id && access.owns\(action.work\)/);
  for (const call of ['firebase.suggestPlaces(input: input)', 'firebase.resolvePlace(placeId: suggestion.placeId)', 'firebase.createTrip(draft: draft)']) {
    assert(controller.includes('try await ' + call + '\n            try requireCurrent(action)'));
  }
  assert.match(controller, /onPublished: @escaping @MainActor \(AccountAccess\) async -> Void/);
  assert.equal((controller.match(/defer \{ finish\(action\) \}/g) ?? []).length, 3);
  assert.doesNotMatch(controller, /@unchecked|@preconcurrency|Task.sleep|retry|fallback/i);
  const view = read(app + 'PublishScreen.swift');
  assert.match(view, /State\(initialValue: PublishController\(access: access\)\)/);
  assert.match(view, /\.onDisappear \{ controller.close\(\) \}/);
  assert.match(view, /onPublished: \{ await appState.refreshAppData\(access: \$0\) \}/);
});

test('actual native receipts preserve the original failure and accept only the controlled account/publication scope', () => {
  const report = JSON.parse(read(iosAccountWork.source));
  assert.equal(report.baseline.sourceCommit, '20ca1458b9927fa354a1586c261c166d9b77d016');
  assert.equal(report.baseline.exitCode, 133);
  assert.equal(report.baseline.restoredNotice, true);
  assert.equal(report.candidate.exitCode, 0);
  assert.equal(report.candidate.restoredNotice, false);
  assert.equal(report.candidate.delayedPublicationCases, 42);
  for (const proof of [report.baseline, report.candidate]) {
    assert.equal(createHash('sha256').update(read(folder + proof.log)).digest('hex'), proof.logSha256);
  }
  assert.match(read(folder + report.candidate.log), /42 delayed success\/error boundaries/);
  for (const key of ['sdkLinkedBuildAccepted', 'renderedAccountSwitchAccepted', 'completeTransportDrainAccepted',
    'fullSignOutAccepted', 'productionWrites', 'newNativeMediaPublished', 'releaseComplete']) assert.equal(report[key], false);
  assert.deepEqual(content.iosAccountWork, iosAccountWork);
  assert.deepEqual(content.updates.filter(item => item.source === iosAccountWorkProgress.source), [iosAccountWorkProgress]);
});

test('the preparation timeout stays terminal and source-bound, with no invented build or UI outcomes', () => {
  const report = JSON.parse(read(iosBuildTimeout.source));
  assert.equal(report.sourceCommit, '9936e6512889f3ab1cace4931513460951fef37b');
  assert.equal(report.runId, 41887949452);
  assert.equal(report.status, 'completed'); assert.equal(report.conclusion, 'cancelled');
  assert.equal(report.configuredMinutes, 35);
  assert.match(report.terminationAnnotation, /maximum execution time of 35m0s/);
  assert.equal(report.underlyingPreparationSlownessCause, 'unknown');
  assert.equal(report.steps.find(step => step.name.startsWith('Compile app')).conclusion, 'cancelled');
  assert.equal(report.steps.find(step => step.name.startsWith('Run every built')).conclusion, 'skipped');
  assert.equal(report.steps.find(step => step.name === 'Dispose isolated simulator').conclusion, 'success');
  for (const key of ['sdkLinkedBuildAccepted', 'fixtureUiExecuted', 'newNativeMediaPublished', 'releaseComplete']) assert.equal(report[key], false);
  const log = read('docs/release/evidence/ios-build-timeout-9936e65-2026-11-04/' + report.provenance.buildLog);
  assert.equal(createHash('sha256').update(log).digest('hex'), report.provenance.buildLogSha256);
  assert.deepEqual(content.iosBuildTimeout, iosBuildTimeout);
  assert.deepEqual(content.updates.filter(item => item.source === iosBuildTimeoutProgress.source), [iosBuildTimeoutProgress]);
  for (const update of [iosAccountWorkProgress, iosBuildTimeoutProgress]) {
    assert.doesNotMatch(update.title + update.text, /Firebase|BrowserStack|SDK|Swift|Xcode|CI\b/i);
  }
});

test('both web events and the existing iPhone checks include the shared ownership regressions', () => {
  const path = 'tests/ios-account-work.test.mjs';
  const ios = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  assert(ios.on.pull_request.paths.includes(path));
  for (const event of ['push', 'pull_request']) assert(web.on[event].paths.includes(path));
  assert(Object.values(web.jobs).some(job => job.steps.some(step => step.run?.includes(path))));
  for (const file of ['AccountWorkScope', 'AccountWorkChecks', 'PublishOwnershipChecks', 'PublishBoundaryChecks']) {
    assert(read('scripts/check-ios-native-plan.sh').includes(file + '.swift'));
  }
});
