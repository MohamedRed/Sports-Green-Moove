import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseDocument } from 'yaml';
import { validateTeamDraftLoss } from '../scripts/qa/team-draft-loss-evidence.mjs';
import { validateRetainedTeamDraft, teamDraftStages } from '../scripts/qa/team-draft-native-retained.mjs';
import { validateTeamDraftErrorCaptureAttempt } from '../scripts/qa/team-draft-error-capture-attempt.mjs';
import { validateTeamDraftErrorComponents } from '../scripts/qa/team-draft-error-components.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const ui = 'android/app/src/main/java/be/sportgreenmoove/app/ui/';
test('both actual storage-error component methods pass without accepting a physical or connected failure test', () => {
  const flow = content.flows.find(item => item.id === 'team-conversation');
  const run = validateTeamDraftErrorComponents(process.cwd(), flow.draftErrorRecovery.source);
  assert.deepEqual(run.componentCases, { executed: 2, passed: 2, failed: 0 });
  assert.equal(run.simulatedStorageFailures, true); assert.equal(flow.status, 'partial');
  for (const [id, file] of Object.entries(run.publishedCaptures)) assert(captures[id].endsWith('/' + file));
  assert(flow.images.filter(item => item.file.startsWith('team-draft-errors-')).every(item => /simulée/.test(item.alt)));
  for (const key of ['connectedServicesVerified', 'physicalDevice', 'productionWrites', 'notificationsVerified', 'releaseReady'])
    assert.throws(() => validateTeamDraftErrorComponents(process.cwd(), flow.draftErrorRecovery.source, path => {
      const bytes = readFileSync(path); if (!path.endsWith('/results.json')) return bytes;
      const changed = JSON.parse(bytes); changed[key] = true; return Buffer.from(JSON.stringify(changed));
    }));
  for (const file of ['instrumentation-results.xml', 'team-draft-read-error.png', 'team-draft-write-error.png'])
    assert.throws(() => validateTeamDraftErrorComponents(process.cwd(), flow.draftErrorRecovery.source,
      path => path.endsWith('/' + file) ? Buffer.from('invalid evidence') : readFileSync(path)));
});
test('the failed storage-error capture remains distinct from the successful connected draft recovery', () => {
  const flow = content.flows.find(item => item.id === 'team-conversation');
  const attempt = validateTeamDraftErrorCaptureAttempt(process.cwd(), flow.draftErrorChecks.source);
  assert.deepEqual(attempt.componentCases, { executed: 2, passed: 1, failed: 1 });
  assert.equal(attempt.correctedNativeUiVerified, false); assert.deepEqual(attempt.publishedCaptures, []);
  assert.match(flow.remaining, /notifications.*téléphones/); assert.equal(flow.status, 'partial');
  assert.equal(validateRetainedTeamDraft(process.cwd(), flow.draftRestart.source).fullProcessRestartProven, true);
  assert(read('.gitattributes').includes('docs/release/evidence/team-draft-error-capture-2026-10-21/*.xml -text -whitespace'));
});
test('draft error components use a full-height narrow portrait host without weakening capture guards', () => {
  const component = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/TeamConversationDraftFlowTest.kt');
  assert(component.includes('Box(Modifier.width(320.dp).fillMaxHeight())'));
  assert(component.includes('fontScale = 1.3f'));
  assert(component.includes('captureLocalUi(compose, "$stem.png")'));
  const capture = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalUiCapture.kt');
  assert(capture.includes('check((bitmap.width > bitmap.height) == landscape)'));
  assert(capture.includes('check(colors.size > 16)'));
});
test('the unchanged native case proves unsent recovery, one explicit send and empty composer across three processes', () => {
  const flow = content.flows.find(item => item.id === 'team-conversation');
  const run = validateRetainedTeamDraft(process.cwd(), flow.draftRestart.source);
  assert.equal(run.nativeCaseCount, 3); assert.equal(Object.keys(run.transcripts).length, 3);
  assert.equal(run.unsentCheckpoint.messageCount, 2); assert.equal(run.fixtureIsolation.messageCount, 3);
  assert.equal(run.fixtureIsolation.exactlyOneExplicitParentSend, true);
  assert.equal(new Set([run.firstProcessId, run.secondProcessId, run.processId]).size, 3);
  assert.equal(flow.status, 'partial'); assert.equal(flow.tour.length, 11);
  assert.deepEqual(flow.tour.slice(0, 5).map(step => step.image), teamDraftStages.map(id => 'team-draft-verified-' + id));
  for (const [id, file] of Object.entries(run.publishedCaptures)) assert(captures[id].endsWith('/' + file));
  assert(captures['team-draft-verified-reopened'].endsWith('/team-draft-reopened.png'));
});
for (const [file, mutate] of [
  ['team-draft-results.json', x => { x.physicalDevice = true; }],
  ['team-draft-results.json', x => { x.notificationsVerified = true; }],
  ['team-draft-results.json', x => { x.safetyAuditAccepted = true; }],
  ['team-draft-results.json', x => { x.productionWrites = true; }],
  ['team-draft-results.json', x => { x.isolatedEnvironmentDestroyed = false; }],
  ['team-draft-results.json', x => { x.fixtureIsolation.messageCount = 4; }],
  ['local-team-draft-stop.json', x => { x.noProcessAfterStop = false; }],
  ['local-team-draft-sent-stop.json', x => { x.forceStopIssued = false; }],
  ['team-draft-device.json', x => { x.processId = x.secondProcessId; }],
  ['team-draft-unsent-checkpoint.json', x => { x.messageCount = 3; }],
  ['disposable-device-restore.json', x => { x.restoration.installAdmin.authorizationRemoved = false; }],
  ['job.json', x => { x.conclusion = 'failure'; }],
  ['artifact.json', x => { x.workflow_run.head_sha = 'f'.repeat(40); }],
  ['visual-review.json', x => { x.published['team-draft-verified-reopened'] = 'team-draft-reopened-window.png'; }],
]) test(`completed draft proof rejects contradictory ${file}: ${mutate}`, () => {
  const source = content.flows.find(item => item.id === 'team-conversation').draftRestart.source;
  assert.throws(() => validateRetainedTeamDraft(process.cwd(), source, path => {
    const bytes = readFileSync(path); if (!path.endsWith('/' + file)) return bytes;
    const value = JSON.parse(bytes); mutate(value); return Buffer.from(JSON.stringify(value));
  }));
});
test('a missing native transcript or modified original capture cannot be promoted to complete draft proof', () => {
  const source = content.flows.find(item => item.id === 'team-conversation').draftRestart.source;
  for (const file of ['LocalTeamDraftRestartTest#recoverAndSendPrivateDraftInNewProcess-instrumentation.txt', 'team-draft-reopened.png'])
    assert.throws(() => validateRetainedTeamDraft(process.cwd(), source, path =>
      path.endsWith('/' + file) ? Buffer.from('not proof') : readFileSync(path)));
});
test('the observed draft loss stays failed and distinct from the later verified correction', () => {
  const flow = content.flows.find(item => item.id === 'team-conversation');
  const run = validateTeamDraftLoss(process.cwd(), flow.draftRegression.source);
  assert.equal(flow.status, 'partial'); assert.equal(run.draftLossObserved, true);
  assert.equal(run.fullFlowVerified, false); assert.equal(run.parentSendReached, false);
  assert.match(flow.remaining, /notifications.*téléphones/);
  for (const [id, file] of Object.entries(run.publishedCaptures)) assert(captures[id].endsWith('/' + file));
  assert(flow.tour.slice(0, 5).every(step => step.image.startsWith('team-draft-verified-')));
  assert(flow.tour.slice(5).every(step => step.image.startsWith('team-access-verified-')));
});
for (const key of ['draftRestored', 'parentSendReached', 'thirdProcessReached', 'fullFlowVerified', 'postFailureStoredStateVerified', 'physicalDevice'])
  test(`the failed draft artifact cannot accept ${key}`, () => {
    const source = content.flows.find(item => item.id === 'team-conversation').draftRegression.source;
    assert.throws(() => validateTeamDraftLoss(process.cwd(), source, path => {
      const bytes = readFileSync(path); if (!path.endsWith('/results.json')) return bytes;
      const value = JSON.parse(bytes); value[key] = true; return Buffer.from(JSON.stringify(value));
    }));
  });
