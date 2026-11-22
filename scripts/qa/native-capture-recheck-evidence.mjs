import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateNativeCaptureRecheck(root, record) {
  const base = dirname(resolve(root, record.source)), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file)), summary = json('summary.json'), run = json('native-run.json');
  assert.equal(record.checkedAt, summary.checkedAt); assert.equal(summary.scope, 'completed-local-replay-with-failed-ordinary-capture');
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  assert.equal(run.headSha, summary.sourceCommit); assert.equal(run.databaseId, summary.ciRunId);
  assert.equal(run.headSha, '24218efd46fa35c5d64e7d33dd07f28657fc4fa3');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  for (const key of ['fullCiPassed', 'ordinaryTestsPassed', 'rootCauseEstablished', 'physicalTrackingAccepted', 'productionWrites', 'releaseComplete'])
    assert.equal(summary[key], false, key);
  assert.equal(summary.localReplayCompleted, true); assert.equal(summary.localGroupsPassed, 36); assert.equal(summary.nativeCasesPassed, 38);
  const focused = run.jobs.filter(job => job.name.startsWith('Android focused safety UI tests / '));
  assert.equal(focused.length, 11); assert(focused.every(job => job.conclusion === 'success')); assert.equal(summary.focusedLanesPassed, 11);
  assert.equal(run.jobs.find(job => job.databaseId === 119759415562).conclusion, 'failure');
  const artifact = json('artifact-metadata.json'); assert.equal(artifact.id, 12418273134);
  assert.equal(artifact.name, 'android-connected-ui-test-results'); assert.equal(artifact.workflow_run.head_sha, run.headSha);
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 1,
    componentEvidence: 0, localReplay: 0});
  const replay = json('replay/results.json'); assert.equal(replay.runId, summary.runId);
  assert.equal(replay.scope, 'local-ui-not-physical-device'); assert.equal(replay.testCount, 36); assert.equal(replay.nativeCaseCount, 38);
  assert.equal(replay.steps.length, 36); assert(replay.steps.every(step => step.status === 'passed'));
  assert.equal(new Set(replay.steps.map(step => step.id)).size, 36);
  const files = readdirSync(resolve(base, 'replay')), transcripts = files.filter(file => file.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 30);
  for (const name of transcripts) assertInstrumentationPassed(bytes('replay/' + name).toString(), name.startsWith('LocalAppFlowTest-') ? 9 : 1);
  const copies = files.filter(file => file.startsWith('adb-pull-')); assert.equal(copies.length, 16);
  for (const file of copies) { const receipt = json('replay/' + file); assert.equal(receipt.runId, replay.runId); assert.equal(receipt.completed, true); }
  const suite = new XMLParser({ignoreAttributes: false, isArray: name => name === 'testcase'}).parse(bytes('ordinary-suite.xml')).testsuite;
  assert.equal(suite['@_tests'], '193'); assert.equal(suite['@_failures'], '1'); assert.equal(suite['@_errors'], '0');
  assert.equal(suite['@_skipped'], '50'); assert.equal(suite.testcase.length, 193);
  assert.equal(suite.testcase.filter(test => Object.hasOwn(test, 'skipped')).length, 50);
  const failures = suite.testcase.filter(test => Object.hasOwn(test, 'failure')); assert.equal(failures.length, 1);
  assert.equal(failures[0]['@_name'], 'largeTextParentSeesBothVersionsAndAcceptsWithoutApplying');
  assert.equal(summary.failedCase, failures[0]['@_classname'].split('.').at(-1) + '.' + failures[0]['@_name']);
  assert.match(JSON.stringify(failures[0].failure), /Failed waiting for PixelCopy!/);
  const cleanup = json('disposable-store-restore.json'); assert.equal(cleanup.verified, true);
  assert.equal(cleanup.installAdmin.authorizationRemoved, true); assert.equal(cleanup.installAdmin.componentRemoved, true);
  assert.equal(cleanup.installAdmin.originalPolicyRestored, true);
  for (const [file, digest] of Object.entries(json('source-sha256.json')))
    assert.equal(createHash('sha256').update(bytes('source/' + file)).digest('hex'), digest, file);
  assertEvidenceBundleChecksums(base);
  return summary;
}
