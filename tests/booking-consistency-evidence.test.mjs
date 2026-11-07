import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { content, captures } from '../partner-portal/content.mjs';
import {bookingServerRecheck, bookingServerRecheckProgress} from '../partner-portal/booking-server-recheck.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';

const base = 'docs/release/evidence/local-booking-consistency-2026-10-17/';
const bytes = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const read = (path) => bytes(path).toString();
const json = (file) => JSON.parse(read(base + file));
const hashes = {
  'before.json': '2dead076384b3eea937dc1536f7eab2a4a5cc20ee7c8ff92cb4947e8be097a6c',
  'after.json': '2d4eb9032cd6a1535a33aa1ac7e82d89f12967afd1bf037e4719f7dd57f81766',
  'functions.json': '7529bad4660c165aba8e3fe049007f1b563b9fa1bdbfc0d3f94cf8c737ebd8a6',
  'search-recovery.xml': 'ab9220a7e75cdd8304fc1488fc47c669c60169077357e2bef5996247c095ec14',
  'error-policy.xml': '88fe955fb4627b0c5a7921426c34e6c04292da77bc4c63d89a6feb3645ca28ff',
  'services.json': '391c9040ff793b46eb4a8cb21be692b44ab7d11bb8ab4ea1549b00463e38e9b0',
  'native-components.xml': 'b22742782bfceb0d9c591fed776b4d3b19ede894c690d0aea84ad8bfb6088535',
  'network-preparation-failure.json': '4810efdb5f38881a47745157455e696872b5019b1cde6f7c9bb202b9e4943057',
  'modem-before.json': '613515821592d1473a258e149e2d437c018a52f47060e9fecaf40bd4b6924b1e',
  'modem-after.json': '932fe648488277a0fa105e206950a808f544b20158ea7f6f5b2fec29da4b1225',
  'booking-review-required.png': 'c57d5681d3562c514dc2be6dffcbe859c92a21cec9bc9bc3a4b56267deaf2425',
  'booking-review-narrow.png': 'cb6b488a2e3edc0dce613ed720d0d294198f9cca6dcbb839eb4f78e89ecf6a1f',
  'complete-replay.json': 'ffd06c8085d29a6e9ff4d219ffe52e0dcf30154b5e148a1c651907caef1352ab',
  'network-recovery.json': '6d59766eb071b74c09ff644a326e17164506632e8d90444d28b62f341cd6b45a',
};

test('retained booking evidence preserves original bytes and isolated scope', () => {
  for (const [file, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(bytes(base + file)).digest('hex'), hash, file);
    assert(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|AIza[\w-]{30}|sk_live_[\w]+|Bearer eyJ/.test(read(base + file)));
  }
  for (const file of ['before.json', 'after.json']) {
    const run = json(file);
    assert.equal(run.projectId, 'demo-sgm-local-qa');
    assert.equal(run.scope, 'controlled-local-booking-handler-not-phone-ui');
    assert.equal(run.livePayment, false); assert.equal(run.productionDeployed, false);
    assert.match(run.runId, /^[a-f0-9]{32}$/);
    assert.equal(run.testedAt.slice(0, 10), '2026-10-17');
  }
});

