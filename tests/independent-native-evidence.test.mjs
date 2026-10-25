import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { validateIndependentNativeEvidence, validateNativeCiProvenance } from '../scripts/qa/independent-native-evidence.mjs';
import { validateEmergencyIdentityReport, validateRetainedEmergencyIdentity } from '../scripts/qa/emergency-identity-retained-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';
import { validateCurrentNativeBlocker } from '../scripts/qa/flow-recheck-evidence.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const base = 'docs/release/evidence/native-independent-61dc4cb-2026-10-20/';
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const json = (path) => JSON.parse(read(base + path));
test('all four actual independent trials and the complete unchanged replay retain source, execution and cleanup proof', () => {
  const evidence = validateIndependentNativeEvidence(root, base);
  assert.equal(evidence.sourceCommit, '61dc4cbbfe7be43b14f878f86e358b17bd53d2e7');
  assert.equal(evidence.ciRunId, '39345199425'); assert.equal(Object.keys(json('artifact-sha256.json')).length, 110);
  assert.equal(Object.keys(json('source-sha256.json')).length, 79);
});
test('a skipped, missing, cancelled or failed required native case cannot become an aggregate pass', () => {
  const original = json('native-run.json'), context = json('retained-context.json');
  validateNativeCiProvenance(original, context);
  for (const name of ['Android native UI tests', 'Android native unit tests', 'Native UI flow coverage',
    'Android focused safety UI tests / Isolated safety flows', ...Object.keys(context.cases).map((id) =>
      'Android focused safety UI tests / Isolated ' + id)]) {
    for (const conclusion of ['failure', 'skipped', 'cancelled', null]) {
      const run = structuredClone(original); run.jobs.find((job) => job.name === name).conclusion = conclusion;
      assert.throws(() => validateNativeCiProvenance(run, context));
    }
    assert.throws(() => validateNativeCiProvenance({ ...original, jobs: original.jobs.filter((job) => job.name !== name) }, context));
    const running = structuredClone(original); running.jobs.find((job) => job.name === name).status = 'in_progress';
    assert.throws(() => validateNativeCiProvenance(running, context));
    assert.throws(() => validateNativeCiProvenance({ ...original, jobs: [...original.jobs,
      { name, status: 'completed', conclusion: 'failure' }] }, context));
  }
  for (const patch of [{ headSha: '0'.repeat(40) }, { databaseId: 1 }, { status: 'in_progress' }, { conclusion: 'failure' }])
    assert.throws(() => validateNativeCiProvenance({ ...original, ...patch }, context));
  for (const patch of [{ report: '../outside.json' }, { report: '/private/outside.json' }, { runId: 'wrong-run' }]) {
    const modified = structuredClone(context); Object.assign(modified.cases['emergency-identity'], patch);
    assert.throws(() => validateNativeCiProvenance(original, modified));
  }
});
test('identity reports cannot accept a phone call, physical device, child login, provider request or failed disposal', () => {
  const report = json('emergency-identity/emergency-identity-results.json'); validateEmergencyIdentityReport(report);
  for (const key of ['physicalDevice', 'productionWrites', 'safetyAuditAccepted', 'storeReviewAccepted',
    'childOwnAccountDialImplemented', 'fullProcessRestartProven'])
    assert.throws(() => validateEmergencyIdentityReport({ ...report, [key]: true }));
  for (const key of ['nativeUiExecuted', 'adminClientClosed', 'localPackagesRemoved', 'isolatedEnvironmentDestroyed', 'emulatorCliExitedSuccessfully'])
    assert.throws(() => validateEmergencyIdentityReport({ ...report, [key]: false }));
  for (const key of ['dialIntentCount', 'directCallIntentCount', 'providerRequests'])
    assert.throws(() => validateEmergencyIdentityReport({ ...report, [key]: 1 }));
  assert.throws(() => validateEmergencyIdentityReport({ ...report, fixtureIsolation: { ...report.fixtureIsolation, oldContactPreserved: false } }));
  assert.throws(() => validateEmergencyIdentityReport({ ...report, steps: [] }));
});
test('the separate profile gallery publishes only its four reviewed actual local captures with no child-own-account claim', () => {
  const flow = content.flows.find((item) => item.id === 'emergency-profile');
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-10-20'); assert.equal(flow.images.length, 4);
  const report = validateRetainedEmergencyIdentity(root, flow.ui.source);
  assert.equal(report.childOwnAccountDialImplemented, false); assert.equal(report.dialIntentCount, 0);
  assert.match(flow.remaining, /connexion de l’enfant/); assert.match(flow.remaining, /sur téléphone/);
  assert.equal(flow.tour.length, 4);
  for (const [index, image] of flow.images.entries()) {
    assert.equal(flow.tour[index].image, image.file); assert.match(image.alt, /20 octobre/);
    assert(captures[image.file].startsWith(base + 'emergency-identity/'));
  }
  assert(content.updates.some((item) => item.flow === flow.id && item.date === '2026-10-20'));
  assert.equal(content.nativeVerification.source, base + 'README.md');
  validateCurrentNativeBlocker(root, content);
  const blocker = content.blockers.find(item => item.id === 'chat-send-stability');
  assert.equal(blocker.source, content.nativeVerification.source); assert.match(blocker.next, /sur téléphone/);
  assert.match(blocker.text, /précédent/);
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'partial');
});
test('raw bytes, actual new evidence tests and current source are covered by smoke and native gates', () => {
  for (const extension of ['xml', 'txt', 'json', 'claimed']) assert(read('.gitattributes').includes(base + '**/*.' + extension + ' -text -whitespace'));
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = parseDocument(read('.github/workflows/' + name)).toJSON();
    for (const path of ['tests/independent-native-evidence.test.mjs', 'tests/continuous-device-evidence.test.mjs']) {
      for (const event of ['push', 'pull_request']) assert(workflow.on[event].paths.includes(path));
      assert(Object.values(workflow.jobs).some((job) => job.steps?.some((step) => step.run?.includes(path))));
    }
  }
});
