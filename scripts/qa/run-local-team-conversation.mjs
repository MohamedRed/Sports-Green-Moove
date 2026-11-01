import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';
import { assertLocalEndpointsClosed } from './local-emulator-lifecycle.mjs';
import {createHash} from 'node:crypto';
import {teamPushRegistrationSources} from './team-push-registration-sources.mjs';
import {teamPushAlertSources} from './team-push-alert-sources.mjs';
import {teamPushDispatchSources} from './team-push-dispatch-sources.mjs';

const output = process.env.SGM_LOCAL_FLOW_OUTPUT;
const mode = process.argv[2];
const suites = new Map([[undefined,'local-team-conversation-suite.mjs'],['--directory','local-team-chat-options-suite.mjs'],
  ['--reads','local-team-read-suite.mjs'],['--alerts','local-team-alert-suite.mjs'],['--inbox-alerts','local-notification-inbox-suite.mjs'],
  ['--push-registration','local-team-push-registration-suite.mjs'],['--push-alert','local-team-push-alert-suite.mjs'],
  ['--push-dispatch','local-team-push-dispatch-suite.mjs']]);
assert(suites.has(mode), 'Select a supported team conversation or notification suite');
assert(isAbsolute(output ?? '') && !existsSync(output), 'A fresh absolute output path is required');
const sources=mode==='--push-dispatch'?teamPushDispatchSources:mode==='--push-alert'?teamPushAlertSources:teamPushRegistrationSources;
const hashSources=()=>Object.fromEntries(sources.map(file=>[file,
  createHash('sha256').update(readFileSync(resolve(import.meta.dirname,'../..',file))).digest('hex')]));
const registrationSources=['--push-registration','--push-alert','--push-dispatch'].includes(mode)?hashSources():null;
const runtime = prepareLocalRuntime(), ports = [9099, 8080, 9000, 5001];
let report, failure, endpoints;
try {
  await assertLocalEndpointsClosed(ports);
  runtime.env.SGM_LOCAL_UI_SESSION_FILE = resolve(runtime.temp, 'session.json');
  runtime.env.SGM_LOCAL_FLOW_OUTPUT = resolve(runtime.temp, 'team-conversation-results.json');
  runEmulatorEntry(runtime, suites.get(mode));
  report = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT));
  assert.equal(report.runId, runtime.env.SGM_LOCAL_RUN_ID);
  assert.equal(mode ? report.isolation.protectedBaselinePreserved : report.protectedBaselinePreserved, true);
  if (['--reads','--alerts','--inbox-alerts','--push-registration','--push-alert','--push-dispatch'].includes(mode)) assert.equal(report.completed, true);
  assert.equal(report.adminClientClosed, true);
  if(['--push-alert','--push-dispatch'].includes(mode))assert.equal(report.firestoreClientTerminated,true);
  if(registrationSources){assert.deepEqual(report.sourceFiles,registrationSources);assert.deepEqual(hashSources(),registrationSources);}
} catch (error) { failure = error; }
finally {
  try { runtime.cleanup(); assert(!existsSync(runtime.temp)); endpoints = await assertLocalEndpointsClosed(ports); }
  catch (error) { failure = failure ? new AggregateError([failure, error], 'Trial and disposal failed') : error; }
}
if (failure) throw failure;
writeFileSync(output, JSON.stringify({ ...report, isolatedEnvironmentDestroyed: true,
  emulatorEndpoints: endpoints }, null, 2) + '\n', { flag: 'wx' });
