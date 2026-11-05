import assert from 'node:assert/strict';
import {assertCurrentIosAutomatedEvidence} from '../scripts/qa/ios-fixture-release-evidence.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosBuildAudit, iosBuildAuditProgress} from '../partner-portal/ios-build-audit.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';

const folder = 'docs/release/evidence/ios-build-audit-2026-11-05/';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const json = path => JSON.parse(read(path));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const report = json(iosBuildAudit.source);
const frozen = (commit, path) => {
  const row = json(iosBuildAudit.checksums).files.find(row => row.commit === commit && row.path === path);
  assert(row, path); const source = read('docs/release/evidence/source-archive/' + row.sha256 + '.txt');
  assert.equal(sha(source), row.sha256); return source;
};

test('the actual 3954ff7 run stays cancelled at its approved deadline before all fixture and capture execution', () => {
  const run = json(folder + 'terminal-run.json');
  assert.equal(run.databaseId, 41947106575); assert.equal(run.headSha, report.failedSourceCommit);
  assert.equal(run.headSha, '3954ff7cca9e97bf06314466dc6b99772f78006a');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'cancelled');
  const job = run.jobs.find(job => job.databaseId === 126992774516);
  assert.equal(job.conclusion, 'cancelled');
  assert.equal(job.steps.find(step => step.name === 'Compile app and all fixture test bundles').conclusion, 'cancelled');
  for (const name of ['Run every built fixture test without rebuilding', 'Validate and collect only three approved synthetic captures',
    'Retain approved iPhone captures for one day']) assert.equal(job.steps.find(step => step.name === name).conclusion, 'skipped');
  assert.equal(job.steps.find(step => step.name === 'Dispose isolated simulator').conclusion, 'success');
  assert.equal(json(folder + 'artifact-inventory.json').total_count, 0);
  assert(json(folder + 'annotations.json').some(row => row.message === 'The job has exceeded the maximum execution time of 50m0s'));
  assert.equal(report.observedBuild.lineCount, 14024); assert.equal(report.observedBuild.compilerErrorCount, 0);
  assert.equal(report.observedBuild.appSwiftCompileLineCount, 0);
  assert.match(read(folder + 'selected-build-lines.txt'), /StripePaymentSheet/);
  assert.match(read(folder + 'selected-build-lines.txt'), /The operation was canceled/);
  for (const key of ['rootCauseConfirmed', 'contactTransferFixSdkVerified', 'sdkLinkedBuildAccepted', 'fixtureUiExecuted',
    'physicalDeviceAccepted', 'newNativeMediaPublished', 'releaseComplete']) assert.equal(report[key], false);
});

test('no speculative runner, cache, deadline, build or reduced-fixture change follows the timeout', () => {
  const old = parseDocument(frozen(report.failedSourceCommit, '.github/workflows/ios-mvp-verification.yml')).toJSON();
  const audited = parseDocument(frozen(report.currentAppSourceCommit, '.github/workflows/ios-mvp-verification.yml')).toJSON();
  assert.deepEqual(audited.jobs, old.jobs);
  assert.deepEqual(audited.concurrency, old.concurrency);
  const job = audited.jobs['ios-fixture-verification'];
  assert.equal(job['runs-on'], 'macos-26-intel'); assert.equal(job['timeout-minutes'], 50);
  assert.equal(job.steps.filter(step => step.uses?.startsWith('actions/upload-artifact')).length, 1);
  const commands = job.steps.map(step => step.run ?? '').join('\n');
  assert.doesNotMatch(commands, /retry|only-testing|skip-testing|\|\| true/);
  assert.equal(report.currentAppSourceCommit, '6073b2c3106e3f15d410352a8d8494eede90d4df');
  assert.equal(report.currentAppGateRunId, 41954791367);
  assert.equal(report.currentAppGateAccepted, false);
});

