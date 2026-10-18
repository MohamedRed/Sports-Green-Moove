import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { GoogleAuth } from 'google-auth-library';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

assert.deepEqual(process.argv.slice(2), ['--approved-isolated-real-maps'], 'Explicit real-map approval is required');
assert(isAbsolute(process.env.SGM_LOCAL_FLOW_OUTPUT ?? ''), 'An absolute evidence output is required');
assert(!existsSync(process.env.SGM_LOCAL_FLOW_OUTPUT), 'Never overwrite prior evidence');
const runtime = prepareLocalRuntime();
try {
  // Cloud credentials stay in this parent. The isolated runtime never receives ADC.
  const client = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
  let response;
  try {
    response = await client.request({ url: 'https://secretmanager.googleapis.com/v1/projects/sports-green-moove-prod/secrets/GOOGLE_MAPS_API_KEY/versions/latest:access' });
  } catch { throw new Error('Cannot access the existing server map credential; no provider requests were made'); }
  const key = Buffer.from(response.data.payload.data, 'base64').toString('utf8');
  assert(/^AIza[A-Za-z0-9_-]{20,}$/.test(key), 'Invalid server map credential');
  const keyFile = resolve(runtime.temp, 'approved-maps-key');
  writeFileSync(keyFile, key, { mode: 0o600, flag: 'wx' });
  runtime.env.SGM_REAL_MAPS_KEY_FILE = keyFile;
  runtime.env.SGM_APPROVED_REAL_MAPS = 'isolated-five-requests';
  runEmulatorEntry(runtime, 'real-maps-local-session.mjs');
  const result = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT, 'utf8'));
  assert.equal(result.runId, runtime.env.SGM_LOCAL_RUN_ID);
  assert.equal(result.projectId, 'demo-sgm-local-qa');
  assert.equal(result.status, 'passed');
  assert.equal(result.providerRequests.length, 5);
} finally { runtime.cleanup(); }
