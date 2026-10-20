import assert from 'node:assert/strict';
import { createDecipheriv, generateKeyPairSync, privateDecrypt, constants } from 'node:crypto';
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
