import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { validateChildAccountApprovalEvidence, validateChildAccountApprovalReport } from '../scripts/qa/child-account-approval-evidence.mjs';
import { content } from '../partner-portal/content.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const metadata = { source: 'docs/release/evidence/child-account-approval-2026-10-26/results.json',
  checksums: 'docs/release/evidence/child-account-approval-2026-10-26/artifact-sha256.json', checkedAt: '2026-10-26' };

test('ten actual authenticated approval groups and fourteen JVM cases retain exact local boundaries', () => {
  validateChildAccountApprovalEvidence(root, metadata);
});
test('the report cannot accept seeded approval, native, physical or production claims', () => {
  const original = JSON.parse(read(metadata.source));
  for (const key of ['nativeUiExecuted', 'physicalDevice', 'productionWrites', 'childAccountLinkPreseeded'])
    assert.throws(() => validateChildAccountApprovalReport({ ...original, [key]: true }));
  for (const key of ['childAccountApprovalFlowExecuted', 'adminClientClosed', 'isolatedEnvironmentDestroyed'])
    assert.throws(() => validateChildAccountApprovalReport({ ...original, [key]: false }));
  assert.throws(() => validateChildAccountApprovalReport({ ...original, steps: original.steps.slice(1) }));
});
test('backend CI executes the authenticated approval and web smoke protects its integration', () => {
  const backend = parseDocument(read('.github/workflows/backend-ci.yml')).toJSON();
  assert(Object.values(backend.jobs).some(job => job.steps?.some(step => step.run?.includes('npm run test:child-account-approval'))));
  const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  assert(Object.values(web.jobs).some(job => job.steps?.some(step => step.run?.includes('tests/child-account-approval-contract.test.mjs'))));
});
test('the production child contact entry has no dependency on the tracking permission gate', () => {
  const app = read('android/app/src/main/java/be/sportgreenmoove/app/ui/SportsGreenMooveApp.kt');
  assert(app.includes('rideSessionId = emergencyRideSessionId(requireNotNull(session).roles, activeRide, contactReturn == AppScreen.Ride)'));
  assert(app.includes('accountLinks = providers.childAccountLinks'));
  const policy = read('android/app/src/main/java/be/sportgreenmoove/app/ui/EmergencyRideAccess.kt');
  assert(!/Permission|Location|startTracking/.test(policy));
  const cases = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/ChildEmergencyPermissionFlowTest.kt');
  assert(cases.includes('PackageManager.PERMISSION_DENIED')); assert(cases.includes('assertEquals(0, trackingStarts)'));
  assert(!cases.includes('assumeTrue')); assert(!cases.includes('grantRuntimePermission'));
});
test('the portal keeps the new local approval separate from older simulated child captures', () => {
  const flow = content.flows.find(row => row.id === 'child-emergency');
  assert.equal(flow.status, 'partial'); assert.deepEqual(flow.accountApproval, metadata);
  assert.equal(flow.ui.checkedAt, '2026-10-19'); assert.equal(flow.images.length, 3);
  assert.match(flow.remaining, /connexion de l’enfant/); assert.match(flow.remaining, /ouverture réelle du téléphone/);
});
test('the new dialog uses the existing emergency palette for surfaces, labels and interactive text', () => {
  const dialog = read('android/app/src/main/java/be/sportgreenmoove/app/ui/ChildAccountLinkDialog.kt');
  for (const fragment of ['containerColor = Sgm.colors.bgCard', 'titleContentColor = Sgm.colors.textPrimary',
    'textContentColor = Sgm.colors.textPrimary', 'focusedLabelColor = Sgm.colors.textPrimary',
    'focusedBorderColor = Sgm.colors.textPrimary', 'Text("Fermer", color = Sgm.colors.textPrimary)']) assert(dialog.includes(fragment));
  assert.equal((dialog.match(/outlinedButtonColors\(contentColor = Sgm.colors.textPrimary\)/g) || []).length, 2);
});
