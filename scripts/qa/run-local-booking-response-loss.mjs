import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

assert(!process.env.SGM_LOCAL_FLOW_OUTPUT || !existsSync(process.env.SGM_LOCAL_FLOW_OUTPUT),
  'Use a fresh booking response-loss evidence output');
const runtime = prepareLocalRuntime();
try { runEmulatorEntry(runtime, 'local-booking-response-loss.mjs'); }
finally { runtime.cleanup(); }
