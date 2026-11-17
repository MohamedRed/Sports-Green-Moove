import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { assertParentPhoneBooking } from '../scripts/qa/browserstack-parent-booking-evidence.mjs';
import { assertParentPhoneSearch, parentSearchScope } from '../scripts/qa/browserstack-parent-search-evidence.mjs';
import { teamPhoneScope, validateTeamPhoneArtifacts } from '../scripts/qa/team-phone-evidence.mjs';
import { emergencyOptionsPhoneScope, validateEmergencyPhoneArtifacts } from '../scripts/qa/emergency-phone-retained-evidence.mjs';
import { teamDraftPhoneScope, validateTeamDraftPhone } from '../scripts/qa/team-draft-phone-evidence.mjs';

export function validatePhoneEvidence(root, phone, checkedAt) {
  const base = dirname(resolve(root, phone.source));
  const json = (name) => JSON.parse(readFileSync(resolve(base, name), 'utf8'));
  const run = JSON.parse(readFileSync(resolve(root, phone.source), 'utf8'));
  assert.equal(run.testedAt.slice(0, 10), checkedAt);
  if (run.scope === teamDraftPhoneScope) return validateTeamDraftPhone(root, phone.source);
  if (run.scope === emergencyOptionsPhoneScope) return validateEmergencyPhoneArtifacts(root, phone.source);
  if (run.scope === teamPhoneScope) return validateTeamPhoneArtifacts(root, phone.source);
  const search = run.scope === parentSearchScope;
  const receipts = search ? ['fixture.json', 'checkpoint.json', 'connection-policy.json'] :
    ['requested.json', 'approved.json', 'cancelled.json', 'driver-approval.json', 'connection-policy.json'];
  if (search) assertParentPhoneSearch(run, json('fixture.json'), json('checkpoint.json'), json('connection-policy.json'));
  else assertParentPhoneBooking(run, ['requested', 'approved', 'cancelled'].map((phase) => json(phase + '.json')),
    json('driver-approval.json'), json('connection-policy.json'));
  const hashes = json('artifact-sha256.json');
  for (const [name, hash] of Object.entries(hashes)) {
    assert(!name.includes('/') && !name.includes('\\'), 'Phone evidence must use local artifact names');
    assert.equal(createHash('sha256').update(readFileSync(resolve(base, name))).digest('hex'), hash, name);
  }
  for (const name of ['results.json', ...receipts, ...run.captures])
    assert(Object.hasOwn(hashes, name), 'Missing phone evidence hash: ' + name);
  for (const name of run.captures) {
    const png = readFileSync(resolve(base, name));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2400);
  }
}
