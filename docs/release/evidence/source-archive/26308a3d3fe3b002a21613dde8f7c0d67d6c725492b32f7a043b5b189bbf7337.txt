import assert from 'node:assert/strict';

const errnoNames = new Map([
  ['Connection reset by peer', 'connection-reset'], ['Broken pipe', 'broken-pipe'],
  ['Bad file descriptor', 'bad-file-descriptor'], ['Connection timed out', 'connection-timed-out'],
  ['No such device', 'no-such-device'], ['Success', 'reported-success'],
]);
const scope = 'allowlisted-adb-daemon-transport-events-not-disconnect-cause';
const prefix = /^(\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+[VDIWEF]\s+adb\s*:\s+(transport(?:_fd|_local)?\.cpp):\d+\s+(.+)$/;

function classify(message) {
  const event = /^emulator-(\d{4,5}): (connection terminated: (read failed|write failed)|read failed(?:: ([^\r\n]*))?)$/.exec(message);
  if (event) {
    const port = Number(event[1]); if (port < 5554 || port > 5584 || port % 2) return null;
    return { emulatorPort: port, kind: event[3] ? 'connection-terminated-' + event[3].replace(' ', '-') : 'transport-read-failed',
      errno: event[3] ? null : event[4] ? errnoNames.get(event[4]) ?? 'unclassified' : 'not-reported' };
  }
  const kicked = /^kicking transport (?:0x)?[a-fA-F0-9]+ emulator-(\d{4,5})$/.exec(message);
  if (kicked) {
    const port = Number(kicked[1]);
    if (port >= 5554 && port <= 5584 && port % 2 === 0) return { emulatorPort: port, kind: 'transport-kicked', errno: null };
  }
  return null;
}

export function summarizeAdbDaemonEvents(tail, selectedPids = null) {
  assert(selectedPids === null || Array.isArray(selectedPids) && selectedPids.length <= 16 &&
    selectedPids.every(pid => Number.isSafeInteger(pid) && pid > 0));
  const result = { scope, available: tail !== null, rawLogsRetained: false, sourceTailLimitBytes: 65536,
    selectedPids, eventLimit: 64, matchedEventCount: 0, droppedEventCount: 0,
    unselectedPidLineCount: 0, unclassifiedTransportLineCount: 0, events: [] };
  if (tail === null) return result;
  assert(typeof tail === 'string' && tail.length <= 65536, 'Only the bounded owned-daemon log tail is accepted');
  for (const line of tail.split('\n')) {
    const match = prefix.exec(line); if (!match) continue;
    const [month, day, hour, minute, second] = match[1].split(/[- :.]/).map(Number);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) continue;
    const pid = Number(match[2]), tid = Number(match[3]);
    if (!Number.isSafeInteger(pid) || pid <= 0 || !Number.isSafeInteger(tid) || tid <= 0) continue;
    if (selectedPids !== null && !selectedPids.includes(pid)) { result.unselectedPidLineCount++; continue; }
    const event = classify(match[5]);
    if (!event) { result.unclassifiedTransportLineCount++; continue; }
    result.matchedEventCount++;
    result.events.push({ timestampLocal: match[1], pid, tid, source: match[4], ...event });
    if (result.events.length > result.eventLimit) { result.events.shift(); result.droppedEventCount++; }
  }
  return result;
}
