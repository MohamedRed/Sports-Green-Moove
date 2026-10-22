import { runScopedLocalBinary } from './scoped-browserstack-local.mjs';
import { readPrivateCredentialPipe } from './read-private-credential-pipe.mjs';

const [binary, pipe, configPipe] = process.argv.slice(2), controller = new AbortController();
const startupDiagnostic = process.argv[5] === '--startup-diagnostic-approved';
const logPipe = startupDiagnostic ? process.argv[6] : undefined;
const interrupt = () => controller.abort('SIGINT'), terminate = () => controller.abort('SIGTERM');
process.once('SIGINT', interrupt); process.once('SIGTERM', terminate);
let phase = 'private-input';
try {
  const timeout = setTimeout(() => controller.abort('SIGTERM'), 180_000);
  let accessKey;
  try { accessKey = await readPrivateCredentialPipe(pipe, controller.signal); }
  finally { clearTimeout(timeout); }
  phase = 'vendor-launch';
  const pending = runScopedLocalBinary(binary, accessKey, { signal: controller.signal, env: process.env, configPipe, logPipe, startupDiagnostic,
    onSpawn: pid => console.log(JSON.stringify({ scope: 'scoped-helper-process-not-connection-proof', pid,
      credentialInArguments: false, credentialInEnvironment: false, dashboardDisabled: true })) });
  accessKey = '';
  const result = await pending;
  if (result.stopped) process.exitCode = controller.signal.reason === 'SIGINT' ? 130 : 143;
} catch (error) {
  const code = ['ERR_ASSERTION', 'EPIPE', 'ENOENT', 'ABORT_ERR'].includes(error?.code) ? error.code : 'UNCONFIRMED';
  console.error(`Scoped helper stopped during ${phase} (${code}). No credential diagnostics are emitted.`);
  if (error?.vendorOutcome) console.error(JSON.stringify({scope: 'classified-vendor-exit-not-connection-proof', ...error.vendorOutcome}));
  process.exitCode = controller.signal.aborted ? (controller.signal.reason === 'SIGINT' ? 130 : 143) : 1;
} finally {
  process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate);
}
