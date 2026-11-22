import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

export function installSupportResponseGate(runtime, output) {
  assert(isAbsolute(output) && !existsSync(output), 'A fresh private response-gate directory is required');
  assert.equal(runtime.env.GCLOUD_PROJECT, 'demo-sgm-local-qa'); assert.match(runtime.env.SGM_LOCAL_RUN_ID, /^[a-f0-9]{32}$/);
  const lib = resolve(runtime.temp, 'functions/lib'), entry = resolve(lib, 'index.js');
  const source = readFileSync(entry, 'utf8'), original = 'export { submitSupportReport } from "./callables/supportSubmission.js";';
  assert.equal(source.split(original).length, 2, 'Instrument exactly the selected copied callable export');
  assert(source.startsWith("import './local-egress-guard.mjs';"));
  mkdirSync(output, { mode: 0o700 });
  const config = { projectId: 'demo-sgm-local-qa', runId: runtime.env.SGM_LOCAL_RUN_ID, output, maxHoldMs: 180_000 };
  writeFileSync(resolve(lib, 'qa-support-gate-config.json'), JSON.stringify(config), { flag: 'wx', mode: 0o600 });
  cpSync(resolve(import.meta.dirname, 'support-submission-response-gate.mjs'), resolve(lib, 'qa-support-response-gate.mjs'));
  writeFileSync(resolve(lib, 'qa-support-submission.js'), `import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onCall } from 'firebase-functions/v2/https';
import { submitSupportReport as original } from './callables/supportSubmission.js';
import { firestore } from './lib/firebase.js';
import { supportSubmissionSchema, supportSubmissionIdentity } from './domain/supportSubmission.js';
import { holdSupportSubmissionResponse } from './qa-support-response-gate.mjs';
const config = JSON.parse(readFileSync(new URL('./qa-support-gate-config.json', import.meta.url)));
assert.equal(process.env.GCLOUD_PROJECT, config.projectId); assert.equal(process.env.FUNCTIONS_EMULATOR, 'true');
assert.equal(typeof original.run, 'function');
export const submitSupportReport = onCall({ timeoutSeconds: 240 }, async request => {
  const receipt = await original.run(request);
  return holdSupportSubmissionResponse({ request, receipt, config, verifyCommitted: async () => {
    const input = supportSubmissionSchema.parse(request.data), identity = supportSubmissionIdentity(request.auth.uid, input);
    assert.equal(receipt.reportId, identity.id);
    const [report, operation] = await firestore.getAll(firestore.collection('reports').doc(receipt.reportId),
      firestore.collection('supportSubmissionOperations').doc(receipt.reportId));
    assert(report.exists && operation.exists); assert.equal(report.get('reporterUserId'), request.auth.uid);
    for (const [field, value] of Object.entries(identity.content)) assert.equal(report.get(field) ?? null, value);
    assert.equal(operation.get('digest'), identity.digest); assert.equal(operation.get('clientRequestId'), input.clientRequestId);
    return { reportId: report.id, operationId: operation.id, digest: identity.digest, originalContentVerified: true };
  }});
});\n`, { flag: 'wx' });
  writeFileSync(entry, source.replace(original, 'export { submitSupportReport } from "./qa-support-submission.js";'));
  return config;
}
