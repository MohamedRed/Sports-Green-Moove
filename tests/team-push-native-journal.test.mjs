import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {parseDocument} from 'yaml';
import {nativeTeamPushFolder as folder, validateNativeTeamPushJournal} from '../scripts/qa/native-team-push-journal-evidence.mjs';
import {content} from '../partner-portal/content.mjs';
const read = file => readFileSync(resolve(file), 'utf8');

test('twenty-seven native-journal cases and the complete 722-case JVM result are not phone delivery', () => {
  const run = validateNativeTeamPushJournal(process.cwd()); assert.equal(run.focusedUnitTests, 27);
  const team = content.flows.find(row => row.id === 'team-conversation');
  assert.equal(team.pushJournal.source, folder + 'review.json'); assert.equal(team.status, 'partial');
  assert.equal(team.latestEvidence, 'phone'); assert.equal(team.phone.checkedAt, '2026-10-21');
  assert.equal(team.images.length, 62); assert.equal(team.tour.length, 39); assert.match(team.remaining, /app fermée/);
  const progress = content.updates.find(row => row.source === folder + 'README.md'); assert(progress);
  assert.match(progress.text, /En local/); assert.match(progress.text, /app fermée reste à terminer/);
  assert.doesNotMatch(progress.title + progress.text, /firebase|browserstack|FCM|token|dispatcher|API|SDK/i);
});
test('the private journal is deliberately not advertised as an installed runtime integration', () => {
  const main = 'android/app/src/main/java/be/sportgreenmoove/app/services/';
  const journal = read(main + 'TeamPushJournal.kt');
  for (const marker of ['old.confirmed != null', 'old.pending != command', 'old.epoch != ticket.epoch',
    'old.revision != ticket.revision', 'check(!old.needsTokenDeletion)', 'old.pending != command']) assert(journal.includes(marker));
  const storage = read(main + 'FileTeamPushStorage.kt');
  assert(storage.includes('synchronized(lock)')); assert(storage.includes('it.fd.sync()')); assert(storage.includes('ATOMIC_MOVE'));
  assert(!storage.includes('catch')); assert(read(main + 'AndroidTeamPushJournal.kt').includes('noBackupFilesDir'));
  const client = read(main + 'FirebaseAndroidTeamPushRegistration.kt');
  assert.equal(client.match(/currentUid\(\) != command.uid/g).length, 2); assert(client.includes('registerTeamPushDevice'));
  assert.doesNotMatch(client, /println|Log\.|getToken\(|FirebaseMessaging/);
  const workflow = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  const command = workflow.jobs['people-safety'].steps.find(row => row.name === 'Test team alerts and pending phone delivery').run;
  assert(command.includes('tests/team-push-native-journal.test.mjs')); assert(command.includes('npm run test:team-push-registration'));
});
for (const key of ['instrumentationExecuted', 'nativeLifecycleImplemented', 'realPhoneTokenRegistered', 'dispatcherImplemented',
  'pushDeliveryVerified', 'tapNavigationVerified', 'physicalDevice', 'productionWrites', 'releaseAccepted'])
  test('rehashing cannot promote journal-only evidence to ' + key, t => {
    const temp = mkdtempSync(resolve(tmpdir(), 'sgm-native-push-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
    cpSync(resolve(folder), temp, {recursive: true});
    const path = resolve(temp, 'review.json'), report = JSON.parse(read(path)); report[key] = true;
    writeFileSync(path, JSON.stringify(report));
    const manifestPath = resolve(temp, 'artifact-sha256.json'), manifest = JSON.parse(read(manifestPath));
    manifest['review.json'] = createHash('sha256').update(readFileSync(path)).digest('hex'); writeFileSync(manifestPath, JSON.stringify(manifest));
    assert.throws(() => validateNativeTeamPushJournal(process.cwd(), temp));
  });
