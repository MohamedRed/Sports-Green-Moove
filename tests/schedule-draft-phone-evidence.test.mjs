import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertScheduleDraftPhoneScope, validateScheduleDraftPhone, scheduleDraftPhoneFolder} from '../scripts/qa/schedule-draft-phone-evidence.mjs';
import {content} from '../partner-portal/content.mjs';
import {scheduleDraftPhone} from '../partner-portal/schedule-draft-phone.mjs';
import {evidenceSourcePaths} from '../partner-portal/evidence-fingerprints.mjs';

const root = resolve(import.meta.dirname, '..');
const read = file => JSON.parse(readFileSync(resolve(root, scheduleDraftPhoneFolder, file)));
const fresh = () => [read('completed/session-results.json'), read('ui-review.json')];

test('completed schedule trial retains nine receipts, manual scope, earlier failure and disposal', () => {
  assert.equal(validateScheduleDraftPhone(root, scheduleDraftPhone).checkpoints.length, 9);
});

test('record receipts cannot become UI/process/storage, payment or release proof', () => {
  for (const key of ['completed', 'physicalUiProvenByThisReport', 'wholeProcessRestartProvenByThisReport',
    'draftStorageProvenByThisReport', 'productionWrites', 'proposalCreated', 'realPaymentExercised']) {
    const [report, review] = fresh(); report[key] = !report[key];
    assert.throws(() => assertScheduleDraftPhoneScope(report, review));
  }
  for (const key of ['processPidsIndependentlyMeasured', 'nativeCaptureExportAccepted', 'newVideoAccepted',
    'installedBytesIndependentlyHashed', 'packageAbsenceIndependentlyProven', 'releaseAccepted', 'realMaps']) {
    const [report, review] = fresh(); review[key] = true;
    assert.throws(() => assertScheduleDraftPhoneScope(report, review));
  }
});

test('mixed runs, missing checkpoints and changed displayed schedule are rejected', () => {
  const mutations = [
    (report, review) => { review.runId = review.firstAttempt.runId; },
    report => { report.checkpoints.pop(); },
    report => { report.checkpoints[0].status = 'failed'; },
    (report, review) => { review.restoredDisplay.arrival = '14:00'; },
    (report, review) => { review.firstAttempt.completed = true; },
    (report, review) => { review.publishedCaptures.push('unapproved.png'); },
  ];
  for (const mutate of mutations) {
    const [report, review] = fresh(); mutate(report, review);
    assert.throws(() => assertScheduleDraftPhoneScope(report, review));
  }
});

test('portal advances only schedule scope and keeps the old gallery dated', () => {
  const flow = content.flows.find(row => row.id === 'publication');
  assert.equal(flow.status, 'partial'); assert.equal(flow.scheduleDraftPhone.checkedAt, '2026-10-28');
  assert.equal(flow.checkedAt, flow.staleCancellationPhone.checkedAt);
  assert.equal(flow.tripDraftPhone.checkedAt, '2026-10-26');
  assert.equal(flow.local.checkedAt, '2026-10-17'); assert.equal(flow.ui.checkedAt, '2026-10-18');
  assert.match(flow.remaining, /application du changement et la carte sur téléphone/);
  assert.equal(flow.tour.filter(step => step.image.startsWith('cancel-phone-')).length, 5);
  assert.equal(flow.tour.filter(step => step.image.startsWith('cancel-stale-phone-')).length, 5);
  assert.equal(flow.tour.length, 10); assert(!flow.images.some(image => /schedule-phone/.test(image.file)));
  assert(evidenceSourcePaths(content).includes(scheduleDraftPhone.checksums));
  const update = content.updates.find(row => row.source === scheduleDraftPhone.source);
  assert.equal(update.date, '2026-10-28'); assert.doesNotMatch(update.text, /BrowserStack|Firebase|APK|ENOSPC/i);
});
