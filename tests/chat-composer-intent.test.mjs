import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { content } from '../partner-portal/content.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const directory = 'docs/release/evidence/local-chat-intent-2026-10-16/';
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
  processEntities: false, isArray: (name) => name === 'testcase' || name === 'failure' });
function report(name) {
  const xml = read(directory + name);
  assert.equal(XMLValidator.validate(xml), true);
  const suite = parser.parse(xml).testsuite;
  assert.equal(suite.name, 'be.sportgreenmoove.app.ui.ConversationComposerStateTest');
  assert.equal(suite.skipped, 0); assert.equal(suite.errors, 0);
  assert.equal(suite.testcase.length, suite.tests);
  assert.equal(suite.testcase.filter((item) => item.failure?.length).length, suite.failures);
  return suite;
}

test('the preserved failures reproduce discarded pending identity and a late error after acknowledgement', () => {
  const initial = report('identity-baseline-failed.xml');
  assert.equal(initial.tests, 6); assert.equal(initial.failures, 2);
  const expanded = report('monotonic-baseline-failed.xml');
  assert.equal(expanded.tests, 7); assert.equal(expanded.failures, 3);
  const failed = expanded.testcase.filter((item) => item.failure?.length);
  assert.deepEqual(failed.map((item) => item.name).sort(), [
    'anObservedConfirmationCannotBeUndoneByALateSendFailure',
    'anUncertainAttemptKeepsItsIdentityEvenWhenTheRetryIsDefinitelyRejected',
    'cancellationAndSavedHolderRecreationDoNotMakeAPendingIntentFreshAgain',
  ]);
  for (const item of failed) assert.equal(item.failure[0].type, 'java.lang.AssertionError');
  const passed = report('composer-passed.xml');
  assert.equal(passed.tests, 7); assert.equal(passed.failures, 0);
  assert.deepEqual(passed.testcase.map((item) => item.name).sort(), expanded.testcase.map((item) => item.name).sort());
});

test('the actual route delegates to the tested controller while retaining separate saved draft and identity holders', () => {
  const root = 'android/app/src/main/java/be/sportgreenmoove/app/ui/';
  const route = read(root + 'ConversationRoute.kt'), state = read(root + 'ConversationComposerState.kt');
  assert.match(route, /val draftState = rememberSaveable\(ref.key\)/);
  assert.match(route, /val pendingState = rememberSaveable\(ref.key\)/);
  assert.match(route, /ConversationComposerState\(draftState, pendingState\)/);
  assert.match(route, /composer.send\(ref, gateway, ::acknowledged\)/);
  assert(!route.includes('definitelyRejected')); assert(!route.includes('UUID.randomUUID'));
  assert.match(state, /val retryingUnconfirmed = pendingId != null/);
  assert.match(state, /definitelyRejected && !retryingUnconfirmed/);
  assert.match(state, /pendingId != requestId -> Unit/);
  assert.match(state, /if \(sending \|\| locked\) return/);
  for (const path of ['ConversationRoute.kt', 'ConversationComposerState.kt']) assert(read(root + path).split('\n').length < 300);
  const screen = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/ConversationFlowTest.kt');
  assert(screen.includes('aRejectedRetryDoesNotReplaceAnUnconfirmedSend'));
  assert(screen.includes('gateway.requests.size == 3'));
});

test('the evidence keeps UI execution, physical delivery and durable draft recovery outside the local unit result', () => {
  const report = read(directory + 'README.md');
  for (const limit of ['not a measured production duplicate', 'does not prove screen execution',
    'not durable draft recovery', 'not deployed to production']) assert(report.includes(limit));
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/chat-composer-intent.test.mjs"').length - 1, 2);
  assert.equal(workflow.split('"android/app/src/main/java/be/sportgreenmoove/app/ui/Conversation*.kt"').length - 1, 2);
  assert.match(workflow, /^\s+run: node --test[^\n]*\btests\/chat-composer-intent\.test\.mjs(?:\s|$)/m);
  const flow = content.flows.find((item) => item.id === 'messages');
  assert.equal(flow.status, 'partial'); assert.equal(flow.source, 'docs/release/evidence/native-matrix-67ab59c-2026-10-19/README.md');
  assert.equal(flow.ui.source, 'docs/release/evidence/native-matrix-67ab59c-2026-10-19/replay/results.json');
  assert.equal(flow.local.source, 'docs/release/evidence/local-booking-recovery-2026-10-17/services.json');
  const update = content.updates.find((item) => item.title === 'Le renvoi ne crée pas de doublon');
  assert.match(update.text, /essai local/i);
  assert.match(update.text, /un seul message et une seule notification/);
});
