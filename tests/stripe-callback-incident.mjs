import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {paymentReturnIncident, paymentReturnIncidentProgress} from '../partner-portal/payment-return-incident.mjs';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';
import {parseAndroidJUnitTranscript} from '../scripts/qa/android-junit-transcript.mjs';

const root = resolve(import.meta.dirname, '..');
const folder = resolve(root, 'docs/release/evidence/callback-capacity-2026-11-03');
const read = name => readFileSync(resolve(folder, name), 'utf8');
const json = name => JSON.parse(read(name));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('the initial callback failure survives later local success and uncorrelated capacity observations', () => {
  assertEvidenceBundleChecksums(folder);
  const review = json('review.json'), job = json('provider-job.json');
  assert.equal(job.id, 125849030006); assert.equal(job.run_id, 41615866643);
  assert.equal(job.head_sha, review.sourceCommit); assert.equal(job.conclusion, 'failure');
  assert.equal(job.steps.find(s => s.name === 'Validate production provider secrets').conclusion, 'success');
  assert.equal(job.steps.find(s => s.name === 'Validate Stripe production readiness').conclusion, 'failure');
  assert.equal(review.callbackDeadlineMs, 15000); assert.equal(review.failedCallback, 'return');
  const requests = json('health-requests.json').entries;
  assert(requests.some(r => r.timestamp === review.serverFailureTimestamp && r.service === 'stripeconnectreturn' && r.status === 500));
  assert(requests.some(r => r.service === 'stripeconnectreturn' && r.status === 204));
  assert(requests.some(r => r.service === 'stripeconnectrefresh' && r.status === 204));
  assert(json('health-system.json').entries.some(r => r.service === 'stripeconnectreturn' &&
    r.timestamp > '2026-11-03T10:02:45.868397Z' && r.classifications.includes('startup_probe_success')));
  assert.equal(review.observedServerFailure, 'no-instance-available-after-waiting');
  const metrics = json('capacity-metrics.json').queries;
  assert.equal(metrics.length, 3); assert(metrics.every(r => r.queryFailed && r.httpStatus === 403));
  for (const service of json('capacity-config.json').services) {
    assert.equal(service.revisionScaling.maxInstanceCount, 1);
    assert.equal(service.maxInstanceRequestConcurrency, 1); assert.equal(service.configOnlyNotIncidentCapacityProof, true);
  }
  const local = json('local-health.json');
  assert.deepEqual(local.observations.map(r => [r.status, r.kind]), [[204, 'return'], [204, 'refresh']]);
  assert.equal(local.originalCiFailurePreserved, true); assert.equal(local.originalCiRerun, false);
  for (const key of ['exactRequestCorrelationEstablished', 'hostingRetryConfirmed', 'instanceCapacityCauseConfirmed',
    'coldStartCauseConfirmed', 'monitoringDenialMeansZeroTraffic', 'localHealthObservationReplacesFailedJob',
    'ordinaryFinalRunnerResultPresent', 'ordinaryUnderlyingProcessErrorRetained', 'networkCaseReached',
    'ordinaryFailureCauseConfirmed', 'productionWrites', 'paymentsCreated', 'providerConfigurationChanged',
    'deadlineChanged', 'retryAdded', 'fallbackAdded', 'physicalFlowAccepted', 'releaseAccepted']) assert.equal(review[key], false, key);
});

test('the incomplete native transcript and original failed gate are not accepted as a network attempt', () => {
  const review = json('review.json'), checks = json('checks.json');
  assert.equal(checks.headRefOid, '9450ad0b449f081b55591c2833d90709843ac1af');
  assert.deepEqual(['SUCCESS', 'SKIPPED', 'FAILURE'].map(c => checks.statusCheckRollup.filter(r => r.conclusion === c).length), [22, 6, 2]);
  assert.equal(checks.statusCheckRollup.find(r => r.name === 'Functions, admin, and website checks').conclusion, 'SUCCESS');
  assert.equal(json('native-job.json').conclusion, 'failure');
  const transcript = read('ordinary-instrumentation.txt');
  assert.throws(() => parseAndroidJUnitTranscript(transcript));
  assert.match(transcript, /INSTRUMENTATION_STATUS: current=331/);
  assert.match(transcript, /INSTRUMENTATION_STATUS: numtests=349/);
  assert(transcript.trim().endsWith('INSTRUMENTATION_STATUS_CODE: 1'));
  assert.doesNotMatch(transcript, /^INSTRUMENTATION_CODE:/m);
  assert.deepEqual(json('ordinary-process.json'), {scope: 'single-ordinary-instrumentation-command-not-flow-proof',
    status: null, signal: 'SIGTERM', errorCode: 'INSTRUMENTATION_PROCESS_ERROR', stderr: ''});
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 1, componentEvidence: 0, localReplay: 1});
  assert.equal(json('disposable-store-restore.json').verified, true);
  const selection = json('selection.json'), hashes = json('artifact-sha256.json');
  assert.equal(selection.originalArchiveBytes, review.originalArchiveBytes);
  assert.equal(selection.originalArchiveSha256, review.originalArchiveSha256);
  assert.equal(selection.selectedMembersComparedByteForByte, true);
  for (const [member, sha] of Object.entries(selection.members)) assert.equal(sha, hashes[member.split('/').at(-1)]);
});

test('the payment publication preserves its exact earlier history while later dated updates can be appended', () => {
  const bytes = readFileSync(resolve(root, 'docs/release/evidence/compatible-security-patches-2026-11-03/portal-v331.json'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '7dc398f9c8e7163c8ab2fa5c43e8c8a963ffe4104e93390c57edfc42607f7fcc');
  const published = JSON.parse(bytes), before = json('portal-before.json');
  const blocker = published.blockers.find(b => b.id === 'payment-return');
  assert.equal(published.flows.length, 34); assert.equal(hash(published.flows), before.flowsSha256);
  assert.equal(published.updates.length, before.updatesCount + 1);
  assert.equal(hash(published.updates.filter(r => r.source !== paymentReturnIncidentProgress.source)), before.updatesSha256);
  assert.equal(hash(published.blockers.filter(b => b.id !== 'payment-return')), before.blockersWithoutPaymentSha256);
  const historical = new Set(published.updates.map(hash));
  assert.deepEqual(content.updates.filter(row => historical.has(hash(row))), published.updates);
  assert.equal(blocker.source, paymentReturnIncident.source);
  assert.equal(blocker.previousRecovery.source, before.previousPaymentBlocker.source);
  assert.equal(content.flows.find(f => f.id === 'payments').status, 'partial');
  assert.match(blocker.text, /reste irrégulier/);
  assert.doesNotMatch(blocker.text + blocker.next + paymentReturnIncidentProgress.text, /Stripe|Firebase|BrowserStack|HTTP|instance|callback|Monitoring|SIGTERM/i);
});

test('the existing release and web checks import and trigger on the incident module', () => {
  assert(readFileSync(resolve(root, 'tests/stripe-production-readiness.test.mjs'), 'utf8').includes("import './stripe-callback-incident.mjs'"));
  for (const name of ['release-readiness.yml', 'web-integration-smoke.yml']) {
    const workflow = parseDocument(readFileSync(resolve(root, '.github/workflows', name), 'utf8')).toJSON();
    for (const event of ['push', 'pull_request']) assert(workflow.on[event].paths.includes('tests/stripe-callback-incident.mjs'));
    assert(Object.values(workflow.jobs).some(job => (job.steps ?? []).some(s => s.run?.includes('npm run test:stripe-production-readiness'))));
  }
});
