import assert from 'node:assert/strict';
import { createDecipheriv, createHash, generateKeyPairSync, privateDecrypt, constants } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { rotateKey, rotationSettings } from '../scripts/security/rotate-browserstack-key.mjs';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 3072 });
const env = { BROWSERSTACK_USERNAME: 'fictional-qa', BROWSERSTACK_ACCESS_KEY: 'fictional-old-key',
  ROTATION_PUBLIC_KEY: publicKey.export({ type: 'spki', format: 'pem' }),
  ROTATION_REQUEST_ID: '12345678-1234-1234-1234-123456789abc',
  GITHUB_REPOSITORY: 'MohamedRed/Sports-Green-Moove', GITHUB_RUN_ID: '42', GITHUB_SHA: 'fixture' };

function harness(statuses = [200, 200, 200, 401]) {
  const calls = [], files = new Map();
  return { calls, files, dependencies: {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { status: statuses.shift(), json: async () => ({ old_key: env.BROWSERSTACK_ACCESS_KEY,
        new_key: 'fictional-new-key' }), body: { cancel: async () => {} } };
    },
    save: async (name, data, options) => { assert.equal(options.flag, 'wx'); files.set(name, data); },
  } };
}

test('rotation returns encrypted credentials and independently verifies both keys', async () => {
  const h = harness();
  const receipt = await rotateKey(rotationSettings(env), h.dependencies);
  assert.equal(receipt.newKeyAccepted, true);
  assert.equal(receipt.oldKeyRejected, true);
  assert.equal(h.calls.filter(c => c.options.method === 'PUT').length, 1);
  assert.equal(h.calls[1].url, 'https://api.browserstack.com/automate/recycle_key.json');
  assert.equal(h.calls[1].options.redirect, 'error');
  const encrypted = JSON.parse(h.files.get('browserstack-key.encrypted.json'));
  const contentKey = privateDecrypt({ key: privateKey,
    padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
  Buffer.from(encrypted.wrappedKey, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', contentKey, Buffer.from(encrypted.iv, 'base64'));
  decipher.setAAD(Buffer.from(JSON.stringify({ requestId: encrypted.requestId,
    repository: encrypted.repository, runId: encrypted.runId, sha: encrypted.sha })));
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
  const decrypted = JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final()]));
  assert.equal(decrypted.accessKey, 'fictional-new-key');
  assert.equal(decrypted.runId, '42');
  for (const file of h.files.values()) {
    assert.ok(!file.includes('fictional-new-key'));
    assert.ok(!file.includes('fictional-old-key'));
  }
});

test('missing settings and weak recipients fail before provider calls', () => {
  assert.throws(() => rotationSettings({}), /missing/);
  const weak = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey;
  assert.throws(() => rotationSettings({ ...env,
    ROTATION_PUBLIC_KEY: weak.export({ type: 'spki', format: 'pem' }) }), /3072/);
});

test('bad existing authentication prevents rotation; uncertain rotation is never retried', async () => {
  const preflight = harness([401]);
  await assert.rejects(rotateKey(rotationSettings(env), preflight.dependencies), /no rotation attempted/);
  assert.equal(preflight.calls.length, 1);
  const ambiguous = harness([200, 503]);
  await assert.rejects(rotateKey(rotationSettings(env), ambiguous.dependencies), /before retrying/);
  assert.equal(ambiguous.calls.length, 2);
  assert.equal(ambiguous.files.size, 0);
});

test('incomplete revocation retains encrypted recovery without repeating rotation', async () => {
  const h = harness([200, 200, 200, 200]);
  await assert.rejects(rotateKey(rotationSettings(env), h.dependencies), /retained/);
  assert.ok(h.files.has('browserstack-key.encrypted.json'));
  assert.equal(h.calls.length, 4);
});

test('maintenance is manual, separate from app distribution, with read-only repository permissions', () => {
  const workflow = readFileSync(new URL('../.github/workflows/android-browserstack.yml', import.meta.url), 'utf8');
  assert.match(workflow, /github.event_name == 'workflow_dispatch' && inputs.rotate_access_key/);
  assert.match(workflow, /!inputs.rotate_access_key && inputs.credentials_rotated && inputs.live_backend_ready/);
  assert.match(workflow, /retention-days: 1/);
  assert.doesNotMatch(workflow, /secrets\.GH_TOKEN|secrets\.GITHUB_TOKEN|actions: write/);
});

