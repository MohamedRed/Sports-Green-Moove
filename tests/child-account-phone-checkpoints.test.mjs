import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateChildAccountPhoneAttempt } from '../scripts/qa/child-account-phone-evidence.mjs';
import { childAccountPhoneAttempt } from '../partner-portal/child-account-phone-attempt.mjs';
import { content } from '../partner-portal/content.mjs';
import ts from 'typescript';
import { childAccountPhonePhases, verifyChildAccountPhoneCheckpoint } from '../scripts/qa/child-account-phone-checkpoints.mjs';

const fixture = { childUid: 'child-account', parentUid: 'parent', childId: 'child-profile', childInstanceId: 'a'.repeat(64) };
const created = { seconds: 100, nanoseconds: 0 }, approved = { seconds: 101, nanoseconds: 0 };
const hash = 'b'.repeat(64);
function baseline() {
  return { documents: { users: [{ id: 'parent', data: { roles: { parent: true } } }],
    children: [{ id: 'child-profile', data: { displayName: 'Enfant fictif QA' } }],
    childAccountLinks: [], childAccountApprovalOwners: [], childAccountApprovalRequests: [] },
    claims: [{ uid: 'child-account', claims: { roleKeys: ['child'] } }], liveData: null };
}
function pending() {
  const state = baseline();
  state.documents.childAccountApprovalOwners = [{ id: fixture.childUid, data: { accountUserId: fixture.childUid, codeHash: hash, createdAt: created } }];
  state.documents.childAccountApprovalRequests = [{ id: hash, data: { accountUserId: fixture.childUid, createdAt: created,
    expiresAt: { seconds: 700, nanoseconds: 0 }, status: 'pending' } }];
  return state;
}
function linked() {
  const state = pending();
  state.documents.childAccountLinks = [{ id: fixture.childUid, data: { accountUserId: fixture.childUid, childId: fixture.childId,
    childInstanceId: fixture.childInstanceId, status: 'verified', verifiedByUserId: fixture.parentUid, verifiedAt: approved } }];
  Object.assign(state.documents.childAccountApprovalRequests[0].data, { status: 'approved', approvedByUserId: fixture.parentUid,
    childId: fixture.childId, childInstanceId: fixture.childInstanceId, approvedAt: approved });
  return state;
}
test('six ordered checkpoints verify one app-created code and one parent-approved immutable link', () => {
  const states = [baseline(), pending(), pending(), linked(), linked(), linked()];
  const results = states.map((state, index) => verifyChildAccountPhoneCheckpoint(childAccountPhonePhases[index], baseline(), state, fixture, states[index - 1]));
  assert.equal(results.length, 6); assert(results.every(row => row.status === 'passed'));
  assert(results.every(row => !row.physicalUiProvenByThisCheckpoint && !row.signupProven && !row.trackingProven));
});
test('the fixture cannot preseed an accepted code or link', () => {
  for (const initial of [pending(), linked()]) assert.throws(() => verifyChildAccountPhoneCheckpoint('code-created', initial, pending(), fixture));
});
test('any unrelated record, role or tracking mutation fails the trial', () => {
  for (const change of [state => state.documents.users[0].data.roles.admin = true,
    state => state.claims[0].claims.roleKeys.push('parent'), state => state.liveData = { unexpected: true },
    state => state.documents.children[0].data.displayName = 'Changed', state => state.documents.extra = []]) {
    const state = pending(); change(state); assert.throws(() => verifyChildAccountPhoneCheckpoint('code-created', baseline(), state, fixture));
  }
});
test('only the selected child account and the verified parent can appear in the approval', () => {
  for (const change of [state => state.documents.childAccountLinks[0].id = 'other',
    state => state.documents.childAccountLinks[0].data.verifiedByUserId = 'manager',
    state => state.documents.childAccountLinks[0].data.childId = 'another-child',
    state => state.documents.childAccountLinks[0].data.childInstanceId = 'c'.repeat(64),
    state => state.documents.childAccountApprovalRequests[0].data.approvedByUserId = fixture.childUid]) {
    const state = linked(); change(state); assert.throws(() => verifyChildAccountPhoneCheckpoint('parent-approved', baseline(), state, fixture, pending()));
  }
});
test('a review or account return cannot silently approve or regenerate a code', () => {
  assert.throws(() => verifyChildAccountPhoneCheckpoint('parent-review', baseline(), linked(), fixture, pending()));
  const changed = linked(); changed.documents.childAccountApprovalOwners[0].data.codeHash = 'd'.repeat(64);
  assert.throws(() => verifyChildAccountPhoneCheckpoint('child-return', baseline(), changed, fixture, linked()));
});
test('plaintext codes and malformed lifetime or owner fields are refused', () => {
  for (const change of [state => state.documents.childAccountApprovalRequests[0].data.code = 'secret',
    state => state.documents.childAccountApprovalRequests[0].data.expiresAt.seconds++,
    state => state.documents.childAccountApprovalOwners[0].data.accountUserId = 'other']) {
    const state = pending(); change(state); assert.throws(() => verifyChildAccountPhoneCheckpoint('code-created', baseline(), state, fixture));
  }
});
test('the observer only reads after setup and cannot approve links or create codes itself', () => {
  const source = readFileSync(new URL('../scripts/qa/manual-child-account-phone-session.mjs', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('observer.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const visit = node => {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      assert(!(ts.isIdentifier(expression) && expression.text === 'call'));
      if (ts.isPropertyAccessExpression(expression) && ['set', 'create', 'update', 'delete', 'createUser', 'setCustomUserClaims', 'updateUser', 'deleteUser'].includes(expression.name.text)) {
        const receiver = expression.expression;
        assert(expression.name.text === 'update' && ts.isCallExpression(receiver) &&
          ts.isIdentifier(receiver.expression) && receiver.expression.text === 'createHash', 'Only hashing may use a mutation-named method');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert(source.includes('db.terminate()')); assert(source.includes('await deleteApp(app)'));
  assert(source.includes("getDatabase().ref('/').get()"));
  assert(source.includes("replaceAll(session.password, '[REDACTED]')"));
});

const root = fileURLToPath(new URL('..', import.meta.url));
test('both incomplete phone attempts retain their three checkpoints, source archives and verified local disposal', () => {
  validateChildAccountPhoneAttempt(root, childAccountPhoneAttempt);
  const flow = content.flows.find(row => row.id === 'child-emergency');
  assert.equal(flow.status, 'partial'); assert.equal(flow.latestEvidence, 'phone');
  assert.deepEqual(flow.phoneAttempt, childAccountPhoneAttempt);
  assert.equal(flow.images.filter(row => row.file.startsWith('child-link-phone-')).length, 2);
  assert.match(flow.remaining, /accord du parent/);
});
test('a checksummed attempt still cannot promote approval, completion, signup, tracking or production proof', () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-child-phone-evidence-'));
  const folder = 'docs/release/evidence/child-account-phone-attempt-2026-10-26';
  try {
    cpSync(resolve(root, folder), resolve(temp, folder), { recursive: true });
    const archive = resolve(temp, 'docs/release/evidence/source-archive'); mkdirSync(archive);
    for (const attempt of ['attempt-1', 'attempt-2']) for (const name of ['session-results.json', 'fixture-ready.json']) {
      const report = JSON.parse(readFileSync(resolve(root, folder, attempt, name)));
      for (const hash of Object.values(report.sourceFiles)) cpSync(resolve(root, 'docs/release/evidence/source-archive', hash + '.txt'), resolve(archive, hash + '.txt'));
    }
    const file = 'attempt-2/session-results.json', target = resolve(temp, folder, file);
    const original = JSON.parse(readFileSync(target)), manifestPath = resolve(temp, folder, 'artifact-sha256.json');
    for (const change of [report => report.completed = true, report => report.signupProven = true,
      report => report.trackingProven = true, report => report.productionWrites = true,
      report => report.checkpoints[2].approved = true, report => report.checkpoints.pop(),
      report => report.adminClientClosed = false]) {
      const report = structuredClone(original); change(report);
      const bytes = JSON.stringify(report); writeFileSync(target, bytes);
      const manifest = JSON.parse(readFileSync(manifestPath)); manifest[file] = createHash('sha256').update(bytes).digest('hex');
      writeFileSync(manifestPath, JSON.stringify(manifest));
      assert.throws(() => validateChildAccountPhoneAttempt(temp, childAccountPhoneAttempt));
    }
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
