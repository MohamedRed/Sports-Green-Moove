import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prepareContinuousDevice, restoreContinuousDevice } from '../scripts/qa/continuous-disposable-device.mjs';
import { assertContinuousDevice, assertPinnedApks, pinnedApkHashes, pinnedPackages,
  preparePinnedApks } from '../scripts/qa/preinstalled-disposable-apks.mjs';
import { pauseDisposableStore } from '../scripts/qa/disposable-store-pause.mjs';
import { prepareDisposableTestApks, usePreinstalledTestApks } from '../scripts/qa/install-disposable-test-apks.mjs';
import { continuousFixture, approvalKeys, assertNoGuardedInstallOrUnlock } from './fixtures/continuous-disposable-device.mjs';

const scope = 'single-case-continuous-installation-guard-not-flow-proof';
const names = Object.keys(pinnedPackages);
const consume = (f, env = f.env) => preparePinnedApks({ android: f.android, serial: f.device.serial, env, device: f.device });
const clearCount = (f) => f.events.filter(({ command }) => command.startsWith('pm clear ')).length;
const restore = (f, receipt) => restoreContinuousDevice(f.device, receipt, f.execute, f.deps);
const caught = (action) => { let error; try { action(); } catch (failure) { error = failure; } assert(error); return error; };

test('focused dispatch never selects legacy installation when its receipt or approval is lost', (t) => {
  const f = continuousFixture(t);
  assert.equal(usePreinstalledTestApks({}), false); assert.equal(usePreinstalledTestApks(f.env), true);
  for (const env of [{ ...f.env, SGM_PREINSTALLED_TEST_APKS_RECEIPT: undefined },
    { ...f.env, SGM_FOCUSED_UI_CASE: undefined }, { ...f.env, SGM_TEST_PHONE_ADMIN_APPROVED: undefined },
    { ...f.env, SGM_PREINSTALLED_TEST_APKS_RECEIPT: '' }]) {
    assert.throws(() => prepareDisposableTestApks({ env, device: f.device }), { code: 'ERR_ASSERTION' });
  }
  assert.equal(f.events.length, 0);
});

test('setup pins both actual APK byte hashes and activates the guard only after both installs', (t) => {
  const f = continuousFixture(t), receipt = f.prepareAndSave();
  assert.equal(receipt.scope, scope); assert.equal(receipt.case, f.env.SGM_FOCUSED_UI_CASE);
  assert.deepEqual(receipt.apkHashes, pinnedApkHashes(f.android));
  const installs = f.events.filter(({ kind }) => kind === 'command');
  assert.equal(installs.length, 2); assert(installs.every(({ blocked }) => !blocked));
  assert.equal(f.state.blocked, true); assert.equal(f.state.owner, true);
  assertNoGuardedInstallOrUnlock(f.events);
});

test('preinstalled preparation binds receipt bytes, clears exactly its two apps, and keeps the guard', (t) => {
  const f = continuousFixture(t), receipt = f.prepareAndSave();
  const result = consume(f);
  assert.deepEqual(result, { method: scope, case: receipt.case, apkHashes: f.hashes,
    receiptSha256: createHash('sha256').update(readFileSync(f.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT)).digest('hex'),
    installationsRemainedBlocked: true });
  assert.deepEqual(f.events.filter(({ command }) => command.startsWith('pm clear ')).map(({ args }) => args[2]), names);
  assert.equal(statSync(f.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT + '.claimed').mode & 0o777, 0o600);
  assertNoGuardedInstallOrUnlock(f.events);
});

for (const key of approvalKeys) test(`missing/false ${key} refuses setup and replay without mutation`, (t) => {
  for (const value of [undefined, 'false', 'yes']) {
    const f = continuousFixture(t), receipt = f.prepareAndSave();
    const env = { ...f.env, [key]: value }; f.events.length = 0;
    assert.throws(() => prepareContinuousDevice(env, f.execute, f.deps));
    assert.throws(() => consume(f, env));
    assert.equal(f.events.length, 0); assert.equal(clearCount(f), 0);
    assert.equal(receipt.scope, scope);
  }
});

