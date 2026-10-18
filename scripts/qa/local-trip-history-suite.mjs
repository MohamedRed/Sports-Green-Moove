import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { configureLocalEmulators } from './local-emulator-config.mjs';
import { checkTripHistory } from './local-trip-history-checks.mjs';

const { projectId } = configureLocalEmulators();
execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
  { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
const result = await checkTripHistory();
const output = process.env.SGM_LOCAL_FLOW_OUTPUT;
if (!output) throw new Error('Explicit local evidence path required');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify({ projectId, runId: process.env.SGM_LOCAL_RUN_ID,
  testedAt: new Date().toISOString(), scope: 'isolated-trip-history-services-not-native-or-production',
  result }, null, 2) + '\n');
console.log('Isolated trip history checks passed.');
