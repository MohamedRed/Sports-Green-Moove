import assert from 'node:assert/strict';
import { isAbsolute } from 'node:path';
import { existsSync } from 'node:fs';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

const baselineRoot = process.env.SGM_QA_BOOKING_HANDLER_ROOT;
if (process.env.SGM_LOCAL_FLOW_OUTPUT) assert(!existsSync(process.env.SGM_LOCAL_FLOW_OUTPUT), 'Use a fresh booking evidence output');
if (baselineRoot) {
  assert(isAbsolute(baselineRoot));
  assert.match(process.env.SGM_QA_BOOKING_SOURCE_REF ?? '', /^[a-f0-9]{40}$/);
}
const runtime = prepareLocalRuntime();
try {
  if (baselineRoot) Object.assign(runtime.env, { SGM_QA_BOOKING_HANDLER_ROOT: baselineRoot,
    SGM_QA_BOOKING_SOURCE_REF: process.env.SGM_QA_BOOKING_SOURCE_REF });
  runEmulatorEntry(runtime, 'local-booking-display.mjs');
} finally { runtime.cleanup(); }
