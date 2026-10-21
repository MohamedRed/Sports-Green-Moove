import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const native = path => read('android/app/src/main/java/be/sportgreenmoove/app/' + path);

test('read acknowledgments require current account-bound authority and validate the entire batch before writing', () => {
  const schema = read('functions/src/domain/teamConversationRead.ts');
  for (const text of ['expectedAccessVersion: hash', '.min(1).max(50)', 'new Set(ids).size === ids.length', '}).strict()',
    'digest(["team-read-v1", uid, messageId])']) assert(schema.includes(text), text);
  const service = read('functions/src/services/teamConversationRead.ts');
  for (const text of ['requireTeamConversationAccess(transaction, uid, token, input)',
    'access.accessVersion !== input.expectedAccessVersion', 'compareTimes(at, access.availableAfter) <= 0',
    'validateTeamReadReceipt(receipts[index].data()!, uid, entry.id, at)', 'entry.get("senderUserId") !== uid',
    'transaction.create(receipts[index].ref', 'currentUserId: uid']) assert(service.includes(text), text);
  assert(service.indexOf('validateTeamReadReceipt(receipts[index]') < service.indexOf('transaction.create('));
  assert(read('functions/src/services/teamConversationAuthority.ts').includes('digest([uid, identities])'));
  assert(read('functions/src/callables/teamConversation.ts').includes('markTeamConversationMessagesRead(requireAuth(request.auth?.uid)'));
});

test('unread counts cover admission-scoped incoming messages beyond one page and never expose other users receipts', () => {
  const service = read('functions/src/services/teamConversationRead.ts');
  for (const text of ['.where("createdAt", ">", availableAfter)', '.where("senderUserId", "!=", uid)',
    '.where("userId", "==", uid)', '.where("messageCreatedAt", ">", availableAfter)',
    'teamUnreadCount(incoming.data().count, read.data().count)']) assert(service.includes(text), text);
  const indexes = JSON.parse(read('firestore.indexes.json')).indexes;
  for (const [group, fields] of [['entries', ['createdAt', 'senderUserId']], ['readReceipts', ['userId', 'messageCreatedAt']]])
    assert(indexes.some(index => index.collectionGroup === group && index.queryScope === 'COLLECTION' &&
      fields.every(field => index.fields.some(item => item.fieldPath === field && item.order === 'ASCENDING'))));
  assert.match(read('firestore.rules'), /match \/teamConversations\/\{document=\*\*\}[^}]+allow read, write: if false/s);
});

test('only visible foreground rows become read after an account-bound server receipt, with explicit retry on failure', () => {
  const route = native('ui/TeamConversationRoute.kt'), state = native('ui/TeamConversationState.kt');
  assert(route.includes('repeatOnLifecycle(Lifecycle.State.STARTED)'));
  for (const text of ['snapshotFlow', 'list.layoutInfo.visibleItemsInfo', 'state.markVisibleRead(it)']) assert(route.includes(text));
  assert(state.includes('it.needsRead && !it.mine && it.id in visibleIds'));
  assert(state.indexOf('gateway.markRead(uid, target, expectedVersion, ids)') < state.indexOf('acknowledgedReads.addAll(ids)'));
  assert(state.includes('ticket == generation && version == expectedVersion'));
  assert(state.includes('catch (rejected: TeamConversationReadRejectedException)'));
  assert(native('ui/TeamConversationScreen.kt').includes('team-chat.read-retry'));
  const wire = native('services/TeamConversationWire.kt');
  for (const text of ['payload["currentUserId"] == uid', 'payload["teamInstanceId"] == target.teamInstanceId',
    'payload["accessVersion"] == accessVersion']) assert(wire.includes(text), text);
  assert(!native('services/FirebaseAndroidTeamConversationGateway.kt').includes('FirebaseFirestore'));
});

test('service scenarios and new native captures are mandatory without claiming notifications or physical execution', () => {
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert(workflow.includes('npm run test:team-chat-reads && node --test tests/team-chat-read-contract.test.mjs'));
  const steps = Object.values(parse(workflow).jobs).flatMap(job => job.steps ?? []);
  const directory = steps.find(step => step.run?.startsWith('npm run test:team-chat-options '));
  const reads = steps.find(step => step.run?.startsWith('npm run test:team-chat-reads '));
  assert(directory && reads); assert.notEqual(reads, directory);
  assert.equal(directory.env.SGM_LOCAL_FLOW_OUTPUT, '${{ runner.temp }}/team-chat-options.json');
  assert.equal(reads.env.SGM_LOCAL_FLOW_OUTPUT, '${{ runner.temp }}/team-chat-reads.json');
  const suite = read('scripts/qa/local-team-read-suite.mjs');
  for (const text of ['notificationsVerified: false', 'physicalDevice: false', 'nativeUiExecuted: false',
    'await verifyTeamChatProtectedBaseline(f)', 'await deleteApp(getApp())']) assert(suite.includes(text));
  const collector = read('scripts/run-android-ui-tests-and-collect-screenshots.sh');
  for (const stem of ['team-read-count-narrow', 'team-read-visible', 'team-read-error', 'team-read-retry', 'team-read-revoked'])
    assert(collector.includes(stem));
  const connected = read('scripts/qa/team-chat-native-records.mjs');
  assert(connected.includes('teamReadReceiptId(uid, messageId)'));
  assert(connected.includes("root.collection('readReceipts').get()).size, 3"));
});
