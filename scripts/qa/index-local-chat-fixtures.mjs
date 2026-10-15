import assert from 'node:assert/strict';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { configureLocalEmulators } from './local-emulator-config.mjs';

export async function indexLocalChatFixtures() {
  const config = configureLocalEmulators();
  assert.equal(config.projectId, 'demo-sgm-local-qa');
  if (getApps().length === 0) initializeApp({ projectId: config.projectId, databaseURL: config.databaseURL });
  const { prepareChatInbox } = await import('../../functions/lib/lib/prepareChatInbox.js');
  const messages = await getFirestore().collection('messages').get();
  const targets = new Map();
  for (const message of messages.docs) {
    const value = message.data();
    for (const uid of value.participantUserIds) {
      const source = { sourceType: value.sourceType, sourceId: value.sourceId };
      targets.set(JSON.stringify([uid, source]), { uid, source });
    }
  }
  for (const { uid, source } of targets.values()) await prepareChatInbox(uid, source, true);
}
