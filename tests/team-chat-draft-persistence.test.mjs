import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseDocument } from 'yaml';
import { validateTeamDraftLoss } from '../scripts/qa/team-draft-loss-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const ui = 'android/app/src/main/java/be/sportgreenmoove/app/ui/';
test('the observed draft loss stays failed and distinct from the unverified correction', () => {
  const flow = content.flows.find(item => item.id === 'team-conversation');
  const run = validateTeamDraftLoss(process.cwd(), flow.draftRegression.source);
  assert.equal(flow.status, 'partial'); assert.equal(run.draftLossObserved, true);
  assert.equal(run.fullFlowVerified, false); assert.equal(run.parentSendReached, false);
  assert.match(flow.remaining, /Valider la correction/);
  for (const [id, file] of Object.entries(run.publishedCaptures)) assert(captures[id].endsWith('/' + file));
  assert(flow.tour.every(step => step.image.startsWith('team-access-verified-')));
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
