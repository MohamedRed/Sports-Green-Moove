import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';
import {validatePrimaryCaptureDiagnostic} from './primary-capture-diagnostic-schema.mjs';
import {nativeFollowup as identity} from './native-followup-evidence.mjs';

export function validateNativeFollowupMain(root) {
  const base = resolve(root, identity.folder, 'main'), read = file => readFileSync(resolve(base, file), 'utf8');
  const json = file => JSON.parse(read(file)); assertEvidenceBundleChecksums(base);
  const run = json('native-run.json'), artifact = json('artifact.json');
  assert.equal(run.headSha, identity.head); assert.equal(run.databaseId, identity.workflowId);
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  const failed = run.jobs.filter(job => job.conclusion === 'failure');
  assert.equal(failed.length, 1); assert.equal(failed[0].databaseId, 124050828082); assert.equal(failed[0].name, 'Android native UI tests');
  assert(run.jobs.every(job => job.status === 'completed' && ['success', 'failure', 'skipped'].includes(job.conclusion)));
  assert.equal(artifact.id, 12976272774); assert.equal(artifact.name, 'android-connected-ui-test-results');
  assert.equal(artifact.workflow_run.head_sha, identity.head); assert.equal(artifact.workflow_run.id, identity.workflowId);
  const ordinary = parseAndroidJUnitTranscript(read('ordinary-instrumentation.txt')), stored = json('ordinary-results.json');
  for (const [key, value] of Object.entries(ordinary)) assert.deepEqual(stored[key], value);
  assert.deepEqual([ordinary.caseCount, ordinary.passed, ordinary.skipped, ordinary.failed], [253, 198, 54, 1]);
  assert.deepEqual(ordinary.cases.filter(row => row.status === 'failed'), [{className: 'be.sportgreenmoove.app.ui.TeamConversationFlowTest',
    name: 'anUnconfirmedSendRetriesTheSameIntentAndOnlyOneMessageIsAdded', status: 'failed', reason: 'test-failure'}]);
  assert.match(read('ordinary-instrumentation.txt'), /Blank test capture rejected; use a rendering-enabled device image\./);
  assert.match(read('ordinary-instrumentation.txt'), /TeamConversationFlowTest\.kt:57/);
  assert.deepEqual(json('native-suite-status.json'),
    {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 1, componentEvidence: 0, localReplay: 0});
  const replay = json('replay/results.json');
  assert.equal(replay.scope, 'local-ui-not-physical-device'); assert.equal(replay.projectId, 'demo-sgm-local-qa');
  assert.equal(replay.runId, '6f879e4db5cb570cbab029257d75fff1');
  assert.deepEqual([replay.testCount, replay.nativeCaseCount, replay.steps.length], [37, 40, 37]);
  assert(replay.steps.every(row => row.status === 'passed')); assert(replay.adminClientClosed && replay.firestoreClientTerminated);
  const files = readdirSync(resolve(base, 'replay')), transcripts = files.filter(file => file.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 32); let cases = 0;
  for (const file of transcripts) {const count = file.startsWith('LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(read('replay/' + file), count); cases += count;}
  assert.equal(cases, 40);
  const copies = files.filter(file => file.startsWith('adb-pull-')); assert.equal(copies.length, 17);
  for (const file of copies) {const row = json('replay/' + file); assert.equal(row.runId, replay.runId);
    assert.equal(row.completed, true); assert.equal(row.status, 0); assert.equal(row.errorCode, null); assert.equal(row.signal, null);
    assert.notEqual(row.phase, 'failure-cleanup'); assert.equal(file, 'adb-pull-' + row.phase + '.json');}
  const captures = readdirSync(resolve(base, 'capture-diagnostics')); assert.equal(captures.length, 6);
  for (const file of captures) {const trace = json('capture-diagnostics/' + file);
    assert.equal(trace.schemaVersion, 3); assert.equal(validatePrimaryCaptureDiagnostic(trace).complete, true);
    assert.equal(trace.primaryOutcome, 'returned'); assert.equal(trace.errorCategory, 'none');}
  const restore = json('device-restoration.json'); assert.equal(restore.case, 'full-matrix');
  assert.equal(restore.restored, true); assert.equal(restore.verified, true); assert.equal(restore.observed.continuousGuardVerified, true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
  assertRetainedSourceFiles(root, json('source-sha256.json'));
  return {ordinary, replayCases: cases, primaryCopies: copies.length, nativeGatePassed: false};
}
