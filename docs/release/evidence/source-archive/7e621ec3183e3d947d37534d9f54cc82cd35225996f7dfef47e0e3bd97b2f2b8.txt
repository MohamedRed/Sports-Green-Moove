import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

assert.equal(process.env.SGM_FOCUSED_UI_CASE, 'team-read-components');
const receipt = process.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT;
assert(isAbsolute(receipt ?? ''));
const parent = resolve(import.meta.dirname, '../../android/app/build/outputs/local-ui-evidence');
mkdirSync(parent, { recursive: true });
const directory = resolve(parent, randomBytes(16).toString('hex'));
execFileSync(process.execPath, [resolve(import.meta.dirname, 'run-team-chat-components.mjs'), receipt, directory,
  '--reads', '--focused-shell-restores'], { env: process.env, stdio: 'inherit', timeout: 12 * 60_000 });
