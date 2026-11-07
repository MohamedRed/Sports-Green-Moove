import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync, lstatSync, rmSync} from 'node:fs';
import {resolve, sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';

export const localRuntimePorts = Object.freeze([9099, 8080, 9000, 5001]);
export const localRuntimeJvmOptions = '-Xms64m -Xmx512m';
const self = fileURLToPath(import.meta.url);

export function disposeLocalRuntime(directory, emulatorsPrepared, ports = localRuntimePorts) {
  assert(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'sgm-local-runtime-'));
  assert.equal(typeof emulatorsPrepared, 'boolean');
  if (!existsSync(directory)) return;
  const stat = lstatSync(directory);
  assert(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid());
  if (emulatorsPrepared) {
    const probe = spawnSync(process.execPath, [self, JSON.stringify(ports)],
      {env: {}, stdio: 'pipe', timeout: 5000, maxBuffer: 4096});
    assert(!probe.error && probe.status === 0 && probe.signal === null,
      `Local emulator endpoints are not verified closed; runtime retained at ${directory}`);
  }
  rmSync(directory, {recursive: true, force: true});
}

if (process.argv[1] === self) {
  try {await assertLocalEndpointsClosed(JSON.parse(process.argv[2]));}
  catch {process.exitCode = 1;}
}
