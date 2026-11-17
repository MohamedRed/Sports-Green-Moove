import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url)));
const helper = fileURLToPath(new URL('./helpers/test-pool-security-probe.mjs', import.meta.url));
for (const vector of ['filename', 'execArgv', 'env']) {
  test(`test workers never accept inherited ${vector} options`, () => {
    const child = spawnSync(process.execPath, ['--max-old-space-size=64', helper, vector], {
      env: { PATH: process.env.PATH }, encoding: 'utf8', timeout: 5000,
      killSignal: 'SIGKILL', maxBuffer: 32 * 1024,
    });
    assert.ifError(child.error); assert.equal(child.signal, null);
    assert.equal(child.status, 0, 'Controlled local worker probe must finish');
    assert.equal(JSON.parse(child.stdout).inheritedOptionUsed, false);
  });
}
test('installed and locked runner removes the vulnerable pool and uses the supported mocker fix', () => {
  const lock = read('package-lock.json');
  const require = createRequire(import.meta.url);
  const installed = name => JSON.parse(readFileSync(require.resolve(`${name}/package.json`)));
  for (const name of ['vitest', '@vitest/mocker']) {
    const version = installed(name).version;
    assert.equal(lock.packages[`node_modules/${name}`].version, version);
    assert.match(version, /^4\.1\.(?:1[2-9]|[2-9]\d|\d{3,})$/);
  }
  assert(!Object.keys(lock.packages).some(path => /(?:^|\/)node_modules\/tinypool$/.test(path)));
  assert.throws(() => require.resolve('tinypool'), { code: 'MODULE_NOT_FOUND' });
});
