import assert from 'node:assert/strict';
import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function summarizeTransferTrace(value) {
  assert(typeof value === 'string' && Buffer.byteLength(value) <= 4 * 1024 * 1024);
  const counts = { messageReadEnded: 0, payloadReadEnded: 0, readOverflow: 0,
    badHeader: 0, writeEnded: 0, transportReadFailed: 0, transportWriteFailed: 0 };
  for (const line of value.split('\n')) {
    const match = /^\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\s+\d+\s+\d+\s+[VDIWEF]\s+adb\s*:\s+transport\.cpp:\d+\s+(.+)$/.exec(line);
    if (!match) continue;
    const message = match[1];
    if (message === 'remote local: read terminated (message)') counts.messageReadEnded++;
    if (message === 'remote local: terminated (data)') counts.payloadReadEnded++;
    if (/^remote local: read overflow \(data length = \d{1,10}\)$/.test(message)) counts.readOverflow++;
    if (/^emulator-\d{4,5}: remote read: bad header$/.test(message)) counts.badHeader++;
    if (message === 'remote local: write terminated') counts.writeEnded++;
    if (/^emulator-\d{4,5}: connection terminated: read failed$/.test(message)) counts.transportReadFailed++;
    if (/^emulator-\d{4,5}: connection terminated: write failed$/.test(message)) counts.transportWriteFailed++;
  }
  return { scope: 'bounded-host-transport-error-counts-not-root-cause', rawLogsRetained: false, counts };
}

export function readTransferTrace() {
  let fd;
  try {
    fd = openSync(join(tmpdir(), `adb.${process.getuid()}.log`), constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(fd);
    assert(stat.isFile() && stat.uid === process.getuid());
    const buffer = Buffer.alloc(Math.min(stat.size, 4 * 1024 * 1024));
    const length = readSync(fd, buffer, 0, buffer.length, Math.max(0, stat.size - buffer.length));
    return { available: true, tailClipped: stat.size > buffer.length,
      ...summarizeTransferTrace(buffer.subarray(0, length).toString('utf8')) };
  } catch {
    return { available: false, rawLogsRetained: false, counts: null };
  } finally { if (fd !== undefined) closeSync(fd); }
}
