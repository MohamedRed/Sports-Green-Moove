import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

const runtime = prepareLocalRuntime();
try { runEmulatorEntry(runtime, 'local-ride-observation-services.mjs'); }
finally { runtime.cleanup(); }