for (const [label, change] of [
  ['unselected case', (f) => { f.env.SGM_FOCUSED_UI_CASE = 'all'; }],
  ['missing receipt', (f) => { delete f.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT; }],
  ['relative receipt', (f) => { f.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT = 'receipt.json'; }],
  ['unreadable receipt', (f) => { f.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT += '.missing'; }],
  ['malformed receipt', (f) => { writeFileSync(f.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT, '{'); }],
  ['wrong case', (f, r) => { r.case = 'ride-observation'; f.save(r); }],
  ['wrong scope', (f, r) => { r.scope = 'disposable-emulator-without-home-navigation'; f.save(r); }],
  ['wrong serial', (f, r) => { r.serial = 'emulator-5556'; f.save(r); }],
  ['changed runtime', (f, r) => { r.mapsRuntime.playServicesVersion = '99.0.0'; f.save(r); }],
  ['mismatched administrator receipt', (f, r) => { r.installAdmin.packageName = 'foreign.admin'; f.save(r); }],
]) test(`${label} fails closed without an install, clear, or receipt claim`, (t) => {
  const f = continuousFixture(t), receipt = f.prepareAndSave(); change(f, receipt);
  const start = f.events.length; assert.throws(() => consume(f));
  assert.equal(clearCount(f), 0);
  assert(!f.events.slice(start).some(({ kind, command }) => kind === 'command' || command.startsWith('am broadcast ')));
  assert(!existsSync(f.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT + '.claimed'));
});

for (const [label, hashes] of [
  ['missing package', (f) => ({ [names[0]]: f.hashes[names[0]] })],
  ['extra package', (f) => ({ ...f.hashes, 'foreign.package': 'a'.repeat(64) })],
  ['uppercase hash', (f) => ({ ...f.hashes, [names[0]]: 'A'.repeat(64) })],
  ['short hash', (f) => ({ ...f.hashes, [names[0]]: 'a'.repeat(63) })],
  ['wrong digest', (f) => ({ ...f.hashes, [names[0]]: '0'.repeat(64) })],
]) test(`strict installed hash validation rejects ${label}`, (t) => {
  const f = continuousFixture(t); f.prepare();
  assert.throws(() => assertPinnedApks(f.device.shell, hashes(f)));
  assert.equal(clearCount(f), 0); assertNoGuardedInstallOrUnlock(f.events);
});

for (const [label, change] of [
  ['missing APK', (f) => f.state.installed.delete(names[0])],
  ['split APK', (f) => { f.state.paths = { [names[0]]: 'package:/data/app/x/base.apk\npackage:/data/app/x/split.apk' }; }],
  ['foreign APK path', (f) => { f.state.paths = { [names[0]]: 'package:/sdcard/base.apk' }; }],
  ['wrong digest path', (f) => { f.state.digestOutput = `${f.hashes[names[0]]}  /different/base.apk`; }],
  ['unavailable digest', (f) => { f.state.digestOutput = 'sha256sum: Permission denied'; }],
  ['changed installed APK', (f) => { f.state.digests = { [names[0]]: '0'.repeat(64) }; }],
  ['changed compiled APK', (f) => writeFileSync(resolve(f.android, 'app/build/outputs', pinnedPackages[names[0]]), 'changed')],
]) test(`preinstalled mode rejects ${label} without fallback`, (t) => {
  const f = continuousFixture(t); f.prepareAndSave(); change(f);
  assert.throws(() => consume(f)); assert.equal(clearCount(f), 0);
  assertNoGuardedInstallOrUnlock(f.events);
});

test('a receipt is claimed exactly once and cannot clear apps twice', (t) => {
  const f = continuousFixture(t); f.prepareAndSave(); consume(f);
  assert.equal(readFileSync(f.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT + '.claimed', 'utf8'), f.env.SGM_FOCUSED_UI_CASE + '\n');
  assert.throws(() => consume(f), { code: 'EEXIST' }); assert.equal(clearCount(f), 2);
  assertNoGuardedInstallOrUnlock(f.events);
});

test('a failed operation after claim consumes the receipt permanently and is not retried', (t) => {
  const original = new Error('clear failed');
  const f = continuousFixture(t, { before: ({ command }) => { if (command === `pm clear ${names[0]}`) throw original; } });
  f.prepareAndSave(); assert.equal(caught(() => consume(f)), original);
  assert.throws(() => consume(f), { code: 'EEXIST' }); assert.equal(clearCount(f), 1);
  assert.equal(f.state.blocked, true); assertNoGuardedInstallOrUnlock(f.events);
});

test('a store awakened by the system is permitted only under the verified continuous guard', (t) => {
  const f = continuousFixture(t, { storeWakes: true }), receipt = f.prepareAndSave();
  assert.equal(receipt.storeStoppedAfterLock, false); consume(f);
  f.state.blocked = false; assert.throws(() => assertContinuousDevice(f.device, receipt), /guard/);
  assert.throws(() => consume(f), /guard/);
  const legacy = continuousFixture(t, { storeWakes: true });
  const error = caught(() => pauseDisposableStore(legacy.device.shell));
  assert(error instanceof AggregateError); assert.equal(error.receipt.stage, 'stopped-verification');
});

