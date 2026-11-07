import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {validateDriverConnectEvidence} from '../scripts/qa/driver-connect-evidence.mjs';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';
import {content, captures} from '../partner-portal/content.mjs';
import {iosPaymentScreen, iosPaymentScreenProgress} from '../partner-portal/ios-payment-screen.mjs';

const root = resolve(import.meta.dirname, '..'), base = 'docs/release/evidence/driver-connect-2026-10-24/';
const read = file => readFileSync(resolve(root, file), 'utf8'), json = file => JSON.parse(read(file));

test('iPhone payment actions retain screen and account generations instead of using an ambient new session', () => {
  const app = 'ios/Sources/SportsGreenMooveApp/';
  const controller = read(app + 'PaymentScreenController.swift');
  for (const text of ['init(access: AccountAccess)', 'active && access.isCurrent && !loading',
    'access.context.role == .driver', 'access.context.grantedRoles.contains(.driver)', 'let work = access.begin()',
    'access.finish(work)', 'revision == generation', 'access.owns(work)', 'url.scheme == "https"',
    'url.user == nil, url.password == nil']) assert(controller.includes(text), text);
  assert(controller.includes('try await gateway.createStripeAccount(email: email)\n            try requireCurrent()'));
  assert(controller.includes('refreshUrl: urls.refreshUrl)\n            try requireCurrent()'));
  assert(controller.includes('openURL(url)\n            try requireCurrent()'));
  const view = read(app + 'PaymentsScreen.swift');
  for (const text of ['PaymentScreenController(access: access)', '.onDisappear { controller.close() }',
    'appState.payRide(booking, access: access)', 'appState.verifyRidePayment(access: access)',
    'appState.refreshAppData(access: access)']) assert(view.includes(text), text);
  assert.doesNotMatch(view, /private func startStripeConnect|appState.loading =|Configurez SGM_|Adresse email Firebase/);
  assert(read(app + 'AppShell.swift').includes('PaymentsScreen(access: access)'));
  assert(read('scripts/check-ios-native-plan.sh').includes('PaymentScreenChecks.swift'));
  assert(read('ios/Tests/SportsGreenMooveNativeChecks/main.swift').includes('try await checkPaymentScreenOwnership()'));
});

