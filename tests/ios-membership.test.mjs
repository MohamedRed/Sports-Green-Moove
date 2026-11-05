import assert from 'node:assert/strict';
import {assertUnchangedIosFixtureWorkload} from '../scripts/qa/ios-fixture-workload-contract.mjs';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosMembership, iosMembershipProgress, iosMembershipFixtureProgress} from '../partner-portal/ios-membership.mjs';
import {iosA37FixturePassProgress} from '../partner-portal/ios-a37-fixture-pass.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const json = path => JSON.parse(read(path)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const app = 'ios/Sources/SportsGreenMooveApp/', folder = 'docs/release/evidence/ios-membership-2026-11-05/';
const report = json(iosMembership.source);
const frozen = (path, commit) => {
  const row = json(iosMembership.checksums).files.find(row => row.path === path && row.commit === commit);
  assert(row, path); const bytes = read('docs/release/evidence/source-archive/' + row.sha256 + '.txt');
  assert.equal(sha(bytes), row.sha256); return bytes;
};

test('club requests replace the local set with exact displayed requests and explicit server readback', () => {
  const view = read(app + 'GroupsScreen.swift'), state = read(app + 'ClubMembershipState.swift');
  for (const text of ['state.request(club)', 'await state.refresh()', 'state.resume()', 'MembershipClubDetail', 'state.more()',
    'MembershipReviewScreen', 'refreshAppData(access: access)']) assert(view.includes(text));
  assert.doesNotMatch(view, /requestedClubIds|\.insert\(|roleLabel/);
  for (const text of ['items.contains(row)', 'row.requestable', 'requiresRefresh = true', 'access.begin()', 'access.finish(work)',
    'access.owns(work)', 'generation == ticket', 'row.id', 'receipt.id == access.context.uid + "_" + row.id']) assert(state.includes(text));
  assert.doesNotMatch(state, /Task.sleep|UserDefaults|print\(|NSLog|retry\(/);
  assert(frozen(app + 'GroupsScreen.swift', report.baselineCommit).includes('requestedClubIds.insert(club.id)'));
});

test('active membership depends on status and active flag, not an assigned role label', () => {
  const summary = read(app + 'ClubSummary.swift'), mapping = read(app + 'FirebaseClubSummaries.swift');
  assert(summary.includes('membershipStatus == "active" && membershipActive != false'));
  assert(summary.includes('membershipStatus == nil && membershipActive == true'));
  assert.doesNotMatch(summary, /roleLabel != nil/);
  for (const text of ['members[clubId] == nil', 'MembershipWire.member', 'member?.isActive == true', 'currentUser?.uid == uid']) assert(mapping.includes(text));
  assert(read(app + 'MembershipPolicy.swift').includes('!access.context.grantedRoles.contains(.child)'));
});

test('catalog uses bounded server queries that can safely return no own membership without weakening rules', () => {
  const source = read(app + 'FirebaseMembershipDirectory.swift');
  for (const text of ['order(by: FieldPath.documentID()).limit(to: 21)', 'query.start(after: [cursor])', 'catalog.prefix(20)',
    'whereField("userId", isEqualTo: uid)', 'whereField("clubId", isEqualTo: clubId).limit(to: 2)',
    'getDocuments(source: .server)', 'snapshot.documents.count <= 1', 'document.documentID == membershipId',
    '!snapshot.metadata.isFromCache', '!snapshot.metadata.hasPendingWrites', 'withCheckedThrowingContinuation',
    'try requireMembershipIdentity(uid)']) assert(source.includes(text));
  assert.doesNotMatch(source, /getDocument\(|try\?|catch.*return|while |Task.sleep/);
  const historicalRules = frozen('firestore.rules', 'candidate');
  assert.equal(sha(historicalRules), json(folder + 'services.json').sourceFiles['firestore.rules']);
  const membershipRule = `match /memberships/{membershipId} {
      allow read: if isAdmin() || isSelf(resource.data.userId) || isClubManager(resource.data.clubId);
      allow create, update, delete: if isAdmin();
    }`;
  assert(historicalRules.includes(membershipRule)); assert(read('firestore.rules').includes(membershipRule));
});

test('manager decisions bind real authority, exact versioned rows and fresh readback', () => {
  const request = read(app + 'MembershipRequest.swift'), gateway = read(app + 'FirebaseMembershipGateway.swift');
  for (const text of ['requestClubMembership', 'listMembershipReviewClubs', 'listClubMemberships', 'reviewClubMembership',
    '"expectedVersion": try MembershipWire.version(row.version)']) assert(request.includes(text));
  for (const text of ['let input = try request.payload()', 'httpsCallable(request.name).call(input)', 'try requireMembershipIdentity(uid)']) assert(gateway.includes(text));
  const state = read(app + 'MembershipReviewState.swift'), view = read(app + 'MembershipReviewScreen.swift');
  for (const text of ['items.contains(row)', 'row.canDecide', 'MembershipPolicy.review(access)', 'requiresRefresh = true',
    'access.owns(work)', 'club = nil']) assert(state.includes(text));
  for (const text of ['presenting: confirmation) { pending in', 'state.decide(pending.row, decision: pending.decision)',
    'await state.refresh()', '.fixedSize(horizontal: false, vertical: true)', 'frame(width: 44, height: 44)']) assert(view.includes(text));
  assert.doesNotMatch(request + gateway + state + view, /setCustomUserClaims|setData\(|updateData\(/);
});

test('controlled checks and complete separate service proof remain source-bound and retain earlier incomplete attempts', () => {
  assert.deepEqual(report.localChecks, {nativePlanExitCode: 0, signatureExitCode: 0, uiSyntaxExitCode: 0,
    delayedBoundaries: 128, membershipStatusCombinations: 8, malformedGroups: 29, serviceChecks: 7, protectedRecords: 110});
  for (const record of report.records) assert.equal(sha(read(folder + record.file)), record.sha256);
  for (const row of json(iosMembership.checksums).files) assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
  assert.match(read(folder + 'native-result.txt'), /MembershipBoundaryChecks passed: 128/);
  assert.match(read(folder + 'native-result.txt'), /29 malformed/);
  assert.match(read(folder + 'signature-result.txt'), /not an SDK build or phone test/);
  const service = json(folder + 'services.json');
  assert(service.completed); assert.equal(service.checks.length, 7); assert(service.checks.every(row => row.status === 'passed'));
  assert.deepEqual(service.review, {concurrentDecisionWinners: 1, approvedCount: 2, rejectedCount: 1, auditCount: 3,
    notificationCount: 3, memberCountBefore: 3, memberCountAfter: 5, paginatedHistory: 25, paginatedManagedClubs: 26,
    foreignManagerRejected: true, revokedManagerRejected: true, staleRerequestRejected: true, roleEscalation: false, livePush: false});
  for (const key of ['adminClientClosed', 'firestoreClientTerminated', 'isolatedEnvironmentDestroyed']) assert.equal(service[key], true);
  assert.equal(service.protectedRecordCount, 110); assert.equal(service.emulatorEndpoints.closed, true);
  for (const [path, hash] of Object.entries(service.sourceFiles)) assert.equal(sha(frozen(path, 'candidate')), hash);
  const failed = json(folder + 'initial-service-fixture-failure.json');
  assert.equal(failed.completed, false); assert.equal(failed.checks[0].status, 'failed'); assert(failed.isolatedEnvironmentDestroyed);
  const first = frozen('scripts/qa/local-membership-client.mjs', 'initial-fixture-attempt'); assert(first.includes('await seedLocalUiFixtures()'));
  assert(read('scripts/qa/local-membership-client.mjs').includes("'seed-firebase-emulator.mjs'"));
  for (const item of json(folder + 'interrupted-local-attempts.json').attempts) {
    assert.equal(item.completed, false); assert.equal(item.finalReceiptPresent, false); assert(item.ownedRuntimeDisposed);
  }
});

test('actual earlier SDK/UI failures preserve all eleven outcomes and lead to corrections without weakening selectors', () => {
  const result = json(folder + 'fixture-results.json'), run = json(folder + 'terminal-run.json'), job = run.jobs[0];
  assert.equal(run.headSha, report.baselineCommit); assert.equal(run.conclusion, 'failure');
  assert.equal(job.steps.find(step => step.name === 'Compile app and all fixture test bundles').conclusion, 'success');
  assert.equal(job.steps.find(step => step.name === 'Run every built fixture test without rebuilding').conclusion, 'failure');
  assert.equal(job.steps.find(step => step.name === 'Dispose isolated simulator').conclusion, 'success');
  assert.equal(result.caseCount, 11); assert.equal(result.passed, 9); assert.equal(result.failed, 2); assert.equal(result.assertionFailures, 3);
  assert.equal(result.cases.length, 11); assert.equal(result.fullGateAccepted, false); assert.equal(json(folder + 'artifact-inventory.json').total_count, 0);
  const lines = read(folder + 'selected-fixture-lines.txt');
  assert(lines.includes("Button, identifier: 'team-chat.thread', label: 'Retour'"));
  assert(lines.includes("Button, label: 'Abandonner les modifications'"));
  assert(frozen(app + 'TeamChatThreadView.swift', report.baselineCommit).includes('.accessibilityIdentifier("team-chat.thread")'));
  assert.doesNotMatch(read(app + 'TeamChatThreadView.swift'), /accessibilityIdentifier\("team-chat.thread"\)/);
  const contact = read(app + 'EmergencyContactScreen.swift');
  assert(contact.includes('.alert("Abandonner les modifications ?"')); assert(contact.includes('presenting: discard) { action in'));
  assert(contact.includes('Button("Continuer la modification", role: .cancel)')); assert.doesNotMatch(contact, /\.confirmationDialog/);
  for (const file of ['ParentEmergencyContactFlowTests.swift', 'TeamChatFlowChecks.swift']) {
    const path = 'ios/UITests/SportsGreenMooveUITests/' + file, original = frozen(path, report.baselineCommit);
    const expected = file === 'TeamChatFlowChecks.swift' ? original.replace('    let send = app.buttons["team-chat.send"]\n',
      '    let send = app.buttons["team-chat.send"]\n' +
      '    let enabled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: send)\n' +
      '    XCTAssertEqual(XCTWaiter.wait(for: [enabled], timeout: 6), .completed)\n') : original;
    assert.equal(read(path), expected);
  }
});

test('new request/review UI assertions preserve all eleven cases, the approved runtime and capture bounds', () => {
  const path = 'ios/UITests/SportsGreenMooveUITests/';
  const cases = readdirSync(new URL('../' + path, import.meta.url)).filter(file => file.endsWith('.swift'))
    .flatMap(file => [...read(path + file).matchAll(/func (test\w+)\(/g)].map(match => match[1]));
  assert.equal(cases.length, 11); assert.equal(new Set(cases).size, 11);
  const helper = read(path + 'MembershipFlowChecks.swift');
  for (const id of ['groups.join.action', 'membership.detail.status', 'membership.review.entry', 'membership.approve.ui-parent_club-tennis']) assert(helper.includes(id));
  assert.doesNotMatch(helper, /XCTSkip|sleep\(|screenshot\(|captureApproved/);
  const workflow = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  const old = parseDocument(frozen('.github/workflows/ios-mvp-verification.yml', report.baselineCommit)).toJSON();
  assertUnchangedIosFixtureWorkload(workflow, old);
  assert.equal(workflow.jobs['ios-fixture-verification']['timeout-minutes'], 50);
  assert(read(app + 'UITestMembershipGateway.swift').includes('#if DEBUG'));
});

test('concise local and actual fixture notes preserve release gaps and enter both web events and iPhone coverage', () => {
  assert.deepEqual(content.iosMembership, iosMembership);
  assert.deepEqual(content.updates.filter(row => row.source === iosMembershipProgress.source), [iosMembershipProgress]);
  const {previous} = partitionUpdates(content.updates);
  assert(previous.some(row => row.source === iosMembershipProgress.source));
  assert(previous.some(row => row.source === iosA37FixturePassProgress.source && row.coversFlows.includes('clubs')));
  assert.deepEqual(content.updates.filter(row => row.source === iosMembershipFixtureProgress.source), [iosMembershipFixtureProgress]);
  assert(partitionUpdates(content.updates).previous.some(row => row.source === iosMembershipFixtureProgress.source));
  assert.equal(json(iosMembershipFixtureProgress.source).passed, 9);
  assert.doesNotMatch(iosMembershipProgress.title + iosMembershipProgress.text, /Firebase|BrowserStack|SDK|Swift|CI\b/i);
  for (const key of ['candidateSdkLinkedBuildAccepted', 'candidateFixtureUiExecuted', 'nativeServiceIntegrationAccepted',
    'physicalDeviceAccepted', 'phoneHandoffAccepted', 'newNativeMediaPublished', 'releaseComplete']) assert.equal(report[key], false);
  for (const key of ['providerRequests', 'productionWrites', 'realPayments', 'newPhoneSessions']) assert.equal(report[key], 0);
  const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON(), path = 'tests/ios-membership.test.mjs';
  for (const event of ['pull_request', 'push']) assert(web.on[event].paths.includes(path));
  assert(Object.values(web.jobs).some(job => job.steps.some(step => step.run?.includes(path))));
  assert.deepEqual(web.jobs.smoke.steps.filter(step => step.name === 'Verify isolated membership discovery and review'), [{
    name: 'Verify isolated membership discovery and review', env: {SGM_LOCAL_FLOW_OUTPUT: '${{ runner.temp }}/membership-client.json'},
    run: 'npm run test:membership-client',
  }]);
  assert.equal(json('package.json').scripts['test:membership-client'], 'node scripts/qa/run-local-membership-client.mjs');
  assert(parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON().on.pull_request.paths.includes(path));
  for (const id of ['ios_sdk_build_ci', 'ios_fixture_ui_ci'])
    assert.equal(json('docs/release/evidence-manifest.json').automatedUserFlowEvidence.items.find(row => row.id === id).status, 'pending');
});
