import assert from 'node:assert/strict';
import { validateCaptureCallbackInvestigation } from '../scripts/qa/capture-callback-investigation-evidence.mjs';
import { validateCaptureRuntimeEvidence, captureRuntimeFolder } from '../scripts/qa/capture-runtime-evidence.mjs';
import { validateTripDraftPhone } from '../scripts/qa/trip-draft-phone-evidence.mjs';
import { validateScheduleDraftPhone } from '../scripts/qa/schedule-draft-phone-evidence.mjs';
import { validateConsentRestartPhone } from '../scripts/qa/trip-consent-restart-phone-evidence.mjs';
import { validateFlowGate398 } from '../scripts/qa/flow-gate-398-evidence.mjs';
import { validateSdkImagePreparation } from '../scripts/qa/sdk-image-preparation-evidence.mjs';
import { validateRenderNetworkGate } from '../scripts/qa/render-network-gate-evidence.mjs';
import {validateCancellationPhoneEvidence, cancellationEvidenceDirectory} from '../scripts/qa/trip-cancellation-phone-evidence.mjs';
import {validateStaleCancellationPhone, staleCancellationFolder} from '../scripts/qa/cancellation-stale-phone-evidence.mjs';

export function validatePublicationEvidence(root, flow) {
  assert.equal(flow.staleCancellationPhone.source, staleCancellationFolder + 'summary.json');
  assert.equal(flow.staleCancellationPhone.checksums, staleCancellationFolder + 'artifact-sha256.json');
  assert.equal(flow.staleCancellationPhone.checkedAt, '2026-10-30');
  assert.equal(flow.checkedAt, flow.staleCancellationPhone.checkedAt); validateStaleCancellationPhone(root);
  assert.equal(flow.tripCancellationPhone.source, cancellationEvidenceDirectory + '/summary.json');
  validateCancellationPhoneEvidence(root, flow.tripCancellationPhone.source);
  validateFlowGate398(root);
  validateSdkImagePreparation(root);
  validateRenderNetworkGate(root);
  assert.equal(flow.id, 'publication'); assert.equal(flow.status, 'partial');
  assert.equal(flow.captureInvestigation.source, 'docs/release/evidence/capture-callback-investigation-2026-10-26/README.md');
  validateCaptureCallbackInvestigation(root);
  assert.deepEqual(flow.captureInvestigation.runtime,
    { source: captureRuntimeFolder + 'README.md', checksums: captureRuntimeFolder + 'artifact-sha256.json' });
  validateCaptureRuntimeEvidence(root);
  assert.equal(flow.tripDraftPhone.source, 'docs/release/evidence/trip-draft-phone-2026-10-26/session-results.json');
  assert.equal(flow.tripDraftPhone.checkedAt, '2026-10-26'); validateTripDraftPhone(root, flow.tripDraftPhone);
  assert.equal(flow.scheduleDraftPhone.checkedAt, '2026-10-28'); validateScheduleDraftPhone(root, flow.scheduleDraftPhone);
  assert.equal(flow.consentRestartPhone.checkedAt, '2026-10-28'); validateConsentRestartPhone(root, flow.consentRestartPhone);
}
