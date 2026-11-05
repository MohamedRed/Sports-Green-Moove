import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosTeamChat, iosTeamChatProgress} from '../partner-portal/ios-team-chat.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const app = 'ios/Sources/SportsGreenMooveApp/';
const folder = 'docs/release/evidence/ios-team-chat-2026-11-05/';

test('the actual messages screen opens an owned adult team directory without replacing booking or review content', () => {
  const screen = read(app + 'MessagesScreen.swift');
  for (const part of ['TeamChatPolicy.permits(access)', 'team-chat.entry', 'TeamChatHost(access: access, gateway: teamGateway)',
    '.id(access.context.id)', 'ChatCard(chat: $0)', 'PendingReviewsContent(state: state.reviews']) assert(screen.includes(part));
  assert(read(app + 'GatewayContracts.swift').includes('TeamChatGateway'));
  const policy = read(app + 'TeamChatPolicy.swift');
  assert(policy.includes('!access.context.grantedRoles.contains(.child)'));
  assert(policy.includes('[.parent, .driver, .clubManager]'));
  const directory = read(app + 'TeamChatDirectoryState.swift');
  for (const part of ['next.items', 'next.nextCursor', 'items.contains(item)', 'close(); return item',
    'access.begin()', 'access.finish(work)', 'access.owns(work)', 'generation == ticket']) assert(directory.includes(part));
});

test('team callable requests retain exact account, instance, operation and admission ownership at the SDK boundary', () => {
  const gateway = read(app + 'FirebaseTeamChatGateway.swift'), request = read(app + 'TeamChatRequest.swift');
  assert(request.includes('enum TeamChatRequest: Sendable'));
  for (const endpoint of ['listTeamChatOptions', 'getTeamChatMessages', 'sendTeamChatMessage', 'markTeamChatMessagesRead']) assert(request.includes(endpoint));
  assert(gateway.indexOf('let input = try request.payload()') > gateway.indexOf('withCheckedThrowingContinuation'));
  assert.equal((gateway.match(/Auth.auth\(\).currentUser\?\.uid == uid/g) ?? []).length, 2);
  assert.equal((gateway.match(/try Task.checkCancellation\(\)/g) ?? []).length, 2);
  assert.doesNotMatch(gateway + request, /@unchecked|@preconcurrency|nonisolated\(unsafe\)|Task.sleep|fallback/);
  assert(request.includes('requestId.uuidString.lowercased()'));
  assert(request.includes('expectedAccessVersion'));
  const wire = read(app + 'TeamChatWire.swift');
  for (const part of ['expectedTeamInstanceId', 'after-current-admission', 'TeamChatIdentity.operation', 'sender != uid || !read',
    'CFGetTypeID(number) != CFBooleanGetTypeID()', 'read == ids']) assert(wire.includes(part));
  assert.doesNotMatch(gateway.split('@MainActor private func teamRejected')[1], /resourceExhausted|deadlineExceeded|unavailable/);
});

