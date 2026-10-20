import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { startSearchMapsBroker } from '../scripts/qa/search-maps-fetch.mjs';
import { attachRealMapsBroker } from '../scripts/qa/real-maps-runtime.mjs';
import { fixture, testKey, request, response } from './helpers/search-maps-fixture.mjs';

test('isolated worker routes the approved matrix through the shared broker without receiving the server key', async () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-search-bridge-unit-')), trip = fixture(); let calls = 0;
  const broker = await startSearchMapsBroker(testKey, trip, async () => response(calls++));
  try {
    const lib = resolve(temp, 'functions/lib'); mkdirSync(lib, { recursive: true });
    writeFileSync(resolve(lib, 'index.js'), "import './local-egress-guard.mjs';\n");
    cpSync(new URL('../scripts/qa/local-egress-guard.mjs', import.meta.url), resolve(lib, 'local-egress-guard.mjs'));
    writeFileSync(resolve(temp, 'functions/.secret.local'), 'STRIPE_SECRET_KEY=LOCAL_PROVIDER_DISABLED\nGOOGLE_MAPS_API_KEY=LOCAL_PROVIDER_DISABLED\n');
    attachRealMapsBroker({ temp, env: { GCLOUD_PROJECT: 'demo-sgm-local-qa' } }, broker);
    const config = readFileSync(resolve(lib, 'real-maps-bridge-config.json'), 'utf8');
    assert(!config.includes(testKey)); assert(!readFileSync(resolve(temp, 'functions/.secret.local'), 'utf8').includes(testKey));
    const code = `import './index.js';
      const config = JSON.parse((await import('node:fs')).readFileSync('./real-maps-bridge-config.json','utf8'));
      for (const data of ${JSON.stringify(Array.from({ length: 6 }, (_, n) => request(n, trip)))}) {
        const result = await fetch(data.url, {method:data.method, ...(data.body === null ? {} : {body:data.body}),
          headers:{'X-Goog-Api-Key':config.token,'X-Goog-FieldMask':data.fieldMask}});
        if (!result.ok) throw Error('approved chain failed'); await result.json();
      }
      for (const url of ['https://firestore.googleapis.com','https://api.stripe.com/v1/payment_intents']) {
        let rejected=false; try { await fetch(url); } catch { rejected=true; }
        if(!rejected) throw Error('production egress opened');
      }
      console.log('six-approved-search-calls-only');`;
    const result = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', code], { cwd: lib, timeout: 15_000 });
    assert.equal(result.stdout.trim(), 'six-approved-search-calls-only'); assert.equal(calls, 6);
    assert.equal(broker.receipts().requests.length, 6);
    assert.throws(() => attachRealMapsBroker({ temp, env: { GCLOUD_PROJECT: 'demo-sgm-local-qa' } }, { ...broker, policy: 'unknown' }));
  } finally { await broker.close(); rmSync(temp, { recursive: true, force: true }); }
});
