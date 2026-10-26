import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDocument } from 'yaml';
import { fileURLToPath } from 'node:url';
import { validateChildDiscoveryEvidence, validateChildDiscoveryReport } from '../scripts/qa/child-contact-discovery-evidence.mjs';
import { validateChildDiscoveryCiFailure } from '../scripts/qa/child-contact-discovery-ci-evidence.mjs';
import { validateChildDiscoveryUiEvidence, validateChildDiscoveryUiReport } from '../scripts/qa/child-contact-discovery-ui-evidence.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const android = 'android/app/src/main/java/be/sportgreenmoove/app/';
test('nine actual child components cannot override the separate screen-copy failure or claim a real-phone journey', () => {
  validateChildDiscoveryUiEvidence(fileURLToPath(new URL('..', import.meta.url)));
  const folder = 'docs/release/evidence/child-contact-discovery-ui-2026-10-26/';
  const ordinary = JSON.parse(read(folder + 'ordinary-results.json')), source = JSON.parse(read(folder + 'source.json'));
  for (const key of ['mainNativeCiPassed', 'physicalDevice', 'actualChildSignIn', 'invitationExecuted',
    'connectedBackend', 'dialerOpened', 'screenshotsAccepted', 'productionWrites'])
    assert.throws(() => validateChildDiscoveryUiReport(ordinary, { ...source, [key]: true }));
  assert.throws(() => validateChildDiscoveryUiReport({ ...ordinary, failed: 0 }, source));
});
test('the failed main CI remains negative and the no-ride candidate exercises discovery rather than bypassing it', () => {
  validateChildDiscoveryCiFailure(fileURLToPath(new URL('..', import.meta.url)));
  const component = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/ChildRideEmergencyFlowTest.kt');
  for (const text of ['fixture.noActiveRide = true', 'waitFor("emergency.child-ride.no-active-ride")',
    'assertEquals(1, fixture.discoveries)', 'assertEquals(0, fixture.reads)',
    'compose.onNodeWithTag("emergency.child-link").assertIsEnabled()']) assert(component.includes(text));
  assert(read('docs/contracts/child-account-link.md').includes('initiates account creation by sending an invitation'));
});
test('retained discovery proof rejects device, production, seeded-link and weakened-authority claims', () => {
  validateChildDiscoveryEvidence(fileURLToPath(new URL('..', import.meta.url)));
  const original = JSON.parse(read('docs/release/evidence/child-contact-discovery-2026-10-26/results.json'));
  for (const key of ['nativeUiExecuted', 'physicalDevice', 'productionWrites', 'childAccountLinkPreseeded'])
    assert.throws(() => validateChildDiscoveryReport({ ...original, [key]: true }));
  for (const key of ['minimalOwnContactOnly', 'noActiveRideExplicit', 'knownRideRecheckPreserved'])
    assert.throws(() => validateChildDiscoveryReport({ ...original, discovery: { ...original.discovery, [key]: false } }));
  assert.throws(() => validateChildDiscoveryReport({ ...original, discovery: { ...original.discovery, currentAuthorityPatches: 11 } }));
});
test('child contact discovery uses a private profile link and the existing active-ride index in one transaction', () => {
  const service = read('functions/src/services/childRideEmergencyContact.ts');
  const discovery = service.slice(service.indexOf('export async function discoverChildRideEmergencyContact'),
    service.indexOf('function requireChildToken'));
  for (const text of ['requireChildToken(token)', 'firestore.runTransaction', 'childIdentity(transaction, uid)',
    '.where("childUserIds", "array-contains", identity.childId)', '.where("status", "==", "active")',
    '.orderBy("startedAt", "desc").limit(1)', 'readContact(transaction, uid, ride.id, identity)', ': null'])
    assert(discovery.includes(text), text);
  assert(!discovery.includes('participantUserIds'));
  assert(read('functions/src/callables/emergencyContact.ts').includes('const childDiscoverySchema = z.object({}).strict()'));
  const index = JSON.parse(read('firestore.indexes.json')).indexes;
  assert(index.some(item => item.collectionGroup === 'rideSessions' &&
    JSON.stringify(item.fields) === JSON.stringify([{ fieldPath: 'childUserIds', arrayConfig: 'CONTAINS' },
      { fieldPath: 'status', order: 'ASCENDING' }, { fieldPath: 'startedAt', order: 'DESCENDING' }])));
});
test('child entry does not require the adult ride payload or location and does not run adult bootstrap reads', () => {
  const app = read(android + 'ui/SportsGreenMooveApp.kt');
  assert(app.includes('if (AppRole.Child in session?.roles.orEmpty()) appData.clear()'));
  assert(app.includes('onEmergencyContact = if (AppRole.Child in requireNotNull(session).roles)'));
  assert(read(android + 'ui/TripsScreen.kt').includes('if (onEmergencyContact != null)'));
  const route = read(android + 'ui/EmergencyContactRoute.kt');
  assert(route.includes('ChildRideEmergencyRoute(uid, null, gateway'));
  const state = read(android + 'ui/ChildRideEmergencyState.kt');
  assert(state.includes('gateway.discoverChildRideEmergencyContact(uid)'));
  assert(state.includes('gateway.readChildRideEmergencyContact(uid, expected.rideSessionId)'));
  assert(!state.includes('requestPermissions')); assert(!state.includes('saveEmergencyContact'));
});
test('the authenticated approval suite exercises discovery and both service CI lanes execute that suite', () => {
  assert(read('scripts/qa/local-child-account-approval-suite.mjs').includes('discovery = await verifyChildContactDiscovery(actors, ride, clubId)'));
  const checks = read('scripts/qa/child-contact-discovery-checks.mjs');
  for (const text of ['assert.notEqual(actors.child.uid, childId)', 'current: null', 'currentAuthorityPatches: patches.length',
    "{ status: 'revoked' }", "{ roles: { child: false } }", "{ guardianUserIds: [] }", 'await newer.delete()'])
    assert(checks.includes(text));
  for (const name of ['backend-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = parseDocument(read('.github/workflows/' + name)).toJSON();
    assert(Object.values(workflow.jobs).some(job => job.steps?.some(step => step.run?.includes('npm run test:child-account-approval'))));
  }
});
