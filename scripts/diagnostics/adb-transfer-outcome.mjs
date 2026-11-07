export function transferCommandOutcome(result) {
  const text = typeof result.stderr === 'string' ? result.stderr : '';
  const outcome = {
    status: Number.isInteger(result.status) ? result.status : null,
    signal: result.signal ?? null,
    errorCode: result.error ? 'COMMAND_ERROR' : null,
    signals: {
      deviceOffline: /\bdevice offline\b/.test(text),
      deviceMissing: /\bdevice '[^'\r\n]+' not found\b/.test(text),
      transportClosed: /\b(?:connection terminated|remote (?:process )?closed|protocol fault|connection reset)\b/i.test(text),
      permissionDenied: /\bpermission denied\b/i.test(text),
      noSpace: /\bno space left on device\b/i.test(text),
      timedOut: result.error?.code === 'ETIMEDOUT',
    },
  };
  const failed = outcome.status !== 0 || outcome.signal !== null || outcome.errorCode !== null;
  return {...outcome, outputCoverage: {present: text.length > 0, byteCount: Buffer.byteLength(text),
    recognizedFailure: failed && Object.values(outcome.signals).some(Boolean),
    unclassifiedFailure: failed && !Object.values(outcome.signals).some(Boolean)}};
}
