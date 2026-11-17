import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { readTeamNativeDevice } from './team-native-evidence.mjs';
import { cleanupTeamNativeFixture, seedTeamNativeFixture, verifyTeamNativeFixture } from './local-team-native-fixture.mjs';

export async function replayTeamEnrollmentUi({ instrument, collect, directory, runId }) {
  assert.match(runId, /^[a-f0-9]{32}$/);
  const fixture = await seedTeamNativeFixture(); let marker, transcript, failure;
  try {
    instrument(['LocalTeamEnrollmentFlowTest'], 1); collect(); marker = readTeamNativeDevice(directory, runId);
    transcript = readFileSync(resolve(directory, 'LocalTeamEnrollmentFlowTest-instrumentation.txt'));
    assertInstrumentationPassed(transcript.toString('utf8'), 1); await verifyTeamNativeFixture(fixture, marker);
  } catch (error) { failure = error; }
  try { await cleanupTeamNativeFixture(fixture); }
  catch (error) { if (failure) throw new AggregateError([failure, error], 'Team replay and cleanup failed'); throw error; }
  if (failure) throw failure;
  const sources = ['scripts/qa/local-team-native-fixture.mjs', 'scripts/qa/team-native-evidence.mjs', 'scripts/qa/local-team-enrollment-ui.mjs',
    'functions/src/domain/teamEnrollment.ts', 'functions/src/services/teamEnrollment.ts', 'functions/src/services/teamEnrollmentViews.ts',
    'functions/src/services/teamEnrollmentAuthority.ts', 'functions/src/services/teamEnrollmentOptions.ts', 'functions/src/callables/teamEnrollment.ts',
    ...['data/TeamEnrollmentModels.kt', 'services/FirebaseAndroidTeamEnrollmentGateway.kt', 'services/TeamEnrollmentWire.kt',
      'services/MembershipPageToken.kt', 'ui/TeamEnrollmentState.kt', 'ui/TeamEnrollmentRoute.kt', 'ui/TeamEnrollmentScreen.kt',
      'ui/TeamEnrollmentOptionDialog.kt'].map((path) => 'android/app/src/main/java/be/sportgreenmoove/app/' + path),
    ...['LocalTeamEnrollmentFlowTest.kt', 'LocalTeamEnrollmentPeer.kt', 'LocalUiCapture.kt']
      .map((path) => 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + path)];
  const hash = (raw) => createHash('sha256').update(raw).digest('hex');
  const result = { projectId: 'demo-sgm-local-qa', runId, testedAt: new Date().toISOString(), scope: 'local-ui-not-physical-device',
    testCount: 1, nativeCaseCount: 1, steps: [{ id: 'team-enrollment-ui', status: 'passed' }], checks: marker.checks,
    screenshots: marker.screenshots, transcriptSha256: hash(transcript), guardianVerificationPreseeded: false,
    managerDecisionMethod: 'authenticated-local-sdk-not-management-ui', enrollmentCount: 2, enrollmentEventCount: 8,
    guardianEventCount: 3, protectedRecordsUnchanged: true, isolatedFixtureCleanupVerified: true,
    physicalDevice: false, productionWrites: false, fullProcessRestartProven: false, teamChatImplemented: false,
    sourceFiles: Object.fromEntries(sources.map((path) => [path, hash(readFileSync(resolve(import.meta.dirname, '../..', path)))])) };
  writeFileSync(resolve(directory, 'team-enrollment-results.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); return result;
}
