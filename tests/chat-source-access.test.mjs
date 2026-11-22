import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {chatSourceAccess, chatSourceAccessProgress} from '../partner-portal/chat-source-access.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const json = path => JSON.parse(read(path));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const folder = 'docs/release/evidence/chat-source-access-2026-11-05/';
const report = json(chatSourceAccess.source);
const source = 'android/app/src/main/java/be/sportgreenmoove/app/';
const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();

test('original unauthorized history and query-compatibility failures stay independently retained', () => {
  for (const record of report.records) assert.equal(sha(read(folder + record.file)), record.sha256);
  for (const row of json(chatSourceAccess.checksums).files)
    assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
  const baseline = json(folder + 'baseline.json'); assert(baseline.completed && baseline.baseline);
  const removals = baseline.observations.filter(row => row.apiAfter !== 'allowed');
  assert.equal(removals.length, 7); assert(removals.every(row => row.directGetAfter === 200 && row.queryAfter === 200));
  for (const name of ['first-candidate-failed.json', 'query-observation-failed.json', 'field-binding-failed.json'])
    assert.equal(json(folder + name).completed, false);
  const diagnostic = json(folder + 'query-proof-diagnostic.json'); assert.equal(diagnostic.results.length, 8);
  assert.equal(diagnostic.results.find(row => row.name === 'candidate').queryBefore.status, 'permission-denied');
  const compatible = diagnostic.results.find(row => row.name === 'without-static-list-type');
  assert.equal(compatible.queryBefore.status, 'allowed'); assert.equal(compatible.queryAfter.status, 'permission-denied');
});

test('message-only listener failure is not silently promoted by the application source-observer correction', () => {
  const negative = json(folder + 'message-listener-negative.json');
  assert.equal(negative.numTotalTests, 219); assert.equal(negative.numPassedTests, 218); assert.equal(negative.numFailedTests, 1);
  const failed = negative.testResults.flatMap(row => row.assertionResults).filter(row => row.status === 'failed');
  assert.equal(failed.length, 1); assert.match(failed[0].fullName, /terminates an active SDK query/);
  assert(read('docs/release/evidence/source-archive/f1941203ccf763f4eeb6456129b0f7ef75192538fa54e21440b5355600078ef5.txt')
    .includes('Current-source listener did not terminate'));
  assert(report.originalMessageListenerExpectationFailed && report.independentSourceObserverRequired);
  const actual = read('tests/chat-source-access-rules.test.ts');
  assert(actual.includes('observes source revocation independently of a still-open message query'));
  assert(actual.includes('stopMessages?.(); stopSource?.()'));
});

test('complete original rules, services and unit workloads pass with preserved records and verified cleanup', () => {
  const rules = json(folder + 'rules.json'); assert.equal(rules.numTotalTests, 219); assert.equal(rules.numPassedTests, 219);
  assert.equal(rules.numFailedTests, 0); assert.equal(rules.numPendingTests, 0);
  const services = json(folder + 'services.json'); assert.equal(services.checks.length, 9);
  assert(services.completed && services.checks.every(row => row.status === 'passed'));
  assert(services.isolatedEnvironmentDestroyed && services.adminClientClosed && services.firestoreClientTerminated && services.endpoints.closed);
  assert.equal(services.protectedRecordCount, 22); assert.equal(services.sourceFiles['firestore.rules'], report.rulesPolicySha256);
  for (const name of ['rules-cleanup.json', 'message-listener-negative-cleanup.json', 'source-listener-negative-cleanup.json',
    'runner-argument-failure-cleanup.json']) {
    const cleanup = json(folder + name); assert(cleanup.ownedEnvironmentDestroyed && cleanup.endpoints.closed);
  }
  assert.deepEqual(report.androidUnitTests, {tests: 840, failures: 0, errors: 0, skipped: 0});
  const command = json('package.json').scripts['test:rules'];
  for (const name of ['security', 'chat-inbox', 'chat-source-access', 'membership', 'trip-capacity', 'team-ownership',
    'trip-cancellation', 'trip-details', 'trip-change', 'booking-request', 'child-account-link']) assert(command.includes(`tests/${name}-rules.test.ts`));
});

