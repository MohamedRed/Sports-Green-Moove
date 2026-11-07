import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const runtime = prepareLocalRuntime();
try {
  runEmulatorEntry(runtime, 'local-trip-contention.mjs');
} finally {
  try {
    const diagnostic = resolve(runtime.temp, 'firestore-debug.log');
    mkdirSync(dirname(runtime.env.SGM_LOCAL_FLOW_OUTPUT), { recursive: true });
    if (existsSync(diagnostic)) copyFileSync(diagnostic, `${runtime.env.SGM_LOCAL_FLOW_OUTPUT}.firestore.log`);
  } finally {
    runtime.cleanup();
  }
}
