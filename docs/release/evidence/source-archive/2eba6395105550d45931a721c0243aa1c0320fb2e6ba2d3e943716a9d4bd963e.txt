export function transferCommandOutcome(result) {
  const text = typeof result.stderr === 'string' ? result.stderr : '';
  return {
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
}
