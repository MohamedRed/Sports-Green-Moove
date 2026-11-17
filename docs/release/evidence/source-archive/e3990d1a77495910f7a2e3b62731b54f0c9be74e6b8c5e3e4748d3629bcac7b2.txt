import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deleteApp, getApp } from 'firebase-admin/app';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { call, denied } from './local-flow-client.mjs';
import { prepareTeamChatUiFixture, verifyTeamChatProtectedBaseline } from './team-conversation-ui-fixture.mjs';

await seedLocalUiFixtures();
let isolation; const steps = [], passed = id => steps.push({ id, status: 'passed' });
try {
  const f = await prepareTeamChatUiFixture();
  async function teams(actor) {
    let cursor, first, pages = 0; const rows = [], seen = new Set();
    do {
      const page = await call('listTeamChatOptions', actor, { kind: 'teams', clubId: f.clubId, ...(cursor ? { cursor } : {}) });
      assert.equal(page.currentUserId, actor.uid); assert.equal(page.clubId, f.clubId); assert.equal(page.kind, 'teams');
      assert(page.items.length <= 5); assert(!seen.has(page.nextCursor) || page.nextCursor === null);
      if (pages === 0) first = page;
      rows.push(...page.items); cursor = page.nextCursor; if (cursor) seen.add(cursor);
      assert(++pages < 30);
    } while (cursor);
    assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
    return { rows, first, pages };
  }
  const parent = await teams(f.parent);
  assert.deepEqual(parent.first.items, []); assert(parent.first.nextCursor); assert(parent.pages >= 2);
  assert.deepEqual(parent.rows.map(row => row.id), [f.teamId]);
  assert.equal(parent.rows[0].teamInstanceId, f.target.expectedTeamInstanceId);
  passed('empty-scanned-page-retains-cursor-and-only-approved-team-is-discoverable');
  assert.deepEqual((await teams(f.otherParent)).rows, parent.rows);
  passed('second-verified-parent-discovers-child-team-without-own-enrollment');
  for (const actor of [f.unrelated, f.manager]) assert.deepEqual((await teams(actor)).rows, []);
  passed('unrelated-club-member-and-unenrolled-manager-cannot-discover-team-chat');
  await denied('listTeamChatOptions', null, { kind: 'clubs' }, 'UNAUTHENTICATED');
  await denied('listTeamChatOptions', f.parent, { kind: 'teams', clubId: 'foreign-club' }, 'PERMISSION_DENIED');
  await denied('listTeamChatOptions', f.otherParent, { kind: 'teams', clubId: f.clubId, cursor: parent.first.nextCursor }, 'PERMISSION_DENIED');
  passed('anonymous-foreign-club-and-cross-account-cursor-are-denied');
  const page = await call('getTeamChatMessages', f.parent, f.target);
  assert.equal(page.items.length, 1); assert.equal(page.items[0].id, f.initialMessageId);
  assert.equal(page.items[0].authorName, 'Hermes Driver QA'); assert.match(page.items[0].requestId, /^[a-f0-9-]{36}$/);
  assert.match(page.accessVersion, /^[a-f0-9]{64}$/);
  passed('native-page-contract-exposes-author-request-identity-and-current-access-version');
  await call('transitionGuardianVerification', f.manager, { clubId: f.clubId, childId: f.childId, parentUserId: f.parent.uid,
    action: 'revoke', expectedRevision: 2, requestId: 'a1234567-1234-4234-8234-123456789abc' });
  assert.deepEqual((await teams(f.parent)).rows, []); assert.deepEqual((await teams(f.otherParent)).rows, parent.rows);
  passed('revocation-removes-directory-entry-without-removing-another-verified-parent');
  isolation = await verifyTeamChatProtectedBaseline(f);
} finally { await deleteApp(getApp()); }
const paths = ['scripts/qa/team-conversation-ui-fixture.mjs', 'scripts/qa/local-team-chat-options-suite.mjs',
  'functions/src/services/teamConversationOptions.ts', 'functions/src/services/teamConversationAuthority.ts',
  'functions/src/services/teamConversation.ts', 'functions/src/callables/teamConversation.ts'];
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({ projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
  testedAt: new Date().toISOString(), scope: 'local-team-chat-directory-services-not-native-ui', steps, isolation,
  nativeUiExecuted: false, physicalDevice: false, productionWrites: false, notificationsVerified: false, adminClientClosed: true,
  sourceFiles: Object.fromEntries(paths.map(file => [file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))
}, null, 2) + '\n', { flag: 'wx' });
