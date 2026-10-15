import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { configureLocalEmulators } from './local-emulator-config.mjs';
import { runScenarios } from './local-flow-scenarios.mjs';
import { checkRidePassengerSafety } from './local-ride-safety.mjs';
import { checkChatDeliverySafety } from './local-chat-safety.mjs';

const { projectId } = configureLocalEmulators();
const steps = [];
async function check(id, action) {
  try { await action(); steps.push({ id, status: 'passed' }); }
  catch (error) { steps.push({ id, status: 'failed', message: error.message }); process.exitCode = 1; }
  console.log(`${id}: ${steps.at(-1).status}`);
}
const root = resolve(import.meta.dirname, '../..');
const child = (name) => execFileSync(process.execPath, [resolve(root, 'scripts/qa', name)],
  { env: process.env, encoding: 'utf8', timeout: 90_000, stdio: ['ignore', 'pipe', 'pipe'] });
let lifecycle;
await check('fixtures', async () => { child('seed-firebase-emulator.mjs'); });
await check('ride-lifecycle', async () => {
  lifecycle = JSON.parse(child('run-firebase-emulator-lifecycle-smoke.mjs'));
});
if (lifecycle) await runScenarios(check, lifecycle);
await check('ride-passenger-safety', checkRidePassengerSafety);
await check('chat-delivery-safety', checkChatDeliverySafety);
const result = { runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(), projectId, scope: 'local-emulated-services-not-phone-ui',
  steps, lifecycle, limits: ['No live provider payments, GPS, device tracking or push delivery tested.',
    'Club approval/rejection, trip editing/cancellation and refund settlement remain unverified.'] };
const output = process.env.SGM_LOCAL_FLOW_OUTPUT;
if (!output) throw new Error('Explicit local evidence output path required');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Local QA: ${steps.filter((s) => s.status === 'passed').length}/${steps.length} groups passed. Evidence saved.`);
