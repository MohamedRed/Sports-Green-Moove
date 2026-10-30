import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertConsentRestartPhoneScope, validateConsentRestartPhone, consentRestartPhoneFolder} from '../scripts/qa/trip-consent-restart-phone-evidence.mjs';
import {consentRestartPhone} from '../partner-portal/consent-restart-phone.mjs';
import {content} from '../partner-portal/content.mjs';
import {evidenceSourcePaths} from '../partner-portal/evidence-fingerprints.mjs';

const root = resolve(import.meta.dirname, '..');
const read = file => JSON.parse(readFileSync(resolve(root, consentRestartPhoneFolder, file)));
const fresh = () => [read('completed/session-results.json'), read('ui-review.json')];

test('ten original consent checkpoints replay against the baseline with five separate manual restart observations', () => {
  assert.equal(validateConsentRestartPhone(root, consentRestartPhone).checkpoints.length, 10);
});

test('a preparation failure, missing stage or mixed run cannot become completed consent evidence', () => {
  const changes = [
    report => { report.completed = false; },
    report => { report.checkpoints.pop(); },
    (report, review) => { review.runId = review.preparationFailure.runId; },
    (report, review) => { review.forceStops.pop(); },
    (report, review) => { review.forceStops[1].account = 'second-parent'; },
    (report, review) => { review.forceStops[0].restoredState = 'confirmed'; },
    (report, review) => { review.preparationFailure.completed = true; },
  ];
  for (const change of changes) {
    const [report, review] = fresh(); change(report, review);
    assert.throws(() => assertConsentRestartPhoneScope(report, review));
  }
});

test('manual recovery does not imply PID, installed bytes, new media, two phones, payment or release proof', () => {
  for (const key of ['independentProcessPids', 'installedBytesIndependentlyHashed', 'packageAbsenceIndependentlyProven',
    'twoSimultaneousPhones', 'iosTested', 'applicationExercised', 'realPaymentExercised', 'physicalGpsTested',
    'releaseAccepted', 'newVideoAccepted', 'nativeCaptureExportAccepted']) {
    const [report, review] = fresh(); review[key] = true;
    assert.throws(() => assertConsentRestartPhoneScope(report, review));
  }
  const [report, review] = fresh(); report.wholeProcessRestartProven = true;
  assert.throws(() => assertConsentRestartPhoneScope(report, review));
});

test('portal keeps dated galleries, partial application/payments and simultaneous-device work', () => {
  const flow = content.flows.find(row => row.id === 'publication');
  assert.equal(flow.status, 'partial'); assert.equal(flow.tripConsentPhone.checkedAt, '2026-10-25');
  assert.equal(flow.tripDraftPhone.checkedAt, '2026-10-26'); assert.equal(flow.scheduleDraftPhone.checkedAt, '2026-10-28');
  assert.match(flow.remaining, /application du changement et la carte sur téléphone/);
  assert.equal(flow.tour.filter(step => step.image.startsWith('cancel-phone-')).length, 5);
  assert.equal(flow.tour.filter(step => step.image.startsWith('cancel-stale-phone-')).length, 5);
  assert.equal(flow.tour.length, 10);
  assert(flow.images.some(row => row.file.startsWith('consent-phone-')));
  assert(evidenceSourcePaths(content).includes(consentRestartPhone.checksums));
  const blocker = content.blockers.find(row => row.id === 'trip-consent-restart');
  assert.equal(blocker.source, consentRestartPhone.source); assert.match(blocker.next, /deux téléphones/);
  const update = content.updates.find(row => row.source === consentRestartPhone.source);
  assert.equal(update.date, '2026-10-28'); assert.doesNotMatch(update.text, /BrowserStack|Firebase|APK|PID/i);
});
