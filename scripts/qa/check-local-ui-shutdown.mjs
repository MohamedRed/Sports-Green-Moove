import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '../..'), ports = [5001, 8080, 9000, 9099];
const output = process.env.SGM_LOCAL_FLOW_OUTPUT;
assert(output && isAbsolute(output) && !existsSync(output), 'Choose a fresh absolute shutdown evidence file');
async function requireRefused(port) {
  await new Promise((resolveClosed, reject) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.setTimeout(2_000);
    socket.once('connect', () => { socket.destroy(); reject(new Error('Isolated service port remains occupied: ' + port)); });
    socket.once('timeout', () => { socket.destroy(); reject(new Error('Service-port state is unverified: ' + port)); });
    socket.once('error', (error) => { socket.destroy(); if (error.code === 'ECONNREFUSED') resolveClosed(); else reject(error); });
  });
}
const directory = mkdtempSync(resolve(tmpdir(), 'sgm-shutdown-check-')), checks = [];
try {
  for (const stopSignal of ['SIGINT', 'SIGTERM']) {
    for (const port of ports) await requireRefused(port);
    const session = resolve(directory, stopSignal + '.json');
    const env = Object.fromEntries(['PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'JAVA_HOME', 'ANDROID_HOME', 'ANDROID_SDK_ROOT']
      .filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
    env.SGM_LOCAL_UI_SESSION_FILE = session;
    const child = spawn(process.execPath, [resolve(root, 'scripts/qa/start-local-ui.mjs')], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const stoppingEvents = [], diagnosticLines = [];
    let metadata;
    const observe = (line) => {
      diagnosticLines.push(line); if (diagnosticLines.length > 150) diagnosticLines.shift();
      const service = line.match(/Stopping (Functions|Database|Firestore|Authentication) Emulator/);
      if (service) stoppingEvents.push(service[1]);
    };
    const logs = [child.stdout, child.stderr].map((input) => createInterface({ input }));
    for (const log of logs) log.on('line', observe);
    const closed = once(child, 'close', { signal: AbortSignal.timeout(210_000) });
    try {
      const deadline = Date.now() + 180_000;
      while (!existsSync(session)) {
        assert(child.exitCode === null && child.signalCode === null, 'Local UI session exited before readiness');
        assert(Date.now() < deadline, 'Local UI session did not become ready'); await delay(100);
      }
      assert.equal(statSync(session).mode & 0o077, 0);
      metadata = JSON.parse(readFileSync(session)); assert.equal(metadata.projectId, 'demo-sgm-local-qa');
      assert.match(metadata.runId, /^[a-f0-9]{32}$/);
      assert(child.kill(stopSignal), 'The live owned supervisor must receive the requested signal');
      const [code, signal] = await closed;
      assert.equal(code, stopSignal === 'SIGINT' ? 130 : 143); assert.equal(signal, null);
      assert(!existsSync(session), 'Private fixture credentials must be removed by normal shutdown');
      assert.throws(() => process.kill(child.pid, 0), { code: 'ESRCH' });
      for (const port of ports) await requireRefused(port);
      for (const service of ['Functions', 'Database', 'Firestore', 'Authentication']) assert(stoppingEvents.includes(service), service);
      checks.push({ signal: stopSignal, runId: metadata.runId, exitCode: code, supervisorExitedAfterCleanup: true,
        privateSessionFileRemoved: true, loopbackPortsRefused: ports, servicesStopped: [...new Set(stoppingEvents)].sort() });
    } catch (error) {
      let diagnostic = diagnosticLines.join('\n');
      if (metadata?.password) diagnostic = diagnostic.replaceAll(metadata.password, '[REDACTED]');
      diagnostic = diagnostic.replace(/AIza[\w-]{20,}|Bearer\s+[\w.~+/-]+=*|eyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[REDACTED]');
      console.error(`Original ${stopSignal} supervisor diagnostics (outcome unchanged):\n${diagnostic}`);
      throw error;
    } finally {
      if (child.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); await closed; }
      for (const log of logs) log.close();
    }
  }
} finally { rmSync(directory, { recursive: true, force: true }); }
const files = ['scripts/qa/start-local-ui.mjs', 'scripts/qa/local-runtime.mjs', 'scripts/qa/supervised-local-process.mjs',
  'scripts/qa/check-local-ui-shutdown.mjs', 'scripts/qa/local-entry-command.mjs', 'scripts/qa/local-ui-session.mjs'];
writeFileSync(output, JSON.stringify({ scope: 'actual-isolated-service-shutdown-not-phone-or-release-proof',
  testedAt: new Date().toISOString(), completed: true, checks, productionWrites: false,
  sourceFiles: Object.fromEntries(files.map((file) => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')])) }, null, 2) + '\n',
{ mode: 0o600, flag: 'wx' });
console.log('Both actual isolated-service signals completed cleanup without manual process/file removal.');
