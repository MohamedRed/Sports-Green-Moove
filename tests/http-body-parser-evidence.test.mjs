import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, cpSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {content} from '../partner-portal/content.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';
import {assertRequestSafetySummary, validateRequestSafetyEvidence, requestSafetyFolder} from '../scripts/qa/http-body-parser-evidence.mjs';

const record = content.requestSafetyRecheck, root = resolve(import.meta.dirname, '..');
test('the same parser cases retain two original worker crashes, the patch and both service outcomes', () => {
  const summary = validateRequestSafetyEvidence(root, record);
  assert.equal(summary.parserFailuresBefore, 3); assert.equal(summary.parserFailuresAfter, 0);
  assert.equal(summary.securityAuditClear, false);
});
test('local dependency proof cannot become a production exploit, phone, root-cause or full-security claim', () => {
  const original = JSON.parse(readFileSync(resolve(root, record.source)));
  for (const key of ['productionExploitReproduced', 'securityAuditClear', 'productionDeployed', 'physicalDeviceAccepted',
    'nativeReplayAccepted', 'releaseComplete', 'originalCliExitCauseProven', 'realPayments'])
    assert.throws(() => assertRequestSafetySummary({...original, [key]: true}));
  assert.throws(() => assertRequestSafetySummary({...original, incompleteServiceGroupsPassed: 24}));
});
test('altering the retained failed result invalidates the evidence instead of erasing the first attempt', t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-parser-evidence-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  cpSync(resolve(root, requestSafetyFolder), resolve(temp, requestSafetyFolder), {recursive: true});
  writeFileSync(resolve(temp, requestSafetyFolder, 'incomplete-services.json'), '{}');
  assert.throws(() => validateRequestSafetyEvidence(temp, record), /incomplete-services.json/);
});
test('request security and runtime disposal stay in both required CI workflows with concise public scope', () => {
  for (const name of ['backend-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = readFileSync(resolve(root, '.github/workflows', name), 'utf8');
    for (const path of ['tests/http-body-parser-security.test.mjs', 'tests/http-body-parser-evidence.test.mjs',
      'tests/local-runtime-disposal.test.mjs']) assert(workflow.includes(path));
  }
  const blocker = content.blockers.find(row => row.id === 'dependency-security');
  assert.equal(content.requestSafetyRecheck.source, requestSafetyFolder + '/summary.json');
  assert.equal(blocker.source, 'docs/release/evidence/dependency-patch-2026-10-28/README.md');
  assert.match(blocker.text, /locaux/); assert.match(blocker.text, /autres alertes/i);
  assert(content.updates.some(row => row.source === requestSafetyFolder + '/README.md'));
  const update = content.updates.find(row => row.source === blocker.source);
  assert(update); assert.doesNotMatch(update.text, /body-parser|Firebase|npm|Express|SDK/);
  const {recent} = partitionUpdates(content.updates);
  assert(recent.includes(update));
  assert(recent.some(row => row.source === 'docs/release/evidence/direct-booking-confirmation-2026-10-28/README.md'));
});