test('Android owns source and identity listeners independently, with no cache grant or polling fallback', () => {
  const observer = read(source + 'services/ConversationSourceObserver.kt');
  for (const text of ['!snapshot.metadata.isFromCache', '!snapshot.metadata.hasPendingWrites()', 'ConversationSourceAccess.permits',
    'auth.currentUser?.uid != uid', 'source.remove()', 'auth.removeAuthStateListener(identity)']) assert(observer.includes(text));
  const gateway = read(source + 'services/FirebaseAndroidConversationGateway.kt');
  assert(gateway.indexOf('val access = authorize(ref)') < gateway.indexOf('ConversationSourceAccess.guard('));
  assert(gateway.includes('observeConversationSource(firestore, auth, ref, access.uid)'));
  const guard = read(source + 'domain/ConversationSourceAccess.kt');
  assert(guard.includes('access.distinctUntilChanged().flatMapLatest')); assert(guard.includes('throw ConversationAccessRevokedException()'));
  assert(guard.includes('(source["parentUserId"] ?: source["requesterUserId"]) == uid'));
  assert.doesNotMatch(observer + guard, /delay\(|Thread.sleep|while\s*\(|GlobalScope|setCustomUserClaims/);
  const state = read(source + 'ui/ConversationState.kt');
  assert(state.includes('if (ticket != generation) return')); assert(state.includes('generation++; clearContent()'));
  assert(state.includes('messages = emptyList(); participantNames = emptyList()'));
  for (const name of ['domain/ConversationSourceAccess.kt', 'services/ConversationSourceObserver.kt', 'ui/ConversationState.kt'])
    assert(read(source + name).split('\n').length < 300);
});

test('rules release is explicit, deletion-protected and validated without plans, applies or credentials in smoke CI', () => {
  const terraform = read('infra/firestore-rules/main.tf');
  for (const text of ['filebase64sha256(', 'google_firebaserules_ruleset.firestore.id', 'deletion_policy = "ABANDON"',
    'deletion_policy = "PREVENT"', 'prevent_destroy = true', 'create_before_destroy = true', 'import {', 'projects/${var.project_id}/releases/cloud.firestore'])
    assert(terraform.includes(text));
  assert.doesNotMatch(terraform, /default\s*=|google_project|google_billing|google_storage|local-exec/);
  assert(json(folder + 'terraform-validation.json').valid);
  const steps = Object.values(web.jobs).flatMap(job => job.steps);
  assert.deepEqual(steps.filter(step => step.name === 'Verify current booking and ride chat authority'), [{
    name: 'Verify current booking and ride chat authority', env: {SGM_LOCAL_FLOW_OUTPUT: '${{ runner.temp }}/chat-source-access.json'},
    run: 'npm run test:chat-source-access && node --test tests/chat-source-access.test.mjs tests/ios-current-fixture-result.test.mjs tests/ios-input-controls.test.mjs tests/ios-ride-chat.test.mjs',
  }]);
  const validation = steps.find(step => step.name === 'Validate rules configuration without cloud changes');
  assert(validation.run.includes('init -backend=false -input=false -lockfile=readonly'));
  assert.doesNotMatch(validation.run, /\bplan\b|\bapply\b|\bimport\b|\bdestroy\b|secrets\./);
  for (const event of ['pull_request', 'push']) {
    assert(web.on[event].paths.includes('tests/chat-source-access*.test.*'));
    assert(web.on[event].paths.includes('infra/firestore-rules/**'));
  }
});

test('one concise local-only portal note preserves all historical flows and leaves deployment/native release pending', () => {
  assert.deepEqual(content.chatSourceAccess, chatSourceAccess);
  assert.deepEqual(content.updates.filter(row => row.source === chatSourceAccessProgress.source), [chatSourceAccessProgress]);
  assert.doesNotMatch(chatSourceAccessProgress.title + chatSourceAccessProgress.text, /Firebase|BrowserStack|Terraform|SDK|Kotlin|CI\b/i);
  const previous = json(folder + 'portal-before.json');
  for (const row of previous.flows) assert.equal(sha(JSON.stringify(content.flows.find(item => item.id === row.id))), row.sha256);
  for (const hash of previous.updates) assert(content.updates.some(row => sha(JSON.stringify(row)) === hash));
  assert.equal(sha(JSON.stringify(content.blockers)), previous.blockers);
  for (const key of ['productionRulesApplied', 'nativeUiAccepted', 'iphoneConversationImplemented', 'physicalDeviceAccepted', 'releaseComplete'])
    assert.equal(report[key], false);
  const item = json('docs/release/evidence-manifest.json').operationalUserFlowEvidence.items.find(row => row.id === 'booking_ride_chat_access_revocation');
  assert.equal(item.status, 'pending');
  assert.doesNotMatch(item.description, /conversation remains unimplemented/);
  assert(item.evidenceRefs.includes('evidence/ios-ride-chat-2026-11-05/README.md'));
  assert(item.evidenceRefs.includes('evidence/ios-fixture-pass-a37-2026-11-05/README.md'));
});
