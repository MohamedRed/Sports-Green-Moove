import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosRideChat, iosRideChatProgress} from '../partner-portal/ios-ride-chat.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const json = path => JSON.parse(read(path));
const sha = value => createHash('sha256').update(value).digest('hex');
const app = 'ios/Sources/SportsGreenMooveApp/', folder = 'docs/release/evidence/ios-ride-chat-2026-11-05/';
const report = json(iosRideChat.source);

test('booking/ride chat replaces inert native previews without replacing team, review or notification flows', () => {
  const screen = read(app + 'MessagesScreen.swift');
  for (const part of ['RideChatEntry(access: access, gateway: rideGateway', 'TeamChatPolicy.permits(access)',
    'TeamChatHost(access: access, gateway: teamGateway)', 'PendingReviewsContent(state: state.reviews', 'NotificationCard(notification: $0)',
    'chatUnread: Int?', 'chatEpoch = UUID()']) assert(screen.includes(part), part);
  assert.doesNotMatch(screen + read(app + 'Models.swift') + read(app + 'FirebaseInboxGateway.swift'), /InboxChatSummary|struct ChatCard|mapInboxChat|inbox\.chats/);
  assert(read(app + 'GatewayContracts.swift').includes('RideChatGateway'));
  const active = read(app + 'ActiveRideChatEntry.swift');
  for (const part of ['RideChatReference(kind: .rideSession', 'RideChatID(rideId)', '.id(access.context.id)', 'phase == .active']) assert(active.includes(part));
  assert(read(app + 'SecondaryScreens.swift').includes('ActiveRideChatEntry(access: access, gateway: appState.firebase, rideId: ride.rideSessionId)'));
  assert.doesNotMatch(active, /try\?|fallback|\.booking/);
  const identity = read(app + 'RideChatIdentity.swift');
  assert(identity.includes('case booking, rideSession')); assert(identity.includes('utf8.elementsEqual'));
});

test('fresh current source and identity gates own every listener and every async result', () => {
  const thread = read(app + 'FirebaseRideChatThreadWatch.swift'), source = read(app + 'FirebaseRideChatSnapshots.swift');
  assert(thread.includes('result.get() == Set(self.access.participants.keys)'));
  for (const part of ['sourceConfirmed', 'messages?.remove()', 'source?.close()', 'removeStateDidChangeListener',
    'serial > latest', 'if snapshot.metadata.isFromCache { return nil }']) assert(thread.includes(part));
  for (const part of ['!snapshot.metadata.hasPendingWrites', 'RideChatSourcePolicy.participants', 'requireRideChatIdentity(uid)',
    'registration?.remove()', 'serial > latest']) assert(source.includes(part));
  const inbox = read(app + 'FirebaseRideChatInboxWatch.swift');
  assert(inbox.includes('sources.removeValue(forKey: key)?.close()'));
  assert(inbox.includes('self.sources[reference] != nil'));
  const state = read(app + 'RideChatDirectoryState.swift');
  for (const part of ['memberships[$0.reference]?.contains(uid) == true', 'revoked.insert(reference)', 'timeline.remove(reference)',
    'for reference in revoked', 'timeline.nextCursor == nil', 'addingReportingOverflow', 'access.finish(work)', 'generation == ticket']) assert(state.includes(part));
  const gateway = read(app + 'FirebaseRideChatGateway.swift');
  assert(gateway.includes('getDocuments(source: .server)')); assert(gateway.includes('request.payload()'));
  assert.doesNotMatch(gateway + thread + inbox + source, /Task.sleep|UserDefaults|@preconcurrency|nonisolated\(unsafe\)/);
});

test('persisted exact intents, visible read batches and draft editing preserve private ownership', () => {
  const state = read(app + 'RideChatThreadState.swift'), composer = read(app + 'RideChatComposer.swift');
  for (const part of ['access.owns(work)', 'generation == ticket', 'watch?.isCurrent == true',
    'composer.load(); try publish()', 'if canCompose && composer.pending == nil', 'canCompose && !busy',
    'visible.contains($0.id)', '!attempted.contains', 'retry && unconfirmed.contains', 'receipt.ids == ids']) assert(state.includes(part));
  for (const part of ['pending ??', 'try store().write(next)', 'pending == expected', 'rejected && !retrying',
    '$0.sender == uid', '$0.requestId == request', 'RideChatText.same']) assert(composer.includes(part));
  const store = read(app + 'RideChatDraftStore.swift'), files = read(app + 'PrivateChatDraftFiles.swift');
  for (const part of ['"ride-drafts"', 'previous == draft', 'row == expected', 'row.uid == uid && row.reference == reference', 'PrivateChatDraftFiles.lock']) assert(store.includes(part));
  for (const part of ['.completeFileProtection', 'isExcludedFromBackup = true', 'isSymbolicLink != true', '131_072']) assert(files.includes(part));
  assert.doesNotMatch(composer + store, /UserDefaults|MemoryDraft|try\? store|print\(/);
  const view = read(app + 'RideChatThreadView.swift');
  assert(view.includes('rect.intersection(bounds)')); assert(view.includes('.onChange(of: viewport.size)'));
  assert(view.includes('state.markVisible(visible, retry: true)'));
});

test('executed native, scripted adapter and separate local services retain exact proof layers', () => {
  for (const row of report.records) assert.equal(sha(read(folder + row.file)), row.sha256, row.file);
  for (const row of json(iosRideChat.checksums).files) {
    assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256, row.path);
    if (/RideChat.*\.swift$|PrivateChatDraftFiles\.swift$/.test(row.path)) assert(read(row.path).split('\n').length < 300, row.path);
  }
  const native = read(folder + 'native-result.txt');
  for (const part of ['RideChatBoundaryChecks passed: 84', 'RideChatDirectoryWireChecks passed: 23',
    '152-message gap closure', 'RideChatStorageChecks passed:', 'SportsGreenMooveNativeChecks passed',
    'TeamChatBoundaryChecks passed: 96', 'Membership fixture state passed: reject']) assert(native.includes(part));
  assert(read(folder + 'adapter-runtime-result.txt').includes('11 actual thread adapter invalidations'));
  const service = json(folder + 'services.json');
  assert.equal(service.checks.length, 9); assert(service.checks.every(row => row.status === 'passed'));
  for (const key of ['completed', 'adminClientClosed', 'firestoreClientTerminated', 'isolatedEnvironmentDestroyed']) assert.equal(service[key], true);
  assert.equal(service.endpoints.closed, true); assert.equal(service.productionWrites, false); assert.equal(service.providerRequests, 0);
  for (const key of ['sdkLinkedBuildAccepted', 'nativeUiAccepted', 'nativeServiceIntegrationAccepted', 'physicalDeviceAccepted', 'notificationsAccepted', 'releaseComplete']) assert.equal(report[key], false);
  for (const key of ['newPhoneSessions', 'providerRequests', 'productionWrites', 'newMedia']) assert.equal(report[key], 0);
});

