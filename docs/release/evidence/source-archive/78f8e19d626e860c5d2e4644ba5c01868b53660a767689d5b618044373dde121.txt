import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:net';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {delimiter, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {disposeLocalRuntime, localRuntimeJvmOptions} from '../scripts/qa/local-runtime-disposal.mjs';
import {emulatorEntryArguments} from '../scripts/qa/local-runtime.mjs';
import {localJavaEnvironment} from '../scripts/qa/local-java-environment.mjs';

function fixture(t) {
  const path = mkdtempSync(resolve(tmpdir(), 'sgm-local-runtime-'));
  t.after(() => rmSync(path, {recursive: true, force: true}));
  return path;
}
test('preparation cleanup removes only its own unlaunched temporary directory', t => {
  const path = fixture(t); disposeLocalRuntime(path, false); assert(!existsSync(path));
  assert.throws(() => disposeLocalRuntime(resolve(tmpdir()), false));
});
test('a live endpoint preserves the runtime and diagnostics until closure is independently verified', async t => {
  const path = fixture(t), marker = resolve(path, 'failure.txt'); writeFileSync(marker, 'original synthetic diagnostic');
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  t.after(() => {if (server.listening) server.close();});
  assert.throws(() => disposeLocalRuntime(path, true, [port]), /runtime retained/);
  assert.equal(readFileSync(marker, 'utf8'), 'original synthetic diagnostic');
  await new Promise(resolve => server.close(resolve));
  disposeLocalRuntime(path, true, [port]); assert(!existsSync(path));
});
test('an invalid endpoint check cannot delete retained diagnostics', t => {
  const path = fixture(t); assert.throws(() => disposeLocalRuntime(path, true, [0]), /runtime retained/);
  assert(existsSync(path));
});
test('runtime cleanup never follows a substituted directory symlink', t => {
  const target = fixture(t), link = fixture(t); rmSync(link, {recursive: true}); symlinkSync(target, link);
  assert.throws(() => disposeLocalRuntime(link, false)); assert(existsSync(target));
});
test('preparing a callable entry arms disposal checks and fixes per-JVM memory only inside the test runtime', () => {
  const runtime = {temp: '/tmp/sgm-entry-contract', emulatorsPrepared: false};
  emulatorEntryArguments(runtime, 'local-ui-session.mjs'); assert.equal(runtime.emulatorsPrepared, true);
  assert.equal(localRuntimeJvmOptions, '-Xms64m -Xmx512m');
  const source = readFileSync(new URL('../scripts/qa/local-runtime.mjs', import.meta.url), 'utf8');
  assert(source.includes('JAVA_TOOL_OPTIONS: localRuntimeJvmOptions'));
  assert(source.includes('disposeLocalRuntime(temp, runtime.emulatorsPrepared)'));
  assert(!source.includes("'TMPDIR', 'JAVA_TOOL_OPTIONS'"));
});

test('an explicitly configured Java home owns the child executable even when PATH selects another Java', t => {
  const path = fixture(t), home = resolve(path, 'configured home'), old = resolve(path, 'old-vm');
  for (const [bin, label] of [[resolve(home, 'bin'), 'configured'], [old, 'wrong']]) {
    mkdirSync(bin, {recursive: true});
    writeFileSync(resolve(bin, 'java'), `#!/bin/sh\nprintf '${label}\\n'\n`, {mode: 0o755});
  }
  const inherited = {JAVA_HOME: home, PATH: old}, originalPath = process.env.PATH;
  const result = spawnSync('java', ['-version'], {env: localJavaEnvironment(inherited), encoding: 'utf8'});
  assert.equal(result.status, 0); assert.equal(result.stdout, 'configured\n');
  assert.equal(inherited.PATH, old); assert.equal(process.env.PATH, originalPath);
});

test('configured Java selection is idempotent and preserves every unrelated child environment value', t => {
  const path = fixture(t), bin = resolve(path, 'bin'); mkdirSync(bin);
  writeFileSync(resolve(bin, 'java'), '#!/bin/sh\nexit 0\n', {mode: 0o755});
  const original = {JAVA_HOME: path, PATH: ['first', bin, 'last'].join(delimiter), HOME: '/isolated', CI: 'true'};
  const env = localJavaEnvironment(original);
  assert.equal(env.PATH, [bin, 'first', 'last'].join(delimiter));
  assert.deepEqual(localJavaEnvironment(env), env);
  assert.equal(env.HOME, original.HOME); assert.equal(env.CI, original.CI);
  assert.equal(localJavaEnvironment({JAVA_HOME: path}).PATH, bin);
});

test('an invalid explicit Java home fails rather than adopting a different executable from PATH', t => {
  const path = fixture(t), bin = resolve(path, 'bin'); mkdirSync(bin);
  writeFileSync(resolve(bin, 'java'), 'not executable', {mode: 0o600});
  for (const home of ['', 'relative', resolve(path, 'missing'), path]) {
    assert.throws(() => localJavaEnvironment({JAVA_HOME: home, PATH: '/usr/bin'}), /Configured JAVA_HOME/);
  }
});

test('an unconfigured Java home retains the existing explicit PATH without installing or guessing a runtime', () => {
  const inherited = {PATH: '/isolated/bin', HOME: '/isolated'}, env = localJavaEnvironment(inherited);
  assert.deepEqual(env, inherited); assert.notEqual(env, inherited);
  const source = readFileSync(new URL('../scripts/qa/local-runtime.mjs', import.meta.url), 'utf8');
  assert(source.indexOf('const env = localJavaEnvironment(') < source.indexOf('const temp = mkdtempSync'));
});
