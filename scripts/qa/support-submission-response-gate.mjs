import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export const supportResponseGateInput = Object.freeze({ uid: 'sgm-qa-parent', reason: 'Support coupure QA',
  description: 'Demande de test avant une coupure.', emergency: true });

export async function holdSupportSubmissionResponse({ request, receipt, config, verifyCommitted }) {
  assert.equal(config.projectId, 'demo-sgm-local-qa'); assert.match(config.runId, /^[a-f0-9]{32}$/);
  assert(isAbsolute(config.output)); assert.equal(statSync(config.output).mode & 0o077, 0);
  assert(Number.isInteger(config.maxHoldMs) && config.maxHoldMs >= 20 && config.maxHoldMs <= 180_000);
  assert.equal(typeof verifyCommitted, 'function');
  const data = request.data, selected = request.auth?.uid === supportResponseGateInput.uid &&
    data?.reason === supportResponseGateInput.reason && data?.description === supportResponseGateInput.description &&
    data?.emergency === true && data?.subjectType === 'other';
  if (!selected) return receipt;
  assert.equal(receipt.requesterUserId, supportResponseGateInput.uid); assert.match(receipt.reportId, /^[a-f0-9]{64}$/);
  assert.equal(receipt.clientRequestId, data.clientRequestId); assert.equal(typeof receipt.reused, 'boolean');
  const committed = await verifyCommitted(); assert.equal(committed.reportId, receipt.reportId);
  assert.equal(committed.operationId, receipt.reportId); assert.equal(committed.originalContentVerified, true);
  assert.match(committed.digest, /^[a-f0-9]{64}$/);
  const record = { runId: config.runId, recordedAt: new Date().toISOString(), receipt, committed };
  writeFileSync(resolve(config.output, 'attempt-' + randomUUID() + '.json'), JSON.stringify(record, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const claimPath = resolve(config.output, 'held.json');
  try { writeFileSync(claimPath, JSON.stringify(record, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code === 'EEXIST') return receipt; throw error; }
  assert.equal(receipt.reused, false, 'The first held send must be a fresh real transaction');
  const response = request.rawRequest?.res;
  assert.equal(typeof response?.once, 'function'); assert.equal(typeof response?.removeListener, 'function');
  let closedAt = null;
  const closed = () => {
    closedAt = new Date().toISOString();
    writeFileSync(resolve(config.output, 'handler-response-closed.json'), JSON.stringify({ runId: config.runId, closedAt,
      scope: 'handler-transport-observation-not-device-network-proof', reportId: receipt.reportId }) + '\n', { flag: 'wx', mode: 0o600 });
  };
  response.once('close', closed);
  const deadline = Date.now() + config.maxHoldMs;
  try {
    const releasePath = resolve(config.output, 'release.json');
    while (!existsSync(releasePath)) {
      if (Date.now() >= deadline) {
        writeFileSync(resolve(config.output, 'expired.json'), JSON.stringify({ runId: config.runId, expiredAt: new Date().toISOString() }) + '\n',
          { flag: 'wx', mode: 0o600 });
        throw new Error('Isolated response gate expired; phone recovery is not verified');
      }
      await delay(50);
    }
    const release = JSON.parse(readFileSync(releasePath)); assert.equal(release.runId, config.runId); assert.equal(release.reportId, receipt.reportId);
    writeFileSync(resolve(config.output, 'released.json'), JSON.stringify({ runId: config.runId, releasedAt: new Date().toISOString(),
      reportId: receipt.reportId, handlerClosedBeforeReleaseAt: closedAt, receiptUnchanged: true }) + '\n', { flag: 'wx', mode: 0o600 });
    return receipt;
  } finally { response.removeListener('close', closed); }
}