test('the team route always loads private durable state and never silently substitutes a blank composer', () => {
  const route = read(ui + 'TeamConversationRoute.kt'), state = read(ui + 'TeamConversationDraftState.kt');
  assert(route.includes('SharedPreferencesTeamConversationDrafts(context)'));
  assert(!route.includes('rememberSaveable')); assert(route.includes('TeamConversationDraftScreen(draft.error, draft::load, onBack)'));
  assert(state.indexOf('val saved = storage.read(uid, target)') < state.indexOf('composer = ConversationComposerState('));
  assert(state.includes('catch (cancelled: CancellationException) { throw cancelled }'));
  assert(!state.includes('getOrDefault')); assert(!state.includes('getOrNull')); assert(!state.includes('runCatching'));
  const storage = read('android/app/src/main/java/be/sportgreenmoove/app/services/SharedPreferencesTeamConversationDrafts.kt');
  assert(storage.includes('Context.MODE_PRIVATE')); assert(storage.includes('JSONArray(listOf(uid, target.teamId, target.teamInstanceId))'));
  assert(storage.includes('check(edit.commit())')); assert(!storage.includes('edit.apply()'));
  assert(storage.includes('json.keys().asSequence().toSet()')); assert(storage.includes('json.get("uid") == uid'));
  assert(storage.includes('json.get("teamInstanceId") == target.teamInstanceId'));
  assert(read('android/app/src/main/AndroidManifest.xml').includes('android:allowBackup="false"'));
});
test('pending identity is committed before the existing send and cleared durably before acknowledgement', () => {
  const source = read(ui + 'ConversationComposerState.kt');
  assert(source.indexOf('if (!save(draft, requestId)) return') < source.indexOf('pendingId = requestId'));
  assert(source.indexOf('if (!save(draft, requestId)) return') < source.indexOf('send(body, requestId)'));
  assert(source.indexOf('if (!save("", null)) return') < source.indexOf('draft = ""'));
  assert(source.includes('if (save(draft, null))')); assert(source.includes('!retryingUnconfirmed'));
  assert(source.includes('catch (cancelled: CancellationException) { throw cancelled }'));
});
test('native error layouts and the actual restart lane are mandatory, without changing their expected outcomes', () => {
  const errors = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/TeamConversationDraftFlowTest.kt');
  for (const text of ['Modifier.width(320.dp)', 'fontScale = 1.3f', 'assertEquals(0, sends)', 'assertEquals(1, sends)',
    'team-draft-read-error', 'team-draft-write-error', 'assertDoesNotExist()', 'assertIsDisplayed()']) assert(errors.includes(text));
  const collector = read('scripts/run-android-ui-tests-and-collect-screenshots.sh');
  assert(collector.includes('for stem in team-draft-read-error team-draft-write-error'));
  const host = read('scripts/qa/local-team-draft-ui.mjs');
  for (const file of ['TeamConversationDraftState.kt', 'TeamConversationDraftScreen.kt', 'TeamConversationDraftStorage.kt', 'SharedPreferencesTeamConversationDrafts.kt'])
    assert(host.includes(file), file);
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTeamDraftRestartTest.kt');
  assert(native.includes('assertEquals("The private unsent team draft must survive a fully stopped process", body, inputText())'));
  for (const workflow of ['native-ci', 'web-integration-smoke']) assert(Object.values(parseDocument(read(`.github/workflows/${workflow}.yml`)).toJSON().jobs)
    .some(job => job.steps?.some(step => step.run?.split(/\s+/).includes('tests/team-chat-draft-persistence.test.mjs'))));
  const smoke = read('.github/workflows/web-integration-smoke.yml');
  for (const pattern of ['android/app/src/main/java/be/sportgreenmoove/app/services/*TeamConversation*.kt',
    'android/app/src/main/java/be/sportgreenmoove/app/ui/TeamConversation*.kt',
    'android/app/src/test/java/be/sportgreenmoove/app/ui/TeamConversationDraftStateTest.kt',
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/TeamConversation*Test.kt']) assert.equal(smoke.split('"' + pattern + '"').length - 1, 2);
});
