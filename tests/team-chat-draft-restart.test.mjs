import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validateTeamDraftBefore, validateTeamDraftRestart, teamDraftScope } from '../scripts/qa/team-draft-restart-evidence.mjs';
import { validateTeamDraftNativeAttempt } from '../scripts/qa/team-draft-native-attempt.mjs';
import { content } from '../partner-portal/content.mjs';

const runId = 'a'.repeat(32), teamInstanceId = 'b'.repeat(64);
function fixture() {
  const before = { scope: teamDraftScope + '-checkpoint', projectId: 'demo-sgm-local-qa', runId,
    phase: 'draft-prepared', processId: 101, teamInstanceId };
  const sent = { ...before, phase: 'draft-sent', processId: 202, firstProcessId: 101, messageId: 'message-qa' };
  const stop = processId => ({ scope: 'disposable-local-app-force-stop', projectId: before.projectId, runId,
    appId: 'be.sportgreenmoove.app.local', preparedProcessId: processId, observedBeforePid: null,
    forceStopIssued: true, noProcessAfterStop: true });
  const marker = { scope: teamDraftScope, projectId: before.projectId, runId, firstProcessId: 101,
    secondProcessId: 202, processId: 303, messageId: sent.messageId, draftRestored: true,
    explicitSendIndependentlyRead: true, acknowledgedDraftCleared: true, otherAccountDraftEmpty: true,
    parentSignedOut: true, completed: true };
  return [before, stop(101), sent, stop(202), marker];
}
test('three independent processes, two verified stops and actual send acknowledgement are required', () => {
  const values = fixture(); validateTeamDraftRestart(...values, runId); validateTeamDraftBefore(values[0], runId);
});

test('two pre-UI failures and compiled signature correction cannot become successful draft recovery', () => {
  const flow = content.flows.find(item => item.id === 'team-conversation');
  const run = validateTeamDraftNativeAttempt(process.cwd(), flow.draftAttempt.source);
  assert.equal(flow.status, 'partial'); assert.equal(run.executedUserFlowCases, 0);
  assert.deepEqual(run.publishedCaptures, []); assert.equal(flow.images.length, 20);
  assert.match(flow.remaining, /brouillons après fermeture complète/);
});
for (const key of ['nativeCaseCompleted', 'draftRecoveryVerified', 'parentMessageSent', 'fullProcessRestartProven', 'physicalDevice'])
  test(`the failed attempt cannot promote ${key}`, () => {
    const source = content.flows.find(item => item.id === 'team-conversation').draftAttempt.source;
    const read = path => {
      const bytes = readFileSync(path);
      if (!path.endsWith('/results.json')) return bytes;
      const value = JSON.parse(bytes); value[key] = true; return Buffer.from(JSON.stringify(value));
    };
    assert.throws(() => validateTeamDraftNativeAttempt(process.cwd(), source, read));
  });
for (const [label, mutate] of [
  ['activity recreation', values => { values[4].processId = 202; }],
  ['wrong first process', values => { values[2].firstProcessId++; }],
  ['missing force stop', values => { values[1].forceStopIssued = false; }],
  ['still running', values => { values[3].noProcessAfterStop = false; }],
  ['wrong process inventory', values => { values[3].observedBeforePid = 999; }],
  ['another app', values => { values[1].appId = 'be.sportgreenmoove.app'; }],
  ['another run', values => { values[2].runId = 'c'.repeat(32); }],
  ['another team', values => { values[2].teamInstanceId = 'c'.repeat(64); }],
  ['no independent read', values => { values[4].explicitSendIndependentlyRead = false; }],
  ['another receipt', values => { values[4].messageId = 'another'; }],
  ['uncleared draft', values => { values[4].acknowledgedDraftCleared = false; }],
  ['account leak', values => { values[4].otherAccountDraftEmpty = false; }],
]) test(`${label} cannot establish completed team draft recovery`, () => {
  const values = fixture(); mutate(values); assert.throws(() => validateTeamDraftRestart(...values, runId));
});
test('native stages, stored-state checks, original assertions and failed command status stay mandatory', () => {
  const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTeamDraftRestartTest.kt');
  assert.equal((native.match(/@Test fun \w+\(\): Unit =/g) ?? []).length, 3, 'Every expression-bodied JUnit stage must compile to void');
  for (const name of ['preparePrivateTeamDraft', 'recoverAndSendPrivateDraftInNewProcess', 'acknowledgedDraftStaysEmptyInThirdProcess',
    'assertNotEquals', 'driver.observeParentMessage(body)', 'sendRestoredNativeTeamMessage(compose, body)', 'otherAccountDraftEmpty']) assert(native.includes(name));
  const host = read('scripts/qa/local-team-draft-ui.mjs');
  assert(host.indexOf('await verifyTeamDraftRecords(fixture)') < host.indexOf("await instrument('recoverAndSendPrivateDraftInNewProcess')"));
  assert(host.includes('if (commandFailure) throw commandFailure;')); assert(host.includes('if (failure) throw failure;'));
  assert.equal((host.match(/stopDisposableAppProcess\(/g) ?? []).length, 2);
  assert(host.includes('verifyTeamDraftRecords(fixture, marker.messageId)'));
  for (const workflow of ['native-ci', 'web-integration-smoke']) {
    const text = read(`.github/workflows/${workflow}.yml`);
    assert.equal(text.split('"tests/team-chat-*.test.mjs"').length - 1, 2);
    assert(text.includes('tests/team-chat-draft-restart.test.mjs\n'));
  }
});
