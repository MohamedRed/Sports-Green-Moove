import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validateEmergencyDialerRecheck } from '../scripts/qa/emergency-dialer-recheck-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const flow = content.flows.find(row => row.id === 'emergency-contact');
const record = flow.dialerPreflightRecheck;
test('later blocked system prerequisite preserves the older app gallery and scopes cleanup', () => {
  const run = validateEmergencyDialerRecheck(process.cwd(), record);
  assert.equal(run.phoneIconAttempts, 2); assert.equal(run.captures.length, 4);
  assert.equal(run.supportFollowup.responseReceived, null);
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-10-21');
  assert.equal(flow.phone.checkedAt, '2026-10-21');
  assert(flow.dialerPreflight.source.includes('2026-10-21'));
  assert(Object.values(captures).every(file => !file.includes('emergency-dialer-preflight')));
  assert.equal(content.blockers.find(row => row.id === 'emergency-contact').source,
    'docs/release/evidence/emergency-dialer-preflight-2026-10-23/README.md');
});
for (const [key, value] of [['dialerHandoffVerified', true], ['rootCauseConfirmed', true],
  ['publishedCaptures', ['after-phone.jpg']], ['appSignInPerformed', true], ['realCallsPlaced', true],
  ['storeReviewAccepted', true], ['releaseEvidenceAccepted', true], ['phoneIconAttempts', 1],
  ['supportFollowup', {status: 'checked', responseReceived: false}],
  ['cleanup', {phoneSessionStopped: true, packageInventoryVerified: true}]]) {
  test(`blocked recheck rejects unsupported ${key}`, () => {
    assert.throws(() => validateEmergencyDialerRecheck(process.cwd(), record, path => {
      const bytes = readFileSync(path); if (!path.endsWith('/results.json')) return bytes;
      const run = JSON.parse(bytes); run[key] = value; return Buffer.from(JSON.stringify(run));
    }));
  });
}
test('blocked recheck rejects altered image bytes and checksum references', () => {
  assert.throws(() => validateEmergencyDialerRecheck(process.cwd(), {...record, checksums: record.source}));
  assert.throws(() => validateEmergencyDialerRecheck(process.cwd(), record, path =>
    path.endsWith('/home.jpg') ? Buffer.from('not an image') : readFileSync(path)));
});
