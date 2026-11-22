import assert from 'node:assert/strict';
import test from 'node:test';
import {cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {Timestamp} from 'firebase-admin/firestore';
import {teamPushRegistrationFingerprint} from '../functions/lib/domain/teamPushRegistration.js';
import {verifyTeamPushSignOutRecords} from '../scripts/qa/team-push-signout-records.mjs';
import {nativeTeamPushSignOutFolder, validateNativeTeamPushSignOut} from '../scripts/qa/native-team-push-signout-evidence.mjs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const services = 'android/app/src/main/java/be/sportgreenmoove/app/services/', ui = 'android/app/src/main/java/be/sportgreenmoove/app/ui/';
test('770 total and 79 focused JVM cases are retained without promoting the unexecuted connected or phone scope', () => {
  const result = validateNativeTeamPushSignOut(process.cwd());
  assert.equal(result.authenticatedRemovalModelVerified, true); assert.equal(result.syntheticTokenConnectedContractExecuted, false);
  assert.equal(result.authenticatedSignoutRemovalVerified, false); assert.equal(result.signOutUiCasesExecuted, false);
});
for (const key of ['instrumentationExecuted', 'signOutUiCasesExecuted', 'syntheticTokenConnectedContractExecuted',
  'authenticatedSignoutRemovalVerified', 'realSdkCallsExecuted', 'pushDeliveryVerified', 'releaseAccepted'])
  test('even rehashed signout model evidence cannot promote ' + key, t => {
    const temp = mkdtempSync(resolve(tmpdir(), 'sgm-signout-model-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
    cpSync(nativeTeamPushSignOutFolder, temp, {recursive: true});
    const file = resolve(temp, 'review.json'), value = JSON.parse(readFileSync(file)); value[key] = true;
    writeFileSync(file, JSON.stringify(value)); const index = resolve(temp, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(index));
    hashes['review.json'] = createHash('sha256').update(readFileSync(file)).digest('hex'); writeFileSync(index, JSON.stringify(hashes));
    assert.throws(() => validateNativeTeamPushSignOut(process.cwd(), temp));
  });

test('the production exit sequence is bounded off the UI thread and always reaches local auth cleanup', () => {
  const exit = read(ui + 'AppSessionShutdown.kt'), state = read(ui + 'SessionShutdownState.kt');
  assert(exit.indexOf('providers.auth.prepareSignOut()') < exit.indexOf('providers.googleAuth.signOut()'));
  for (const marker of ['Dispatchers.IO', 'withTimeout(3_000L)', 'withContext(NonCancellable)', 'finally { providers.auth.signOut() }']) assert(exit.includes(marker));
  for (const marker of ['if (pending) return', 'CoroutineStart.UNDISPATCHED', 'try { before() } finally { finish() }', 'finally { pending = false }']) assert(state.includes(marker));
  const app = read(ui + 'SportsGreenMooveApp.kt'), gate = read(ui + 'AppAccessGate.kt');
  assert(app.indexOf('session = null') < app.indexOf('}, finished = { failed ->'));
  assert(gate.indexOf('shutdownPending ->') < gate.indexOf('session == null ->')); assert(gate.includes('WindowInsets.safeDrawing'));
  assert(app.split('\n').length < 300); assert(!app.includes('signOutProviders(providers)'));
});
test('logout intent is durable and only a verified explicit sign-in clears its current-user barrier', () => {
  const codec = read(services + 'TeamPushRecordCodec.kt'), lifecycle = read(services + 'TeamPushLifecycle.kt');
  assert(codec.includes('"version" to "2"')); assert(codec.includes('version in setOf("1", "2")'));
  assert(codec.includes('values.keys == if (version == "1") keys else keys + "signOutUid"'));
  assert(lifecycle.includes('journal.beginSignOut(currentUid())')); assert(!lifecycle.includes('signingOutUid'));
  assert(lifecycle.includes('withTimeout(2_500L)')); assert(lifecycle.includes('catch (cancelled: CancellationException) { throw cancelled }'));
  const auth = read(services + 'FirebaseAndroidRuntime.kt'), onboarding = read(ui + 'OnboardingRoute.kt');
  assert(auth.indexOf('requiresSignOut(context, user.uid)') < auth.indexOf('return initializeUserProfile(user)'));
  assert(auth.includes('check(user.uid == expectedUid)')); assert(auth.includes('AndroidTeamPushRuntime.authorizeSignIn(context, session.uid)'));
  assert.equal((onboarding.match(/providers.auth.completeSocialSignIn\(session.uid\)/g) ?? []).length, 2);
  assert(!onboarding.includes('providers.auth.currentSession() ?: session'));
});
test('the connected contract runs the real app exit and records only a synthetic messaging-token scope', () => {
  const runner = read('scripts/qa/local-team-conversation-ui.mjs');
  assert(runner.includes('verifyTeamPushSignOutRecords(db, phoneSignOut'));
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTeamPushSignOutContract.kt');
  for (const marker of ['BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR', 'projectId == "demo-sgm-local-qa"',
    'FirebaseAndroidTeamPushRegistration(auth)', 'lifecycle.prepareSignOut()', 'auth.currentUser == null', 'realMessagingSdkCalls", 0']) assert(native.includes(marker));
  assert(!native.includes('FirebaseMessaging.getInstance'));
  const content = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTeamTestContent.kt');
  assert(content.includes('onActivityPostCreated')); assert(content.includes('unregisterActivityLifecycleCallbacks(this)'));
  assert(content.includes('SportsGreenMooveApp { providers }'));
  const collector = read('scripts/run-android-ui-tests-and-collect-screenshots.sh');
  for (const name of ['session-exit-narrow.png', 'session-exit-wide-dark.png']) assert.equal(collector.split(name).length - 1, 2);
});

function fixture() {
  const marker = {scope: 'isolated-native-ui-signout-with-synthetic-phone-token', projectId: 'demo-sgm-local-qa', runId: 'isolated-run',
    installationHash: 'a'.repeat(64), activationRevision: 2, removalRevision: 3, confirmedWhileAuthenticated: true,
    authAbsentAfter: true, uiLoginReturned: true, durableSignOutIntent: true, syntheticTokenCalls: 1, realMessagingSdkCalls: 0, pushDeliveryVerified: false};
  const record = {schemaVersion: 1, userId: 'driver', platform: 'android', secretHash: 'b'.repeat(64), revision: 3,
    fingerprint: teamPushRegistrationFingerprint('driver', {platform: 'android', revision: 3, token: null}),
    active: false, token: null, createdAt: Timestamp.fromMillis(1), updatedAt: Timestamp.fromMillis(2)};
  const data = {marker, record, installations: 1, tokenIndexes: 0};
  data.db = {collection(name) { return {doc(id) { assert.equal(id, marker.installationHash); return {async get() {return {exists: true, data: () => record};}};},
    async get() {return {size: name === 'teamPushInstallations' ? data.installations : data.tokenIndexes};}};}};
  return data;
}
test('independent final-state verification does not promote the activation receipt or real SDK delivery', async () => {
  const f = fixture(), result = await verifyTeamPushSignOutRecords(f.db, f.marker, {uid: 'driver', runId: 'isolated-run'});
  assert.equal(result.finalRemovalIndependentlyRead, true); assert.equal(result.activationIndependentlyRead, false); assert.equal(result.pushDeliveryVerified, false);
});
for (const [name, mutate] of [
  ['wrong owner', f => f.record.userId = 'other'], ['still active', f => f.record.active = true],
  ['wrong revision', f => f.record.revision++], ['wrong fingerprint', f => f.record.fingerprint = '0'.repeat(64)],
  ['token still stored', f => f.record.token = 'synthetic_' + 'T'.repeat(80)], ['token index remains', f => f.tokenIndexes++],
  ['extra installation', f => f.installations++], ['no auth acknowledgement', f => f.marker.confirmedWhileAuthenticated = false],
  ['no durable intent', f => f.marker.durableSignOutIntent = false], ['no UI return', f => f.marker.uiLoginReturned = false],
  ['real SDK promoted', f => f.marker.realMessagingSdkCalls = 1], ['delivery promoted', f => f.marker.pushDeliveryVerified = true],
]) test('signout proof rejects ' + name, async () => {
  const f = fixture(); mutate(f); await assert.rejects(() => verifyTeamPushSignOutRecords(f.db, f.marker, {uid: 'driver', runId: 'isolated-run'}));
});
