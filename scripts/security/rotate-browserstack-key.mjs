import { constants, createCipheriv, createPublicKey, publicEncrypt, randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const recentApps = 'https://api-cloud.browserstack.com/app-live/recent_apps?limit=1';
const rotationUrl = 'https://api.browserstack.com/automate/recycle_key.json';

export function rotationSettings(env) {
  const names = ['BROWSERSTACK_USERNAME', 'BROWSERSTACK_ACCESS_KEY', 'ROTATION_PUBLIC_KEY',
    'ROTATION_REQUEST_ID', 'GITHUB_REPOSITORY', 'GITHUB_RUN_ID', 'GITHUB_SHA'];
  if (names.some(name => !env[name])) throw new Error('Required rotation settings are missing.');
  if (!/^[a-f0-9-]{36}$/.test(env.ROTATION_REQUEST_ID)) throw new Error('Invalid rotation request ID.');
  const key = createPublicKey(env.ROTATION_PUBLIC_KEY);
  if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength < 3072) {
    throw new Error('A dedicated RSA public key of at least 3072 bits is required.');
  }
  return { username: env.BROWSERSTACK_USERNAME, accessKey: env.BROWSERSTACK_ACCESS_KEY, key,
    requestId: env.ROTATION_REQUEST_ID, repository: env.GITHUB_REPOSITORY,
    runId: env.GITHUB_RUN_ID, sha: env.GITHUB_SHA };
}

export async function rotateKey(settings, { fetchImpl = fetch, save = writeFile } = {}) {
  const request = (url, key, method = 'GET') => fetchImpl(url, {
    method, redirect: 'error', signal: AbortSignal.timeout(30_000),
    headers: { Authorization: `Basic ${Buffer.from(`${settings.username}:${key}`).toString('base64')}`,
      'Content-Type': 'application/json' },
    ...(method === 'PUT' ? { body: '{}' } : {}),
  });
  const before = await request(recentApps, settings.accessKey);
  if (before.status !== 200) throw new Error('Existing credentials could not be verified; no rotation attempted.');
  await before.body?.cancel();
  // Never retry this non-idempotent request, including after a timeout.
  const response = await request(rotationUrl, settings.accessKey, 'PUT');
  if (response.status !== 200) throw new Error('Rotation was not confirmed; inspect the account before retrying.');
  const result = await response.json();
  if (typeof result.new_key !== 'string' || !result.new_key || result.new_key === settings.accessKey) {
    throw new Error('Rotation response is incomplete; inspect the account before retrying.');
  }
  const identity = { requestId: settings.requestId, repository: settings.repository,
    runId: settings.runId, sha: settings.sha };
  const contentKey = randomBytes(32), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', contentKey, iv);
  cipher.setAAD(Buffer.from(JSON.stringify(identity)));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify({ ...identity,
    username: settings.username, accessKey: result.new_key })), cipher.final()]);
  const wrappedKey = publicEncrypt({ key: settings.key, padding: constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256' }, contentKey);
  // Persist only ciphertext before checking revocation, so a failed check does not lose recovery.
  await save('browserstack-key.encrypted.json', JSON.stringify({ version: 1, ...identity,
    algorithm: 'RSA-OAEP-SHA256+A256GCM', wrappedKey: wrappedKey.toString('base64'),
    iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64') }), { flag: 'wx', mode: 0o600 });
  const current = await request(recentApps, result.new_key);
  const revoked = await request(recentApps, settings.accessKey);
  const receipt = { version: 1, ...identity, rotatedAt: new Date().toISOString(),
    newKeyAccepted: current.status === 200, oldKeyRejected: revoked.status === 401,
    newKeyStatus: current.status, oldKeyStatus: revoked.status,
    scope: 'credential-rotation-only-no-device-session-or-app-upload' };
  await current.body?.cancel();
  await revoked.body?.cancel();
  await save('browserstack-key-rotation-receipt.json', JSON.stringify(receipt, null, 2), { flag: 'wx' });
  if (!receipt.newKeyAccepted || !receipt.oldKeyRejected) {
    throw new Error('Encrypted key retained, but credential verification is incomplete. Do not rotate again automatically.');
  }
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await rotateKey(rotationSettings(process.env));
    console.log('Access key rotated; encrypted handoff and sanitized verification receipt saved.');
  } catch {
    console.error('Credential maintenance did not complete. Inspect the encrypted artifact and account before any retry.');
    process.exitCode = 1;
  }
}