test('the independent complete replay preserves the failed run and proves actual offline and restored boundaries', () => {
  const run = json('complete-replay.json'), network = json('network-recovery.json');
  assert.equal(run.runId, 'd849f6670fc0f34f60b36823eaa4ba92');
  assert.equal(run.testedAt, '2026-10-17T04:18:31.327Z');
  assert.equal(run.scope, 'local-ui-not-physical-device'); assert.equal(run.testCount, 21);
  assert.equal(run.steps.length, 22); assert(run.steps.every((item) => item.status === 'passed'));
  assert.equal(network.runId, run.runId); assert.equal(network.completed, true);
  assert.equal(network.preparation.hasDefaultDataSubscription, true);
  const offline = network.network.find((item) => item.phase === 'offline');
  assert.equal(offline.activeNetwork, false); assert.equal(offline.internetNetworkCount, 0);
  assert.equal(offline.backendReachable, false); assert.equal(offline.wifiEnabled, false);
  assert.equal(offline.mobileDataEnabled, false);
  const restored = network.network.find((item) => item.phase === 'restored');
  assert.equal(restored.backendReachable, true); assert.equal(restored.activeNetwork, true);
  for (const key of ['offlineSendUnconfirmed', 'offlineDraftRetained', 'recoveredSendConfirmed',
    'cellularRequestReleased', 'accountDraftCleared', 'replyReceived']) assert.equal(network[key], true);
  assert.equal(run.chatNetwork.messageCount, 2); assert.equal(run.chatNetwork.notificationCount, 2);
  assert.equal(run.chatNetwork.duplicateMessages, 0);
  assert.equal(run.tripCancellation.livePayment, false); assert.equal(run.tripCancellation.refundIssued, false);
  assert.equal(json('network-preparation-failure.json').completed, false);
  assert(content.updates.some((item) => item.flow === 'messages' && /instable/.test(item.text)));
});

test('the original thirteen-case failure remains a failure, not retroactively accepted', () => {
  const run = json('before.json');
  assert.equal(run.passed, false); assert.equal(run.cases.length, 13);
  assert.equal(run.cases.filter((item) => item.status === 'passed').length, 3);
  for (const item of run.cases.slice(0, 8)) {
    assert.equal(item.status, 'failed'); assert.equal(item.bookingCount, 1);
  }
  assert(!run.cases.some((item) => item.id === 'confirmed-application'));
});

test('the final fourteen cases reject changed agreement or authority without creating a stale request', () => {
  const run = json('after.json');
  assert.equal(run.passed, true); assert.equal(run.cases.length, 14);
  assert.equal(run.runId, 'e85c1073a713f312d297bf7b43fe0a76');
  assert(run.cases.every((item) => item.status === 'passed' && item.mutationApplied));
  assert.deepEqual(run.cases.slice(0, 13).map((item) => item.id), json('before.json').cases.map((item) => item.id));
  for (const item of run.cases) {
    if (item.expectedError) {
      assert.equal(item.rejected.code, item.expectedError); assert.equal(item.bookingCount, 0);
    } else {
      assert.equal(item.bookingCount, 1); assert.equal(item.bookings[0].status, 'requested');
      assert(item.reads.some((path) => path.startsWith('children/')));
    }
  }
  const application = run.cases.at(-1).mutationResult;
  assert.equal(application.method, 'real-local-proposal-confirmation-application');
  assert.equal(application.parentDecision, 'accept'); assert.equal(application.status, 'applied');
  assert.equal(application.newPriceCents, 900); assert.equal(application.providerCalls, 1);
  assert.deepEqual(application.affectedBookingIds, [application.existingBookingId]);
  assert.equal(application.syntheticRoute, true); assert.equal(application.livePayment, false);
});

