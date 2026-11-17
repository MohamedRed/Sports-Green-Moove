import { readFileSync } from 'node:fs';
import { disposableAndroidShell } from './disposable-android-shell.mjs';
import { restoreContinuousDevice } from './continuous-disposable-device.mjs';

try { console.log(JSON.stringify(restoreContinuousDevice(disposableAndroidShell(), JSON.parse(readFileSync(process.argv[2], 'utf8'))))); }
catch (failure) { if (failure.receipt) console.log(JSON.stringify(failure.receipt)); throw failure; }
