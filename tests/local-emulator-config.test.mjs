import test from 'node:test';
import assert from 'node:assert/strict';
import { configureLocalEmulators, projectId } from '../scripts/qa/local-emulator-config.mjs';

const valid = () => ({ SGM_QA_PASSWORD: 'ephemeral-fixture-password' });
test('local QA only configures an explicit demo project and loopback endpoints', () => {
  const env = valid();
  const config = configureLocalEmulators(env);
  assert.equal(config.projectId, projectId);
  assert.equal(env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
  assert.match(config.databaseURL, /^http:\/\/127\.0\.0\.1:9000/);
});
test('local QA fails closed for live projects, remote endpoints or missing fixture password', () => {
  for (const [key, value] of Object.entries({ GCLOUD_PROJECT: 'sports-green-moove-prod',
    FIREBASE_PROJECT_ID: 'sports-green-moove-dev', FIRESTORE_EMULATOR_HOST: 'remote:8080',
    FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9098', FIREBASE_DATABASE_EMULATOR_HOST: 'remote:9000',
    FUNCTIONS_EMULATOR_ORIGIN: 'https://example.test/functions', SGM_QA_PASSWORD: '' })) {
    assert.throws(() => configureLocalEmulators({ ...valid(), [key]: value }), key);
  }
});
