import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {superviseLocalProcess} from './supervised-local-process.mjs';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';

const root = resolve(import.meta.dirname, '../..'), plans = [
  ['build', ['run', 'build']], ['functions', ['test']], ['rules', ['run', 'test:rules']],
  ['payments', ['run', 'test:stripe-webhook-flow']], ['child-approval', ['run', 'test:child-account-approval']],
  ['child-invitation', ['run', 'test:child-invitation']],
];
if (process.argv[2] === 'step') {
  const index = Number(process.argv[3]); assert(Number.isInteger(index) && plans[index]);
  const controller = new AbortController(), onInt = () => controller.abort('SIGINT'), onTerm = () => controller.abort('SIGTERM');
  process.once('SIGINT', onInt); process.once('SIGTERM', onTerm);
  try {
    const result = await superviseLocalProcess({command: 'npm', args: plans[index][1], cwd: root,
      env: process.env, signal: controller.signal});
    assert.equal(result.stopped, false);
    console.log(JSON.stringify({uriCompatibilityStep: plans[index][0], commandSucceeded: true, groupExitVerified: result.groupExitVerified}));
  } catch (error) {
    console.log(JSON.stringify({uriCompatibilityStep: plans[index][0], commandSucceeded: false,
      groupExitVerified: error.groupExitVerified === true}));
    throw error;
  } finally {process.removeListener('SIGINT', onInt); process.removeListener('SIGTERM', onTerm);}
} else {
  assert(process.argv.length === 2 || process.argv.length === 3 && process.argv[2] === 'remaining');
  const remaining = process.argv[2] === 'remaining';
  const folder = resolve(root, 'docs/release/evidence/uri-security-2026-11-02', remaining ? 'compatibility-followup' : 'compatibility');
  assert(!existsSync(folder), 'Compatibility outcomes cannot be overwritten'); mkdirSync(folder);
  const config = mkdtempSync(resolve(tmpdir(), 'sgm-uri-compat-'));
  const ports = [4400, 4500, 5001, 8080, 9000, 9099, 9150, 9199];
  const env = Object.fromEntries(['PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'JAVA_HOME']
    .filter(key => process.env[key]).map(key => [key, process.env[key]]));
  Object.assign(env, {CI: 'true', FIREBASE_CLI_DISABLE_USAGE_REPORTING: 'true',
    XDG_CONFIG_HOME: resolve(config, 'cli'), GOOGLE_APPLICATION_CREDENTIALS: resolve(config, 'no-cloud-credentials.json')});
  const write = (name, value) => writeFileSync(resolve(folder, name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
  let completed = false;
  const outcomes = [], selected = [...plans.entries()].filter(([index]) => !remaining || index >= 4);
  const outputs = Object.fromEntries(selected.filter(([index]) => index >= 4)
    .map(([, [name]]) => [name, resolve(folder, name + '-results.json')]));
  for (const path of Object.values(outputs)) assert(!existsSync(path) && !existsSync(path + '.artifacts'));
  try {
    write('endpoints-before.json', await assertLocalEndpointsClosed(ports));
    for (const [index, [name]] of selected) {
      const path = resolve(folder, name + '.txt'), fd = openSync(path, 'wx', 0o600);
      let result;
      try {
        result = spawnSync(process.execPath, [import.meta.filename, 'step', String(index)],
          {cwd: root, env: {...env, ...(outputs[name] ? {SGM_LOCAL_FLOW_OUTPUT: outputs[name]} : {})},
            stdio: ['ignore', fd, fd], timeout: 600_000, killSignal: 'SIGTERM'});
      } finally {closeSync(fd);}
      const text = readFileSync(path, 'utf8').replaceAll(root, '<repo>').replaceAll(config, '<compat-runtime>')
        .replace(/AIza[\w-]{20,}|Bearer\s+[\w.~+/-]+=*|eyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[REDACTED]');
      writeFileSync(path, text);
      const line = text.split('\n').find(row => row.startsWith('{"uriCompatibilityStep":'));
      const checkpoint = line ? JSON.parse(line) : null;
      const endpoints = await assertLocalEndpointsClosed(ports);
      const outcome = {name, status: result.status, signal: result.signal, errorCode: result.error?.code ?? null,
        groupExitVerified: checkpoint?.groupExitVerified === true, endpoints};
      outcomes.push(outcome); write(name + '-outcome.json', outcome); console.log(JSON.stringify(outcome));
      assert.ifError(result.error); assert.equal(result.status, 0); assert.equal(result.signal, null);
      assert.equal(outcome.groupExitVerified, true);
    }
    write('complete.json', {scope: 'local-build-and-business-compatibility-not-provider-or-physical-release',
      completed: true, outcomes, productionDeployed: false, releaseAccepted: false});
    completed = true;
  } finally {
    const endpoints = await assertLocalEndpointsClosed(ports);
    const groupsStopped = outcomes.every(row => row.groupExitVerified);
    if (groupsStopped) rmSync(config, {recursive: true});
    write('disposal.json', {endpoints, privateConfigurationRemoved: groupsStopped && !existsSync(config),
      groupsStopped, completed});
  }
}
