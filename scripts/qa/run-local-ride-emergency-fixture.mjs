#!/usr/bin/env node
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

const runtime = prepareLocalRuntime();
try { runEmulatorEntry(runtime, 'local-ride-emergency-fixture.mjs'); }
finally { runtime.cleanup(); }
