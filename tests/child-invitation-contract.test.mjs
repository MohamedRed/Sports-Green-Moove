import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import ts from 'typescript';
import { parseDocument } from 'yaml';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { invitationPhonePhases, verifyInvitationPhoneCheckpoint } from '../scripts/qa/child-invitation-phone-checkpoints.mjs';
import { validateInvitationPhoneArtifacts } from '../scripts/qa/child-invitation-phone-evidence.mjs';
import { childInvitationPhone } from '../partner-portal/child-invitation-phone.mjs';
import { validateChildInvitationEvidence, validateChildInvitationReport } from '../scripts/qa/child-invitation-evidence.mjs';
import { validateChildBindingReport } from '../scripts/qa/child-invitation-binding-evidence.mjs';
import { validateChildInvitationBrowserEvidence, validateConnectedInvitationReport, validateInvitationBrowserReview } from '../scripts/qa/child-invitation-browser-evidence.mjs';
import {invitationRecheckFolder, validateChildInvitationRecheck, validateInvitationServiceRecheck} from '../scripts/qa/child-invitation-recheck-evidence.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('current invitation service recheck preserves parent authority and incomplete phone scope', () => {
  validateChildInvitationRecheck(fileURLToPath(new URL('..', import.meta.url)));
  const report = JSON.parse(read(invitationRecheckFolder + 'services.json'));
  const disposal = JSON.parse(read(invitationRecheckFolder + 'disposal.json'));
  const baseline = JSON.parse(read('docs/release/evidence/child-invitation-2026-10-26/services.json'));
  for (const mutate of [r => r.physicalDevice = true, r => r.browserUiExecuted = true,
    r => r.bindingBypassObserved = true, r => r.defaultParentPromotionObserved = true,
    r => r.parentApprovalSeparate = false, r => r.steps.pop(), r => r.providerRequests = 1,
    r => r.emulatorEndpoints.closed = false]) {
    const changed = structuredClone(report); mutate(changed);
    assert.throws(() => validateInvitationServiceRecheck(changed, disposal, baseline));
  }
  assert.throws(() => validateInvitationServiceRecheck(report, {...disposal, runId: '0'.repeat(32)}, baseline));
});
test('physical invitation records and manual share review retain delivery, signup and public deployment gaps', () => {
  validateInvitationPhoneArtifacts(fileURLToPath(new URL('..', import.meta.url)), childInvitationPhone);
});
test('even rehashed invitation receipts reject changed authority and broader delivery or signup claims', () => {
  const root = fileURLToPath(new URL('..', import.meta.url)), temp = mkdtempSync(resolve(tmpdir(), 'sgm-invitation-evidence-'));
  const folder = 'docs/release/evidence/child-invitation-phone-2026-10-26';
  try {
    cpSync(resolve(root, folder), resolve(temp, folder), { recursive: true });
    const archive = resolve(temp, 'docs/release/evidence/source-archive'); mkdirSync(archive);
    for (const file of ['session-results.json', 'fixture-ready.json']) {
      const report = JSON.parse(readFileSync(resolve(root, folder, file)));
      for (const hash of Object.values(report.sourceFiles))
        cpSync(resolve(root, 'docs/release/evidence/source-archive', hash + '.txt'), resolve(archive, hash + '.txt'));
    }
    const changes = [['session-results.json', value => value.completed = false],
      ['session-results.json', value => value.signupProven = true],
      ['session-results.json', value => value.checkpoints[2].systemShareProvenByThisCheckpoint = true],
      ['session-results.json', value => value.checkpoints[3].protectedRecordsUnchanged = false],
      ['ui-review.json', value => value.externalDeliveryProven = true],
      ['ui-review.json', value => value.publicLanding.childSignupAvailable = true],
      ['ui-review.json', value => value.sharedTokenSha256 = '0'.repeat(64)],
      ['invitation-records.json', value => value.observations[2].invitations[0].data.parentUserId = 'other'],
      ['invitation-records.json', value => value.observations[4].invitations[0].data.status = 'pending']];
    for (const [file, mutate] of changes) {
      const original = readFileSync(resolve(root, folder, file)), value = JSON.parse(original);
      mutate(value); const bytes = JSON.stringify(value); writeFileSync(resolve(temp, folder, file), bytes);
      const manifest = JSON.parse(readFileSync(resolve(root, folder, 'artifact-sha256.json')));
      manifest[file] = createHash('sha256').update(bytes).digest('hex');
      writeFileSync(resolve(temp, folder, 'artifact-sha256.json'), JSON.stringify(manifest));
      assert.throws(() => validateInvitationPhoneArtifacts(temp, childInvitationPhone));
      writeFileSync(resolve(temp, folder, file), original);
    }
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
test('phone invitation checkpoints preserve roles and records across real sharing and revocation', () => {
  const fixture = { childId: 'child', childInstanceId: 'b'.repeat(64), parentUid: 'parent', clubId: 'club' };
  const baseline = { documents: { users: [], childAccountInvitations: [], childAccountInvitationOwners: [] }, claims: [], liveData: null };
  const ownerId = createHash('sha256').update(JSON.stringify([fixture.childId, fixture.childInstanceId])).digest('hex');
  const createdAt = { seconds: 100, nanoseconds: 0 };
  const pending = structuredClone(baseline);
  pending.documents.childAccountInvitations.push({ id: 'a'.repeat(64), data: { ...fixture, parentUserId: fixture.parentUid,
    ownerId, status: 'pending', createdAt, expiresAt: { seconds: 86500, nanoseconds: 0 } } });
  delete pending.documents.childAccountInvitations[0].data.parentUid;
  pending.documents.childAccountInvitationOwners.push({ id: ownerId, data: { invitationHash: 'a'.repeat(64), createdAt } });
  const revoked = structuredClone(pending);
  Object.assign(revoked.documents.childAccountInvitations[0].data, { status: 'revoked', revokedAt: { seconds: 101, nanoseconds: 0 } });
  const states = [baseline, pending, pending, pending, revoked, revoked];
  invitationPhonePhases.forEach((phase, index) => {
    const result = verifyInvitationPhoneCheckpoint(phase, baseline, states[index], fixture, states[index - 1]);
    assert.equal(result.status, 'passed'); assert.equal(result.systemShareProvenByThisCheckpoint, false);
    assert.equal(result.signupProven, false); assert.equal(result.parentApprovalProven, false);
  });
  for (const mutate of [state => state.claims.push({ admin: true }), state => state.liveData = {},
    state => state.documents.users.push({ id: 'unexpected' }), state => state.documents.childAccountInvitations[0].data.token = 'secret',
    state => state.documents.childAccountInvitations[0].data.parentUserId = 'other',
    state => state.documents.childAccountInvitations[0].data.expiresAt.seconds++]) {
    const changed = structuredClone(pending); mutate(changed);
    assert.throws(() => verifyInvitationPhoneCheckpoint('invitation-created', baseline, changed, fixture, baseline));
  }
  assert.throws(() => verifyInvitationPhoneCheckpoint('share-returned', baseline, revoked, fixture, pending));
});
const compiled = ts.transpileModule(read('admin/src/childInvitationLink.ts'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { takeChildInvitationToken, invitationSignupError } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
test('original connected-browser receipts prove one child signup, never phone sharing or approval', () => {
  validateChildInvitationBrowserEvidence(fileURLToPath(new URL('..', import.meta.url)));
  const folder = 'docs/release/evidence/child-invitation-browser-2026-10-26/';
  const report = JSON.parse(read(folder + 'observations.json'));
  for (const field of ['nativeUiExecuted', 'physicalDevice', 'productionWrites'])
    assert.throws(() => validateConnectedInvitationReport({ ...report, [field]: true }));
  for (const field of ['userCount', 'redemptionRequests', 'parentApprovalCount']) {
    const changed = structuredClone(report); changed.observations[2][field]++;
    assert.throws(() => validateConnectedInvitationReport(changed));
  }
  const review = JSON.parse(read(folder + 'browser-review.json'));
  for (const field of ['submitHandlerInjected', 'accountFormSubmittedInIframe', 'phoneTested', 'nativeShareChooserOpened',
    'appLinkOpened', 'newGalleryMediaAccepted', 'applicationDeployed', 'releaseAccepted'])
    assert.throws(() => validateInvitationBrowserReview({ ...review, [field]: true }));
});
test('retained negative trials and passing repairs cannot be promoted into phone, production or release completion', () => {
  validateChildInvitationEvidence(fileURLToPath(new URL('..', import.meta.url)));
  const folder = 'docs/release/evidence/child-invitation-2026-10-26/';
  const report = JSON.parse(read(folder + 'verification.json'));
  for (const field of ['instrumentedCasesExecuted', 'physicalDevice', 'nativeShareChooserOpened', 'connectedBrowserSignup',
    'automaticParentApproval', 'newScreenshotsAccepted', 'applicationDeployed', 'signupUrlPublished', 'productionWrites', 'releaseAccepted'])
    assert.throws(() => validateChildInvitationReport({ ...report, [field]: true }));
  const recheck = JSON.parse(read(folder + 'binding-recheck/verification.json'));
  for (const field of ['bindingBypassObserved', 'defaultParentPromotionObserved', 'physicalDevice', 'nativeUiExecuted', 'productionWrites', 'releaseAccepted'])
    assert.throws(() => validateChildBindingReport({ ...recheck, [field]: true }));
});
test('the public invitation takes only a fragment secret and removes it from browser history', () => {
  const calls = [], history = { replaceState: (...args) => calls.push(args) }, token = 'a'.repeat(64);
  assert.equal(takeChildInvitationToken({ pathname: '/child-invitation', hash: '#' + token, search: '' }, history), token);
  assert.deepEqual(calls, [[null, '', '/child-invitation']]);
  for (const input of [{ hash: '#short', search: '' }, { hash: '#%61' + token, search: '' },
    { hash: '#' + token, search: '?email=child@example.test' }, { hash: '', search: '' }])
    assert.equal(takeChildInvitationToken({ pathname: '/child-invitation', ...input }, history), null);
});
test('signup errors never echo a credential, response body, token or provider diagnostic', () => {
  const secret = 'sensitive-synthetic-value';
  for (const code of ['functions/already-exists', 'functions/resource-exhausted', 'functions/failed-precondition',
    'functions/permission-denied', 'functions/unavailable', undefined]) {
    const message = invitationSignupError({ code, message: secret });
    assert(!message.includes(secret)); assert(!message.includes('Firebase')); assert(!message.includes('BrowserStack'));
  }
});
test('invitation signup is isolated from existing admin credentials and cannot initialize an adult profile', () => {
  const gateway = read('admin/src/childInvitationGateway.ts'), page = read('admin/src/ChildInvitationPage.tsx');
  for (const value of ['child-invitation-signup', 'inMemoryPersistence', 'if (auth.currentUser)', 'redeemChildInvitation',
    'value.parentApprovalRequired !== true', 'demo-sgm-local-qa']) assert(gateway.includes(value));
  for (const value of ['initializeUserProfile', 'createUserWithEmailAndPassword', 'localStorage', 'sessionStorage', 'console.'])
    assert(!gateway.includes(value) && !page.includes(value));
  assert(page.includes('submitting.current')); assert(page.includes('setPassword("")'));
  assert(page.includes('password !== confirmation')); assert(page.includes('password.length < 12'));
  assert(page.includes('href="sports-green-moove://account"'));
  const main = read('admin/src/main.tsx');
  assert(main.indexOf('import("./ChildInvitationPage")') < main.indexOf('import("./App")'));
});
test('accounts remain disabled until server-owned child roles and profile have been written', () => {
  const auth = read('functions/src/services/childInvitationAuth.ts'), redeem = read('functions/src/services/childInvitationRedemption.ts');
  assert(auth.includes('disabled: true')); assert(auth.includes('roleKeys: ["child"]'));
  assert(!auth.includes('password: false')); assert(!auth.includes('setCustomUserClaims(uid, { roleKeys: ["parent"]'));
  assert(redeem.indexOf('transaction.create(accountRef') < redeem.indexOf('await enableInvitedChildAccount('));
  assert(redeem.indexOf('transaction.create(userRef') < redeem.indexOf('await enableInvitedChildAccount('));
  assert(redeem.includes('invitation.requestDigest !== requestDigest')); assert(redeem.includes('attemptCount ?? 0) >= 5'));
  assert(!redeem.includes('transaction.create(linkRef'));
  const approval = read('functions/src/services/childAccountApproval.ts');
  assert(approval.includes('readChildInvitationBinding'));
  for (const field of ['childId', 'clubId', 'childInstanceId']) assert(approval.includes(`binding.${field} !==`));
  assert(approval.includes('request.get("invitationHash") !== binding.invitationHash'));
  const initialization = read('functions/src/callables/adminUsers.ts');
  assert(initialization.indexOf('assertInitializedChildRoleIntegrity(currentClaims, profile.data())') < initialization.indexOf('const roleKeys = defaultRoleKeysForClaims'));
  assert(initialization.indexOf('assertInitializedChildRoleIntegrity(currentClaims, profile.data())') < initialization.indexOf('await auth.setCustomUserClaims'));
  const runtime = read('android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidRuntime.kt');
  assert(runtime.includes('InitializedAuthProfileWire.roles(user.uid, profile)'));
  assert(!runtime.includes('?: setOf(AppRole.Parent)'));
});
test('parent share state is in memory, account fenced, expiry checked and cannot replay a late background response', () => {
  const path = 'android/app/src/main/java/be/sportgreenmoove/app/';
  const state = read(path + 'ui/ChildInvitationState.kt'), gateway = read(path + 'services/FirebaseAndroidChildInvitationGateway.kt');
  for (const value of ['private var link:', 'fun leaveForeground()', 'link = null', 'ticket != generation',
    'validateInvitationLink', 'it > now()', 'setOf("provisioning", "accepted")']) assert(state.includes(value));
  assert(gateway.includes('auth.currentUser?.uid != uid')); assert.equal((gateway.match(/requireSession\(uid\)/g) ?? []).length, 2);
  for (const value of ['SharedPreferences', 'rememberSaveable', 'Log.', 'println']) assert(!state.includes(value));
  const dialog = read(path + 'ui/ChildInvitationDialog.kt');
  assert(dialog.includes('Intent.ACTION_SEND')); assert(dialog.includes('Intent.EXTRA_TEXT, link'));
  assert(!dialog.includes('Text(link')); assert(!dialog.includes('Text(value.url'));
});
test('both service CI lanes execute the invitation trial and retain its original disposal report', () => {
  for (const file of ['backend-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = parseDocument(read('.github/workflows/' + file)).toJSON();
    const steps = Object.values(workflow.jobs).flatMap(job => job.steps ?? []);
    assert(steps.some(step => step.run === 'npm run test:child-invitation && node --test tests/child-invitation-contract.test.mjs'));
    const upload = steps.find(step => step.with?.name === 'child-invitation-results');
    assert(upload); assert.equal(upload.with['if-no-files-found'], 'error');
    assert(upload.with.path.endsWith('/child-invitation.json*'));
  }
  const rules = read('tests/child-account-link-rules.test.ts');
  for (const name of ['childAccountInvitations', 'childAccountInvitationOwners', 'childAccountInvitationAccounts']) assert(rules.includes(name));
});
