import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosLocationStop, iosLocationStopProgress} from '../partner-portal/ios-location-stop.mjs';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const base = 'ios/Sources/SportsGreenMooveApp/';
const folder = 'docs/release/evidence/ios-location-stop-2026-11-04/';

test('pending startup owns every await and cannot activate capture after stop', () => {
  const source = read(base + 'NativeLocationFallbackProvider.swift');
  assert.match(source, /let id = try state.begin\(ride: rideSessionId\)/);
  assert.match(source, /defer \{ state.finishStart\(id\) \}/);
  assert.match(source, /try await upload\(firstUpdate\)\s+try state.requireCurrent\(id\)/);
  assert(source.indexOf('try state.requireCurrent(id)', source.indexOf('try await upload(firstUpdate)')) <
    source.indexOf('manager.startUpdatingLocation()'));
  assert.match(source, /guard state.revoke\(ride: rideSessionId\) else \{ return \}/);
  assert.doesNotMatch(source, /guard continuousSession\?\.rideSessionId == rideSessionId/);
  assert.match(source, /authorizationContinuation = nil/);
  assert.match(source, /locationContinuation = nil/);
  assert.match(source, /authorization\?\.resume\(throwing: CancellationError\(\)\)/);
  assert.match(source, /location\?\.resume\(throwing: CancellationError\(\)\)/);
  assert.match(source, /for task in uploads.values \{ task.cancel\(\) \}/);
});

test('all delegate events carry a synchronized immutable owner into the actor', () => {
  const source = read(base + 'NativeLocationFallbackProvider.swift');
  assert.match(source, /OSAllocatedUnfairLock<LocationCallbackScope\?>\(initialState: nil\)/);
  assert.match(source, /let managerId = ObjectIdentifier\(manager\)/);
  assert.match(source, /scope\?\.managerId == managerId \? scope\?\.owner : nil/);
  assert.equal((source.match(/guard let id = owner\(for: manager\)/g) ?? []).length, 3);
  assert.equal((source.match(/guard self.state.owns\(id\) else \{ return \}/g) ?? []).length, 3);
  assert.match(source, /callbackOwner.withLock \{ \$0 = nil \}/);
  assert.match(source, /stopped\?\.delegate = nil/);
  assert.match(source, /let manager = CLLocationManager\(\)/);
  assert.match(source, /let work = try state.beginUpload\(session.id\)/);
  assert.match(source, /defer \{ state.finishUpload\(work\) \}/);
  assert.match(source, /case \.none:/);
  assert.doesNotMatch(source, /@unchecked|@preconcurrency|Task.sleep|try\?/);
  const state = read(base + 'LocationSessionState.swift');
  assert.match(state, /owner == nil, pendingStarts.isEmpty, pendingUploads.isEmpty/);
  assert.match(state, /ride == nil \|\| ride == owner.ride/);
});

test('the checker compiles the actual wrapper against controlled declarations, without device access', () => {
  const script = read('scripts/qa/check-ios-location-provider.mjs');
  assert.match(script, /source.replace\(guard, '#if canImport\(CoreLocation\)'\)/);
  assert.match(script, /const language = baseline \? '5' : '6'/);
  assert.match(script, /\['-strict-concurrency=complete', '-warnings-as-errors'\]/);
  assert.match(script, /execFileSync\('git', \['show', `\$\{baseline\}:\$\{sourcePath\}`\]/);
  assert.doesNotMatch(script, /fetch\(|curl|simctl|adb|xcodebuild|@unchecked/);
  const checks = read('tests/fixtures/ios-location/CandidateChecks.swift');
  for (const marker of ['awaitingUpload.cancel()', 'stopAllUpdates()', 'isolated-authorization',
    'isolated-capture', 'another-ride', 'isolated-overlap', 'Controlled upload failure']) assert(checks.includes(marker));
  assert(read('ios/Tests/SportsGreenMooveNativeChecks/main.swift').includes('try checkLocationSessionOwnership()'));
});

test('both web events and the existing bounded native job cover the new checker', () => {
  const ios = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const path of ['tests/ios-location-stop.test.mjs', 'scripts/qa/check-ios-location-provider.mjs', 'tests/fixtures/ios-location/**']) {
    assert(ios.on.pull_request.paths.includes(path));
    for (const event of ['push', 'pull_request']) assert(web.on[event].paths.includes(path));
  }
  const job = ios.jobs['ios-fixture-verification'];
  assert.equal(job['timeout-minutes'], 50);
  assert(job.steps.some(step => step.run === 'node scripts/qa/check-ios-location-provider.mjs'));
  assert(Object.values(web.jobs).some(job => job.steps.some(step => step.run?.includes('tests/ios-location-stop.test.mjs'))));
});

test('the retained comparison proves only the local stop race, never completed logout or physical GPS', () => {
  const report = JSON.parse(read(iosLocationStop.source));
  assert.equal(report.baseline.sourceCommit, '84aa1349933844f78fd9180d33583301f0c35e1f');
  assert.deepEqual(report.baseline.observed, {startResult: 'completed', continuousStartsAfterStop: 1, localStopCalls: 0, initialUploads: 1});
  assert.deepEqual(report.candidate.observed, {startResult: 'cancelled', continuousStartsAfterStop: 0, localStopCalls: 1, initialUploads: 1});
  assert.equal(report.comparison.languageMode, 'Swift 5 for both bodies');
  assert.equal(report.providerChecks.languageMode, 'Swift 6, complete concurrency, warnings as errors');
  for (const proof of [report.comparison, report.providerChecks, report.nativeChecks]) {
    assert.equal(proof.exitCode, 0);
    assert.equal(createHash('sha256').update(read(folder + proof.log)).digest('hex'), proof.logSha256);
  }
  for (const key of ['sdkLinkedBuildAccepted', 'physicalGpsEvidenceAccepted', 'completedSignOutAccepted',
    'issuedNetworkRequestCancellationAccepted', 'productionWrites', 'newNativeMediaPublished', 'releaseComplete']) assert.equal(report[key], false);
  assert.deepEqual(content.iosLocationStop, iosLocationStop);
  assert.deepEqual(content.updates.filter(item => item.source === iosLocationStopProgress.source), [iosLocationStopProgress]);
  assert.doesNotMatch(iosLocationStopProgress.title + iosLocationStopProgress.text,
    /Firebase|BrowserStack|CoreLocation|Swift|SDK|backend|Xcode|CI\b/i);
  for (const id of [iosLocationStopProgress.flow, ...iosLocationStopProgress.coversFlows]) assert(content.flows.some(flow => flow.id === id));
});
