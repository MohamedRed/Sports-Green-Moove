import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {content} from '../../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '../..'), input = process.argv[2];
assert(input?.startsWith('/'), 'Supply the directory containing original sanitized results');
const folder = resolve(root, 'docs/release/evidence/chat-source-access-2026-11-05');
assert(!existsSync(resolve(folder, 'summary.json')), 'Never replace retained evidence');
mkdirSync(folder, {recursive: true});
const read = path => readFileSync(resolve(root, path), 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const write = (name, bytes) => writeFileSync(resolve(folder, name), bytes, {flag: 'wx'});
const json = value => JSON.stringify(value, null, 2) + '\n';
const archive = (bytes, expected = sha(bytes)) => {
  assert.equal(sha(bytes), expected);
  const path = resolve(root, 'docs/release/evidence/source-archive', expected + '.txt');
  if (!existsSync(path)) writeFileSync(path, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(path)), expected); return expected;
};
const oldRules = read('docs/release/evidence/source-archive/ce0d06aa59ab1e1108a547029acb72af2678c7ca6ad55dec69377b4a7ea23f45.txt');
const boundRules = oldRules.replace("message.get('sourceType', null)", 'message.sourceType').replace("message.get('sourceId', null)", 'message.sourceId');
archive(boundRules, 'c61d31052f3a6bb0ea59b0f85b10bdb6df1868cd5cf596d49725faa012d17ec0');
const queryCompatible = boundRules.replace('      allow read: if signedIn() && resource.data.participantUserIds is list &&\n        resource.data.participantUserIds.hasAny([request.auth.uid]) && isCurrentChatParticipant(resource.data);',
  '      // Keep the query-provable predicate; non-list values fail hasAny as well.\n      allow read: if signedIn() && resource.data.participantUserIds.hasAny([request.auth.uid]) &&\n        isCurrentChatParticipant(resource.data);');
archive(queryCompatible, '88966c792480a25743b21685b32526df850a38d89fae89706d508ce352f2c439');
const initialSuite = read('docs/release/evidence/source-archive/d925bfb20d0c2b59c28e8ac1dd78c3e27d58f9f37e3fb48caf85373e35eeeff7.txt');
const instrumented = initialSuite.replace('      assert.equal(await read(item.old, sent.messageId), 200); assert.deepEqual(await query(item.old, source), {status: 200, rows: 1});',
  "      const initialGet = await read(item.old, sent.messageId), initialQuery = await query(item.old, source);\n      observations.push({id: item.id, phase: 'before-source-change', directGet: initialGet, query: initialQuery});\n      assert.equal(initialGet, 200); assert.deepEqual(initialQuery, {status: 200, rows: 1});");
