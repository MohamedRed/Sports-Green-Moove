import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [mode, readyPath] = process.argv.slice(2);
if (mode === 'success') process.exit(0);
if (mode === 'failure') process.exit(7);
if (mode === 'worker') {
  const keep = setInterval(() => {}, 1_000);
  const stop = () => { clearInterval(keep); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  process.send({ ready: true, pid: process.pid });
} else {
  const worker = spawn(process.execPath, [fileURLToPath(import.meta.url), 'worker'], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  worker.once('message', ({ pid }) => {
    writeFileSync(readyPath, JSON.stringify({ launcher: process.pid, worker: pid }));
    if (mode === 'orphan') { worker.unref(); worker.disconnect(); process.exit(0); }
  });
  const stop = () => {
    const code = mode === 'failure-on-stop' ? 7 : 0;
    if (worker.exitCode !== null) process.exit(code);
    else worker.once('exit', () => process.exit(code));
  };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
