import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {appendFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sampleProofResources} from './ci-proof-resources.mjs';

export const chatProofCommands = [
  ['scripts/diagnostics/chat-proof-media-probe.mjs'],
  ['--test', 'tests/chat-receipt-loss-proxy.test.mjs', 'tests/chat-receipt-loss-checkpoints.test.mjs',
    'tests/chat-receipt-loss-phone.test.mjs'],
];
export async function runChatProofDiagnostic(output, {root = resolve(import.meta.dirname, '../..'),
  launch = spawn, sample = sampleProofResources, intervalMs = 500} = {}) {
  assert(isAbsolute(output)); mkdirSync(output);
  const result = {scope: 'clean-runner-chat-proof-diagnostic-not-primary-smoke-or-release',
    node: process.version, platform: process.platform, phases: [], cancellationSignal: null,
    primaryGateAccepted: false, physicalFlowAccepted: false, rootCauseProven: false, releaseAccepted: false};
  let child, samples = 0;
  const observe = () => {
    if (samples++ < 600) appendFileSync(resolve(output, 'resources.jsonl'), JSON.stringify(sample()) + '\n');
  };
  const cancel = signal => {
    result.cancellationSignal = signal;
    writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    if (child) child.kill(signal);
  };
  const term = () => cancel('SIGTERM'), interrupt = () => cancel('SIGINT');
  process.once('SIGTERM', term); process.once('SIGINT', interrupt);
  const timer = setInterval(observe, intervalMs); timer.unref();
  try {
    observe();
    for (const [index, args] of chatProofCommands.entries()) {
      if (result.cancellationSignal) break;
      const phase = {id: index === 0 ? 'media-pixels' : 'unchanged-chat-tests', args,
        startedAt: new Date().toISOString(), status: null, signal: null, launchFailed: false};
      result.phases.push(phase);
      writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
      console.log('Chat proof diagnostic phase: ' + phase.id);
      await new Promise(resolveExit => {
        child = launch(process.execPath, args, {cwd: root, stdio: 'inherit'});
        child.once('error', () => {phase.launchFailed = true; resolveExit();});
        child.once('exit', (status, signal) => {phase.status = status; phase.signal = signal; resolveExit();});
      });
      child = undefined; phase.completedAt = new Date().toISOString(); observe();
      if (phase.status !== 0 || phase.signal || phase.launchFailed) break;
    }
    result.diagnosticPassed = !result.cancellationSignal && result.phases.length === 2 &&
      result.phases.every(phase => phase.status === 0 && !phase.signal && !phase.launchFailed);
    return result;
  } finally {
    clearInterval(timer); process.removeListener('SIGTERM', term); process.removeListener('SIGINT', interrupt);
    observe(); writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await runChatProofDiagnostic(process.env.SGM_CHAT_PROOF_DIAGNOSTIC_DIR ?? '');
  console.log(JSON.stringify(result)); process.exitCode = result.diagnosticPassed ? 0 : 1;
}
