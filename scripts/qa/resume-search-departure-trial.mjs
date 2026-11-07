import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {connect} from 'node:net';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const trial = '/Users/mrr/.codex/sgm-native-comparison-20261030/search-departure-trial';
const originalRuntime = '/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-local-runtime-FzubIE';
const originalHelper = '/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-scoped-bs-H8DPbE';
assert(!existsSync(originalRuntime) && !existsSync(originalHelper));
for (const port of [5001, 8080, 9000, 9099, 49418]) assert(await new Promise(done => {
  const socket = connect({host: '127.0.0.1', port});
  socket.once('connect', () => {socket.destroy(); done(false);});
  socket.once('error', error => done(error.code === 'ECONNREFUSED'));
  socket.setTimeout(1000, () => {socket.destroy(); done(false);});
}), 'The original trial must be stopped before a new one is prepared');
for (const [path, digest] of Object.entries(JSON.parse(readFileSync(resolve(trial, 'after/source-sha256.json')))))
  assert.equal(createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex'), digest, path);
const path = resolve(trial, 'runtime/session.private.json');
assert.equal(statSync(path).mode & 0o077, 0);
const session = JSON.parse(readFileSync(path)); assert.equal(session.projectId, 'demo-sgm-local-qa');
assert.equal(session.parent, 'p@example.test'); assert.match(session.runId, /^[a-f0-9]{32}$/);
const checkpoint = JSON.parse(readFileSync(resolve(trial, 'records/before.json')));
assert.equal(checkpoint.runId, session.runId); assert.equal(checkpoint.phase, 'before');
rmSync(path);
writeFileSync(resolve(trial, 'preparation/interrupted-phone-trial.json'), JSON.stringify({
  scope: 'interrupted-before-authentication-not-product-or-phone-flow-result', observedAt: new Date().toISOString(),
  projectId: session.projectId, runId: session.runId, completedRecordPhases: ['before'],
  stoppedHandleIds: [66317, 77034, 74397], originalExitCodesObserved: false,
  originalProcessesIndependentlyAbsent: true, originalRuntimeDirectoryAbsent: true, originalHelperDirectoryAbsent: true,
  closedPorts: [5001, 8080, 9000, 9099, 49418], privateFixtureCredentialRemoved: !existsSync(path),
  authenticatedPhoneObserved: false, datePickerExercised: false, providerSessionEndedByAgent: false,
  phoneUninstallIndependentlyVerified: false, originalClipboardRestorationVerified: false,
  interruptionCauseEstablished: false, searchSubmitted: false, mapRequests: 0, releaseAccepted: false,
}, null, 2) + '\n', {flag: 'wx'});
const resumed = resolve(trial, 'resumed-20261031'); assert(!existsSync(resumed));
mkdirSync(resumed, {mode: 0o700}); mkdirSync(resolve(resumed, 'runtime'), {mode: 0o700});
mkdirSync(resolve(resumed, 'captures'), {mode: 0o700});
console.log(JSON.stringify({resumed, originalTrialAccepted: false, sourcesUnchanged: true}));
