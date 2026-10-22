import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { validateNativeCaptureRecheck } from './native-capture-recheck-evidence.mjs';

export function validateFlowRecheck(root, record) {
  const base = dirname(resolve(root, record.source)), read = name => readFileSync(resolve(base, name), 'utf8');
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  const json = name => JSON.parse(read(name)), report = json('summary.json');
  assert.equal(report.reviewedAt, record.checkedAt);
  assert.equal(report.scope, 'terminal-ci-service-recheck-and-incomplete-native-phone-attempts');
  assert.equal(report.sourceCommit, '87ec649ea41d0203ea591bc3a4b5380c881c2b0c');
  for (const key of ['fullNativeReplayCompleted', 'newPhoneFlowCompleted', 'physicalTrackingAccepted', 'productionWrites', 'releaseComplete'])
    assert.equal(report[key], false, key);
  assert.deepEqual(report.newCapturesAccepted, []); assert.equal(report.serviceGroupsPassed, 24);
  const web = json('web-run.json'), native = json('native-run.json');
  for (const run of [web, native]) { assert.equal(run.headSha, report.sourceCommit); assert.equal(run.status, 'completed'); }
  assert.equal(web.databaseId, 39691040870); assert.equal(web.conclusion, 'success');
  const webJob = web.jobs.find(job => job.databaseId === 119536999659); assert.equal(webJob.conclusion, 'success');
  assert.equal(webJob.steps.find(step => step.name === 'Test isolated multi-person flows').conclusion, 'success');
  const expected = ['fixtures', 'ride-lifecycle', 'publication', 'booking-cancellation', 'last-seat-concurrency', 'multi-seat-booking',
    'messages-notifications', 'ride-audit-ledgers', 'ratings', 'club-request', 'support-request', 'ride-passenger-safety',
    'chat-delivery-safety', 'chat-post-commit-response-loss', 'chat-directory-safety', 'reservation-decisions', 'membership-review',
    'trip-capacity-ownership', 'team-ownership', 'trip-cancellation', 'trip-details-ownership', 'trip-change-parent-confirmation',
    'trip-change-application', 'trip-change-supplement'];
  const lines = read('service-transcript.txt').trim().split('\n'); assert.equal(lines.length, 25);
  assert.deepEqual(lines.slice(0, 24).map(line => /Z ([a-z-]+): passed$/.exec(line)?.[1]), expected);
  assert.match(lines[24], /Local QA: 24\/24 groups passed\. Evidence saved\.$/);
  assert.equal(native.databaseId, 39691040962); assert.equal(native.conclusion, 'failure');
  assert.equal(native.jobs.find(job => job.name === 'Android native UI tests').conclusion, 'failure');
  const focused = native.jobs.filter(job => job.name.startsWith('Android focused safety UI tests / '));
  assert.equal(focused.length, 11); assert(focused.every(job => job.conclusion === 'success'));
  const failed = json('adb-pull-trip-consent-recovery.json'), recovered = json('adb-pull-failure-cleanup.json');
  assert.equal(failed.runId, '33d063637a59367f67318a001c48565e'); assert.equal(failed.completed, false); assert.equal(failed.status, 1);
  assert.equal(recovered.runId, failed.runId); assert.equal(recovered.completed, true); assert.match(recovered.stderr, /108 files pulled/);
  const diagnostics = json('adb-sync-trip-consent-recovery-diagnostics.json'); assert.equal(diagnostics.runId, failed.runId);
  assert(diagnostics.observations.some(item => item.stderr?.includes('device offline')));
  const phone = json('session-results.json'); assert.equal(phone.completed, false); assert.deepEqual(phone.checkpoints, []);
  assert.equal(phone.adminClientClosed, true); assert.equal(phone.productionWrites, false);
  assert.equal(report.phoneHelperOutcome.code, 126); assert.equal(report.phoneHelperOutcome.rootCauseEstablished, false);
  assert.equal(report.phoneHelperOutcome.verboseDiagnosticApproved, false); assert.equal(report.phoneHelperOutcome.ownedGroupExitVerified, true);
  const startup = json('startup-diagnostic.json');
  assert.equal(startup.startupOnlyApproved, true); assert.equal(startup.requestLoggingEnabled, false);
  assert.equal(startup.normalVerbosity, 0); assert.equal(startup.code, 126); assert.equal(startup.rootCauseEstablished, false);
  assert.equal(startup.helperDirectoryRemoved, true); assert.equal(startup.startupOutputBytes, 196);
  assert.match(startup.startupOutput, /Skipping initialisation of configuration console/);
  const cleanup = json('cleanup.json'); assert(Object.values(cleanup.removed).every(value => value === true));
  assert.equal(cleanup.phoneSessionStopped, true); assert.equal(cleanup.phonePolicyChanged, false);
  assert.deepEqual(cleanup.endpoints, {host: '127.0.0.1', ports: [9099,8080,9000,5001], closed: true});
  for (const [file, hash] of Object.entries(json('artifact-sha256.json'))) {
    assert.equal(basename(file), file); assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash, file);
  }
  return report;
}

export function validateCurrentNativeBlocker(root, content) {
  const report = validateNativeCaptureRecheck(root, content.nativeCaptureRecheck);
  const blocker = content.blockers.find(item => item.id === 'test-device-stability');
  assert(blocker, 'The incomplete native replay must remain visible');
  assert.equal(resolve(root, blocker.source), resolve(root, dirname(content.nativeCaptureRecheck.source), 'README.md'));
  assert.equal(report.fullCiPassed, false);
  assert.match(blocker.text, /36 essais/); assert.match(blocker.text, /capture.*texte agrandi/);
  assert.match(blocker.next, /complète/);
  return blocker;
}
