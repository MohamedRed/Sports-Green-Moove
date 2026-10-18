import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { readEmergencyDevice } from './emergency-contact-evidence.mjs';
import { cleanupEmergencyNativeFixture, seedEmergencyNativeFixture, verifyEmergencyNativeFixture } from './local-emergency-native-fixture.mjs';

export async function replayEmergencyContactUi({ instrument, collect, directory, runId }) {
  assert.match(runId, /^[a-f0-9]{32}$/);
  const fixture = await seedEmergencyNativeFixture();
  let marker, transcript, failure;
  try {
    instrument(['LocalEmergencyContactFlowTest'], 1, ['-e', 'emergencyVerificationId', fixture.verificationId]);
    collect();
    marker = readEmergencyDevice(directory, runId);
    transcript = readFileSync(resolve(directory, 'LocalEmergencyContactFlowTest-instrumentation.txt'));
    assertInstrumentationPassed(transcript.toString('utf8'), 1);
    await verifyEmergencyNativeFixture(fixture, marker);
  } catch (error) { failure = error; }
  try { await cleanupEmergencyNativeFixture(fixture); }
  catch (error) { if (failure) throw new AggregateError([failure, error], 'Contact replay and cleanup failed'); throw error; }
  if (failure) throw failure;
  const base = 'android/app/src/main/java/be/sportgreenmoove/app/';
  const sources = ['data/EmergencyContactModels.kt', 'services/EmergencyContactGateway.kt', 'services/EmergencyContactWire.kt',
    'services/FirebaseAndroidEmergencyContactGateway.kt', 'services/AndroidEmergencyDialer.kt', 'ui/EmergencyContactState.kt',
    'ui/EmergencyContactScreen.kt', 'ui/EmergencyContactDialogs.kt', 'ui/EmergencyContactRoute.kt'].map((path) => base + path);
  sources.push('functions/src/domain/emergencyContact.ts', 'functions/src/services/emergencyContactAuthority.ts',
    'functions/src/services/emergencyContact.ts', 'functions/src/callables/emergencyContact.ts',
    ...['LocalEmergencyContactFlowTest.kt', 'LocalEmergencyPeer.kt', 'LocalEmergencyEvidence.kt', 'LocalEmergencyDialerDiagnostic.kt',
      'LocalExternalUiWait.kt', 'LocalComposeRule.kt']
      .map((path) => 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + path));
  const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const result = { projectId: 'demo-sgm-local-qa', runId, testedAt: new Date().toISOString(),
    scope: 'local-ui-not-physical-device', testCount: 1, nativeCaseCount: 1,
    steps: [{ id: 'emergency-contact-ui', status: 'passed' }], checks: marker.checks, screenshots: marker.screenshots,
    transcriptSha256: sha(transcript), verificationPreseeded: true, managerDecisionMethod: 'authenticated-local-sdk-revoke-only',
    privateOperationsVerified: 3, protectedRecordsUnchanged: true, isolatedFixtureCleanupVerified: true,
    dialerOpened: true, directCallIntentCount: 0, dialerPackage: marker.dialerPackage,
    childOwnAccountDialImplemented: false, physicalDevice: false, productionWrites: false,
    sourceFiles: Object.fromEntries(sources.map((path) => [path, sha(readFileSync(resolve(import.meta.dirname, '../..', path)))])) };
  writeFileSync(resolve(directory, 'emergency-contact-results.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  return result;
}