test('retained completion proves credential maintenance, not a new device trial', () => {
  const receipt = JSON.parse(readFileSync(new URL(
    '../docs/release/evidence/browserstack-key-rotation-2026-10-20/receipt.json', import.meta.url)));
  assert.equal(receipt.newKeyStatus, 200);
  assert.equal(receipt.oldKeyStatus, 401);
  assert.equal(receipt.localAuthenticationStatus, 200);
  assert.equal(receipt.githubSecretName, 'BROWSERSTACK_ACCESS_KEY');
  assert.ok(Date.parse(receipt.githubSecretUpdatedAt) > Date.parse(receipt.rotatedAt));
  assert.equal(receipt.plaintextCredentialPersisted, false);
  assert.equal(receipt.deviceSessionsStarted, 0);
  assert.equal(receipt.scope, 'credential-rotation-only-no-device-session-or-app-upload');
  assert.ok(!Object.hasOwn(receipt, 'accessKey') && !Object.hasOwn(receipt, 'new_key'));
});

test('the later replacement rejects the exposed key, updates the secret and retains no plaintext recovery', () => {
  const base = new URL('../docs/release/evidence/browserstack-key-rotation-2026-10-21/', import.meta.url);
  const receipt = JSON.parse(readFileSync(new URL('receipt.json', base)));
  assert.deepEqual(Object.keys(receipt).sort(), ['version', 'requestId', 'repository', 'runId', 'sha', 'rotatedAt',
    'newKeyAccepted', 'oldKeyRejected', 'newKeyStatus', 'oldKeyStatus', 'scope', 'repositorySecretUpdated',
    'secretUpdatedAt', 'independentNewKeyStatus', 'privateRecipientKeyRemoved'].sort());
  assert.equal(receipt.requestId, '27f7d88f-3f1d-4da6-a345-319d40ca5a04');
  assert.equal(receipt.repository, 'MohamedRed/Sports-Green-Moove'); assert.equal(receipt.runId, '39639558489');
  assert.equal(receipt.sha, '70daee2173b5d75815d657dd4c4b847682aa67d7');
  assert.equal(receipt.newKeyAccepted, true); assert.equal(receipt.oldKeyRejected, true);
  assert.equal(receipt.newKeyStatus, 200); assert.equal(receipt.oldKeyStatus, 401);
  assert.equal(receipt.independentNewKeyStatus, 200); assert.equal(receipt.repositorySecretUpdated, true);
  assert(Date.parse(receipt.secretUpdatedAt) > Date.parse(receipt.rotatedAt));
  assert.equal(receipt.privateRecipientKeyRemoved, true);
  assert.equal(receipt.scope, 'credential-rotation-only-no-device-session-or-app-upload');
  const job = JSON.parse(readFileSync(new URL('job.json', base)));
  assert.equal(job.name, 'rotate-access-key'); assert.equal(job.run_id, Number(receipt.runId));
  assert.equal(job.head_sha, receipt.sha); assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  const artifact = JSON.parse(readFileSync(new URL('artifact.json', base)));
  assert.equal(artifact.id, 12363263371); assert.equal(artifact.workflow_run.id, job.run_id);
  assert.equal(artifact.workflow_run.head_sha, receipt.sha);
  assert.equal(artifact.name, 'browserstack-key-rotation-' + receipt.requestId);
  const cleanup = JSON.parse(readFileSync(new URL('cleanup.json', base)));
  assert.deepEqual(cleanup.loopbackPortsRefused, [5001, 8080, 9000, 9099, 45454, 45690, 45691, 45954]);
  assert.equal(cleanup.privateSessionFileRemoved, true); assert.equal(cleanup.privateRecipientKeyRemoved, true);
  for (const key of ['deviceSessionsStarted', 'appUiCasesExecuted', 'acceptedCaptures']) assert.equal(cleanup[key], 0);
  assert.equal(cleanup.productionAppDataTouched, false);
  const apk = JSON.parse(readFileSync(new URL('apk-preparation.json', base)));
  assert.equal(apk.applicationId, 'be.sportgreenmoove.app.local'); assert.equal(apk.emulatorHost, '127.0.0.1');
  assert.equal(apk.sourceCommit, receipt.sha); assert.equal(apk.deviceSessionStarted, false);
  assert.equal(apk.acceptedFlowEvidence, false); assert.equal(apk.buildSucceeded, true);
  const hashes = JSON.parse(readFileSync(new URL('artifact-sha256.json', base)));
  for (const [file, digest] of Object.entries(hashes)) {
    assert(!/[\\/]/.test(file)); assert.equal(createHash('sha256').update(readFileSync(new URL(file, base))).digest('hex'), digest);
  }
  const guide = readFileSync(new URL('../docs/release/browserstack-isolated-phone-test.md', import.meta.url), 'utf8');
  assert(guide.includes('do not\nbootstrap an unrestricted connection'));
  assert(guide.includes('never emit a raw accessibility tree'));
});