archive(instrumented, '129dba0f63eb88cbcbe8187f35fad06c11cee70bf51324b0f6f323a2071b9fc0');
const records = [];
const retain = (from, to) => {
  const bytes = readFileSync(resolve(input, from));
  assert(!/AIza[\w-]{20,}|Bearer\s+[\w.~+/-]+=*|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes.toString()), 'Unreviewed credential-like content');
  write(to, bytes); records.push({file: to, sha256: sha(bytes)}); return JSON.parse(bytes);
};
for (const [from, to] of [
  ['sgm-chat-source-baseline-20261105.json', 'baseline.json'],
  ['sgm-chat-source-candidate-20261105.json', 'first-candidate-failed.json'],
  ['sgm-chat-source-query-diagnostic-20261105.json', 'query-observation-failed.json'],
  ['sgm-chat-source-bound-query-20261105.json', 'field-binding-failed.json'],
  ['sgm-chat-source-query-compatible-20261105.json', 'query-compatible.json'],
  ['sgm-chat-rule-query-probe-20261105.json', 'query-proof-diagnostic.json'],
  ['sgm-chat-rules-vitest-20261105.json', 'message-listener-negative.json'],
  ['sgm-chat-rules-vitest-cleanup-20261105.json', 'message-listener-negative-cleanup.json'],
  ['sgm-chat-source-final-rules-20261105.json.cleanup.json', 'runner-argument-failure-cleanup.json'],
  ['sgm-chat-source-final-rules-v2-20261105.json', 'source-listener-negative.json'],
  ['sgm-chat-source-final-rules-v2-20261105.json.cleanup.json', 'source-listener-negative-cleanup.json'],
]) retain(from, to);
archive(readFileSync(resolve(input, 'sgm-chat-rule-query-probe-20261105.mjs')));
const services = retain('sgm-chat-source-final-services-20261105.json', 'services.json');
assert(services.completed && services.isolatedEnvironmentDestroyed && services.endpoints.closed);
assert.equal(services.checks.length, 9); assert(services.checks.every(row => row.status === 'passed'));
assert.equal(services.protectedRecordCount, 22);
const rules = retain('sgm-chat-source-final-rules-v3-20261105.json', 'rules.json');
assert.equal(rules.numTotalTests, 219); assert.equal(rules.numPassedTests, 219); assert.equal(rules.numFailedTests, 0);
const cleanup = retain('sgm-chat-source-final-rules-v3-20261105.json.cleanup.json', 'rules-cleanup.json');
assert(cleanup.completed && cleanup.ownedEnvironmentDestroyed && cleanup.endpoints.closed);
const terraform = retain('sgm-chat-source-final-terraform-20261105.json', 'terraform-validation.json'); assert(terraform.valid);
const parser = new XMLParser({ignoreAttributes: false}), totals = {tests: 0, failures: 0, errors: 0, skipped: 0};
const units = resolve(root, 'android/app/build/test-results/testDebugUnitTest');
mkdirSync(resolve(folder, 'units'));
for (const file of readdirSync(units).filter(file => file.endsWith('.xml'))) {
  const bytes = readFileSync(resolve(units, file)), suite = parser.parse(bytes).testsuite;
  for (const key of Object.keys(totals)) totals[key] += Number(suite['@_' + key]);
  write('units/' + file, bytes); records.push({file: 'units/' + file, sha256: sha(bytes)});
}
assert.deepEqual(totals, {tests: 840, failures: 0, errors: 0, skipped: 0});
const paths = ['firestore.rules', 'tests/security-rules.test.ts', 'tests/chat-source-access-rules.test.ts',
  'scripts/qa/chat-source-access-suite.mjs', 'scripts/qa/run-chat-source-access.mjs',
  'scripts/qa/chat-source-rules-entry.mjs', 'scripts/qa/run-chat-source-rules.mjs',
  'infra/firestore-rules/main.tf', 'infra/firestore-rules/.terraform.lock.hcl'];
for (const name of ['domain/ConversationSourceAccess.kt', 'services/ConversationSourceObserver.kt',
  'services/FirebaseAndroidConversationGateway.kt', 'ui/ConversationState.kt'])
  paths.push('android/app/src/main/java/be/sportgreenmoove/app/' + name);
for (const name of ['domain/ConversationSourceAccessTest.kt', 'ui/ConversationStateTest.kt'])
  paths.push('android/app/src/test/java/be/sportgreenmoove/app/' + name);
const files = paths.map(path => ({path, commit: 'candidate', sha256: archive(read(path))}));
for (const record of ['baseline.json', 'first-candidate-failed.json', 'query-observation-failed.json', 'field-binding-failed.json', 'query-compatible.json', 'services.json']) {
  const report = JSON.parse(readFileSync(resolve(folder, record)));
  for (const [path, hash] of Object.entries(report.sourceFiles)) {
    const bytes = existsSync(resolve(root, 'docs/release/evidence/source-archive', hash + '.txt')) ?
      read('docs/release/evidence/source-archive/' + hash + '.txt') : read(path);
    archive(bytes, hash);
    if (!files.some(row => row.sha256 === hash && row.path === path)) files.push({path, commit: record, sha256: hash});
  }
}
write('source-sha256.json', json({files}));
write('portal-before.json', json({flows: content.flows.map(row => ({id: row.id, sha256: sha(JSON.stringify(row))})),
  updates: content.updates.map(row => sha(JSON.stringify(row))), blockers: sha(JSON.stringify(content.blockers))}));
write('summary.json', json({checkedAt: '2026-11-05', scope: 'isolated-chat-source-authorization-not-native-ui-or-production',
  baselineCommit: 'd51c0f8c50fd2c148bf751bec07a4a380bac0ae4', serviceChecks: 9, rulesTests: 219, androidUnitTests: totals,
  protectedRecords: 22, rulesPolicySha256: sha(read('firestore.rules')), records,
  originalMessageListenerExpectationFailed: true, independentSourceObserverRequired: true,
  productionRulesApplied: false, nativeUiAccepted: false, iphoneConversationImplemented: false,
  physicalDeviceAccepted: false, releaseComplete: false, providerRequests: 0, productionWrites: 0, newMedia: 0}));
console.log('Retained original negative observations, 9 service checks, 219 rule cases and 840 Android unit cases.');
