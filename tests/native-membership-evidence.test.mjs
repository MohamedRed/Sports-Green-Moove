import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { content, captures } from '../partner-portal/content.mjs';

const root = new URL('../', import.meta.url);
const base = 'docs/release/evidence/local-membership-refresh-2026-10-16/';
const bytes = (name) => readFileSync(new URL(base + name, root));
const read = (name) => bytes(name).toString('utf8');

test('native membership captures require the completed sixteen-case replay and exact saved decisions', () => {
  const run = JSON.parse(read('results.json'));
  assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.runId, '32718a1063c5fc003cda4cc4142208ab');
  assert.equal(run.scope, 'local-ui-not-physical-device');
  assert.equal(run.testCount, 16); assert.equal(run.steps.length, 17);
  assert(run.steps.every((step) => step.status === 'passed'));
  assert.deepEqual(run.membershipRefresh, {
    method: 'app-request-refresh-ui-with-local-sdk-manager-decisions-and-persisted-checks',
    records: [
      { clubId: 'sgm-qa-native-approve', status: 'active', active: true, memberCount: 2, reviewCount: 1 },
      { clubId: 'sgm-qa-native-reject', status: 'active', active: true, memberCount: 2, reviewCount: 2 },
    ], reviewCount: 3, notificationCount: 3, roleEscalation: false, livePush: false,
    limitation: 'Manager decisions use authenticated local SDK calls, not a mobile management UI.',
  });
  const flow = content.flows.find((item) => item.id === 'clubs');
  assert.equal(flow.status, 'partial');
  assert.equal(flow.ui.source, 'docs/release/evidence/local-guardian-review-2026-10-18/results.json');
  for (const file of ['membership-parent', 'membership-reopened', 'membership-account']) {
    assert.match(flow.images.find((image) => image.file === file).alt, /16 octobre/);
  }
  assert(run.steps.some((step) => step.id === 'membership-refresh-ui' && step.status === 'passed'));
  assert.match(readFileSync(new URL(flow.source, root), 'utf8'), /local-membership-refresh-2026-10-16\/README.md/);
  assert.match(flow.remaining, /enfant/); assert.match(flow.remaining, /téléphone/);
  assert.match(read('README.md'), /not a process restart/);
  assert.match(read('README.md'), /not deployed to production/);
});

test('original native captures and normalized reports retain their exact scope', () => {
  for (const [file, height] of [['local-membership-approved-refused.png', 2400],
    ['local-membership-after-restart.png', 2272], ['local-membership-other-account.png', 2272]]) {
    const image = bytes(file);
    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(image.readUInt32BE(16), 1080); assert.equal(image.readUInt32BE(20), height);
    assert(Object.values(captures).includes(base + file));
  }
  const report = read('membership-replay-passed.txt');
  assert.match(report, /OK \(1 test\)/);
  assert(!/FAILURES|INSTRUMENTATION_FAILED/.test(report));
  assert.equal(report, gunzipSync(bytes('membership-replay-original.txt.gz')).toString('utf8').replace(/\n+$/, '\n'));
  const xml = read('general-ui-replay-passed.xml');
  assert.match(xml, /tests="64" failures="0" errors="0" skipped="11"/);
  assert.equal((xml.match(/classname="be.sportgreenmoove.app.ui.GroupsLayoutTest"/g) || []).length, 3);
  assert.equal(xml, gunzipSync(bytes('general-ui-replay-original.xml.gz')).toString('utf8')
    .replace(/\r\n/g, '\n').replace(/[\t ]+$/gm, ''));
});
