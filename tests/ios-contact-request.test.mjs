import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosContactRequest,iosContactRequestProgress} from '../partner-portal/ios-contact-request.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';
const read = path => readFileSync(new URL('../' + path,import.meta.url),'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const app = 'ios/Sources/SportsGreenMooveApp/';
const folder = 'docs/release/evidence/ios-contact-request-2026-11-05/';

test('contact requests carry Sendable values rather than an aliased dictionary across the async helper', () => {
  const request = read(app + 'EmergencyContactRequest.swift'), gateway = read(app + 'FirebaseEmergencyContactGateway.swift');
  assert(request.includes('enum EmergencyContactRequest: Sendable'));
  for (const fragment of ['case guardianContacts(cursor: String?)','case read(EmergencyContactScope)',
    'case save(EmergencyContactOperation)','EmergencyContactWire.payload(operation)','GuardianContactWire.validCursor(cursor)']) assert(request.includes(fragment));
  assert(gateway.includes('request: EmergencyContactRequest'));
  assert.doesNotMatch(gateway,/input: \[String: Any\]/);
  const continuation = gateway.indexOf('withCheckedThrowingContinuation');
  const payload = gateway.indexOf('let input = try request.payload()');
  const dispatch = gateway.indexOf('httpsCallable(request.name).call(input)');
  assert(continuation >= 0 && payload > continuation && dispatch > payload);
  assert.equal((gateway.match(/Auth.auth\(\).currentUser\?\.uid == uid/g) ?? []).length,2);
  assert.equal((gateway.match(/try Task.checkCancellation\(\)/g) ?? []).length,2);
  assert.doesNotMatch(gateway + request,/@unchecked|@preconcurrency|nonisolated\(unsafe\)|retry|fallback|Task.sleep/);
});

test('the rating payload is also constructed at the one SDK transfer, without changing receipt or account guards', () => {
  const source = read(app + 'FirebaseFeedbackGateway.swift').split('func createReport')[0];
  assert(source.indexOf('var data: [String: Any]') > source.indexOf('withCheckedThrowingContinuation'));
  assert(source.includes('id == "\\(rideSessionId)_\\(uid)_\\(ratedUserId)"'));
  assert.equal((source.match(/Auth.auth\(\).currentUser\?\.uid == uid/g) ?? []).length,2);
  assert.equal((source.match(/try Task.checkCancellation\(\)/g) ?? []).length,2);
});

test('the actual terminal SDK compiler failure remains failed before every fixture and capture step', () => {
  const report = JSON.parse(read(iosContactRequest.source)), run = JSON.parse(read(folder + 'terminal-run.json'));
  assert.equal(report.failedSourceCommit,'84c9b627acfcebbddaad147bdd282af8483ce943');
  assert.equal(report.runId,41935572872); assert.equal(report.jobId,126960411175);
  assert.equal(run.headSha,report.failedSourceCommit); assert.equal(run.status,'completed'); assert.equal(run.conclusion,'failure');
  const job = run.jobs.find(row => row.databaseId === report.jobId);
  assert.equal(job.conclusion,'failure');
  assert.equal(job.steps.find(row => row.name === 'Compile app and all fixture test bundles').conclusion,'failure');
  for (const name of ['Run every built fixture test without rebuilding','Validate and collect only three approved synthetic captures',
    'Retain approved iPhone captures for one day']) assert.equal(job.steps.find(row => row.name === name).conclusion,'skipped');
  assert.equal(job.steps.find(row => row.name === 'Dispose isolated simulator').conclusion,'success');
  assert.equal(JSON.parse(read(folder + 'artifact-inventory.json')).total_count,0);
  assert.match(read(folder + 'compiler-diagnostic.txt'),/sending value of non-Sendable type '\[String : Any\]'/);
  assert.match(read(folder + 'compiler-diagnostic.txt'),/Passing task-isolated value/);
  assert.equal(report.deadlineFailure,false); assert.equal(report.fixtureUiExecuted,false);
});

test('executed request checks and signature preflight stay separate from real SDK and full-flow acceptance', () => {
  const report = JSON.parse(read(iosContactRequest.source));
  assert.equal(report.checkedAt,'2026-11-05');
  assert.deepEqual(report.localChecks,{nativePlanExitCode:0,signatureExitCode:0,exactRequestVariants:10,invalidInputsRejected:10});
  for (const log of report.records) assert.equal(sha(read(folder + log.file)),log.sha256);
  assert.match(read(folder + 'native-result.txt'),/EmergencyContactRequestChecks passed: 10 exact request variants and 10 invalid inputs/);
  assert.match(read(folder + 'native-result.txt'),/SportsGreenMooveNativeChecks passed/);
  for (const key of ['candidateSdkBuildAccepted','fixtureUiExecuted','fullConversationAccepted','physicalDeviceAccepted',
    'newNativeMediaPublished','releaseComplete']) assert.equal(report[key],false);
  for (const key of ['providerRequests','productionWrites','realPayments','newPhoneSessions']) assert.equal(report[key],0);
  const manifest = JSON.parse(read(iosContactRequest.checksums));
  for (const file of manifest.files) assert.equal(sha(read('docs/release/evidence/source-archive/' + file.sha256 + '.txt')),file.sha256);
  assert.equal(sha(read('docs/release/evidence/source-archive/' + report.failedGatewaySha256 + '.txt')),report.failedGatewaySha256);
});

test('the exact fixture inventory, deadline, capture policy and signature checking remain required', () => {
  const path = 'ios/UITests/SportsGreenMooveUITests/';
  const cases = readdirSync(new URL('../' + path,import.meta.url)).filter(x=>x.endsWith('.swift'))
    .flatMap(file=>[...read(path+file).matchAll(/func (test\w+)\(/g)].map(m=>m[1]));
  assert.equal(cases.length,11); assert.equal(new Set(cases).size,11);
  const job = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON().jobs['ios-fixture-verification'];
  assert.equal(job['timeout-minutes'],50);
  assert.equal(job.steps.filter(x=>x.uses?.startsWith('actions/upload-artifact')).length,1);
  const signature = read('tests/fixtures/ios-support-concurrency/FirebaseFunctions.swift');
  assert(signature.includes('public final class HTTPSCallable: Sendable'));
  assert(signature.includes('_ data: sending Any?'));
  assert(signature.includes('completion: @escaping @MainActor'));
  assert(read('scripts/check-ios-native-plan.sh').includes('EmergencyContactRequestChecks.swift'));
  assert(read('scripts/check-ios-support-concurrency.sh').includes('EmergencyContactRequest.swift'));
});

test('the concise incomplete-iPhone portal note has smoke coverage and does not accept pending release entries', () => {
  assert.deepEqual(content.iosContactRequest,iosContactRequest);
  assert.deepEqual(content.updates.filter(x=>x.source===iosContactRequestProgress.source),[iosContactRequestProgress]);
  assert(partitionUpdates(content.updates).previous.some(row=>row.source===iosContactRequestProgress.source));
  assert.doesNotMatch(iosContactRequestProgress.title + iosContactRequestProgress.text,/Firebase|BrowserStack|SDK|Swift|CI\b/i);
  const file = 'tests/ios-contact-request.test.mjs';
  const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for(const event of ['pull_request','push']) assert(web.on[event].paths.includes(file));
  assert(Object.values(web.jobs).some(job=>job.steps.some(step=>step.run?.includes(file))));
  assert(parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON().on.pull_request.paths.includes(file));
  const manifest = JSON.parse(read('docs/release/evidence-manifest.json'));
  for(const id of ['ios_sdk_build_ci','ios_fixture_ui_ci']) assert.equal(manifest.automatedUserFlowEvidence.items.find(x=>x.id===id).status,'pending');
});
