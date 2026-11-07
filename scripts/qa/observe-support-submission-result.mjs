import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { deleteApp, getApp } from 'firebase-admin/app';
import { verifySupportLateConfirmation, verifySupportUnclassifiedReplay } from './manual-support-recovery-checkpoints.mjs';

const [sessionPath, checkpointPath, gate, output] = process.argv.slice(2);
for (const path of [sessionPath, checkpointPath, gate, output]) assert(isAbsolute(path ?? ''));
assert(!existsSync(output)); assert.equal(statSync(sessionPath).mode & 0o077, 0);
const session = JSON.parse(readFileSync(sessionPath)); assert.equal(session.projectId, 'demo-sgm-local-qa');
const checkpoint = JSON.parse(readFileSync(checkpointPath));
assert.equal(checkpoint.runId, session.runId); assert.equal(checkpoint.projectId, session.projectId);
assert.equal(checkpoint.result.phase, 'uncertain');
process.env.SGM_QA_PASSWORD = session.password;
const { call, db, denied, signIn } = await import('./local-flow-client.mjs');
const normalize = value => JSON.parse(JSON.stringify(value));
const gateJson = name => existsSync(resolve(gate, name)) ? JSON.parse(readFileSync(resolve(gate, name))) : null;
try {
  const parent = await signIn(session.parent), foreign = await signIn(session.driver);
  const fixture = checkpoint.fixture;
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
  const state = normalize({ reports, operations, attempts, held: gateJson('held.json'), released: gateJson('released.json'),
    expired: !!gateJson('expired.json'), requesterView, foreignList, replies, notifications });
  let result, lateConfirmationAccepted = true;
  try { result = verifySupportLateConfirmation(state, fixture); }
  catch (error) {
    if (state.attempts.length !== 2) throw error;
    lateConfirmationAccepted = false;
    result = verifySupportUnclassifiedReplay(state, fixture);
  }
  writeFileSync(output, JSON.stringify({ projectId: session.projectId, runId: session.runId, testedAt: new Date().toISOString(),
    fixture, state, result, lateConfirmationAccepted, productionWrites: false,
    baselineScope: 'saved-request-and-operation-only-after-uncertain-checkpoint',
    physicalNetworkStateVerifiedByScript: false, physicalUiVerifiedByScript: false }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(lateConfirmationAccepted ? 'One unchanged report and operation, one handler attempt, foreign access denied.'
    : 'Late-confirmation claim REJECTED: two handler attempts, one unchanged report and operation. Replay origin unproven; flow not accepted.');
} finally { await deleteApp(getApp()); delete process.env.SGM_QA_PASSWORD; }
