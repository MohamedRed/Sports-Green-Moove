const storeProcess = /^com\.android\.vending(?::[A-Za-z0-9_.-]+)?$/;

export function parseStoreProcessEvents(output) {
  if (typeof output !== 'string' || output.length > 65_536) throw new Error('Invalid bounded process-event output');
  const events = [];
  for (const line of output.split('\n')) {
    const match = line.match(/^\s*(\d{10}\.\d{3,6})\s+\d+\s+\d+\s+I\s+(am_proc_start|am_proc_died)\s*:\s*\[([^\[\]]+)\]\s*$/);
    if (!match) continue;
    const values = match[3].split(',').map((value) => value.trim());
    const start = match[2] === 'am_proc_start', processIndex = start ? 3 : 2;
    if (!storeProcess.test(values[processIndex] ?? '') || values[0] !== '0' ||
        !/^\d+$/.test(values[1] ?? '') || start && !/^\d+$/.test(values[2] ?? '')) continue;
    const event = { epochSeconds: Number(match[1]), event: match[2], userId: 0,
      pid: Number(values[1]), processName: values[processIndex] };
    // Retain only public process metadata, never the free-form hosting component or trailing fields.
    if (start && /^[A-Za-z][A-Za-z0-9_.-]{0,39}$/.test(values[4] ?? '')) event.hostingType = values[4];
    events.push(event);
  }
  return events.slice(-30);
}

export function readStoreProcessDiagnostics(shell) {
  try {
    const events = parseStoreProcessEvents(shell('logcat', '-b', 'events', '-d', '-v', 'epoch', '-t', '100',
      '-s', 'am_proc_start:I', 'am_proc_died:I'));
    return { status: 'observed', scope: 'bounded-public-store-process-events-not-restart-cause-proof', events };
  } catch {
    return { status: 'unavailable', scope: 'bounded-public-store-process-events-not-restart-cause-proof', events: [] };
  }
}
