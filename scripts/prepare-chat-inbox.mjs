import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { initializeApp } from 'firebase-admin/app';
import { parseChatIndexCommand } from './lib/chat-index-command.mjs';

const command = parseChatIndexCommand(process.argv.slice(2));
const moduleUrl = new URL('../functions/lib/lib/prepareChatInbox.js', import.meta.url);
await access(moduleUrl);
if (command.projectId === 'demo-sgm-local-qa') {
  const { configureLocalEmulators } = await import('./qa/local-emulator-config.mjs');
  const config = configureLocalEmulators();
  initializeApp({ projectId: config.projectId, databaseURL: config.databaseURL });
} else {
  for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_DATABASE_EMULATOR_HOST']) {
    assert(!process.env[key], 'Live project indexing refuses emulator configuration');
  }
  for (const key of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'FIREBASE_PROJECT_ID']) {
    assert(!process.env[key] || process.env[key] === command.projectId, 'Project configuration does not match the selected project');
  }
  initializeApp({ projectId: command.projectId });
}
const { prepareChatInbox } = await import(moduleUrl.href);
const result = await prepareChatInbox(command.userId, command.source, command.apply);
console.log(JSON.stringify({ projectId: command.projectId, mode: command.apply ? 'apply' : 'dry-run', ...result }));