for (const [label, change] of [
  ['missing owner', (s) => { s.owner = false; }],
  ['unlocked guard', (s) => { s.blocked = false; }],
  ['active installer', (s) => { s.installs = 'Active install sessions:\n  Session 9:\n    mDestroyed=false\nHistorical install sessions:\n'; }],
  ['changed map runtime', (s) => { s.version = '26.0.0'; }],
  ['disabled location', (s) => { s.location = 'false'; }],
  ['changed store background', (s) => { s.background.RUN_IN_BACKGROUND = 'allow'; }],
]) test(`continuous replay rejects ${label} without clearing or reinstalling`, (t) => {
  const f = continuousFixture(t); f.prepareAndSave(); change(f.state);
  assert.throws(() => consume(f)); assert.equal(clearCount(f), 0); assertNoGuardedInstallOrUnlock(f.events);
});

test('setup rollback removes partially installed apps and independently restores every modified setting', (t) => {
  const installFailure = new Error('second APK refused'), resetFailure = new Error('uninstall failed');
  const f = continuousFixture(t, { before: ({ kind }, state) => {
    if (kind === 'command' && state.installed.size === 1) throw installFailure;
    if (kind === 'reset') throw resetFailure;
  } });
  const error = caught(f.prepare);
  assert.deepEqual(error.errors, [installFailure, resetFailure]);
  assert.deepEqual(error.receipt.cleanup, { localPackagesRemoved: false, backgroundRestored: true, stoppedRestored: true, adminRemoved: true });
  assert.equal(error.receipt.verified, false); assert.equal(f.state.owner, false); assert.equal(f.state.stopped, false);
  assert.deepEqual(f.state.background, { RUN_IN_BACKGROUND: 'allow', RUN_ANY_IN_BACKGROUND: 'default' });
  assert.equal(f.events.filter(({ kind }) => kind === 'command').length, 2);
  assert.equal(f.events.filter(({ kind }) => kind === 'reset').length, 1);
});

for (const [label, change] of [
  ['pre-existing guard', (s) => { s.blocked = true; }],
  ['pre-existing test app', (s) => { s.installed.add(names[0]); }],
  ['active installer', (s) => { s.installs = 'Active install sessions:\n  Session 9:\n    mDestroyed=false\nHistorical install sessions:\n'; }],
]) test(`setup refuses ${label} without attempting administration or mutation`, (t) => {
  const f = continuousFixture(t); change(f.state); assert.throws(f.prepare);
  assert(!f.events.some(({ kind }) => ['prepareAdmin', 'removeAdmin', 'command', 'reset'].includes(kind)));
  assert(!f.events.some(({ command }) => /^(am (broadcast|force-stop)|pm (disable-user|enable|unstop)|cmd appops set)/.test(command)));
});

test('an admin setup failure retains its nested cleanup receipt and is never retried', (t) => {
  const f = continuousFixture(t), original = Object.assign(new Error('admin failed'), {
    receipt: { scope: 'failed-disposable-admin-setup-not-flow-proof', cleanup: { componentRemoved: false } },
  });
  let attempts = 0;
  f.deps.prepareAdmin = () => { attempts++; throw original; };
  const error = caught(f.prepare);
  assert.equal(attempts, 1); assert.deepEqual(error.errors, [original]);
  assert.deepEqual(error.receipt.nestedFailure, original.receipt); assert.deepEqual(error.receipt.cleanup, {});
  assert.equal(error.receipt.verified, false); assert(!f.events.some(({ kind }) => kind === 'command'));
});

test('setup rollback attempts all restorations even when each independent restoration fails', (t) => {
  let rollback = false;
  const original = new Error('post-lock setup failed');
  const f = continuousFixture(t, { before: ({ command, kind }) => {
    if (!rollback && command.startsWith('pm list packages -d')) { rollback = true; throw original; }
    if (rollback && (['reset', 'removeAdmin'].includes(kind) ||
      /^(cmd appops set|pm unstop|pm enable)/.test(command))) throw new Error(`restore failed: ${kind} ${command}`);
  } });
  const error = caught(f.prepare);
  assert.equal(error.errors[0], original); assert.equal(error.errors.length, 6);
  assert.deepEqual(error.receipt.cleanup, { localPackagesRemoved: false, backgroundRestored: false,
    stoppedRestored: false, launcherRestored: false, adminRemoved: false });
  assert.equal(error.receipt.verified, false);
  assert.equal(f.events.filter(({ kind }) => kind === 'removeAdmin').length, 1); assertNoGuardedInstallOrUnlock(f.events);
});

