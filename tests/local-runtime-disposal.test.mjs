import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:net';
import {existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {disposeLocalRuntime, localRuntimeJvmOptions} from '../scripts/qa/local-runtime-disposal.mjs';
import {emulatorEntryArguments} from '../scripts/qa/local-runtime.mjs';

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
