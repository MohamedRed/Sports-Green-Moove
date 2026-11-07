import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { historyPhonePhases, verifyHistoryPhoneCheckpoint } from './manual-team-history-checkpoints.mjs';

const [sessionPath, output] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? ''));
assert.equal(statSync(sessionPath).mode & 0o077, 0, 'Fixture credentials must remain private');
const session = JSON.parse(readFileSync(sessionPath, 'utf8'));
assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.match(session.runId, /^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD = session.password;
const { seedHistoryPhoneFixture, historyPhoneState, cleanupHistoryPhoneFixture } = await import('./manual-team-history-fixture.mjs');
mkdirSync(output, { mode: 0o700 });
const sources = ['scripts/qa/manual-team-history-session.mjs', 'scripts/qa/manual-team-history-checkpoints.mjs',
  'scripts/qa/manual-team-history-fixture.mjs', 'functions/src/services/teamEnrollmentHistory.ts',
  'android/app/src/main/java/be/sportgreenmoove/app/services/TeamEnrollmentHistoryWire.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidTeamEnrollmentGateway.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/TeamEnrollmentHistoryState.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/TeamEnrollmentHistoryRoute.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/TeamEnrollmentHistoryScreen.kt'];
const sourceFiles = Object.fromEntries(sources.map((file) => [file,
  createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]));
const fixture = await seedHistoryPhoneFixture(), checkpoints = [];
let completed = false, failure;
const input = createInterface({ input: process.stdin, terminal: false });
console.log('Isolated history fixture ready. Enter the observed checkpoint name, finish, or stop.');
try {
  for await (const command of input) {
    const phase = command.trim(); if (phase === 'stop') break;
    if (phase === 'finish') { assert.equal(checkpoints.length, historyPhonePhases.length); completed = true; break; }
    assert.equal(phase, historyPhonePhases[checkpoints.length], 'Checkpoints must execute once in order');
    const state = await historyPhoneState(fixture);
    const result = verifyHistoryPhoneCheckpoint(phase, state, fixture.identity);
    writeFileSync(resolve(output, phase + '.json'), JSON.stringify({ projectId: session.projectId, runId: session.runId,
      recordedAt: new Date().toISOString(), scope: 'independent-local-history-checkpoint-not-ui-proof',
      ...result, identity: fixture.identity, state }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    checkpoints.push(result); console.log(`Persisted checkpoint passed: ${phase}`);
  }
} catch (error) { failure = error; }
finally { input.close(); }
try { await cleanupHistoryPhoneFixture(fixture); }
catch (cleanup) { throw failure ? new AggregateError([failure, cleanup], 'History session and cleanup failed') : cleanup; }
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({ projectId: session.projectId, runId: session.runId,
  testedAt: new Date().toISOString(), scope: 'manual-history-persisted-checkpoints-not-ui-or-release-proof',
  completed: completed && !failure, checkpoints, sourceFiles, fixtureCleanupVerified: true,
  productionWrites: false, physicalUiProvenByThisReport: false, teamChatImplemented: false }, null, 2) + '\n',
{ mode: 0o600, flag: 'wx' });
if (failure) throw failure;
console.log(`Manual history session closed: ${completed ? 'all checkpoints passed' : 'incomplete'}. Fixture cleanup verified.`);
