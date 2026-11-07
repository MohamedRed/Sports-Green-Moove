import assert from 'node:assert/strict';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';

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

export function requireOrdinaryInstrumentation(result, transcript, observeFailure) {
  try {
    assert.equal(result.status, 0, 'Ordinary instrumentation command failed');
    assert.equal(result.signal, null); assert(!result.error);
    return parseAndroidJUnitTranscript(transcript);
  } catch (failure) {
    try { observeFailure(failure); }
    catch { console.warn('Partial capture observations unavailable; original instrumentation failure preserved.'); }
    throw failure;
  }
}
