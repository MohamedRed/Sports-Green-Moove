import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const vector = process.argv[2];
assert(['filename', 'execArgv', 'env'].includes(vector));
const require = createRequire(import.meta.url);
let legacy;
try { legacy = require.resolve('tinypool'); }
catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  process.stdout.write(JSON.stringify({ dependencyAbsent: true, inheritedOptionUsed: false }));
  process.exit(0);
}
const { Tinypool } = await import(legacy);
const fixture = name => fileURLToPath(new URL(`../fixtures/pool-probe-${name}.mjs`, import.meta.url));
const inherited = {
  filename: fixture('inherited'),
  execArgv: ['--import', fixture('preload')],
  env: { SGM_POOL_PROBE_PRELOAD: 'ran' },
};
let pool;
try {
  Object.defineProperty(Object.prototype, vector, { value: inherited[vector], configurable: true, writable: true });
  pool = new Tinypool({ filename: fixture('configured'), minThreads: 1, maxThreads: 1 });
  const result = await pool.run(21, {});
  assert.equal(result.value, 21);
  process.stdout.write(JSON.stringify({ dependencyAbsent: false,
    inheritedOptionUsed: result.selected === 'inherited' || result.preload }));
} finally {
  delete Object.prototype[vector];
  await pool?.destroy();
}
