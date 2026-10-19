import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { assertTeamPhoneReport, validateTeamPhoneArtifacts } from '../scripts/qa/team-phone-evidence.mjs';
import { verifyManualTeamCheckpoint, teamPhonePhases } from '../scripts/qa/manual-team-phone-checkpoints.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const base = 'docs/release/evidence/phone-team-enrollment-2026-10-19/';
const bytes = (path) => readFileSync(new URL('../' + path, import.meta.url));
const json = (name) => JSON.parse(bytes(base + name));
const records = () => teamPhonePhases.map(([phase]) => json(phase + '.json'));
const validate = (patch = {}, session = json('session-results.json'), checkpoints = records(), teardown = json('teardown.json')) =>
  assertTeamPhoneReport({ ...json('results.json'), ...patch }, session, checkpoints, json('connection-policy.json'), teardown);

test('actual phone-parent and manager UI proof retains seven exact checkpoints, twelve reviewed captures and cleanup', () => {
  const run = validateTeamPhoneArtifacts(root, base + 'results.json');
  assert.equal(run.testedAt, '2026-10-19T10:26:31.777Z'); assert.equal(run.sourceCommit, '21190ff46ae631901d45c2f33f04ea97def263e6');
  assert.equal(run.appSha256, '6fc824d795aa7c737ffcf35ab294596922f97403909e680fcea8bde316eda64e');
  assert.equal(json('child-approved.json').state.events.length, 7);
  assert.doesNotMatch(bytes(base + 'session-results.json').toString('utf8'), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/);
});
test('missing, repeated, foreign or incorrect actors and revisions never satisfy a persisted phone checkpoint', () => {
  const original = json('child-approved.json');
  for (const mutate of [
    (state) => state.events.pop(), (state) => state.events.push({ ...state.events[0] }),
    (state) => { state.events[0].actorUserId = 'outside-account'; },
    (state) => { state.enrollments[0].teamInstanceId = 'different-team'; },
    (state) => { state.enrollments[0].clubId = 'foreign-club'; },
    (state) => { state.enrollments[0].revision++; },
    (state) => { state.guardian.status = 'revoked'; },
  ]) {
    const state = structuredClone(original.state); mutate(state);
    assert.throws(() => verifyManualTeamCheckpoint(original.phase, state, original.identity));
  }
  assert.throws(() => verifyManualTeamCheckpoint('unknown', original.state, original.identity));
});
test('partial runs, absent cleanup or wider restart, tracking, chat and release claims are rejected', () => {
  for (const patch of [{ fullProcessRestartProven: true }, { guardianRevocationPhoneProven: true }, { videoCaptured: true },
    { productionWrites: true }, { releaseEvidenceAccepted: true }, { teamChatImplemented: true }, { trackingVerified: true },
    { physicalDevice: false }, { managerUiProven: false }, { parentNativeUiProven: false }, { captures: [] },
    { captureMethod: 'native-pixel-export' }, { steps: json('results.json').steps.slice(1) }]) assert.throws(() => validate(patch));
  for (const patch of [{ completed: false }, { fixtureCleanupVerified: false }, { physicalUiProvenByThisReport: true }])
    assert.throws(() => validate({}, { ...json('session-results.json'), ...patch }));
  assert.throws(() => validate({}, json('session-results.json'), records().toReversed()));
  for (const patch of [{ privateSessionFileRemoved: false }, { phoneReleasedObserved: false }, { helperProcessesStopped: false }])
    assert.throws(() => validate({}, json('session-results.json'), records(), { ...json('teardown.json'), ...patch }));
});
test('the private portal preserves the nine original phone views alongside six separately bound history views', () => {
  const flow = content.flows.find((item) => item.id === 'team-enrollment');
  assert.equal(flow.status, 'partial'); assert.equal(flow.phone.source, base + 'results.json');
  assert.equal(flow.images.length, 15); assert.equal(flow.tour.length, 15); assert.equal(flow.local.checkedAt, '2026-10-18');
  const original = flow.images.filter((image) => captures[image.file].startsWith(base));
  assert.equal(original.length, 9);
  assert.equal(flow.tour.filter((step) => original.some((image) => image.file === step.image)).length, 9);
  assert.equal(flow.historyPhone.source, 'docs/release/evidence/phone-team-history-2026-10-19/results.json');
  assert.match(flow.remaining, /fermeture complète/); assert.match(flow.remaining, /conversation/);
  assert.doesNotMatch(JSON.stringify(flow), /Firebase|BrowserStack|Playwright|SDK|Terraform/);
  const manager = content.flows.find((item) => item.id === 'team-review');
  assert.equal(manager.phone.source, flow.phone.source); assert.equal(manager.ui.checkedAt, '2026-10-18');
});
test('earlier native preparation failure remains separate from the completed phone journey and guard pass', () => {
  const prefix = 'docs/release/evidence/disposable-installation-guard-2026-10-18/preparation-failure-21190ff/';
  const hashes = JSON.parse(bytes(prefix + 'artifact-sha256.json')); assert.equal(Object.keys(hashes).length, 3);
  for (const [file, expected] of Object.entries(hashes)) assert.equal(createHash('sha256').update(bytes(prefix + file)).digest('hex'), expected);
  assert.deepEqual(JSON.parse(bytes(prefix + 'disposable-device-setup.json')),
    { scope: 'failed-disposable-device-setup-not-flow-proof', serial: 'emulator-5554', storeCleanup: null, adminCleanup: null });
  assert.match(bytes(prefix + 'native-failed.log').toString('utf8'), /Store pause was not applied/);
});
test('backend and web smoke validate the manual phone checkpoint and artifact contracts', () => {
  for (const name of ['backend-ci.yml', 'web-integration-smoke.yml'])
    assert(bytes('.github/workflows/' + name).toString('utf8').includes('tests/team-phone-evidence.test.mjs'));
  const smoke = bytes('.github/workflows/web-integration-smoke.yml').toString('utf8');
  assert.equal(smoke.split('"tests/team-phone-evidence.test.mjs"').length - 1, 2);
});
