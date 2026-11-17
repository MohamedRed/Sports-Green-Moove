import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { deleteApp, getApp } from 'firebase-admin/app';

const [sessionPath, checkpoints, gate, actionsPath, output] = process.argv.slice(2);
for (const path of [sessionPath, checkpoints, gate, actionsPath, output]) assert(isAbsolute(path ?? ''));
assert(!existsSync(output)); assert.equal(statSync(sessionPath).mode & 0o077, 0);
const session = JSON.parse(readFileSync(sessionPath)); assert.equal(session.projectId, 'demo-sgm-local-qa');
const checkpoint = JSON.parse(readFileSync(resolve(checkpoints, 'committed.json')));
const controller = JSON.parse(readFileSync(resolve(checkpoints, 'session-results.json')));
assert.equal(checkpoint.runId, session.runId); assert.equal(controller.runId, session.runId);
assert.equal(controller.completed, false); assert.equal(checkpoint.result.phase, 'committed');
process.env.SGM_QA_PASSWORD = session.password;
const { call, db, denied, signIn } = await import('./local-flow-client.mjs');
const normalize = value => JSON.parse(JSON.stringify(value));
try {
  const parent = await signIn(session.parent), foreign = await signIn(session.driver), fixture = checkpoint.fixture;
  const reports = (await db.collection('reports').where('reporterUserId', '==', parent.uid).get()).docs
    .map(row => ({ id: row.id, ...row.data() })).filter(row => row.reason === fixture.originalReport.reason);
  const operations = (await db.collection('supportSubmissionOperations').where('requesterUserId', '==', parent.uid).get()).docs
    .map(row => ({ id: row.id, ...row.data() }));
  assert.deepEqual(normalize(reports), [fixture.originalReport]); assert.deepEqual(normalize(operations), [fixture.originalOperation]);
  const view = await call('getMySupportReport', parent, { reportId: fixture.reportId });
  await denied('getMySupportReport', foreign, { reportId: fixture.reportId }, 'NOT_FOUND');
  const foreignList = await call('listMySupportReports', foreign); assert(!foreignList.items.some(row => row.id === fixture.reportId));
  const attempts = readdirSync(gate).filter(file => /^attempt-[a-f0-9-]+\.json$/.test(file))
    .map(file => JSON.parse(readFileSync(resolve(gate, file)))).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  assert(attempts.length >= 2); assert.equal(attempts[0].receipt.reused, false);
  assert(attempts.slice(1).every(row => row.receipt.reused === true));
  assert(attempts.every(row => row.receipt.reportId === fixture.reportId && row.receipt.clientRequestId === fixture.requestId));
  const actions = JSON.parse(readFileSync(actionsPath)), sends = actions.filter(row => row.label === 'native-initial-send-once');
  assert.equal(sends.length, 1); assert.equal(sends[0].status, 'completed');
  const between = actions.filter(row => row.label.startsWith('native-') && row.startedAt > sends[0].finishedAt && row.startedAt < attempts[1].recordedAt);
  assert.equal(between.length, 0);
  writeFileSync(output, JSON.stringify({ projectId: session.projectId, runId: session.runId, recordedAt: new Date().toISOString(),
    scope: 'post-failure-request-integrity-and-operator-journal-not-accepted-phone-recovery',
    reports: normalize(reports), operations: normalize(operations), attempts, view, foreignList, foreignReadDenied: true,
    originalRequestAndOperationUnchanged: true, recordedNativeSendActions: 1, noRecordedSecondNativeInputBeforeReplay: true,
    operatorJournalIsIndependentDeviceTrace: false, gateExpired: existsSync(resolve(gate, 'expired.json')),
    flowAccepted: false, processRestartVerified: false, explicitRetryVerified: false, productionWrites: false }, null, 2) + '\n',
    { flag: 'wx', mode: 0o600 });
  console.log('Incomplete experiment retained: unchanged request and operation, no recorded second native input before replay. No flow acceptance.');
} finally { await deleteApp(getApp()); delete process.env.SGM_QA_PASSWORD; }
