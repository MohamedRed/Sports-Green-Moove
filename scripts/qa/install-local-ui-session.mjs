#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const [serial, path] = process.argv.slice(2);
assert(/^emulator-\d+$/.test(serial), 'Only a disposable Android emulator is supported');
const session = JSON.parse(readFileSync(path, 'utf8'));
assert.equal(session.projectId, 'demo-sgm-local-qa');
assert(session.password?.length >= 12);
const adb = process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : 'adb';
function run(args, input) {
  const result = spawnSync(adb, ['-s', serial, ...args], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  assert.equal(result.status, 0, 'Local app fixture transfer failed');
}
run(['shell', 'run-as', 'be.sportgreenmoove.app.local', 'mkdir', '-p', 'files']);
run(['shell', 'run-as', 'be.sportgreenmoove.app.local', 'dd', 'of=files/local-qa-session.json'], JSON.stringify(session));
run(['shell', 'run-as', 'be.sportgreenmoove.app.local', 'chmod', '600', 'files/local-qa-session.json']);
console.log('Disposable credentials transferred to the local-only app sandbox.');
