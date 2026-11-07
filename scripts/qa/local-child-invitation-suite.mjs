import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { deleteApp, getApp } from 'firebase-admin/app';
import { auth, call, db, denied, signIn } from './local-flow-client.mjs';
import { childEmergencyActors, verifyChildContactParent, withChildFixturePatch } from './child-emergency-fixture.mjs';
import { invitationHash, invitationOwnerId, redemptionDigest } from '../../functions/lib/domain/childInvitation.js';

execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
  { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
const actors = await childEmergencyActors(), childId = 'sgm-qa-child-lina', clubId = 'sgm-qa-club-green-wavre';
await db.collection('childAccountLinks').doc(actors.child.uid).delete();
const beforeUsers = (await auth.listUsers()).users;
const baseline = new Map(beforeUsers.map(user => [user.uid, user.customClaims]));
const steps = [], secrets = [process.env.SGM_QA_PASSWORD];
const check = async (id, action) => { await action(); steps.push({ id, status: 'passed' }); };
let target, invitation, token, ref, createdUid, newChild, failure, bindingBypassObserved = false, defaultParentPromotionObserved = false;
const signup = () => ({ token, email: 'invited-child@example.test', password: process.env.SGM_QA_PASSWORD });
const resetBudget = async () => ref.update({ attemptWindowAt: Timestamp.fromMillis(0), attemptCount: 0 });
try {
  await check('only-a-current-verified-parent-can-invite', async () => {
    const input = { childId, clubId, expectedChildInstanceId: 'a'.repeat(64) };
    for (const actor of [null, actors.manager, actors.driver, actors.child, actors.other, actors.parent])
      await denied('createChildInvitation', actor, input, actor ? 'PERMISSION_DENIED' : 'UNAUTHENTICATED');
    await verifyChildContactParent(actors, childId, clubId);
    const view = await call('getEmergencyContact', actors.parent, { target: { kind: 'child', childId, clubId } });
    target = { childId, clubId, expectedChildInstanceId: view.childInstanceId };
    await denied('createChildInvitation', actors.parent, { ...target, roles: { admin: true } }, 'INVALID_ARGUMENT');
    await denied('createChildInvitation', actors.parent, { ...target, expectedChildInstanceId: 'a'.repeat(64) }, 'FAILED_PRECONDITION');
  });
  await check('the-shared-link-is-private-hashed-expiring-and-not-an-approval', async () => {
    invitation = await call('createChildInvitation', actors.parent, target);
    const url = new URL(invitation.url); token = url.hash.slice(1); secrets.push(token);
    assert.equal(url.origin, 'https://sports-green-moove-prod.web.app'); assert.equal(url.pathname, '/child-invitation');
    assert.equal(url.search, ''); assert.match(token, /^[a-f0-9]{64}$/);
    assert.equal(invitation.invitationHash, invitationHash(token));
    assert(invitation.expiresAtMillis > Date.now() && invitation.expiresAtMillis <= Date.now() + 86_400_000);
    ref = db.collection('childAccountInvitations').doc(invitation.invitationHash);
    assert(!JSON.stringify((await ref.get()).data()).includes(token));
    assert.equal((await ref.get()).get('status'), 'pending'); assert.equal((await db.collection('childAccountLinks').get()).size, 0);
    assert.equal((await auth.listUsers()).users.length, beforeUsers.length);
  });
  await check('the-parent-can-read-minimal-status-and-cannot-regenerate-through-a-cooldown', async () => {
    const status = await call('getChildInvitation', actors.parent, target);
    assert.deepEqual(status.current, { invitationHash: invitation.invitationHash, status: 'pending', expiresAtMillis: invitation.expiresAtMillis });
    assert(!JSON.stringify(status).includes(token));
    await denied('getChildInvitation', actors.manager, target, 'PERMISSION_DENIED');
    await denied('createChildInvitation', actors.parent, target, 'RESOURCE_EXHAUSTED');
  });
  await check('replaced-revoked-expired-and-unknown-links-create-no-account', async () => {
    await db.collection('childAccountInvitationOwners').doc(invitationOwnerId(childId, target.expectedChildInstanceId)).update({ createdAt: Timestamp.fromMillis(0) });
    const retired = token;
    invitation = await call('createChildInvitation', actors.parent, target); token = new URL(invitation.url).hash.slice(1); secrets.push(token);
    assert.equal((await ref.get()).get('status'), 'revoked'); ref = db.collection('childAccountInvitations').doc(invitation.invitationHash);
    await denied('redeemChildInvitation', null, { ...signup(), token: retired }, 'FAILED_PRECONDITION');
    await denied('redeemChildInvitation', null, { ...signup(), token: '0'.repeat(64) }, 'FAILED_PRECONDITION');
    await withChildFixturePatch(ref, { expiresAt: Timestamp.fromMillis(0) }, () => denied('redeemChildInvitation', null, signup(), 'FAILED_PRECONDITION'));
    assert.equal((await auth.listUsers()).users.length, beforeUsers.length);
  });
  await check('signed-in-and-client-selected-privileged-signups-are-refused', async () => {
    await denied('redeemChildInvitation', actors.parent, signup(), 'FAILED_PRECONDITION');
    for (const patch of [{ roleKeys: ['admin'] }, { accountUserId: actors.parent.uid }, { parentUserId: actors.parent.uid }, { password: 'short' }])
      await denied('redeemChildInvitation', null, { ...signup(), ...patch }, 'INVALID_ARGUMENT');
  });
  await check('signup-rechecks-the-current-parent-membership-role-guardian-and-child-identity', async () => {
    for (const [document, patch] of [[db.collection('users').doc(actors.parent.uid), { roles: { parent: false } }],
      [db.collection('memberships').doc(`${actors.parent.uid}_${clubId}`), { active: false }],
      [db.collection('children').doc(childId), { guardianUserIds: [] }]])
      await withChildFixturePatch(document, patch, () => denied('redeemChildInvitation', null, signup(), 'PERMISSION_DENIED'));
    assert.equal((await auth.listUsers()).users.length, beforeUsers.length);
  });
  await check('an-existing-email-is-not-taken-over-and-the-uncreated-reservation-is-released', async () => {
    await resetBudget();
    await denied('redeemChildInvitation', null, { ...signup(), email: 'p@example.test' }, 'ALREADY_EXISTS');
    const pending = await ref.get(); assert.equal(pending.get('status'), 'pending'); assert.equal(pending.get('accountUserId'), undefined);
    assert.equal((await auth.listUsers()).users.length, beforeUsers.length);
    assert.deepEqual((await auth.getUser(actors.parent.uid)).customClaims, baseline.get(actors.parent.uid));
  });
  await check('concurrent-redemption-creates-one-pure-child-account-without-an-approved-link', async () => {
    await resetBudget();
    const results = await Promise.all([call('redeemChildInvitation', null, signup()), call('redeemChildInvitation', null, signup())]);
    for (const result of results) assert.deepEqual(result, { created: true, parentApprovalRequired: true });
    const users = (await auth.listUsers()).users.filter(user => !baseline.has(user.uid)); assert.equal(users.length, 1);
    const user = users[0]; createdUid = user.uid;
    assert.equal(user.disabled, false); assert.deepEqual(user.customClaims, { roleKeys: ['child'], childInvitationHash: invitation.invitationHash });
    const profile = await db.collection('users').doc(createdUid).get();
    assert.equal(profile.get('roles').child, true); assert.equal(profile.get('roles').parent, false);
    assert.equal((await ref.get()).get('status'), 'accepted'); assert.equal((await db.collection('childAccountLinks').get()).size, 0);
    assert(!JSON.stringify((await ref.get()).data()).includes(process.env.SGM_QA_PASSWORD));
    assert(!JSON.stringify((await ref.get()).data()).includes(token));
  });
  await check('normal-email-signin-and-profile-initialization-preserve-the-child-role', async () => {
    newChild = await signIn('invited-child@example.test'); assert.equal(newChild.uid, createdUid);
    const profile = await call('initializeUserProfile', newChild, {});
    assert.deepEqual(profile.roleKeys, ['child']); assert.equal(profile.roles.parent, false);
    const original = await auth.getUser(createdUid), profileRef = db.collection('users').doc(createdUid), originalProfile = await profileRef.get();
    try {
      await auth.setCustomUserClaims(createdUid, { childInvitationHash: invitation.invitationHash });
      try {
        const promoted = await call('initializeUserProfile', newChild, {});
        defaultParentPromotionObserved = promoted.roleKeys.includes('parent');
        assert.fail('Missing child roles must not initialize an invited account as parent.');
      } catch (error) { if (error.code !== 'FAILED_PRECONDITION') throw error; }
      assert.equal((await auth.getUser(createdUid)).customClaims.roleKeys, undefined);
      assert.equal((await profileRef.get()).get('roles').child, true);
    } finally { await auth.setCustomUserClaims(createdUid, original.customClaims); await profileRef.set(originalProfile.data()); }
    await denied('getCurrentChildRideEmergencyContact', newChild, {}, 'PERMISSION_DENIED');
  });
  await check('lost-response-retry-reuses-the-account-and-cannot-change-credentials', async () => {
    await resetBudget();
    assert.deepEqual(await call('redeemChildInvitation', null, signup()), { created: true, parentApprovalRequired: true });
    await denied('redeemChildInvitation', null, { ...signup(), password: process.env.SGM_QA_PASSWORD + 'different' }, 'FAILED_PRECONDITION');
    await denied('redeemChildInvitation', null, { ...signup(), email: 'other-invited@example.test' }, 'FAILED_PRECONDITION');
    assert.equal((await signIn('invited-child@example.test')).uid, createdUid);
    assert.equal((await auth.listUsers()).users.length, beforeUsers.length + 1);
  });
  await check('a-post-commit-enable-interruption-can-resume-with-the-original-link-and-credentials', async () => {
    await resetBudget(); await auth.updateUser(createdUid, { disabled: true });
    assert.equal((await auth.getUser(createdUid)).disabled, true);
    await call('redeemChildInvitation', null, signup());
    assert.equal((await auth.getUser(createdUid)).disabled, false);
    assert.equal((await signIn('invited-child@example.test')).uid, createdUid);
  });
  await check('credential-retry-requests-are-budgeted-per-invitation', async () => {
    await resetBudget();
    for (let index = 0; index < 5; index++) await denied('redeemChildInvitation', null,
      { ...signup(), password: process.env.SGM_QA_PASSWORD + index }, 'FAILED_PRECONDITION');
    await denied('redeemChildInvitation', null, signup(), 'RESOURCE_EXHAUSTED');
    await resetBudget();
  });
  await check('a-used-invitation-cannot-be-revoked-or-replaced-as-if-it-were-unused', async () => {
    await denied('revokeChildInvitation', actors.parent, { ...target, invitationHash: invitation.invitationHash }, 'FAILED_PRECONDITION');
    await denied('createChildInvitation', actors.parent, target, 'FAILED_PRECONDITION');
  });
  await check('invitation-origin-pins-separate-parent-approval-to-the-invited-child', async () => {
    const childRef = db.collection('children').doc(childId), otherId = 'sgm-qa-invitation-other-child';
    await db.collection('children').doc(otherId).create({ ...(await childRef.get()).data(), displayName: 'Autre enfant fictif QA' });
    await verifyChildContactParent(actors, otherId, clubId);
    const otherView = await call('getEmergencyContact', actors.parent, { target: { kind: 'child', childId: otherId, clubId } });
    const code = await call('createChildAccountLinkCode', newChild, {}); secrets.push(code.code);
    await denied('approveChildAccountLink', actors.parent, { code: code.code, childId: otherId, clubId,
      expectedChildInstanceId: otherView.childInstanceId }, 'PERMISSION_DENIED');
    const originRef = db.collection('childAccountInvitationAccounts').doc(createdUid), origin = await originRef.get();
    try {
      await originRef.delete();
      try {
        const wrong = await call('approveChildAccountLink', actors.parent, { code: code.code, childId: otherId, clubId,
          expectedChildInstanceId: otherView.childInstanceId });
        bindingBypassObserved = wrong.childId === otherId;
        assert.fail('Removing the invitation binding must not permit approval for another child.');
      } catch (error) { if (error.code !== 'PERMISSION_DENIED') throw error; }
    } finally { await originRef.set(origin.data()); }
    await withChildFixturePatch(db.collection('users').doc(createdUid), { childInvitationHash: FieldValue.delete() }, () =>
      denied('createChildAccountLinkCode', newChild, {}, 'PERMISSION_DENIED'));
    await withChildFixturePatch(originRef, { invitationHash: '0'.repeat(64) }, () =>
      denied('approveChildAccountLink', actors.parent, { code: code.code, ...target }, 'PERMISSION_DENIED'));
    const approval = await call('approveChildAccountLink', actors.parent, { code: code.code, ...target });
    assert.equal(approval.accountUserId, createdUid); assert.equal(approval.childId, childId);
    const link = await db.collection('childAccountLinks').doc(createdUid).get(); assert.equal(link.get('verifiedByUserId'), actors.parent.uid);
  });
  await check('a-current-authority-loss-still-blocks-replay-without-changing-roles', async () => {
    await withChildFixturePatch(db.collection('children').doc(childId), { guardianUserIds: [] }, () =>
      denied('redeemChildInvitation', null, signup(), 'PERMISSION_DENIED'));
    assert.deepEqual((await auth.getUser(createdUid)).customClaims, { roleKeys: ['child'], childInvitationHash: invitation.invitationHash });
  });
  await check('a-pending-invitation-can-be-revoked-with-current-parent-authority', async () => {
    const otherId = 'sgm-qa-invitation-other-child';
    const view = await call('getEmergencyContact', actors.parent, { target: { kind: 'child', childId: otherId, clubId } });
    const otherTarget = { childId: otherId, clubId, expectedChildInstanceId: view.childInstanceId };
    const pending = await call('createChildInvitation', actors.parent, otherTarget), secret = new URL(pending.url).hash.slice(1); secrets.push(secret);
    await denied('revokeChildInvitation', actors.manager, { ...otherTarget, invitationHash: pending.invitationHash }, 'PERMISSION_DENIED');
    assert.equal((await call('revokeChildInvitation', actors.parent, { ...otherTarget, invitationHash: pending.invitationHash })).revoked, true);
    await denied('redeemChildInvitation', null, { ...signup(), token: secret, email: 'revoked@example.test' }, 'FAILED_PRECONDITION');
  });
  await check('an-interrupted-disabled-account-can-resume-child-claims-and-profile-without-an-adult-session', async () => {
    const otherId = 'sgm-qa-invitation-other-child';
    const view = await call('getEmergencyContact', actors.parent, { target: { kind: 'child', childId: otherId, clubId } });
    await db.collection('childAccountInvitationOwners').doc(invitationOwnerId(otherId, view.childInstanceId)).update({ createdAt: Timestamp.fromMillis(0) });
    const pending = await call('createChildInvitation', actors.parent, { childId: otherId, clubId, expectedChildInstanceId: view.childInstanceId });
    const secret = new URL(pending.url).hash.slice(1); secrets.push(secret);
    const input = { token: secret, email: 'resumed-child@example.test', password: process.env.SGM_QA_PASSWORD };
    const reservedUid = 'sgm-qa-invitation-interrupted-child';
    await db.collection('childAccountInvitations').doc(pending.invitationHash).update({ status: 'provisioning', accountUserId: reservedUid,
      requestDigest: redemptionDigest(input), email: input.email, childName: 'Enfant interruption fictive QA', expiresAt: Timestamp.fromMillis(0) });
    await auth.createUser({ uid: reservedUid, email: input.email, password: input.password, disabled: true });
    assert.equal((await auth.getUser(reservedUid)).disabled, true);
    assert.equal((await db.collection('users').doc(reservedUid).get()).exists, false);
    await call('redeemChildInvitation', null, input);
    const user = await auth.getUser(reservedUid); assert.equal(user.disabled, false); assert.deepEqual(user.customClaims.roleKeys, ['child']);
    assert.equal((await db.collection('users').doc(reservedUid).get()).get('roles').parent, false);
    assert.equal((await signIn(input.email)).uid, reservedUid);
    assert.equal((await db.collection('childAccountLinks').doc(reservedUid).get()).exists, false);
  });
  await check('existing-account-claims-stay-unchanged-and-the-only-new-account-is-a-child', async () => {
    const users = (await auth.listUsers()).users;
    for (const user of users) if (baseline.has(user.uid)) assert.deepEqual(user.customClaims, baseline.get(user.uid));
    assert.equal(users.length, beforeUsers.length + 2);
    assert.deepEqual(users.find(user => user.uid === createdUid).customClaims.roleKeys, ['child']);
  });
} catch (error) { failure = error; }
finally { await db.terminate(); await deleteApp(getApp()); }
const paths = ['functions/src/domain/childInvitation.ts', 'functions/src/config/childInvitation.json',
  'functions/src/services/childInvitationAuthority.ts', 'functions/src/services/childInvitationAuth.ts',
  'functions/src/services/childInvitationRedemption.ts', 'functions/src/services/childInvitations.ts',
  'functions/src/callables/childInvitations.ts', 'functions/src/services/childAccountApproval.ts', 'functions/src/services/childInvitationBinding.ts',
  'functions/src/callables/adminUsers.ts', 'functions/src/domain/roles.ts', 'functions/src/domain/initializedChildRoles.ts', 'firestore.rules',
  'scripts/qa/local-child-invitation-suite.mjs', 'scripts/qa/run-local-child-invitation.mjs'];
const report = { scope: 'isolated-authenticated-invitation-provisioning-and-approval-not-browser-or-phone-ui',
  projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(), steps,
  testCount: steps.length, nativeUiExecuted: false, browserUiExecuted: false, physicalDevice: false,
  productionWrites: false, providerRequests: 0, childAccountProvisioned: steps.some(step => step.id.startsWith('concurrent-')),
  parentApprovalSeparate: true, bindingBypassObserved, defaultParentPromotionObserved, injectedInterruptionScenarios: 2, adminClientClosed: true,
  sourceFiles: Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')])) };
const encoded = JSON.stringify(report, null, 2) + '\n';
for (const secret of secrets) assert(!encoded.includes(secret));
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, encoded, { flag: 'wx' });
if (failure) throw failure;
console.log('Eighteen isolated child-invitation service groups passed; no browser, phone or production flow is claimed.');
