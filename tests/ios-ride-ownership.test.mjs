import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosRideOwnership, iosRideOwnershipProgress} from '../partner-portal/ios-ride-ownership.mjs';
import {iosPermissionBuild, iosPermissionBuildProgress} from '../partner-portal/ios-permission-build.mjs';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('the actual permission bridge is explicitly Void and checked before another SDK build', () => {
  const source = read('ios/Sources/SportsGreenMooveApp/ActiveRidePermissionGate.swift');
  assert.match(source, /private func requestAlwaysAuthorization\(\) async throws \{\s+try await withCheckedThrowingContinuation \{ \(continuation: CheckedContinuation<Void, Error>\) in/);
  const check = 'scripts/qa/check-ios-permission-continuation.mjs';
  const script = read(check);
  for (const text of ['source.slice(offset, limit)', '-strict-concurrency=complete', '-warnings-as-errors', 'swift-version',
    'fixture.replace', 'finally { rmSync(directory']) assert(script.includes(text));
  const workflow = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  const steps = workflow.jobs['ios-fixture-verification'].steps;
  assert(steps.findIndex(step => step.run === 'node ' + check) < steps.findIndex(step => step.name.startsWith('Compile app')));
  assert(workflow.on.pull_request.paths.includes(check));
  const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['push', 'pull_request']) assert(web.on[event].paths.includes(check));
});

test('the approved capture attempt remains a terminal compiler failure with zero images, not a timeout or UI pass', () => {
  const folder = 'docs/release/evidence/ios-permission-build-a23-2026-11-04/';
  const report = JSON.parse(read(iosPermissionBuild.source)), run = JSON.parse(read(folder + 'terminal.json'));
  assert.equal(run.headSha, 'a23cb9d67f6163156150dbfd320aff7e7ae95835');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(report.runId, 41901262613); assert.equal(report.jobId, 126823997145);
  assert.equal(report.configuredMinutes, 50); assert.equal(report.artifactCount, 0); assert.equal(report.capturesAccepted, 0);
  const steps = run.jobs[0].steps;
  assert.equal(steps.find(step => step.name.startsWith('Compile app')).conclusion, 'failure');
  for (const prefix of ['Run every built', 'Validate and collect', 'Retain approved']) {
    assert.equal(steps.find(step => step.name.startsWith(prefix)).conclusion, 'skipped');
  }
  assert.equal(steps.find(step => step.name === 'Dispose isolated simulator').conclusion, 'success');
  const excerpt = read(folder + 'compiler-error.txt');
  assert.match(excerpt, /generic parameter 'T' could not be inferred/);
  assert.equal(createHash('sha256').update(excerpt).digest('hex'), report.selection.excerptSha256);
  assert.equal(createHash('sha256').update(read(folder + 'terminal.json')).digest('hex'), report.selection.terminalSha256);
  assert.equal(report.bridgeCheck.exitCode, 0);
  assert.equal(createHash('sha256').update(read(folder + report.bridgeCheck.log)).digest('hex'), report.bridgeCheck.logSha256);
  for (const key of ['fixtureUiExecuted', 'sdkLinkedBuildAccepted', 'newNativeMediaPublished', 'physicalDeviceAccepted', 'releaseComplete']) {
    assert.equal(report[key], false);
  }
  assert.deepEqual(content.iosPermissionBuild, iosPermissionBuild);
  assert.deepEqual(content.updates.filter(entry => entry.source === iosPermissionBuildProgress.source), [iosPermissionBuildProgress]);
  assert.doesNotMatch(iosPermissionBuildProgress.title + iosPermissionBuildProgress.text, /Firebase|BrowserStack|SDK|Swift|CI\b/i);
});
const root = 'ios/Sources/SportsGreenMooveApp/';
const folder = 'docs/release/evidence/ios-ride-ownership-2026-11-04/';

test('a revoked account or role cannot own pending ride work even after an ABA transition', () => {
  const state = read(root + 'RideRequestState.swift');
  assert.match(state, /pending == nil, !Task.isCancelled/);
  assert.match(state, /pending == request && revision == request.id && request.uid == uid && request.role == role/);
  assert.match(state, /func invalidate\(\) \{ revision = UUID\(\) \}/);
  assert.match(state, /if pending == request \{ pending = nil \}/);
  for (const call of ['ridePermissions.cancelPending()', 'firebase.stopAllNativeLocationFallback()', 'radar.stopLocalTracking()']) assert(state.includes(call));
  const app = read(root + 'AppState.swift');
  assert.match(app, /session\?\.uid != oldValue\?\.uid \|\| session\?\.roles != oldValue\?\.roles/);
  assert.match(app, /selectedRole != oldValue \{\s+appDataRefreshId = nil; invalidateRideWork\(\)/);
  const auth = read(root + 'AppState+Authentication.swift');
  assert.match(auth, /func signOut\(\) \{\s+accountWork.clear\(\)\s+invalidateRideWork\(\)/);
  assert.match(auth, /guard !rideRequests.busy, !accountWork.busy, !locationWorkUnsettled else \{ return \}/);
  assert.doesNotMatch(state + auth, /endRide\(|completeTrip\(|cancelTrip\(/);
});

test('permission, startup and completion guard each async boundary without a new fallback', () => {
  const permissions = read(root + 'ActiveRidePermissionGate.swift');
  assert.match(permissions, /try await ridePermissions.ensureReadyForActiveRide\(\)\s+try requireCurrentRideRequest\(request\)/);
  assert.match(permissions, /defer \{ rideRequests.finish\(request\) \}/);
  assert.match(permissions, /cancelPendingIfCreated\(\) \{ existing\?\.cancelPending\(\) \}/);
  assert.match(permissions, /let pending = authorizationContinuation; authorizationContinuation = nil/);
  assert.match(permissions, /guard authorizationContinuation == nil else/);
  assert.match(permissions, /guard requestRevision == id, pendingRequest == id else/);
  assert.match(permissions, /let settings = await center.notificationSettings\(\)\s+try requireCurrent\(\)/);
  assert.match(permissions, /let granted = try await center.requestAuthorization\([^\n]+\)\s+try requireCurrent\(\)/);
  const startup = read(root + 'ActiveRideStartup.swift');
  assert.match(startup, /try await firebase.startRide\([^\n]+\)\s+try requireCurrent\(\)/);
  assert.match(startup, /try await firebase.writeNativeLocationFallback\([^\n]+\)\s+try requireCurrent\(\)/);
  assert.match(startup, /error is CancellationError \|\| Task.isCancelled/);
  assert.equal((startup.match(/requireCurrent: \(\) throws -> Void/g) ?? []).length, 4);
  const lifecycle = read(root + 'AppStateRideLifecycle.swift');
  assert.match(lifecycle, /let updated = try await firebase.getActiveRide\(\)\s+try requireCurrentRideRequest\(request\)\s+activeRide = updated/);
  assert.doesNotMatch(lifecycle, /loading = (true|false)/);
  assert.match(lifecycle, /role: request.role/);
});

test('local teardown is synchronous and separate from remote trip completion, with UID-bound uploads', () => {
  const radar = read(root + 'FirebaseRadarTrackingGateway.swift');
  const stop = radar.slice(radar.indexOf('@MainActor func stopLocalTracking()'), radar.indexOf('init(publishableKey:'));
  for (const call of ['Radar.stopTracking()', 'Radar.setUserId(nil)', 'Radar.setMetadata(nil)']) assert(stop.includes(call));
  assert.doesNotMatch(stop, /completeTrip|cancelTrip|await|Task\s*\{/);
  const gateway = read(root + 'FirebaseNativeGateway.swift');
  assert.match(gateway, /@MainActor func stopNativeLocationFallback/);
  assert.doesNotMatch(gateway, /Task \{ @MainActor in/);
  assert.match(gateway, /guard let uid = Auth.auth\(\).currentUser\?\.uid/);
  assert.match(gateway, /uploadNativeLocationUpdate\(update, uid: uid\)/);
  const upload = read(root + 'FirebaseLocationUpload.swift');
  assert.match(upload, /firebaseOwnedCall\(uid: uid, name: "writeLocationBatch"/);
  assert.doesNotMatch(upload, /Auth.auth|currentUser|httpsCallable/);
  assert(read('scripts/check-ios-support-concurrency.sh').includes('FirebaseLocationUpload.swift'));
});

test('the actual regression and complete native checks preserve the original failure and scoped acceptance', () => {
  const report = JSON.parse(read(iosRideOwnership.source));
  assert.equal(report.baseline.sourceCommit, '9936e6512889f3ab1cace4931513460951fef37b');
  assert.equal(report.baseline.exitCode, 133);
  assert.equal(report.baseline.restoredRide, true);
  assert.deepEqual(report.baseline.calls, ['start-ride', 'radar', 'native-start']);
  assert.equal(report.candidate.exitCode, 0);
  assert.equal(report.candidate.restoredRide, false);
  assert.deepEqual(report.candidate.calls, ['start-ride']);
  assert.deepEqual([report.candidate.startupBoundaryCases, report.candidate.permissionRevocationCases,
    report.candidate.passengerAndEndRevocationCases], [72, 2, 8]);
  for (const receipt of [report.baseline, report.candidate, report.signatures, ...report.retainedDrafts]) {
    assert.equal(createHash('sha256').update(read(folder + receipt.log)).digest('hex'), receipt.logSha256);
  }
  for (const key of ['sdkLinkedBuildAccepted', 'fullSignOutAccepted', 'issuedNetworkRequestCancellationAccepted',
    'physicalGpsEvidenceAccepted', 'productionWrites', 'newNativeMediaPublished', 'releaseComplete']) assert.equal(report[key], false);
  assert.match(read(folder + report.candidate.log), /72 delayed startup boundaries/);
  assert.deepEqual(content.iosRideOwnership, iosRideOwnership);
  assert.deepEqual(content.updates.filter(item => item.source === iosRideOwnershipProgress.source), [iosRideOwnershipProgress]);
  assert.doesNotMatch(iosRideOwnershipProgress.title + iosRideOwnershipProgress.text, /Firebase|Radar|BrowserStack|SDK|Swift|CI\b/i);
});

test('existing bounded web and native jobs include the new regression without broader permissions', () => {
  const path = 'tests/ios-ride-ownership.test.mjs';
  const ios = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  assert(ios.on.pull_request.paths.includes(path));
  for (const event of ['push', 'pull_request']) assert(web.on[event].paths.includes(path));
  assert(Object.values(web.jobs).some(job => job.steps.some(step => step.run?.includes(path))));
  assert.equal(ios.jobs['ios-fixture-verification']['timeout-minutes'], 50);
  for (const name of ['RideLifecycleChecks', 'RideLifecycleProbe', 'RideBoundaryChecks']) {
    assert(read('scripts/check-ios-native-plan.sh').includes(name + '.swift'));
  }
});
