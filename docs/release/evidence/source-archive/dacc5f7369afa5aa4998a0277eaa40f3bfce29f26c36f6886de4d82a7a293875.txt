import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';
import { assertLocalEndpointsClosed } from './local-emulator-lifecycle.mjs';

const output = process.env.SGM_LOCAL_FLOW_OUTPUT;
const mode = process.argv[2]; assert(mode === undefined || mode === '--directory' || mode === '--reads', 'Select the message, directory or read suite');
assert(isAbsolute(output ?? '') && !existsSync(output), 'A fresh absolute output path is required');
const runtime = prepareLocalRuntime(), ports = [9099, 8080, 9000, 5001];
let report, failure, endpoints;
try {
  await assertLocalEndpointsClosed(ports);
  runtime.env.SGM_LOCAL_UI_SESSION_FILE = resolve(runtime.temp, 'session.json');
  runtime.env.SGM_LOCAL_FLOW_OUTPUT = resolve(runtime.temp, 'team-conversation-results.json');
  runEmulatorEntry(runtime, mode === '--reads' ? 'local-team-read-suite.mjs' : mode === '--directory' ? 'local-team-chat-options-suite.mjs' : 'local-team-conversation-suite.mjs');
  report = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT));
  assert.equal(report.runId, runtime.env.SGM_LOCAL_RUN_ID);
  assert.equal(mode ? report.isolation.protectedBaselinePreserved : report.protectedBaselinePreserved, true);
  if (mode === '--reads') assert.equal(report.completed, true);
  assert.equal(report.adminClientClosed, true);
} catch (error) { failure = error; }
finally {
  try { runtime.cleanup(); assert(!existsSync(runtime.temp)); endpoints = await assertLocalEndpointsClosed(ports); }
  catch (error) { failure = failure ? new AggregateError([failure, error], 'Trial and disposal failed') : error; }
}
if (failure) throw failure;
writeFileSync(output, JSON.stringify({ ...report, isolatedEnvironmentDestroyed: true,
  emulatorEndpoints: endpoints }, null, 2) + '\n', { flag: 'wx' });
