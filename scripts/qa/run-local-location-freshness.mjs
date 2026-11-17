import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

const runtime = prepareLocalRuntime();
try { runEmulatorEntry(runtime, 'local-location-freshness.mjs'); }
finally { runtime.cleanup(); }
