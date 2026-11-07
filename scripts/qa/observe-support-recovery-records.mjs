import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { deleteApp, getApp } from 'firebase-admin/app';
import { verifySupportRecoveryCheckpoint } from './manual-support-recovery-checkpoints.mjs';

const [sessionPath, checkpointPath, gate, phase, output] = process.argv.slice(2);
for (const path of [sessionPath, checkpointPath, gate, output]) assert(isAbsolute(path ?? ''));
assert(['uncertain', 'reopened', 'confirmed', 'foreign', 'restored'].includes(phase));
assert(!existsSync(output)); assert.equal(statSync(sessionPath).mode & 0o077, 0);
const session = JSON.parse(readFileSync(sessionPath)); assert.equal(session.projectId, 'demo-sgm-local-qa');
const checkpoint = JSON.parse(readFileSync(checkpointPath));
assert.equal(checkpoint.runId, session.runId); assert.equal(checkpoint.result.phase, 'committed');
process.env.SGM_QA_PASSWORD = session.password;
const { call, db, denied, signIn } = await import('./local-flow-client.mjs');
const gateJson = name => existsSync(resolve(gate, name)) ? JSON.parse(readFileSync(resolve(gate, name))) : null;
try {
  const parent = await signIn(session.parent), foreign = await signIn(session.driver);
  const fixture = { ...checkpoint.fixture };
  const reports = (await db.collection('reports').where('reporterUserId', '==', parent.uid).get()).docs
    .map(row => ({ id: row.id, ...row.data() })).filter(row => row.reason === fixture.originalReport.reason);
  const operations = (await db.collection('supportSubmissionOperations').where('requesterUserId', '==', parent.uid).get()).docs
    .map(row => ({ id: row.id, ...row.data() }));
  const requesterView = await call('getMySupportReport', parent, { reportId: fixture.reportId });
  await denied('getMySupportReport', foreign, { reportId: fixture.reportId }, 'NOT_FOUND'); fixture.foreignReadDenied = true;
  const foreignList = await call('listMySupportReports', foreign);
  const replies = (await db.collection('reports').doc(fixture.reportId).collection('publicReplies').get()).docs.map(row => row.data());
  const notifications = (await db.collection('notifications').get()).docs.map(row => row.data())
    .filter(row => JSON.stringify(row).includes(fixture.reportId));
  const attempts = readdirSync(gate).filter(file => /^attempt-[a-f0-9-]+\.json$/.test(file)).map(gateJson);
  const state = JSON.parse(JSON.stringify({ reports, operations, attempts, held: gateJson('held.json'),
    released: gateJson('released.json'), expired: !!gateJson('expired.json'), requesterView, foreignList, replies, notifications }));
  const result = verifySupportRecoveryCheckpoint(phase, state, fixture);
  assert(!state.foreignList.items.some(row => row.id === fixture.reportId));
  writeFileSync(output, JSON.stringify({ projectId: session.projectId, runId: session.runId, recordedAt: new Date().toISOString(),
    scope: 'read-only-support-record-checkpoint-not-phone-network-or-process-proof', fixture, state, result,
    baselineScope: 'saved-request-and-operation-only-after-committed-checkpoint', foreignReadDenied: true,
    physicalUiVerifiedByScript: false, physicalNetworkVerifiedByScript: false, processIdentityVerifiedByScript: false,
    flowAccepted: false, productionWrites: false }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log('Read-only support record checkpoint passed: ' + phase + '. Phone evidence remains separate.');
} finally { await deleteApp(getApp()); delete process.env.SGM_QA_PASSWORD; }
