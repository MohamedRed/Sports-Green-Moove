import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { call, signIn } from './local-flow-client.mjs';
import { seedHistoryPhoneFixture, historyPhoneState, cleanupHistoryPhoneFixture } from './manual-team-history-fixture.mjs';
import { historyPhonePhases, verifyHistoryPhoneCheckpoint } from './manual-team-history-checkpoints.mjs';

execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
  { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
const fixture = await seedHistoryPhoneFixture(), checkpoints = [];
let failure;
try {
  for (const phase of historyPhonePhases) {
    if (phase === 'history-withdrawn') {
      const before = await historyPhoneState(fixture);
      await call('transitionTeamEnrollment', await signIn('p@example.test'), {
        enrollmentId: before.self.id, expectedRevision: before.self.revision,
        action: 'withdraw', requestId: randomUUID() });
    }
    checkpoints.push(verifyHistoryPhoneCheckpoint(phase, await historyPhoneState(fixture), fixture.identity));
  }
} catch (error) { failure = error; }
try { await cleanupHistoryPhoneFixture(fixture); }
catch (cleanup) { throw failure ? new AggregateError([failure, cleanup], 'Fixture smoke and cleanup failed') : cleanup; }
if (failure) throw failure;
assert.equal(checkpoints.length, 5);
mkdirSync(dirname(process.env.SGM_LOCAL_FLOW_OUTPUT), { recursive: true });
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({ runId: process.env.SGM_LOCAL_RUN_ID,
  projectId: 'demo-sgm-local-qa', testedAt: new Date().toISOString(),
  scope: 'phone-fixture-service-smoke-not-ui-proof', checkpoints, fixtureCleanupVerified: true,
  nativeUiExecuted: false, physicalDevice: false, productionWrites: false }, null, 2) + '\n', { flag: 'wx' });
console.log('Passed five service-only phone-fixture checkpoints and protected-state cleanup. No phone UI accepted.');
