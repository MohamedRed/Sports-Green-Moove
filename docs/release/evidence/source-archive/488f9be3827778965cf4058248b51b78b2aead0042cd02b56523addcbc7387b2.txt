import assert from 'node:assert/strict';
import { constants, lstatSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export function assertPrivatePipe(pipe) {
  const info = lstatSync(pipe), parent = lstatSync(resolve(pipe, '..'));
  assert(info.isFIFO() && info.uid === process.getuid() && (info.mode & 0o777) === 0o600);
  assert(parent.isDirectory() && parent.uid === process.getuid() && (parent.mode & 0o777) === 0o700);
}

export async function readPrivateCredentialPipe(pipe, signal) {
  assertPrivatePipe(pipe);
  const handle = await open(pipe, constants.O_RDWR | constants.O_NONBLOCK | constants.O_NOFOLLOW), value = Buffer.alloc(258);
  let length = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      try {
        const { bytesRead } = await handle.read(value, length, value.length - length, null); length += bytesRead;
        assert(length <= 257, 'Private credential input is too long');
        const newline = value.subarray(0, length).indexOf(10);
        if (newline >= 0) {
          assert(newline === length - 1 && newline > 0, 'One private credential line is required');
          return value.subarray(0, newline).toString();
        }
      } catch (error) { if (error.code !== 'EAGAIN') throw error; }
      await delay(25, undefined, { signal });
    }
  } finally { value.fill(0); await handle.close(); }
}
