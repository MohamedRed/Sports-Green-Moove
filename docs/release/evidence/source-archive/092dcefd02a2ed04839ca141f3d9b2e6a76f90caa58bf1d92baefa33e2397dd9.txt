import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { disposableAndroidShell } from './disposable-android-shell.mjs';
import { collectNativeProcessFailure } from './native-process-failure-evidence.mjs';
import {collectRejectedPrimaryBitmaps} from './rejected-primary-captures.mjs';

const directory = process.argv[2];
assert(typeof directory === 'string' && isAbsolute(directory));
const { serial } = disposableAndroidShell();
mkdirSync(directory, { recursive: true });
const adb = process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : 'adb';
if (process.env.SGM_PRIMARY_CAPTURE_DIAGNOSTICS === 'true') {
  try {
    const receipt = collectRejectedPrimaryBitmaps({adb, serial, directory});
    if (receipt.collectionStatus === 'failed') console.warn('Rejected bitmap diagnostic unavailable; original test failure unchanged.');
  } catch { console.warn('Rejected bitmap diagnostic unavailable; process diagnostics will still be attempted.'); }
}
collectNativeProcessFailure({ adb, serial, directory, label: 'OrdinaryUiSuite',
  packageName: 'be.sportgreenmoove.app', runId: randomBytes(16).toString('hex') });
