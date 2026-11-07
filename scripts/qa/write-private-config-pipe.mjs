import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { assertPrivatePipe } from './read-private-credential-pipe.mjs';

export async function writePrivateConfigPipe(pipe, config, signal) {
  assertPrivatePipe(pipe);
  let handle;
  try {
    while (!handle) {
      signal.throwIfAborted();
      try { handle = await open(pipe, constants.O_WRONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW); }
      catch (error) { if (error.code !== 'ENXIO') throw error; }
      if (!handle) await delay(25, undefined, { signal });
    }
    signal.throwIfAborted();
    await handle.writeFile(config);
  } finally { await handle?.close(); }
}
