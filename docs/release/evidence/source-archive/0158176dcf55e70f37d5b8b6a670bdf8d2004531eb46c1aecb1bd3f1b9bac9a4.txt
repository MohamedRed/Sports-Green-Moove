import assert from 'node:assert/strict';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {prepareLocalRuntime, root} from './local-runtime.mjs';
import {localEntryCommand} from './local-entry-command.mjs';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';

const output = process.env.SGM_LOCAL_FLOW_OUTPUT;
assert(output && isAbsolute(output) && !existsSync(output), 'A fresh absolute result path is required');
const ports = [9099, 8080, 9000, 5001, 9199];
await assertLocalEndpointsClosed(ports);
const runtime = prepareLocalRuntime();
let failure, ownedEnvironmentDestroyed = false, endpoints;
try {
  const path = resolve(runtime.temp, 'firebase.json'), config = JSON.parse(readFileSync(path, 'utf8'));
  config.storage = {rules: resolve(root, 'storage.rules')};
  config.emulators.storage = {host: '127.0.0.1', port: 9199};
  writeFileSync(path, JSON.stringify(config)); runtime.emulatorsPrepared = true;
  runtime.run(process.execPath, [resolve(root, 'node_modules/firebase-tools/lib/bin/firebase.js'), 'emulators:exec',
    '--project', 'demo-sgm-local-qa', '--config', path, '--only', 'firestore,database,storage',
    localEntryCommand(process.execPath, resolve(root, 'scripts/qa/chat-source-rules-entry.mjs'))], runtime.temp);
} catch (error) {failure = error;}
finally {
  try {runtime.cleanup(); ownedEnvironmentDestroyed = !existsSync(runtime.temp); assert(ownedEnvironmentDestroyed);
    endpoints = await assertLocalEndpointsClosed(ports);
  } catch (error) {failure = failure ? new AggregateError([failure, error]) : error;}
  writeFileSync(output + '.cleanup.json', JSON.stringify({completed: !failure, ownedEnvironmentDestroyed,
    endpoints: endpoints ?? null, realProvidersUsed: false}, null, 2) + '\n', {flag: 'wx'});
}
if (failure) throw failure;
