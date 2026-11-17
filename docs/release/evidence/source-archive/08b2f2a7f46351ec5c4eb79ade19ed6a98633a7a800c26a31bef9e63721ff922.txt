import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { FieldValue } from 'firebase-admin/firestore';
import { call, db, denied } from './local-flow-client.mjs';
import { clubId, childId, freshTeam, prepareTeamEnrollmentFixtures, verifyEnrollmentParent } from './local-team-enrollment-fixtures.mjs';
import { guardianVerificationId } from '../../functions/lib/domain/guardianVerification.js';

const { actors: a } = await prepareTeamEnrollmentFixtures(), checks = [];
const check = async (id, run) => { await run(); checks.push({ id, status: 'passed' }); };
const options = (actor, input) => call('listTeamEnrollmentOptions', actor, input);
const clubRef = db.collection('clubs').doc(clubId), membership = db.collection('memberships').doc(`${a.parent.uid}_${clubId}`);
const childRef = db.collection('children').doc(childId), childMembership = db.collection('memberships').doc(`${childId}_${clubId}`);
const team = await freshTeam('options');
const beforeEnrollments = (await db.collection('teamEnrollments').get()).size;
const beforeEvents = (await db.collection('teamEnrollmentEvents').get()).size;
await check('anonymous-child-and-admin-only-accounts-cannot-discover-enrollment-choices', async () => {
  for (const actor of [null, a.child, a.admin]) await denied('listTeamEnrollmentOptions', actor, { kind: 'clubs' }, actor ? 'PERMISSION_DENIED' : 'UNAUTHENTICATED');
});
await check('strict-choice-inputs-never-accept-another-account-or-invent-a-context', async () => {
  for (const input of [{ kind: 'clubs', userId: a.other.uid }, { kind: 'teams' }, { kind: 'children' },
    { kind: 'teams', clubId, teamId: team }, { kind: 'unknown' }, { kind: 'clubs', cursor: '' }])
    await denied('listTeamEnrollmentOptions', a.parent, input, 'INVALID_ARGUMENT');
});
await check('club-choices-use-only-current-canonical-active-memberships', async () => {
  assert.equal((await options(a.parent, { kind: 'clubs' })).items.some((row) => row.id === clubId), true);
  const saved = (await membership.get()).data(); await membership.update({ active: false });
  assert.equal((await options(a.parent, { kind: 'clubs' })).items.some((row) => row.id === clubId), false);
  await membership.set(saved);
  await db.collection('memberships').doc('forged-enrollment-choice').create({ ...saved, clubId: 'enroll-foreign-club' });
  assert(!(await options(a.parent, { kind: 'clubs' })).items.some((row) => row.id === 'enroll-foreign-club'));
});
await check('public-private-and-closed-club-states-are-explicit-for-every-choice-page', async () => {
  const saved = (await clubRef.get()).data();
  for (const status of ['public', 'private', 'archived', 'unknown', FieldValue.delete()]) {
    await clubRef.update({ status }); const open = ['public', 'private'].includes(status);
    assert.equal((await options(a.parent, { kind: 'clubs' })).items.some((row) => row.id === clubId), open);
    if (open) assert((await options(a.parent, { kind: 'teams', clubId })).items.some((row) => row.id === team));
    else await denied('listTeamEnrollmentOptions', a.parent, { kind: 'teams', clubId }, 'PERMISSION_DENIED');
  }
  await clubRef.set(saved);
});
await check('teams-stay-in-the-selected-authorized-club-without-roster-or-claim-grants', async () => {
  const foreign = 'enroll-options-foreign-team'; await db.collection('teams').doc(foreign).create({ clubId: 'enroll-foreign-club', name: 'Autre equipe QA' });
  assert(!(await options(a.parent, { kind: 'teams', clubId })).items.some((row) => row.id === foreign));
  await denied('listTeamEnrollmentOptions', a.parent, { kind: 'teams', clubId: 'enroll-foreign-club' }, 'PERMISSION_DENIED');
  await denied('listTeamEnrollmentOptions', a.unscoped, { kind: 'teams', clubId }, 'PERMISSION_DENIED');
  for (const actor of [a.driver, a.manager]) assert((await options(actor, { kind: 'teams', clubId })).items.some((row) => row.id === team));
});
await check('inactive-teams-are-not-join-choices-and-malformed-state-is-not-assumed-open', async () => {
  const record = db.collection('teams').doc(team), saved = (await record.get()).data();
  for (const patch of [{ active: false }, { status: 'archived' }, { status: 'inactive' }]) {
    await record.set({ ...saved, ...patch }); assert(!(await options(a.parent, { kind: 'teams', clubId })).items.some((row) => row.id === team));
    await denied('listTeamEnrollmentOptions', a.parent, { kind: 'children', teamId: team }, 'PERMISSION_DENIED');
  }
  await record.set({ ...saved, status: 'invented' }); await denied('listTeamEnrollmentOptions', a.parent, { kind: 'teams', clubId }, 'FAILED_PRECONDITION');
  await record.set(saved);
});
await check('declared-children-appear-only-after-separate-current-manager-verification', async () => {
  assert.equal((await options(a.parent, { kind: 'children', teamId: team })).items.length, 0);
  await verifyEnrollmentParent(a.parent, a.manager);
  const page = await options(a.parent, { kind: 'children', teamId: team }); assert.equal(page.items.length, 1); assert.equal(page.items[0].id, childId);
  assert.equal((await options(a.driver, { kind: 'children', teamId: team })).items.length, 0);
  assert.equal((await options(a.other, { kind: 'children', teamId: team })).items.length, 0);
});
await check('link-membership-and-verification-loss-remove-child-choices-before-any-write', async () => {
  for (const [record, patch] of [[childRef, { guardianUserIds: [] }], [childMembership, { active: false }]]) {
    const saved = (await record.get()).data(); await record.update(patch);
    assert.equal((await options(a.parent, { kind: 'children', teamId: team })).items.length, 0); await record.set(saved);
  }
  const guardian = db.collection('guardianVerifications').doc(guardianVerificationId(clubId, childId, a.parent.uid));
  await call('transitionGuardianVerification', a.manager, { clubId, childId, parentUserId: a.parent.uid, action: 'revoke',
    expectedRevision: (await guardian.get()).get('revision'), requestId: randomUUID() });
  assert.equal((await options(a.parent, { kind: 'children', teamId: team })).items.length, 0);
  await verifyEnrollmentParent(a.parent, a.manager);
  const saved = (await membership.get()).data(); await membership.update({ active: false });
  await denied('listTeamEnrollmentOptions', a.parent, { kind: 'children', teamId: team }, 'PERMISSION_DENIED'); await membership.set(saved);
});
await check('recreated-child-identities-do-not-inherit-old-verification-in-choice-lists', async () => {
  const saved = (await childRef.get()).data(); await childRef.delete(); await childRef.create(saved);
  assert.equal((await options(a.parent, { kind: 'children', teamId: team })).items.length, 0);
  await verifyEnrollmentParent(a.parent, a.manager); assert.equal((await options(a.parent, { kind: 'children', teamId: team })).items.length, 1);
});
let teamCursor;
await check('paged-team-choices-are-bounded-and-do-not-lose-filtered-scan-pages', async () => {
  const batch = db.batch();
  for (let index = 0; index < 24; index++) batch.create(db.collection('teams').doc(`enroll-options-page-${String(index).padStart(2, '0')}`),
    { clubId, name: `Equipe pagination QA ${index}`, active: index >= 20 });
  await batch.commit();
  const seen = [], ids = new Set(); let cursor;
  do {
    const page = await options(a.parent, { kind: 'teams', clubId, ...(cursor ? { cursor } : {}) }); assert(page.items.length <= 20);
    if (!cursor) { assert.equal(page.items.length, 0); assert(page.nextCursor); }
    for (const item of page.items) { assert(!ids.has(item.id)); ids.add(item.id); }
    if (page.nextCursor) { assert(!seen.includes(page.nextCursor)); seen.push(page.nextCursor); teamCursor ??= page.nextCursor; }
    cursor = page.nextCursor;
  } while (cursor);
  assert(ids.has(team)); for (let index = 20; index < 24; index++) assert(ids.has(`enroll-options-page-${index}`));
  assert(seen.length > 0); assert([...ids].every((id) => !/^enroll-options-page-0/.test(id)));
});
await check('choice-cursors-are-bound-to-account-kind-club-and-server-team-identity', async () => {
  await denied('listTeamEnrollmentOptions', a.other, { kind: 'teams', clubId, cursor: teamCursor }, 'PERMISSION_DENIED');
  await denied('listTeamEnrollmentOptions', a.parent, { kind: 'clubs', cursor: teamCursor }, 'PERMISSION_DENIED');
  await denied('listTeamEnrollmentOptions', a.foreign, { kind: 'teams', clubId: 'enroll-foreign-club', cursor: teamCursor }, 'PERMISSION_DENIED');
  await denied('listTeamEnrollmentOptions', a.parent, { kind: 'teams', clubId, cursor: 'broken!' }, 'INVALID_ARGUMENT');
  for (let index = 0; index < 21; index++) {
    const id = `enroll-options-child-${String(index).padStart(2, '0')}`;
    await db.collection('children').doc(id).create({ displayName: `Enfant pagination QA ${index}`, guardianUserIds: [a.parent.uid] });
    await db.collection('memberships').doc(`${id}_${clubId}`).create({ userId: id, clubId, status: 'active', active: true });
    const input = { clubId, childId: id, parentUserId: a.parent.uid, expectedRevision: 0, requestId: randomUUID() };
    await call('transitionGuardianVerification', a.parent, { ...input, action: 'request' });
    await call('transitionGuardianVerification', a.manager, { ...input, action: 'verify', expectedRevision: 1, requestId: randomUUID() });
  }
  const children = await options(a.parent, { kind: 'children', teamId: team }); assert.equal(children.items.length, 20); assert(children.nextCursor);
  assert.equal((await options(a.parent, { kind: 'children', teamId: team, cursor: children.nextCursor })).items.length, 2);
  await denied('listTeamEnrollmentOptions', a.parent, { kind: 'children', teamId: await freshTeam('options-other'), cursor: children.nextCursor }, 'PERMISSION_DENIED');
  const record = db.collection('teams').doc(team), saved = (await record.get()).data();
  await record.update({ name: 'Nom modifie QA' });
  assert.equal((await options(a.parent, { kind: 'children', teamId: team, cursor: children.nextCursor })).items.length, 2);
  await record.delete(); await record.create(saved);
  await denied('listTeamEnrollmentOptions', a.parent, { kind: 'children', teamId: team, cursor: children.nextCursor }, 'PERMISSION_DENIED');
});
await check('missing-labels-stay-null-and-choice-reads-never-create-enrollment-or-audit-records', async () => {
  const record = db.collection('teams').doc('enroll-options-page-20'); await record.update({ name: FieldValue.delete() });
  let cursor, found;
  do { const page = await options(a.parent, { kind: 'teams', clubId, ...(cursor ? { cursor } : {}) });
    found ??= page.items.find((row) => row.id === record.id); cursor = page.nextCursor;
  } while (cursor);
  assert.equal(found.name, null);
  assert.equal((await db.collection('teamEnrollments').get()).size, beforeEnrollments);
  assert.equal((await db.collection('teamEnrollmentEvents').get()).size, beforeEvents);
});
const paths = ['functions/src/services/teamEnrollmentOptions.ts', 'functions/src/callables/teamEnrollmentOptions.ts',
  'functions/src/services/teamEnrollmentAuthority.ts', 'scripts/qa/local-team-options-suite.mjs', 'scripts/qa/run-local-team-options.mjs'];
const result = { projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(),
  scope: 'local-emulated-services-not-phone-ui', coverage: 'team-enrollment-choice-discovery-not-native-ui',
  testCount: checks.length, steps: checks, nativeUiExecuted: false, teamChatImplemented: false, productionWrites: false, providerRequests: 0,
  syntheticTeamChoices: 24, syntheticChildrenWithActualLocalManagerVerification: 21,
  sourceFiles: Object.fromEntries(paths.map((path) => [path, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')])) };
mkdirSync(dirname(process.env.SGM_LOCAL_FLOW_OUTPUT), { recursive: true });
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(`Passed ${checks.length} isolated team-choice groups; no native or conversation flow accepted.`);
