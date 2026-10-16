import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { configureLocalEmulators } from './local-emulator-config.mjs';
import { runScenarios } from './local-flow-scenarios.mjs';
import { checkRidePassengerSafety } from './local-ride-safety.mjs';
import { checkChatDeliverySafety } from './local-chat-safety.mjs';
import { checkChatDirectorySafety } from './local-chat-directory-safety.mjs';
import { checkReservationDecisions } from './local-reservation-decisions.mjs';
import { checkMembershipReview } from './local-membership-review.mjs';
import { checkTripCapacityOwnership } from './local-trip-capacity.mjs';
import { checkChatResponseLoss } from './local-chat-response-loss.mjs';
import { checkTeamOwnership } from './local-team-ownership.mjs';
import { checkTripCancellation } from './local-trip-cancellation.mjs';
import { checkTripDetailsOwnership } from './local-trip-details.mjs';
import { checkTripChanges } from './local-trip-changes.mjs';

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
const scenarios = lifecycle ? await runScenarios(check, lifecycle) : undefined;
await check('ride-passenger-safety', checkRidePassengerSafety);
await check('chat-delivery-safety', checkChatDeliverySafety);
let chatResponseLoss;
await check('chat-post-commit-response-loss', async () => { chatResponseLoss = await checkChatResponseLoss(); });
await check('chat-directory-safety', checkChatDirectorySafety);
let reservationDecisions;
await check('reservation-decisions', async () => { reservationDecisions = await checkReservationDecisions(); });
let membershipReview;
await check('membership-review', async () => { membershipReview = await checkMembershipReview(); });
let tripCapacity;
await check('trip-capacity-ownership', async () => { tripCapacity = await checkTripCapacityOwnership(); });
let teamOwnership;
await check('team-ownership', async () => { teamOwnership = await checkTeamOwnership(); });
let tripCancellation;
await check('trip-cancellation', async () => { tripCancellation = await checkTripCancellation(); });
let tripDetails;
await check('trip-details-ownership', async () => { tripDetails = await checkTripDetailsOwnership(); });
let tripChanges;
await check('trip-change-parent-confirmation', async () => { tripChanges = await checkTripChanges(); });
const result = { runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(), projectId, scope: 'local-emulated-services-not-phone-ui',
  steps, lifecycle, scenarios, reservationDecisions, membershipReview, tripCapacity, chatResponseLoss, teamOwnership, tripCancellation, tripDetails, tripChanges,
  limits: ['No live provider payments, GPS, device tracking or push delivery tested.',
    'Trip editing and refund settlement require separate evidence; the cancellation app replay is recorded separately.'] };
const output = process.env.SGM_LOCAL_FLOW_OUTPUT;
if (!output) throw new Error('Explicit local evidence output path required');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Local QA: ${steps.filter((s) => s.status === 'passed').length}/${steps.length} groups passed. Evidence saved.`);
