import assert from 'node:assert/strict';
import test from 'node:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { content, captures } from '../partner-portal/content.mjs';
import { validateSystemPhonePrerequisite } from '../scripts/qa/system-phone-prerequisite-evidence.mjs';

const flow = content.flows.find(row => row.id === 'emergency-contact'), record = flow.dialerPackageRecheck;
test('another device family narrows the prerequisite without accepting an app action or inventing its cause', () => {
  const report = validateSystemPhonePrerequisite(process.cwd(), record);
  assert.equal(report.packageAbsenceVerified, true); assert.equal(report.dialerHandoffAccepted, false);
  assert.equal(flow.status, 'partial'); assert.equal(flow.phone.checkedAt, '2026-10-21');
  assert(Object.values(captures).every(path => !path.includes('emergency-dialer-samsung')));
  assert.equal(content.blockers.find(row => row.id === 'emergency-contact').source, record.source.replace('summary.json', 'README.md'));
});
for (const [file, key, value] of [['summary.json', 'dialerHandoffAccepted', true], ['summary.json', 'rootCauseConfirmed', true],
  ['summary.json', 'releaseComplete', true], ['summary.json', 'packageAbsenceVerified', false],
  ['summary.json', 'publicGalleryAssetsAdded', ['02-system-home.jpg']], ['dialer-package-observation.json', 'rootCauseConfirmed', true],
  ['package-cleanup-observation.json', 'packageAbsent', false]]) {
  test('prerequisite evidence refuses altered ' + key, t => {
    const root = mkdtempSync(resolve(tmpdir(), 'sgm-system-phone-proof-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const base = dirname(record.source); cpSync(base, resolve(root, base), { recursive: true });
    const path = resolve(root, base, file), data = JSON.parse(readFileSync(path)); data[key] = value;
    writeFileSync(path, JSON.stringify(data)); assert.throws(() => validateSystemPhonePrerequisite(root, record));
  });
}