test('prior terminal runs remain source-specific incomplete results with zero capture artifacts', () => {
  assert.deepEqual(report.previousRuns.map(row => [row.runId, row.sdkBuild, row.fixtureStep, row.completedCases, row.passedCases, row.failedCases]),
    [[42043418025, 'success', 'cancelled', 7, 6, 1], [42047085995, 'failure', 'skipped', 0, 0, 0]]);
  for (const row of report.previousRuns) {
    assert.equal(json(folder + row.runId + '-run.json').headSha, row.commit);
    assert.equal(json(folder + row.runId + '-artifacts.json').total_count, 0);
    assert.equal(row.disposal, 'success'); assert.equal(row.plannedCases, 11);
  }
  assert(read(folder + '42047085995-selected.txt').includes('Could not resolve package dependencies'));
});

test('new booking and first-message assertions are inside eleven original cases without capture or policy expansion', () => {
  const dir = 'ios/UITests/SportsGreenMooveUITests/';
  const all = readdirSync(new URL('../' + dir, import.meta.url)).filter(name => name.endsWith('.swift')).map(name => read(dir + name));
  assert.equal(all.flatMap(bytes => [...bytes.matchAll(/func test\w+\(/g)]).length, 11);
  const helper = read(dir + 'RideChatFlowChecks.swift');
  for (const part of ['ride-chat.bookings.more', 'ride-chat.composer', 'editor.value as? String', '"50 messages"',
    '"51 messages"', 'ride-chat.earlier', 'ride-chat.send', 'ride-chat.active-entry', 'ride-chat.empty', 'ride-chat.row.booking.booking-1']) assert(helper.includes(part));
  assert.doesNotMatch(helper, /capture|screenshot|sleep|XCTSkip|func test/);
  const fixture = read(dir + 'SportsGreenMooveUITests.swift');
  assert(fixture.includes('verifyRideChat(in: app)')); assert(fixture.includes('verifyActiveRideChat(in: app)'));
  const native = read('scripts/check-ios-native-plan.sh'); assert(native.includes('scripts/qa/check-ios-ride-chat-runtime.sh'));
  const job = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON().jobs['ios-fixture-verification'];
  assert.equal(job['timeout-minutes'], 50);
  const uploads = job.steps.filter(row => row.uses?.startsWith('actions/upload-artifact'));
  assert.equal(uploads.length, 1); assert.equal(uploads[0].with['retention-days'], 1);
});

test('one concise portal note preserves all prior flows, history, blockers and release gaps', () => {
  assert.deepEqual(content.iosRideChat, iosRideChat);
  assert.deepEqual(content.updates.filter(row => row.source === iosRideChatProgress.source), [iosRideChatProgress]);
  assert.doesNotMatch(iosRideChatProgress.title + iosRideChatProgress.text, /Firebase|BrowserStack|SDK|Swift|CI\b/i);
  const previous = json(folder + 'portal-before.json');
  for (const row of previous.flows) assert.equal(sha(JSON.stringify(content.flows.find(flow => flow.id === row.id))), row.sha256);
  for (const hash of previous.updates) assert(content.updates.some(row => sha(JSON.stringify(row)) === hash));
  assert.equal(sha(JSON.stringify(content.blockers)), previous.blockers);
  for (const name of ['web-integration-smoke', 'ios-mvp-verification']) {
    const workflow = parseDocument(read('.github/workflows/' + name + '.yml')).toJSON();
    assert(workflow.on.pull_request.paths.includes('tests/ios-ride-chat.test.mjs'));
    if (name === 'web-integration-smoke') {
      assert(workflow.on.push.paths.includes('tests/ios-ride-chat.test.mjs'));
      assert(Object.values(workflow.jobs).some(job => job.steps.some(step => step.run?.includes('tests/ios-ride-chat.test.mjs'))));
    }
  }
  const manifest = json('docs/release/evidence-manifest.json');
  for (const id of ['ios_sdk_build_ci', 'ios_fixture_ui_ci']) assert.equal(manifest.automatedUserFlowEvidence.items.find(row => row.id === id).status, 'pending');
});
