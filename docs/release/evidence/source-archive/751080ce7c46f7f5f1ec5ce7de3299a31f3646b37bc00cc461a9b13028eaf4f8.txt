import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

const runtime = prepareLocalRuntime();
try {
  runEmulatorEntry(runtime, 'local-booking-consistency.mjs');
} finally {
  runtime.cleanup();
}