test('unit and wider service receipts retain their exact passing scope', () => {
  const unit = json('functions.json');
  assert.equal(unit.success, true); assert.equal(unit.numTotalTests, 228);
  assert.equal(unit.numPassedTests, 228); assert.equal(unit.numFailedTests, 0);
  for (const file of ['search-recovery.xml', 'error-policy.xml']) {
    const suite = new XMLParser({ ignoreAttributes: false }).parse(read(base + file)).testsuite;
    assert.equal(Number(suite['@_tests']), 4); assert.equal(Number(suite['@_failures']), 0);
    assert.equal(Number(suite['@_skipped']), 0); assert.equal(Number(suite['@_errors']), 0);
  }
  const services = json('services.json');
  assert.equal(services.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(services.steps.length, 24); assert(services.steps.every((item) => item.status === 'passed'));
});

test('smoke CI covers the harness and Android recovery while release status remains partial', () => {
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/booking-consistency-evidence.test.mjs"').length - 1, 2);
  assert.match(workflow, /run: npm run test:booking-consistency/);
  assert.match(workflow, /run: node --test tests\/booking-consistency-evidence.test.mjs/);
  assert(workflow.includes('name: booking-consistency-results'));
  const collector = read('scripts/run-android-ui-tests-and-collect-screenshots.sh');
  for (const name of ['booking-review-required.png', 'booking-review-narrow.png']) assert(collector.includes(name));
  assert.equal(content.flows.find((item) => item.id === 'booking').status, 'partial');
  assert.equal(content.blockers.find((item) => item.id === 'booking-retry-devices').source,
    'docs/release/evidence/booking-receipt-phone-2026-10-30/README.md');
  assert.match(read(base + 'README.md'), /does not bind a request to the terms previously displayed/);
});

test('the three executed screen cases and captures do not promote the later failed network replay', () => {
  const suite = new XMLParser({ ignoreAttributes: false }).parse(read(base + 'native-components.xml')).testsuite;
  assert.equal(Number(suite['@_tests']), 80); assert.equal(Number(suite['@_skipped']), 16);
  assert.equal(Number(suite['@_failures']), 0); assert.equal(Number(suite['@_errors']), 0);
  const cases = suite.testcase.filter((item) => item['@_classname'].endsWith('.BookingReviewFlowTest'));
  assert.equal(cases.length, 3);
  assert(cases.every((item) => !Object.hasOwn(item, 'skipped') && !Object.hasOwn(item, 'failure') && !Object.hasOwn(item, 'error')));
  for (const name of ['booking-review-required', 'booking-review-narrow']) {
    assert.equal(captures[name], base + name + '.png');
    assert(content.flows.find((item) => item.id === 'booking').images.some((item) => item.file === name && /17 octobre/.test(item.alt)));
  }
  const failed = json('network-preparation-failure.json');
  assert.equal(failed.completed, false); assert.equal(failed.failedPhase, 'network-preparation');
  assert.equal(failed.runId, '94d5b9ed9fb95675d9c4104d151c14c6');
  assert.deepEqual(failed.network, []); assert.equal(failed.cellularRequestReleased, true);
  assert.equal(failed.preparationFailure.hasDefaultDataSubscription, false);
  assert.equal(failed.preparationFailure.backendReachable, true);
  assert.deepEqual(failed.preparationFailure.internetTransports, ['wifi']);
  assert.equal(failed.preparationFailure.cellularAvailableCallbacks, 0);
  assert(!Object.hasOwn(failed, 'recoveredSendConfirmed'));
  for (const phase of ['before', 'after']) {
    const modem = json(`modem-${phase}.json`);
    assert.equal(modem.runId, failed.runId); assert.equal(modem.voice, 'home'); assert.equal(modem.data, 'home');
  }
});

const currentFolder = 'docs/release/evidence/booking-server-recheck-2026-11-05/';
const current = file => JSON.parse(read(currentFolder + file));
const digest = value => createHash('sha256').update(value).digest('hex');
test('the current isolated fourteen-case replay checks actual transaction reads without accepting the earlier unexecuted attempt', () => {
  const report = current('summary.json'), run = current('services.json');
  for (const row of report.records) assert.equal(digest(bytes(currentFolder + row.file)), row.sha256);
  assert.equal(run.scope, 'controlled-local-booking-handler-not-phone-ui');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.testedAt.slice(0, 10), '2026-11-05');
  assert.equal(run.passed, true); assert.equal(run.cases.length, 14);
  assert.deepEqual(run.cases.map(row => row.id), json('after.json').cases.map(row => row.id));
  for (const row of run.cases) {
    assert.equal(row.status, 'passed'); assert.equal(row.mutationApplied, true);
    if (row.expectedError) { assert.equal(row.rejected.code, row.expectedError); assert.equal(row.bookingCount, 0); }
    else {
      assert.equal(row.bookingCount, 1); assert.equal(row.bookings[0].seats, 2);
      assert.equal(row.bookings[0].status, 'requested'); assert(row.reads.some(path => path.startsWith('children/')));
    }
  }
  const application = run.cases.at(-1).mutationResult;
  assert.equal(application.method, 'real-local-proposal-confirmation-application');
  assert.equal(application.parentDecision, 'accept'); assert.equal(application.status, 'applied');
  assert.equal(application.providerCalls, 1); assert.equal(application.syntheticRoute, true);
  assert.equal(application.livePayment, false);
  const earlier = JSON.parse(read('docs/release/evidence/ios-search-contract-2026-11-05/service-attempt.json'));
  assert.equal(earlier.result, 'not-executed'); assert.equal(earlier.assertionGroupsCompleted, 0);
});