test('persisted drafts and explicit unknown-send retry cannot replace an unsettled intent or switch to volatile storage', () => {
  const store = read(app + 'TeamChatDraftStore.swift'), composer = read(app + 'TeamChatComposer.swift');
  for (const part of ['[uid, target.teamId, target.instanceId]', 'isExcludedFromBackup = true', '.completeFileProtection',
    'previous == draft', 'row == expected', 'isSymbolicLink != true', '131_072', 'releaseRejected']) assert(store.includes(part));
  for (const part of ['pending ??', 'try store().write(next)', 'pending == expected', 'rejected && !retrying',
    'row', 'storage']) assert(composer.includes(part));
  assert(composer.includes('$0.senderId == uid && $0.requestId == id && $0.body == TeamChatText.normalized(pending.body)'));
  assert.doesNotMatch(store + composer, /UserDefaults|MemoryDraft|try\? store|print\(|NSLog/);
  const state = read(app + 'TeamChatState.swift');
  for (const part of ['generation == ticket', 'access.owns(work)', 'access.finish(work)', 'composer.clear()',
    'page.accessVersion == previous', 'senderId != uid', 'visible.contains($0.id)', '!attemptedReads.contains', 'unconfirmedReads']) assert(state.includes(part));
  const view = read(app + 'TeamChatThreadView.swift');
  assert(view.includes('rect.intersection(bounds)'));
  assert(view.includes('state.markVisible(visible, retry: true)'));
  assert.doesNotMatch(view, /\.onAppear.*markVisible|state.send\(/);
});

test('executed controlled client checks and three real local-service suites retain their separate proof scopes', () => {
  const report = JSON.parse(read(iosTeamChat.source));
  assert.equal(report.checkedAt, '2026-11-05');
  assert.deepEqual(report.localChecks, {nativePlanExitCode: 0, signatureExitCode: 0, uiSyntaxExitCode: 0,
    delayedBoundaries: 96, malformedMessageGroups: 32, requestReceiptGroups: 18, identityVectors: 6});
  for (const record of report.records) assert.equal(sha(read(folder + record.file)), record.sha256);
  const native = read(folder + 'native-result.txt');
  for (const part of ['TeamChatBoundaryChecks passed: 96', 'TeamChatWireChecks passed: 32',
    'TeamChatRequestChecks passed: 18', 'TeamChatStorageChecks passed:', 'SportsGreenMooveNativeChecks passed']) assert(native.includes(part));
  for (const [file, count] of [['conversation-services.json', 18], ['directory-services.json', 6], ['read-services.json', 12]]) {
    const service = JSON.parse(read(folder + file));
    assert.equal(service.steps.length, count); assert(service.steps.every(row => row.status === 'passed'));
    assert.equal(service.protectedBaselinePreserved ?? service.isolation?.protectedBaselinePreserved, true);
    assert.equal(service.isolatedEnvironmentDestroyed, true); assert.equal(service.adminClientClosed, true);
    assert.equal(service.emulatorEndpoints.closed, true); assert.equal(service.productionWrites, false);
    assert.equal(service.nativeUiExecuted, false); assert.equal(service.physicalDevice, false);
    assert.equal(service.notificationsVerified, false);
  }
  for (const key of ['sdkLinkedBuildAccepted', 'fixtureUiExecuted', 'nativeServiceIntegrationAccepted', 'fullConversationAccepted',
    'notificationsAccepted', 'physicalDeviceAccepted', 'newNativeMediaPublished', 'releaseComplete']) assert.equal(report[key], false);
  for (const key of ['providerRequests', 'productionWrites', 'realPayments', 'newPhoneSessions']) assert.equal(report[key], 0);
  const manifest = JSON.parse(read(iosTeamChat.checksums));
  for (const file of manifest.files) assert.equal(sha(read('docs/release/evidence/source-archive/' + file.sha256 + '.txt')), file.sha256, file.path);
});

test('team UI is prepared inside the existing eleven cases with no new capture, retry or deadline change', () => {
  const path = 'ios/UITests/SportsGreenMooveUITests/';
  const cases = readdirSync(new URL('../' + path, import.meta.url)).filter(file => file.endsWith('.swift'))
    .flatMap(file => [...read(path + file).matchAll(/func (test\w+)\(/g)].map(match => match[1]));
  assert.equal(cases.length, 11); assert.equal(new Set(cases).size, 11);
  const fixture = read(path + 'SportsGreenMooveUITests.swift');
  assert(fixture.indexOf('verifyTeamChat(in: app)') > fixture.indexOf('captureApproved(.rating)'));
  const helper = read(path + 'TeamChatFlowChecks.swift');
  for (const part of ['team-chat.choices-more', 'team-chat.earlier', 'team-chat.send', 'editor.value as? String']) assert(helper.includes(part));
  assert.doesNotMatch(helper, /capture|screenshot|sleep|retry|XCTSkip|func test/);
  assert(read(app + 'UITestTeamChat.swift').includes('#if DEBUG'));
  assert(read('scripts/check-ios-support-concurrency.sh').includes('-D DEBUG'));
  assert(read('scripts/check-ios-native-plan.sh').includes('TeamChatBoundaryChecks.swift'));
  const job = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON().jobs['ios-fixture-verification'];
  assert.equal(job['timeout-minutes'], 50);
  const upload = job.steps.filter(step => step.uses?.startsWith('actions/upload-artifact'));
  assert.equal(upload.length, 1); assert.equal(upload[0].with['retention-days'], 1);
});

test('the concise public note retains pending native evidence and runs in smoke and iPhone source gates', () => {
  assert.deepEqual(content.iosTeamChat, iosTeamChat);
  assert.deepEqual(content.updates.filter(row => row.source === iosTeamChatProgress.source), [iosTeamChatProgress]);
  assert(partitionUpdates(content.updates).previous.some(row => row.source === iosTeamChatProgress.source));
  assert.doesNotMatch(iosTeamChatProgress.title + iosTeamChatProgress.text, /Firebase|BrowserStack|SDK|Swift|CI\b/i);
  const file = 'tests/ios-team-chat.test.mjs', web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['pull_request', 'push']) assert(web.on[event].paths.includes(file));
  assert(Object.values(web.jobs).some(job => job.steps.some(step => step.run?.includes(file))));
  assert(parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON().on.pull_request.paths.includes(file));
  const manifest = JSON.parse(read('docs/release/evidence-manifest.json'));
  for (const id of ['ios_sdk_build_ci', 'ios_fixture_ui_ci']) assert.equal(manifest.automatedUserFlowEvidence.items.find(row => row.id === id).status, 'pending');
});
