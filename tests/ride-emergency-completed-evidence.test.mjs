import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync, cpSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { validateRideEmergencyReport, validateRetainedRideEmergency } from '../scripts/qa/ride-emergency-retained-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';
import { tours } from '../partner-portal/tours.mjs';
import { rideEmergencyCaptures } from '../scripts/qa/ride-emergency-evidence.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = 'docs/release/evidence/ride-emergency-pass-2026-10-19/';
const source = base + 'ride-emergency-results.json';
const read = (file) => JSON.parse(readFileSync(resolve(root, file)));
const report = read(source);
test('the actual completed two-account ride replay retains primary evidence and the complete original lifecycle', () => {
  assert.equal(validateRetainedRideEmergency(root, source).runId, '8fccf592fef8d5f5a1c5225c38205b72');
  const context = read(base + 'retained-context.json');
  assert.equal(context.sourceCommit, 'a7dae8a99809ef64b17b0b189014d11411358fc0');
  assert.equal(context.githubRunId, 39273057606); assert.equal(context.githubRunAttempt, 1);
  assert.equal(context.currentHeadComplete, false); assert.equal(Object.keys(context.sourceFiles).length, 24);
});
test('a physical, store, incomplete or account-mixed report cannot use this scoped native result', () => {
  for (const mutate of [(r) => { r.physicalDevice = true; }, (r) => { r.storeReviewAccepted = true; },
    (r) => { r.actors[1].ownerUid = 'sgm-qa-driver'; }, (r) => { r.actors[0].directCallIntentCount = 1; },
    (r) => { r.driverResumedTrackingVerified = false; }, (r) => { r.privateOperationsVerified = 3; },
    (r) => { r.rideCompletionVerifiedSeparately = false; }, (r) => { r.nativeCaseCount = 2; },
    (r) => { r.childOwnAccountDialImplemented = true; }, (r) => { r.steps[0].status = 'failed'; }]) {
    const changed = structuredClone(report); mutate(changed); assert.throws(() => validateRideEmergencyReport(changed));
  }
});
test('even rehashed unit-fixture tampering cannot replace primary transfer, tracking, transcript or ride completion', () => {
  for (const [file, mutate] of [
    ['adb-pull-ride-emergency.json', (r) => { r.phase = 'failure-cleanup'; }],
    ['local-ride-emergency-parent-entry-tracking.json', (r) => { r.observedRunning = true; }],
    ['results.json', (r) => { r.ride.ratingCount = 0; }],
    ['disposable-store-restore.json', (r) => { r.installAdmin.componentRemoved = false; }],
    ['retained-context.json', (r) => { r.workflowConclusion = 'failure'; }],
    ['LocalRideFlowTest-instrumentation.txt', (r) => r.replace('OK (1 test)', 'FAILURES!!!')],
  ]) {
    const temporary = mkdtempSync(resolve(tmpdir(), 'sgm-ride-evidence-contract-'));
    try {
      mkdirSync(dirname(resolve(temporary, source)), { recursive: true });
      cpSync(resolve(root, base), resolve(temporary, base), { recursive: true });
      const archive = resolve(temporary, 'docs/release/evidence/source-archive'); mkdirSync(archive);
      for (const hash of Object.values(report.sourceFiles))
        copyFileSync(resolve(root, 'docs/release/evidence/source-archive', hash + '.txt'), resolve(archive, hash + '.txt'));
      const original = readFileSync(resolve(temporary, base, file), 'utf8');
      let bytes;
      if (file.endsWith('.txt')) bytes = mutate(original);
      else { const changed = JSON.parse(original); mutate(changed); bytes = JSON.stringify(changed); }
      assert.notEqual(bytes, original); writeFileSync(resolve(temporary, base, file), bytes);
      const hashes = JSON.parse(readFileSync(resolve(temporary, base, 'artifact-sha256.json')));
      hashes[file] = createHash('sha256').update(bytes).digest('hex');
      writeFileSync(resolve(temporary, base, 'artifact-sha256.json'), JSON.stringify(hashes));
      assert.throws(() => validateRetainedRideEmergency(temporary, source), file);
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  }
});
test('the new eight-step ride tour stays separate from prior settings evidence and untested tracking', () => {
  const flow = content.flows.find((f) => f.id === 'ride-emergency');
  assert.equal(flow.status, 'partial'); assert.equal(flow.ui.source, source);
  assert.deepEqual(flow.ui.groups, ['ride-emergency-active-ui']); assert.equal(flow.phone, undefined);
  const expected = rideEmergencyCaptures.map((file) => file.replace('local-', '').replace('.png', ''));
  assert.deepEqual(flow.images.map((item) => item.file), expected); assert.deepEqual(tours['ride-emergency'].map((step) => step.image), expected);
  for (const [index, image] of flow.images.entries()) {
    assert.equal(captures[image.file], base + rideEmergencyCaptures[index]); assert.match(image.alt, /essai local du 19 octobre/);
  }
  assert.equal(content.flows.find((f) => f.id === 'tracking').status, 'untested');
  assert.equal(content.flows.find((f) => f.id === 'emergency-contact').images.filter((i) => i.file.startsWith('emergency-current-')).length, 7);
  assert.match(flow.remaining, /sur téléphone, sans appeler/); assert.match(flow.remaining, /compte enfant/);
  const failure = read('docs/release/evidence/ride-emergency-account-failure-2026-10-19/results.json');
  assert.equal(failure.journeyPassed, false); assert.equal(failure.observation.observedRunning, true);
});
