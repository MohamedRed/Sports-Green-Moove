import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { validateSupportPhone } from '../scripts/qa/support-phone-evidence.mjs';
import { validateSupportFollowup } from '../scripts/qa/support-followup-evidence.mjs';
import { validateSupportFollowupPhone } from '../scripts/qa/support-followup-phone-evidence.mjs';

export function validateSupportEvidence(root, flow, captures) {
  if (flow.supportPhone) {
    assert.equal(flow.id, 'support'); assert.equal(flow.status, 'partial');
    const run = validateSupportPhone(root, flow.supportPhone.source);
    assert.equal(run.testedAt.slice(0, 10), flow.supportPhone.checkedAt);
    assert.equal(flow.supportPhone.checkedAt, flow.checkedAt);
    assert.equal(flow.supportPhone.checksums, dirname(flow.supportPhone.source) + '/artifact-sha256.json');
    for (const [id, file] of Object.entries(run.publishedCaptures)) {
      assert(flow.images.some(image => image.file === id)); assert.equal(captures[id], dirname(flow.supportPhone.source) + '/' + file);
    }
  }
  if (flow.supportFollowup) {
    assert.equal(flow.id, 'support'); assert.equal(flow.status, 'partial');
    const run = validateSupportFollowup(root, flow.supportFollowup.source);
    assert.equal(run.testedAt.slice(0, 10), flow.supportFollowup.checkedAt);
    assert(flow.supportFollowupPhone, 'The latest phone follow-up remains independently scoped');
  }
  if (flow.supportFollowupPhone) {
    assert.equal(flow.status, 'partial');
    const run = validateSupportFollowupPhone(root, flow.supportFollowupPhone.source);
    assert.equal(run.testedAt.slice(0, 10), flow.supportFollowupPhone.checkedAt);
    for (const [id, file] of Object.entries(run.publishedCaptures)) {
      assert(flow.images.some(image => image.file === id));
      assert.equal(captures[id], dirname(flow.supportFollowupPhone.source) + '/' + file);
    }
    assert.match(flow.remaining, /erreurs de connexion/);
  }
}
