import { assertPreparedChatRestart } from './chat-restart-evidence.mjs';
import { stopDisposableAppProcess } from './local-disposable-process-stop.mjs';

export function stopDisposableChatProcess(adb, serial, runId, outputDir, dependencies) {
  return stopDisposableAppProcess({ adb, serial, runId, outputDir,
    beforeName: 'local-chat-restart-before.json', validateBefore: assertPreparedChatRestart }, dependencies);
}
