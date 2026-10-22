import { closeSync, constants, openSync, readSync } from 'node:fs';
import { assertPrivatePipe } from './read-private-credential-pipe.mjs';

export function capturePrivateStartupLog(pipe, consume, onError) {
  assertPrivatePipe(pipe);
  const fd = openSync(pipe, constants.O_RDWR | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  const buffer = Buffer.alloc(1024);
  let closed = false, failure;
  const drain = () => {
    for (let count = 0; count < 16; count++) {
      let length;
      try { length = readSync(fd, buffer, 0, buffer.length, null); }
      catch (error) { if (error.code === 'EAGAIN') return; throw error; }
      if (!length) return;
      try { consume(buffer.subarray(0, length)); }
      finally { buffer.fill(0); }
    }
  };
  const timer = setInterval(() => {
    try { drain(); }
    catch {
      failure = new Error('Private startup diagnostic transfer failed');
      clearInterval(timer); onError(failure);
    }
  }, 25);
  timer.unref();
  return {
    close() {
      if (closed) return;
      closed = true; clearInterval(timer);
      try { if (failure) throw failure; drain(); }
      finally { buffer.fill(0); closeSync(fd); }
    },
  };
}
