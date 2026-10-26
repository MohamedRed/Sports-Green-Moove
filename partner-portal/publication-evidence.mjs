import assert from 'node:assert/strict';
import { validateCaptureCallbackInvestigation } from '../scripts/qa/capture-callback-investigation-evidence.mjs';
import { validateCaptureRuntimeEvidence, captureRuntimeFolder } from '../scripts/qa/capture-runtime-evidence.mjs';
import { validateTripDraftPhone } from '../scripts/qa/trip-draft-phone-evidence.mjs';
import { validateFlowGate398 } from '../scripts/qa/flow-gate-398-evidence.mjs';
import { validateSdkImagePreparation } from '../scripts/qa/sdk-image-preparation-evidence.mjs';

export function validatePublicationEvidence(root, flow) {
  validateFlowGate398(root);
  validateSdkImagePreparation(root);
  assert.equal(flow.id, 'publication'); assert.equal(flow.status, 'partial');
  assert.equal(flow.captureInvestigation.source, 'docs/release/evidence/capture-callback-investigation-2026-10-26/README.md');
  validateCaptureCallbackInvestigation(root);
  assert.deepEqual(flow.captureInvestigation.runtime,
    { source: captureRuntimeFolder + 'README.md', checksums: captureRuntimeFolder + 'artifact-sha256.json' });
  validateCaptureRuntimeEvidence(root);
  assert.equal(flow.tripDraftPhone.source, 'docs/release/evidence/trip-draft-phone-2026-10-26/session-results.json');
  assert.equal(flow.checkedAt, flow.tripDraftPhone.checkedAt); validateTripDraftPhone(root, flow.tripDraftPhone);
}
