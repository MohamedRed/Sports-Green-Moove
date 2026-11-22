import {observeNetworkStartupLogging} from './network-startup-logging.mjs';

const controller = new AbortController();
const interrupt = () => controller.abort(), terminate = () => controller.abort();
process.once('SIGINT', interrupt); process.once('SIGTERM', terminate);
try {
  const result = await observeNetworkStartupLogging(process.argv[2], process.env, {signal: controller.signal});
  console.log(JSON.stringify({scope: result.scope, runId: result.runId, completed: result.completed,
    restored: result.restored, failed: result.failed, flowExecuted: false}));
  if (result.failed) process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate);
}