test('post-lock setup failure independently attempts launcher/admin cleanup after uninstall failure', (t) => {
  const failure = new Error('launcher verification failed'), uninstall = new Error('uninstall failed');
  let armed = true;
  const f = continuousFixture(t, { before: ({ command, kind }) => {
    if (armed && command.startsWith('pm list packages -d')) { armed = false; throw failure; }
    if (kind === 'reset') throw uninstall;
  } });
  const error = caught(f.prepare);
  assert.deepEqual(error.errors, [failure, uninstall]);
  assert.equal(error.receipt.cleanup.launcherRestored, true); assert.equal(error.receipt.cleanup.adminRemoved, true);
  assert.equal(f.state.launcher, true); assert.equal(f.state.owner, false); assertNoGuardedInstallOrUnlock(f.events);
});

test('final cleanup succeeds with storeStopped=false and removes apps before removing the administrator', (t) => {
  const f = continuousFixture(t, { storeWakes: true }), receipt = f.prepareAndSave(); consume(f);
  const result = restore(f, receipt);
  assert.equal(result.observed.storeStopped, false); assert.equal(result.observed.continuousGuardVerified, true);
  assert.equal(result.restored, true); assert.equal(result.verified, true); assert.equal(f.state.installed.size, 0);
  const reset = f.events.findIndex(({ kind }) => kind === 'reset'), admin = f.events.findIndex(({ kind }) => kind === 'removeAdmin');
  assert(reset < admin); assert.equal(f.events[reset].blocked, true); assertNoGuardedInstallOrUnlock(f.events);
});

test('failed final guard verification and uninstall still attempt every independent restoration', (t) => {
  const uninstall = new Error('uninstall failed'), f = continuousFixture(t, { before: ({ kind }) => { if (kind === 'reset') throw uninstall; } });
  const receipt = f.prepareAndSave(); f.state.blocked = false;
  const error = caught(() => restore(f, receipt));
  assert(error.errors.includes(uninstall)); assert.equal(error.errors.length, 2);
  assert.equal(error.receipt.observed.continuousGuardVerified, false); assert.equal(error.receipt.verified, false);
  assert.deepEqual(error.receipt.restoration, { localPackagesRemoved: false, background: true, stopped: true, launcher: true,
    installAdmin: { authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true } });
  assert.equal(f.state.owner, false); assert.equal(f.events.filter(({ kind }) => kind === 'reset').length, 1);
});

test('final cleanup aggregates background, stopped, launcher and admin failures without retries', (t) => {
  let restoring = false;
  const failures = { background: new Error('background'), stopped: new Error('stopped'), launcher: new Error('launcher'), admin: new Error('admin') };
  const f = continuousFixture(t, { before: ({ command, kind }) => {
    if (!restoring) return;
    if (command.startsWith('cmd appops set ')) throw failures.background;
    if (command.startsWith('pm unstop ')) throw failures.stopped;
    if (command.startsWith('pm enable ')) throw failures.launcher;
    if (kind === 'removeAdmin') throw failures.admin;
  } });
  const receipt = f.prepareAndSave(); restoring = true;
  const error = caught(() => restore(f, receipt));
  assert.equal(error.errors.length, 4); assert.equal(error.receipt.restoration.localPackagesRemoved, true);
  for (const key of ['background', 'stopped', 'launcher', 'installAdmin']) assert.equal(error.receipt.restoration[key], false);
  assert.equal(error.receipt.restored, false); assert.equal(error.receipt.verified, false);
  assert.equal(f.events.filter(({ kind }) => kind === 'removeAdmin').length, 1); assertNoGuardedInstallOrUnlock(f.events);
});

test('final cleanup refuses another device before mutation', (t) => {
  const f = continuousFixture(t), receipt = f.prepareAndSave(); receipt.serial = 'emulator-5556';
  const start = f.events.length; assert.throws(() => restore(f, receipt)); assert.equal(f.events.length, start);
});

test('post-claim guard loss is rejected, remains claimed, and still allows independent final cleanup', (t) => {
  const f = continuousFixture(t, { before: ({ command }, state) => {
    if (command === `pm clear ${names[1]}`) state.blocked = false;
  } });
  const receipt = f.prepareAndSave(); assert.throws(() => consume(f), /guard/);
  assert(existsSync(f.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT + '.claimed'));
  const error = caught(() => restore(f, receipt));
  assert.equal(error.receipt.observed.continuousGuardVerified, false);
  assert.equal(error.receipt.restored, true); assert.equal(error.receipt.verified, false);
  assert.equal(f.state.installed.size, 0); assert.equal(f.state.owner, false);
  assertNoGuardedInstallOrUnlock(f.events);
});
