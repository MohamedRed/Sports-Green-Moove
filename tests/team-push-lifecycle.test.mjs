import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {XMLParser} from 'fast-xml-parser';
import {parseDocument} from 'yaml';
import {nativeTeamPushLifecycleFolder as folder, validateNativeTeamPushLifecycle} from '../scripts/qa/native-team-push-lifecycle-evidence.mjs';
import {requiredOperationalEvidence} from '../scripts/release-evidence-requirements.mjs';
import {content} from '../partner-portal/content.mjs';
const read = file => readFileSync(resolve(file), 'utf8'), main = 'android/app/src/main/java/be/sportgreenmoove/app/';

test('51 focused local cases and 746 total JVM cases cannot accept real SDK, phone or signout delivery', () => {
  const result = validateNativeTeamPushLifecycle(process.cwd()); assert.equal(result.nativeLifecycleImplemented, true);
  const team = content.flows.find(row => row.id === 'team-conversation'); assert.equal(team.status, 'partial');
  assert.equal(team.pushLifecycle.source, folder + 'review.json'); assert.equal(team.latestEvidence, 'phone');
  assert.equal(team.phone.checkedAt, '2026-10-21'); assert.equal(team.images.length, 62); assert.equal(team.tour.length, 39);
  const update = content.updates.find(row => row.source === folder + 'README.md'); assert(update);
  assert.match(update.text, /En local/); assert.match(update.text, /app fermée reste à terminer/);
  assert.doesNotMatch(update.title + update.text, /firebase|browserstack|FCM|token|dispatcher|API|SDK/i);
});
test('actual app hooks are wired, local builds opt out and an SDK callback never supplies account-scoped token authority', () => {
  const manifest = new XMLParser({ignoreAttributes: false}).parse(read('android/app/src/main/AndroidManifest.xml')).manifest.application;
  assert.equal(manifest['@_android:name'], '.SgmApplication');
  for (const key of ['firebase_messaging_auto_init_enabled', 'firebase_messaging_notification_delegation_enabled'])
    assert.equal(manifest['meta-data'].find(row => row['@_android:name'] === key)['@_android:value'], 'false');
  const service = manifest.service.find(row => row['@_android:name'] === '.services.TeamPushMessagingService');
  assert.equal(service['@_android:enabled'], '${sgmFirebaseAutoInit}'); assert.equal(service['@_android:exported'], 'false');
  assert(read(main + 'SgmApplication.kt').includes('AndroidTeamPushRuntime.start(this)'));
  assert(read(main + 'MainActivity.kt').includes('AndroidTeamPushRuntime.resumed(applicationContext)'));
  const runtime = read(main + 'services/AndroidTeamPushRuntime.kt');
  assert(runtime.includes('if (BuildConfig.SGM_USE_FIREBASE_EMULATOR || runtime != null'));
  assert(runtime.includes('FirebaseAuth.IdTokenListener')); assert(runtime.includes('withTimeout(20_000L)'));
  assert(runtime.includes('Channel.CONFLATED')); assert(!runtime.slice(runtime.indexOf('private fun failed()'), runtime.indexOf('fun signOut()')).includes('request('));
  const refresh = read(main + 'services/TeamPushMessagingService.kt');
  assert(refresh.includes('AndroidTeamPushRuntime.tokenRefreshed(applicationContext)')); assert(!refresh.includes('token)'));
  const recorder = read('scripts/qa/run-native-team-push-journal.mjs');
  for (const flag of ['-PSGM_USE_FIREBASE_EMULATOR=true', '-PSGM_FIREBASE_EMULATOR_HOST=localhost', '-PSGM_LOCAL_REAL_MAPS_UI=false']) assert(recorder.includes(flag));
  const workflow = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  assert(workflow.jobs['people-safety'].steps.find(row => row.name === 'Test team alerts and pending phone delivery').run.includes('tests/team-push-lifecycle.test.mjs'));
});
test('the release gate explicitly retains every unproven operational phone requirement', () => {
  const ids = ['team_push_closed_app_delivery', 'team_push_notification_tap', 'team_push_current_account_isolation',
    'team_push_revocation_suppression', 'team_push_permission_lifecycle', 'team_push_signout_cleanup'];
  for (const file of ['docs/release/evidence-manifest.json', 'docs/release/evidence-manifest.example.json']) {
    const records = JSON.parse(read(file)).operationalUserFlowEvidence.items;
    for (const id of ids) { assert(requiredOperationalEvidence.includes(id)); assert.equal(records.find(row => row.id === id)?.status, 'pending'); }
  }
});
for (const key of ['runtimeCallbacksExecuted', 'realSdkCallsExecuted', 'authenticatedSignoutRemovalVerified', 'realPhoneTokenRegistered',
  'dispatcherImplemented', 'pushDeliveryVerified', 'tapNavigationVerified', 'physicalDevice', 'productionWrites', 'releaseAccepted', 'automaticRetry'])
  test('rehashed model proof cannot promote ' + key, t => {
    const temp = mkdtempSync(resolve(tmpdir(), 'sgm-push-lifecycle-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
    cpSync(resolve(folder), temp, {recursive: true}); const path = resolve(temp, 'review.json'), value = JSON.parse(read(path)); value[key] = true;
    writeFileSync(path, JSON.stringify(value));
    const manifestPath = resolve(temp, 'artifact-sha256.json'), hashes = JSON.parse(read(manifestPath));
    hashes['review.json'] = createHash('sha256').update(readFileSync(path)).digest('hex'); writeFileSync(manifestPath, JSON.stringify(hashes));
    assert.throws(() => validateNativeTeamPushLifecycle(process.cwd(), temp));
  });
