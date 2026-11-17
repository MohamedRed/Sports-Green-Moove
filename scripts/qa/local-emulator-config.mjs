import assert from 'node:assert/strict';

export const projectId = 'demo-sgm-local-qa';
const hosts = {
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000',
};

export function configureLocalEmulators(env = process.env) {
  for (const key of ['GCLOUD_PROJECT', 'FIREBASE_PROJECT_ID']) {
    assert(!env[key] || env[key] === projectId, `Local QA refuses ${key} outside ${projectId}`);
    env[key] = projectId;
  }
  for (const [key, expected] of Object.entries(hosts)) {
    assert(!env[key] || env[key] === expected, `Local QA refuses non-isolated ${key}`);
    env[key] = expected;
  }
  const functionsOrigin = `http://127.0.0.1:5001/${projectId}/us-central1`;
  assert(!env.FUNCTIONS_EMULATOR_ORIGIN || env.FUNCTIONS_EMULATOR_ORIGIN === functionsOrigin,
    'Local QA refuses non-isolated Functions origin');
  env.FUNCTIONS_EMULATOR_ORIGIN = functionsOrigin;
  assert(env.SGM_QA_PASSWORD?.length >= 12, 'Local QA requires an ephemeral fixture password');
  return { projectId, authHost: hosts.FIREBASE_AUTH_EMULATOR_HOST, functionsOrigin,
    databaseURL: `http://${hosts.FIREBASE_DATABASE_EMULATOR_HOST}/?ns=${projectId}` };
}
