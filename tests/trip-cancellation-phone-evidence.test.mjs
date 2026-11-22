import assert from 'node:assert/strict';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {assertCancellationPhoneEvidence, validateCancellationPhoneEvidence, cancellationEvidenceDirectory as folder} from '../scripts/qa/trip-cancellation-phone-evidence.mjs';
import {cancellationPhonePhases} from '../scripts/qa/trip-cancellation-phone-checkpoints.mjs';
import {content, captures} from '../partner-portal/content.mjs';
import {tripCancellationTour, tripCancellationImages} from '../partner-portal/trip-cancellation-phone.mjs';

const root = resolve(import.meta.dirname, '..'), base = resolve(root, folder);
const json = file => JSON.parse(readFileSync(resolve(base, file + '.json')));
const text = file => readFileSync(resolve(base, file), 'utf8');
const reports = () => ({summary: json('summary'), session: json('phone/checkpoints/session-results'), baseline: json('phone/checkpoints/baseline'),
  checkpoints: cancellationPhonePhases.map(phase => json('phone/checkpoints/' + phase)), review: json('phone/ui-review'),
  cleanup: json('phone/runtime-disposal'), process: {before: text('phone/process-before-stop-ax.txt'),
    stopped: text('phone/process-stopped-ax.txt'), reopened: text('phone/process-reopened-ax.txt'), removed: text('phone/package-removed-ax.txt')}});

test('twelve real isolated record checkpoints, measured process restart and seven session captures validate', () => {
  const report = validateCancellationPhoneEvidence(root);
  assert.equal(report.completedCheckpoints, 12); assert.equal(report.publicCaptureCount, 7);
});
for (const [name, mutate] of [
  ['duplicate cancellation receipt', r => r.checkpoints[4].state.documents.tripCancellations.push(r.checkpoints[4].state.documents.tripCancellations[0])],
  ['unrelated profile change', r => r.checkpoints[11].state.documents.users[0].data.displayName = 'changed'],
  ['reordered checkpoint', r => r.checkpoints.reverse()],
  ['changed fixture', r => r.session.fixture.parentUids[0] = 'another-parent'],
  ['unclosed reader', r => r.session.firestoreClientTerminated = false],
  ['wrong observer scope', r => r.session.physicalUiProven = true],
  ['missing native UI review', r => r.review.secondParentOnlyOwnNoticeVisible = false],
  ['missing session capture approval', r => r.review.sessionCapturesApproved = false],
  ['stale PID', r => r.process.reopened = r.process.before],
  ['missing process absence', r => r.process.stopped = 'stop requested'],
  ['missing package absence', r => r.process.removed = 'uninstall requested'],
  ['live endpoint', r => r.cleanup.ports[0].available = false],
  ['retained runtime', r => r.cleanup.runtimeAbsent = false],
  ['race claim', r => r.summary.concurrentRaceProven = true],
  ['refund claim', r => r.summary.refundDeliveryVerified = true],
  ['push claim', r => r.summary.pushDeliveryVerified = true],
  ['production claim', r => r.summary.productionWrites = true],
  ['release claim', r => r.summary.releaseComplete = true],
  ['installed-byte claim', r => r.summary.installedBytesIndependentlyVerified = true],
  ['native export claim', r => r.summary.nativeScreenshotExportAccepted = true],
]) test('retained phone proof rejects ' + name, () => {
  const report = reports(); mutate(report); assert.throws(() => assertCancellationPhoneEvidence(report));
});
test('altering an original screenshot invalidates the evidence even with unchanged summary', () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-cancel-evidence-'));
  try {
    cpSync(base, resolve(temp, folder), {recursive: true});
    writeFileSync(resolve(temp, folder, 'captures/02-cancellation-recorded.jpg'), 'changed');
    assert.throws(() => validateCancellationPhoneEvidence(temp));
  } finally {rmSync(temp, {recursive: true, force: true});}
});
test('portal keeps seven dated session captures, earlier galleries and partial scope without technology names', () => {
  const flow = content.flows.find(row => row.id === 'publication');
  assert.equal(flow.status, 'partial'); assert.equal(flow.tripCancellationPhone.source, folder + '/summary.json');
  assert.equal(flow.tour.length, 10); assert.deepEqual(flow.tour.slice(5), tripCancellationTour);
  assert.deepEqual(flow.images.slice(5, 12), tripCancellationImages);
  for (const image of flow.images.slice(5, 12)) {
    assert.match(image.alt, /capture de session du 28 octobre/); assert(captures[image.file].startsWith(folder + '/captures/'));
  }
  assert(flow.images.some(row => row.file.startsWith('draft-phone-')));
  assert(flow.images.some(row => row.file.startsWith('consent-phone-')));
  assert.match(flow.remaining, /application du changement.*carte sur téléphone/);
  assert.doesNotMatch(JSON.stringify(flow), /BrowserStack|Firebase|Kotlin|Pixel|SDK/);
  assert(content.blockers.some(row => row.id === 'cancellation-race'));
});
