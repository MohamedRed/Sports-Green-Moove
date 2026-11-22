import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { teamPhonePhases, verifyManualTeamCheckpoint } from './manual-team-phone-checkpoints.mjs';

const [sessionPath, output] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? ''));
assert.equal(statSync(sessionPath).mode & 0o077, 0, 'Fixture credentials must remain private');
const session = JSON.parse(readFileSync(sessionPath, 'utf8'));
assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.match(session.runId, /^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD = session.password;
const { db } = await import('./local-flow-client.mjs');
const { seedTeamNativeFixture, cleanupTeamNativeFixture, teamUi } = await import('./local-team-native-fixture.mjs');
mkdirSync(output, { mode: 0o700 });
const fixture = await seedTeamNativeFixture(), checkpoints = [];
const identity = { ...teamUi, teamInstanceId: fixture.teamInstanceId,
  selfEnrollmentId: fixture.selfEnrollmentId, childEnrollmentId: fixture.childEnrollmentId };
const sources = ['scripts/qa/manual-team-phone-session.mjs', 'scripts/qa/manual-team-phone-checkpoints.mjs',
  'scripts/qa/local-team-native-fixture.mjs', 'functions/src/services/teamEnrollment.ts',
  'functions/src/services/teamEnrollmentViews.ts', 'functions/src/services/teamEnrollmentAuthority.ts',
  'functions/src/services/teamEnrollmentReview.ts', 'admin/src/TeamReviewPanel.tsx', 'admin/src/TeamReviewController.ts',
  'admin/src/teamReviewGateway.ts', 'android/app/src/main/java/be/sportgreenmoove/app/ui/TeamEnrollmentRoute.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/TeamEnrollmentScreen.kt'];
const sourceFiles = Object.fromEntries(sources.map((file) => [file,
  createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]));
const rows = async (name) => (await db.collection(name).where('teamId', '==', teamUi.teamId).get()).docs
  .map((doc) => ({ id: doc.id, ...doc.data() }));
let completed = false, failure;
const input = createInterface({ input: process.stdin, terminal: false });
console.log('Isolated team fixture ready. Enter the next checkpoint name, finish, or stop.');
try {
  for await (const command of input) {
    const phase = command.trim();
    if (phase === 'stop') break;
    if (phase === 'finish') {
      assert.equal(checkpoints.length, teamPhonePhases.length, 'All persisted checkpoints are required');
      completed = true; break;
    }
    assert.equal(phase, teamPhonePhases[checkpoints.length]?.[0], 'Checkpoints must execute once in order');
    const state = { enrollments: await rows('teamEnrollments'), events: await rows('teamEnrollmentEvents'),
      guardian: (await db.collection('guardianVerifications').doc(fixture.verificationId).get()).data() };
    const result = verifyManualTeamCheckpoint(phase, state, identity);
    const receipt = { projectId: session.projectId, runId: session.runId, recordedAt: new Date().toISOString(),
      scope: 'independent-local-persisted-team-checkpoint-not-ui-or-release-proof', ...result, identity, state };
    writeFileSync(resolve(output, phase + '.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    checkpoints.push(result); console.log(`Persisted checkpoint passed: ${phase}`);
  }
} catch (error) { failure = error; }
finally { input.close(); }
try { await cleanupTeamNativeFixture(fixture); }
catch (cleanup) { throw failure ? new AggregateError([failure, cleanup], 'Manual team session and cleanup failed') : cleanup; }
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({ projectId: session.projectId, runId: session.runId,
  testedAt: new Date().toISOString(), scope: 'manual-team-persisted-checkpoints-not-ui-or-release-proof',
  completed: completed && !failure, checkpoints, sourceFiles, fixtureCleanupVerified: true,
  productionWrites: false, physicalUiProvenByThisReport: false, teamChatImplemented: false }, null, 2) + '\n',
{ mode: 0o600, flag: 'wx' });
if (failure) throw failure;
console.log(`Manual team session closed: ${completed ? 'all persisted checkpoints passed' : 'incomplete'}. Fixture cleanup verified.`);
