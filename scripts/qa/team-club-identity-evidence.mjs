import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export const teamClubIdentityGroups = [
  'current-team-and-separately-verified-parent-are-eligible',
  'editing-stored-club-createdAt-does-not-invalidate-server-identity',
  'old-adult-team-cannot-be-approved-by-the-recreated-club',
  'team-choice-cursors-cannot-cross-the-clubs-server-creation-identity',
  'manager-team-cursors-cannot-cross-the-clubs-server-creation-identity',
  'old-parent-verification-does-not-grant-a-new-team-in-the-recreated-club',
  'new-club-choices-and-manager-lists-do-not-expose-orphaned-teams',
  'new-club-manager-cannot-read-the-old-team-roster-or-refuse-its-request',
  'fresh-parent-verification-and-current-team-explicit-approval-restore-child-access',
  'fresh-parent-verification-still-cannot-revive-the-orphaned-team',
];
export function validateTeamClubIdentity(report) {
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.match(report.runId, /^[a-f0-9]{32}$/);
  assert.equal(report.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(report.coverage, 'team-club-identity-not-chat-or-native-ui');
  assert.equal(report.testCount, 10);
  assert.deepEqual(report.steps, teamClubIdentityGroups.map((id) => ({ id, status: 'passed' })));
  assert.deepEqual(report.checks, report.steps);
  assert.deepEqual(report.observed, { clubCreationChanged: true, oldAdultEligible: false, oldGuardianAccepted: false, oldTeamOffered: false });
  for (const key of ['baselineRecordsPreserved', 'claimsUnchanged', 'adminClientClosed', 'emulatorCliExitedSuccessfully',
    'isolatedEnvironmentDestroyed']) assert.equal(report[key], true, key);
  for (const key of ['teamChatImplemented', 'nativeUiExecuted', 'physicalDevice', 'productionWrites']) assert.equal(report[key], false, key);
  assert.equal(report.providerRequests, 0);
  assert.deepEqual(report.baselineCollections, ['users', 'memberships', 'children', 'trips', 'bookings', 'rideSessions',
    'messages', 'chatInboxes', 'notifications', 'co2Ledger', 'rewardLedger', 'clubs', 'teams', 'guardianVerifications']);
  assert.deepEqual(report.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
}
export function validateRetainedTeamClubIdentity(root, source) {
  const directory = dirname(resolve(root, source)), base = dirname(directory);
  const read = (file) => readFileSync(resolve(base, file)), json = (file) => JSON.parse(read(file));
  const report = JSON.parse(readFileSync(resolve(root, source))); validateTeamClubIdentity(report);
  assert.equal(Object.keys(report.sourceFiles).length, 8); assertRetainedSourceFiles(root, report.sourceFiles);
  const { emulatorCliExitedSuccessfully, isolatedEnvironmentDestroyed, emulatorEndpoints, ...attempt } = report;
  assert.deepEqual(json('passed/attempt.json'), attempt);
  const disposal = json('passed/disposal.json');
  assert.equal(disposal.runId, report.runId); assert.equal(disposal.trialPassed, true);
  assert.equal(disposal.scope, 'owned-runtime-disposal-not-flow-verification');
  assert.equal(disposal.isolatedEnvironmentDestroyed, true); assert.deepEqual(disposal.emulatorEndpoints, report.emulatorEndpoints);
  assert(read('passed/transcript.txt').toString().includes('Ten isolated team/club identity groups passed'));
  assert(read('passed/transcript.txt').toString().includes('Script exited successfully (code 0)'));
  for (const [file, hash] of Object.entries(json('artifact-sha256.json'))) {
    assert(!isAbsolute(file) && !file.split('/').includes('..'));
    assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash, file);
  }
  return report;
}
