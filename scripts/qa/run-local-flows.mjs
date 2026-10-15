#!/usr/bin/env node
import { cpSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { projectId } from './local-emulator-config.mjs';

const root = resolve(import.meta.dirname, '../..');
const temp = mkdtempSync(resolve(tmpdir(), 'sgm-local-flows-'));
const env = Object.fromEntries(['PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'JAVA_HOME']
  .filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
Object.assign(env, { CI: 'true', FIREBASE_CLI_DISABLE_USAGE_REPORTING: 'true',
  GCLOUD_PROJECT: projectId, FIREBASE_PROJECT_ID: projectId,
  XDG_CONFIG_HOME: resolve(temp, 'cli-config'),
  GOOGLE_APPLICATION_CREDENTIALS: resolve(temp, 'no-cloud-credentials.json'),
  SGM_QA_PASSWORD: randomBytes(24).toString('hex'),
  SGM_LOCAL_RUN_ID: randomBytes(16).toString('hex'),
  SGM_LOCAL_FLOW_OUTPUT: process.env.SGM_LOCAL_FLOW_OUTPUT || resolve(temp, 'results.json') });
assert(isAbsolute(env.SGM_LOCAL_FLOW_OUTPUT), 'Local evidence output must be an absolute path');

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}

try {
  run('npm', ['run', 'build', '--workspace', 'functions']);
  mkdirSync(resolve(temp, 'functions'));
  cpSync(resolve(root, 'functions/lib'), resolve(temp, 'functions/lib'), { recursive: true });
  cpSync(resolve(root, 'scripts/qa/local-egress-guard.mjs'), resolve(temp, 'functions/lib/local-egress-guard.mjs'));
  const entrypoint = resolve(temp, 'functions/lib/index.js');
  writeFileSync(entrypoint, `import './local-egress-guard.mjs';\n${readFileSync(entrypoint, 'utf8')}`);
  cpSync(resolve(root, 'functions/package.json'), resolve(temp, 'functions/package.json'));
  symlinkSync(resolve(root, 'node_modules'), resolve(temp, 'functions/node_modules'), 'dir');
  const secrets = ['RADAR_WEBHOOK_SECRET', 'GOOGLE_MAPS_API_KEY', 'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'];
  writeFileSync(resolve(temp, 'functions/.secret.local'), secrets.map((key) => `${key}=LOCAL_PROVIDER_DISABLED\n`).join(''), { mode: 0o600 });
  const config = JSON.parse(readFileSync(resolve(root, 'firebase.json'), 'utf8'));
  const local = { functions: { source: 'functions', runtime: 'nodejs22' },
    firestore: { rules: resolve(root, config.firestore.rules), indexes: resolve(root, config.firestore.indexes) },
    database: { rules: resolve(root, config.database.rules) },
    emulators: { ...Object.fromEntries(['auth', 'functions', 'firestore', 'database']
      .map((key) => [key, { host: '127.0.0.1', port: config.emulators[key].port }])),
      ui: { enabled: false }, singleProjectMode: true } };
  writeFileSync(resolve(temp, 'firebase.json'), JSON.stringify(local, null, 2));
  const entry = resolve(root, 'scripts/qa/local-flow-suite.mjs');
  run(process.execPath, [resolve(root, 'node_modules/firebase-tools/lib/bin/firebase.js'),
    'emulators:exec', '--project', projectId, '--config', resolve(temp, 'firebase.json'),
    '--only', 'auth,firestore,database,functions', `"${process.execPath}" "${entry}"`], temp);
  const result = JSON.parse(readFileSync(env.SGM_LOCAL_FLOW_OUTPUT, 'utf8'));
  assert.equal(result.runId, env.SGM_LOCAL_RUN_ID, 'A fresh completed run is required');
  assert.equal(result.projectId, projectId);
  assert.equal(result.steps.length, 10);
  assert(result.steps.every((step) => step.status === 'passed'), 'Every local scenario must pass');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