test('the configured runtime recheck retains executed regressions, endpoint disposal and the unchanged iPhone source at observation', () => {
  const report = current('summary.json'), disposal = current('disposal.json'), native = current('native-source-identity.json');
  assert.equal(report.environmentAndDisposalTestsPassed, 11);
  assert(read(currentFolder + 'java-environment-tests.txt').includes('# pass 11'));
  assert(read(currentFolder + 'java-environment-tests.txt').includes('# fail 0'));
  assert.equal(disposal.closed, true); assert.deepEqual(disposal.ports, [9099, 8080, 9000, 5001]);
  assert.equal(disposal.childProcessExitCode, 0); assert.equal(disposal.host, '127.0.0.1');
  assert.equal(native.baseCommit, '9ae6ea709da5f487a51a1542864d4cf4d0e8f4b1');
  assert.equal(native.aggregateSha256, digest(JSON.stringify(native.files, null, 2) + '\n'));
  const priorSources = JSON.parse(read('docs/release/evidence/ios-search-contract-2026-11-05/source-sha256.json')).files;
  const overlapping = priorSources.filter(row => native.files.some(item => item.path === row.path));
  assert(overlapping.length >= 12);
  for (const row of overlapping) assert.equal(native.files.find(item => item.path === row.path).sha256, row.sha256, row.path);
  for (const row of current('source-sha256.json').files) assert.equal(digest(bytes('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
  const helper = read('scripts/qa/local-java-environment.mjs'), runtime = read('scripts/qa/local-runtime.mjs');
  assert(helper.includes("resolve(env.JAVA_HOME, 'bin')")); assert(helper.includes('accessSync(java, constants.X_OK)'));
  assert(runtime.indexOf('const env = localJavaEnvironment(') < runtime.indexOf('const temp = mkdtempSync'));
  assert.equal(report.nativeSourceUnchanged, true);
});

test('one concise reservation note preserves historical proof and pending release requirements with existing smoke coverage', () => {
  const report = current('summary.json'), before = current('portal-before.json');
  assert.deepEqual(content.bookingServerRecheck, bookingServerRecheck);
  assert.deepEqual(content.updates.filter(row => row.source === bookingServerRecheckProgress.source), [bookingServerRecheckProgress]);
  assert(partitionUpdates(content.updates).recent.some(row => row.source === bookingServerRecheckProgress.source));
  assert.doesNotMatch(bookingServerRecheckProgress.title + bookingServerRecheckProgress.text, /Firebase|BrowserStack|Java|SDK|Swift|Xcode|CI\b/i);
  for (const row of before.flows) assert.equal(digest(JSON.stringify(content.flows.find(flow => flow.id === row.id))), row.sha256);
  for (const hash of before.updates) assert(content.updates.some(row => digest(JSON.stringify(row)) === hash));
  assert.equal(digest(JSON.stringify(content.blockers)), before.blockers);
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/booking-consistency-evidence.test.mjs"').length - 1, 2);
  assert(workflow.includes('run: node --test tests/booking-consistency-evidence.test.mjs'));
  assert(workflow.includes('"scripts/qa/**"'));
  for (const key of ['nativeSdkAccepted', 'nativeUiAccepted', 'realMapIntegrationAccepted', 'completeBookingFlowAccepted',
    'physicalDeviceAccepted', 'releaseComplete']) assert.equal(report[key], false);
  for (const key of ['productionWrites', 'externalProviderRequests', 'realPayments', 'newPhoneSessions', 'newMedia']) assert.equal(report[key], 0);
});
