import assert from 'node:assert/strict';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {prepareLocalRuntime, runEmulatorEntry} from './local-runtime.mjs';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';

const output = process.env.SGM_LOCAL_FLOW_OUTPUT;
assert(isAbsolute(output ?? '') && !existsSync(output), 'Use a fresh absolute receipt path');
const baselineCommit = process.argv[2] ?? null;
assert(process.argv.length <= 3);
if (baselineCommit) assert.match(baselineCommit, /^[a-f0-9]{40}$/);
const runtime = prepareLocalRuntime(), ports = [9099, 8080, 9000, 5001];
const reportPath = resolve(runtime.temp, 'review-history.json');
const sourcePath = 'functions/src/callables/inbox.ts';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
let report, failure, endpoints, execution, destroyed = false;
try {
  await assertLocalEndpointsClosed(ports);
  const modulePath = resolve(runtime.temp, 'functions/lib/callables/inbox.js');
  const source = baselineCommit
    ? execFileSync('git', ['show', `${baselineCommit}:${sourcePath}`], {cwd: resolve(import.meta.dirname, '../..')})
    : readFileSync(resolve(import.meta.dirname, '../..', sourcePath));
  if (baselineCommit) {
    const compiled = ts.transpileModule(source.toString(), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}});
    assert(!compiled.diagnostics?.length);
    writeFileSync(modulePath, compiled.outputText);
  }
  execution = {baselineCommit, inboxSourceSha256: sha(source), inboxModuleSha256: sha(readFileSync(modulePath))};
  runtime.env.SGM_LOCAL_FLOW_OUTPUT = reportPath;
  runtime.env.SGM_LOCAL_UI_SESSION_FILE = resolve(runtime.temp, 'session.json');
  runEmulatorEntry(runtime, 'local-review-history.mjs');
  report = JSON.parse(readFileSync(reportPath));
  assert.equal(report.runId, runtime.env.SGM_LOCAL_RUN_ID);
  assert.equal(report.completed, true); assert(report.steps.length >= 6);
  assert.equal(report.adminClientClosed, true); assert.equal(report.firestoreClientTerminated, true);
} catch (error) {
  failure = error;
  if (!report && existsSync(reportPath)) report = JSON.parse(readFileSync(reportPath));
} finally {
  try {runtime.cleanup(); destroyed = !existsSync(runtime.temp); assert(destroyed); endpoints = await assertLocalEndpointsClosed(ports);}
  catch (error) {failure = failure ? new AggregateError([failure, error], 'Trial and disposal failed') : error;}
}
if (report) writeFileSync(output, JSON.stringify({...report, execution, completed: report.completed && !failure,
  isolatedEnvironmentDestroyed: destroyed, emulatorEndpoints: endpoints ?? null}, null, 2) + '\n', {flag: 'wx'});
if (failure) throw failure;
