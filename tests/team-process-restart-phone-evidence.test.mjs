import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { assertTeamProcessRestart, validateTeamProcessRestart, teamRestartDirectory } from '../scripts/qa/team-process-restart-phone-evidence.mjs';
import { teamPhonePhases } from '../scripts/qa/manual-team-phone-checkpoints.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..');
const json = name => JSON.parse(readFileSync(resolve(root, teamRestartDirectory, name + '.json')));
const reports = () => ({run: json('summary'), session: json('checkpoints/session-results'), observations: json('ui-observations'),
  checkpoints: teamPhonePhases.map(([phase]) => json('checkpoints/' + phase)),
  pairs: teamPhonePhases.map(([phase]) => [json(phase + '-before-stop'), json(phase + '-after-stop')]),
  cleanup: json('runtime-cleanup'), removal: json('package-absence'), approval: json('session-capture-approval'),
  captures: json('public-captures'), consoleText: readFileSync(resolve(root, teamRestartDirectory, 'process-console-text.txt'), 'utf8')});

test('seven real-phone enrollment restarts bind process absence, new processes, exact state, UI and disposal', () => {
  const run = validateTeamProcessRestart(root);
  assert.equal(run.verifiedProcessRestarts, 7); assert.equal(run.releaseEvidenceAccepted, false);
});
test('missing force stop, stale process observations and lost restored authentication fail the restart contract', () => {
  for (const change of [
    r => r.observations.splice(r.observations.findIndex(x => x.phase === 'self-refused-process-stopped'), 1),
    r => r.observations.find(x => x.phase === 'self-refused-native-stop').androidForceStopConfirmationClicked = false,
    r => r.observations.find(x => x.phase === 'self-refused-process-restarted').pid = 18938,
    r => r.observations.find(x => x.phase === 'child-approved-restored').credentialsReentered = true,
    r => r.observations.find(x => x.phase === 'child-requested-restored').parentStatus = 'Inscription approuvée',
    r => r.observations.find(x => x.phase === 'self-requested-restored').newRequestSubmitted = true,
    r => r.observations.find(x => x.phase === 'self-approved-process-stopped').observedAt = '2026-10-28T14:00:00Z',
    r => r.consoleText = r.consoleText.replace('MEMINFO in pid 6108', 'MEMINFO in pid 11947'),
  ]) { const r = reports(); change(r); assert.throws(() => assertTeamProcessRestart(r)); }
});
test('replacement documents, repeated requests, invalid authority and incomplete cleanup are rejected', () => {
  for (const change of [
    r => r.pairs[6][1].documents[0].updateTime = 'changed',
    r => r.pairs[0][1].documents.push(r.pairs[0][1].documents[0]),
    r => r.checkpoints[6].state.events.pop(),
    r => r.checkpoints[6].state.guardian.status = 'revoked',
    r => r.cleanup.processGroupExited = false,
    r => r.cleanup.ports[0].available = false,
    r => r.removal.packageAbsenceIndependentlyObserved = false,
    r => r.session.fixtureCleanupVerified = false,
    r => r.run.releaseEvidenceAccepted = true,
    r => r.run.installedBytesIndependentlyVerified = true,
    r => r.run.guardianReviewUiVerifiedThisRun = true,
    r => r.approval.approved = false,
    r => r.approval.nativeExportClaimAllowed = true,
    r => r.captures[0].method = 'native-export',
    r => r.captures[0].original = 'child-approved-restored-context.png',
  ]) { const r = reports(); change(r); assert.throws(() => assertTeamProcessRestart(r)); }
});
test('original context pixels and all evidence files are protected against drift', () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-team-restart-integrity-'));
  try {
    cpSync(resolve(root, teamRestartDirectory), resolve(temp, teamRestartDirectory), {recursive: true});
    writeFileSync(resolve(temp, teamRestartDirectory, 'child-approved-restored-context.png'), 'changed');
    assert.throws(() => validateTeamProcessRestart(temp));
  } finally { rmSync(temp, {recursive: true, force: true}); }
});
test('the public portal leads with dated session captures, retaining earlier phone evidence and remaining limits', () => {
  const flow = content.flows.find(row => row.id === 'team-enrollment');
  assert.equal(flow.status, 'partial'); assert.equal(flow.images.length, 20); assert.equal(flow.tour.length, 5);
  assert.equal(flow.restartPhone.source, teamRestartDirectory + '/summary.json');
  for (const image of flow.images.slice(0, 5)) {
    assert.match(image.alt, /capture de session du 28 octobre/);
    assert(captures[image.file].startsWith(teamRestartDirectory + '/captures/'));
  }
  assert(flow.images.slice(5).every(image => /19 octobre/.test(image.alt)));
  assert(flow.tour.slice(0, 5).every(step => /Capture de session du 28 octobre/.test(step.text)));
  assert.match(flow.remaining, /notifications/); assert.match(flow.remaining, /autres appareils/);
  assert.doesNotMatch(flow.remaining, /fermeture complète/);
  assert.doesNotMatch(JSON.stringify(flow), /Firebase|BrowserStack|Playwright|SDK|Terraform|Pixel/);
  assert.match(content.updates[0].title, /fermeture/);
});
test('web smoke runs the new evidence contract without changing previous workload commands', () => {
  const workflow = readFileSync(resolve(root, '.github/workflows/web-integration-smoke.yml'), 'utf8');
  assert.equal(workflow.split('"tests/team-process-restart-phone-evidence.test.mjs"').length - 1, 2);
  assert(workflow.includes('run: node --test tests/team-process-restart-phone-evidence.test.mjs'));
});
