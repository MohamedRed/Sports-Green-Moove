import assert from 'node:assert/strict';

const spawnCodes = new Set(['ETIMEDOUT', 'ENOBUFS', 'ENOENT', 'EACCES', 'EINVAL',
  'EAGAIN', 'EMFILE', 'ENFILE', 'EIO', 'ENOMEM']);

export function ordinaryProcessObservation(result, {elapsedMs, stderr}) {
  assert(Number.isSafeInteger(elapsedMs) && elapsedMs >= 0);
  assert.equal(typeof stderr, 'string');
  return {
    scope: 'single-ordinary-instrumentation-command-not-flow-proof',
    status: result.status,
    signal: result.signal,
    errorCode: result.error ? spawnCodes.has(result.error.code) ? result.error.code : 'UNCLASSIFIED_PROCESS_ERROR' : null,
    elapsedMs,
    stderr,
  };
}