test('all four native payment callables use the existing typed and UID-owned boundary', () => {
  const base = 'ios/Sources/SportsGreenMooveApp/';
  const gateway = read(base + 'FirebaseStripePaymentsGateway.swift');
  for (const name of ['createStripeAccount', 'createStripeAccountLink', 'createRidePaymentIntent', 'getRidePaymentStatus']) {
    assert(gateway.includes('paymentCall(name: "' + name + '"'));
  }
  assert(gateway.includes('guard let uid = Auth.auth().currentUser?.uid else { throw CancellationError() }'));
  assert(gateway.includes('firebaseOwnedCall(uid: uid, name: name, input: input)'));
  assert.match(gateway, /decode: @escaping @Sendable \(\[String: Any\]\) throws -> Response/);
  assert.doesNotMatch(gateway, /withCheckedThrowingContinuation|\.httpsCallable\(|@unchecked|@preconcurrency/);
  for (const text of ['CFGetTypeID(number) != CFBooleanGetTypeID()', 'amount.isFinite', 'amount > 0',
    'amount <= Double(Int32.max)', 'amount.rounded(.towardZero) == amount', 'mapRidePaymentState(payload, bookingId: bookingId, paymentIntentId: paymentIntentId)']) {
    assert(gateway.includes(text), text);
  }
  assert(read('scripts/check-ios-support-concurrency.sh').includes('FirebaseStripePaymentsGateway.swift'));
});

test('retained onboarding checks remain synthetic and do not accept SDK, browser or release flows', () => {
  const folder = 'docs/release/evidence/ios-payment-screen-2026-11-04/';
  const proof = json(iosPaymentScreen.source);
  assert.equal(proof.delayedOnboardingCases, 28);
  for (const entry of [proof.nativeChecks, proof.callableSignatures]) {
    assert.equal(entry.exitCode, 0);
    assert.equal(createHash('sha256').update(read(folder + entry.log)).digest('hex'), entry.logSha256);
  }
  assert.match(read(folder + proof.nativeChecks.log), /28 delayed onboarding success\/error boundaries/);
  for (const key of ['sdkLinkedBuildAccepted', 'renderedPaymentScreenAccepted', 'browserOpened', 'providerRequests',
    'realOnboarding', 'livePayment', 'fullSignOutAccepted', 'productionWrites', 'newNativeMediaPublished', 'releaseComplete']) {
    assert.equal(proof[key], key === 'providerRequests' ? 0 : false, key);
  }
  assert.deepEqual(content.iosPaymentScreen, iosPaymentScreen);
  assert.deepEqual(content.updates.filter(entry => entry.source === iosPaymentScreenProgress.source), [iosPaymentScreenProgress]);
  assert.doesNotMatch(iosPaymentScreenProgress.title + iosPaymentScreenProgress.text, /Stripe|Firebase|BrowserStack|SDK|Swift|CI\b/i);
});
test('original device cases, rejected captures and restored-source units retain their different scopes and dates', () => {
  const summary = validateDriverConnectEvidence(root, base + 'summary.json');
  assert.equal(summary.componentTestedAt.slice(0, 10), '2026-10-24'); assert.equal(summary.checkedAt, '2026-10-25');
});
for (const [file, change] of [
  ['summary.json', v => {v.realOnboarding = true;}], ['summary.json', v => {v.physicalDevice = true;}],
  ['summary.json', v => {v.iosTested = true;}], ['summary.json', v => {v.releaseComplete = true;}],
  ['layout/results.json', v => {v.completed = false;}], ['layout/results.json', v => {v.providerRequests = 1;}],
  ['visual-review.json', v => {v.originalThreeCaseNarrowAccepted = true;}],
  ['visual-review.json', v => {v.finalTwoCapturesAccepted = false;}],
  ['host-cleanup.json', v => {v.emulator5554Absent = false;}], ['units/run.json', v => {v.completed = false;}],
  ['red/results.json', v => {v.completed = true;}],
]) test('coherently rehashed unsupported account-preparation proof is rejected: ' + file + ' ' + change, t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-connect-proof-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  cpSync(resolve(root, base), resolve(temp, base), {recursive: true});
  const archive = 'docs/release/evidence/source-archive'; mkdirSync(resolve(temp, archive), {recursive: true});
  const hashes = new Set(['red', 'green', 'layout', 'startup-failure', 'startup-failure-2', 'units'].flatMap(phase =>
    Object.values(json(base + phase + (phase === 'units' ? '/run.json' : '/results.json')).sourceFiles)));
  for (const hash of hashes) cpSync(resolve(root, archive, hash + '.txt'), resolve(temp, archive, hash + '.txt'));
  const row = json(base + file); change(row); const bytes = JSON.stringify(row);
  writeFileSync(resolve(temp, base, file), bytes);
  const checksums = json(base + 'artifact-sha256.json'); checksums[file] = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(resolve(temp, base, 'artifact-sha256.json'), JSON.stringify(checksums));
  assert.throws(() => validateDriverConnectEvidence(temp, base + 'summary.json'));
});
test('the real route owns identity-aware work and the shared button retains wrapped text', () => {
  const route = read('android/app/src/main/java/be/sportgreenmoove/app/ui/PaymentsRoute.kt');
  for (const value of ['rememberCoroutineScope()', 'rememberUpdatedState(sessionUid', 'StripeConnectCoordinator(providers.stripe',
    'loading = blocked || connect.busy', 'connect.start(urls, uriHandler::openUri)']) assert(route.includes(value));
  assert(!/launchStripeConnectOnboarding|Configurez SGM_|Adresse email Firebase/.test(route));
  assert(read('android/app/src/main/java/be/sportgreenmoove/app/ui/PaymentsConnectCard.kt').includes('enabled = !loading'));
  assert(read('android/app/src/main/java/be/sportgreenmoove/app/ui/V2Components.kt').includes('.heightIn(min = size.height)'));
  const smoke = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(smoke.split('"tests/driver-connect-evidence.test.mjs"').length - 1, 2);
  assert(smoke.includes('run: node --test tests/driver-connect-evidence.test.mjs'));
});
test('the portal publishes only the final original captures and retains historical payment proof', () => {
  const flow = content.flows.find(row => row.id === 'payments'); assert.equal(flow.status, 'partial');
  assert.equal(flow.checkedAt, '2026-10-25'); assert.equal(flow.ui.checkedAt, '2026-10-18');
  assert.equal(flow.local.checkedAt, '2026-10-18');
  assert(flow.ui.source.includes('2026-10-18')); assert.equal(flow.tour.length, 2);
  for (const step of flow.tour) assert(captures[step.image].startsWith(base + 'layout/'));
  assert(flow.images.some(image => image.file === 'payment-pending-narrow'));
  assert(!/BrowserStack|Firebase|SDK|Stripe Connect/.test([flow.summary, flow.verified, flow.remaining].join(' ')));
  assert.match(flow.remaining, /commission/); assert.match(flow.remaining, /réels/);
});
test('the original SDK failure remains a preparation failure, not a failed app assertion or a green replay', () => {
  const folder = 'docs/release/evidence/native-setup-8c9851e5-2026-10-24/'; assertEvidenceBundleChecksums(resolve(root, folder));
  const run = json(folder + 'run.json'), summary = json(folder + 'summary.json');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure'); assert.equal(run.headSha, summary.sourceCommit);
  assert.equal(run.jobs.find(job => job.databaseId === 120914862477).conclusion, 'failure');
  for (const key of ['emulatorLaunched', 'ordinarySuiteExecuted', 'authenticatedReplayExecuted', 'releaseComplete']) assert.equal(summary[key], false);
  assert.match(read(folder + 'sdk-installation.txt'), /Error on ZipFile unknown archive/);
});
