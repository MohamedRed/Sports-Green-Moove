#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

const path = process.env.SGM_LOCAL_UI_SESSION_FILE;
assert(path && isAbsolute(path) && !existsSync(path), 'A fresh absolute private session path is required');
const runtime = prepareLocalRuntime();
runtime.env.SGM_LOCAL_UI_SESSION_FILE = path;
try { runEmulatorEntry(runtime, 'local-ui-session.mjs'); }
finally { rmSync(path, { force: true }); runtime.cleanup(); }