test('the source audit freezes real missing actions without requiring future implementations to stay broken', () => {
  const commit = report.currentAppSourceCommit, app = 'ios/Sources/SportsGreenMooveApp/';
  const groups = frozen(commit, app + 'GroupsScreen.swift');
  assert(groups.includes('requestedClubIds.insert(club.id)'));
  assert.doesNotMatch(groups, /requestClubMembership|gateway\.|firebase\./);
  assert(groups.includes('ClubSummaryRow(club: club, actionTitle: "OUVRIR")'));
  const messages = frozen(commit, app + 'MessagesScreen.swift');
  const bookingCard = messages.split('private struct ChatCard: View')[1].split('private struct NotificationCard')[0];
  assert(bookingCard.includes('HStack(spacing: 10)'));
  assert.doesNotMatch(bookingCard, /Button|NavigationLink|onTapGesture|\.sheet/);
  const profile = frozen(commit, app + 'ProfileScreen.swift'), options = frozen(commit, app + 'OptionsScreen.swift');
  assert(profile.includes('"Ma ville", "", AppOverlay.options'));
  assert.doesNotMatch(options, /TextField|TextEditor|saveCity|updateCity/);
  assert.deepEqual(report.sourceGaps.map(row => row.id), ['club-membership', 'booking-ride-chat', 'profile-city']);
  for (const gap of report.sourceGaps) {
    assert.equal(gap.implementedEndToEnd, false); assert.equal(gap.nativeUiExecuted, false);
  }
});

test('the independent generated-file failure preserves the eighteenth primary failure and verified cleanup without app acceptance', () => {
  const run = json(folder + 'transport-terminal-run.json'), result = json(folder + 'transport-result.json');
  assert.equal(run.databaseId, 41954791360); assert.equal(run.headSha, report.currentAppSourceCommit);
  assert.equal(run.conclusion, 'failure');
  assert.equal(result.plannedTrials, 32); assert.equal(result.trials.length, 18);
  assert(result.trials.slice(0, 17).every(row => row.commandCompleted && row.integrityVerified));
  assert.equal(result.trials[17].index, 17); assert.equal(result.trials[17].status, 1);
  assert.equal(result.trials[17].commandCompleted, false); assert.equal(result.completed, false); assert.equal(result.success, false);
  assert.deepEqual(result.cleanup, {remoteCreatedOrPartiallyCreated: true, removed: true, absenceVerified: true});
  assert.equal(result.guestAfter.completed, false); assert.equal(result.guestComparison.continuityProven, false);
  assert.equal(result.emulatorBefore.processState, 'present'); assert.equal(result.emulatorAfter.processState, 'present');
  for (const key of ['appInstalled', 'accountsUsed', 'retryPerformed', 'alternateTransportUsed', 'rootCauseConfirmed', 'releaseAccepted'])
    assert.equal(result[key], false);
  for (const record of report.records) assert.equal(sha(read(folder + record.file)), record.sha256);
  for (const row of json(iosBuildAudit.checksums).files)
    assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
});

test('one concise incomplete-club note preserves the original portal and pending release scope with smoke coverage', () => {
  assert.deepEqual(content.iosBuildAudit, iosBuildAudit);
  assert.deepEqual(content.updates.filter(row => row.source === iosBuildAuditProgress.source), [iosBuildAuditProgress]);
  assert(partitionUpdates(content.updates).previous.some(row => row.source === iosBuildAuditProgress.source));
  assert.doesNotMatch(iosBuildAuditProgress.title + iosBuildAuditProgress.text, /Firebase|BrowserStack|SDK|Swift|CI\b|Stripe/i);
  assert(content.flows.some(row => row.id === 'clubs'));
  const path = 'tests/ios-build-audit.test.mjs', web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['pull_request', 'push']) assert(web.on[event].paths.includes(path));
  assert(Object.values(web.jobs).some(job => job.steps.some(step => step.run?.includes(path))));
  assertCurrentIosAutomatedEvidence();
});
