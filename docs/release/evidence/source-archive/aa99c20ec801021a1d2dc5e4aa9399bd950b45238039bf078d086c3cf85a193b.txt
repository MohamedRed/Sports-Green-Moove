import assert from 'node:assert/strict';
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { root } from './local-runtime.mjs';
import { projectId } from './local-emulator-config.mjs';
import { searchMapsPolicy } from './search-maps-policy.mjs';

export function attachRealMapsBroker(runtime, broker) {
  assert.equal(runtime.env.GCLOUD_PROJECT, projectId);
  assert.match(broker.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.match(broker.token, /^[a-f0-9]{64}$/);
  const policy = broker.policy;
  assert(policy === 'approved-route-edit-five-requests' || policy === searchMapsPolicy);
  const lib = resolve(runtime.temp, 'functions/lib');
  for (const file of ['real-maps-function-bridge.mjs', 'real-maps-fetch.mjs', 'search-maps-policy.mjs'])
    cpSync(resolve(root, 'scripts/qa', file), resolve(lib, file));
  writeFileSync(resolve(lib, 'real-maps-bridge-config.json'), JSON.stringify({ origin: broker.origin, token: broker.token, policy }), { mode: 0o600, flag: 'wx' });
  const entry = resolve(lib, 'index.js'), original = readFileSync(entry, 'utf8');
  const guard = "import './local-egress-guard.mjs';\n";
  assert(original.startsWith(guard), 'The offline network guard must run before the explicit map bridge');
  writeFileSync(entry, guard + "import './real-maps-function-bridge.mjs';\n" + original.slice(guard.length));
  const secrets = resolve(runtime.temp, 'functions/.secret.local'), disabled = readFileSync(secrets, 'utf8');
  assert.equal(disabled.split('GOOGLE_MAPS_API_KEY=LOCAL_PROVIDER_DISABLED').length, 2);
  writeFileSync(secrets, disabled.replace('GOOGLE_MAPS_API_KEY=LOCAL_PROVIDER_DISABLED', `GOOGLE_MAPS_API_KEY=${broker.token}`), { mode: 0o600 });
}

export async function runMapUiEmulators(runtime) {
  const args = [resolve(root, 'node_modules/firebase-tools/lib/bin/firebase.js'), 'emulators:exec', '--project', projectId,
    '--config', resolve(runtime.temp, 'firebase.json'), '--only', 'auth,firestore,database,functions',
    `"${process.execPath}" "${resolve(root, 'scripts/qa/real-maps-android-session.mjs')}"`];
  await new Promise((done, reject) => {
    const child = spawn(process.execPath, args, { cwd: runtime.temp, env: runtime.env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('close', (status, signal) => status === 0 && signal === null ? done() : reject(new Error('Real-map app replay did not complete')));
  });
}
