import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {withoutHostDnsSteps, hostDnsTestStep} from './helpers/host-dns-workload.mjs';

const root = resolve(import.meta.dirname, '..'), read = path => readFileSync(resolve(root, path), 'utf8');
const workflow = path => parseDocument(read(path)).toJSON();
const baseline = hash => {
  const bytes = read('docs/release/evidence/source-archive/' + hash + '.txt');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hash); return parseDocument(bytes).toJSON();
};
const original = baseline('65fa9f5a78a300dcbfbcde419f498f288efb7cae4a5916c261ffdfcafbc9b7e8');
const focusedOriginal = baseline('a4f5be5c3bf78554a2ccd74beed7f7849f1c0afb97d9db1b04c1cebe52be20eb');
test('both existing network cases add only passive pre-launch observation, with every original job and case preserved', () => {
  const main = workflow('.github/workflows/native-ci.yml'), focused = workflow('.github/workflows/native-focused-ui.yml');
  assert.deepEqual(withoutHostDnsSteps(main.jobs), original.jobs);
  assert.deepEqual(withoutHostDnsSteps(focused.jobs, true), focusedOriginal.jobs);
  assert.equal(main.jobs['android-native-ui']['timeout-minutes'], 50);
  assert.equal(focused.jobs['focused-case']['timeout-minutes'], 25);
});
test('the workflow contract rejects extra phones, resolver overrides, skips, changed deadlines and altered original assertions', () => {
  const jobs = workflow('.github/workflows/native-ci.yml').jobs;
  for (const change of [
    jobs => jobs['android-native-ui']['timeout-minutes'] = 51,
    jobs => jobs['android-native-ui'].steps.find(row => row.name === 'Run Android Compose UI tests').with['emulator-options'] += ' -dns-server 8.8.8.8',
    jobs => jobs['android-native-ui'].steps.find(row => row.name === 'Observe host DNS before disposable launch').if = 'false',
    jobs => jobs['android-native-ui'].steps.find(row => row.name === 'Observe host DNS before disposable launch')['continue-on-error'] = true,
    jobs => jobs['android-native-ui'].steps.find(row => row.name === 'Observe host DNS before disposable launch').run = 'true',
    jobs => jobs['native-ui-coverage'].steps.find(row => row.name === 'Validate passive host DNS observations').run = 'true',
  ]) {
    const changed = structuredClone(jobs); change(changed);
    assert.throws(() => assert.deepEqual(withoutHostDnsSteps(changed), original.jobs));
  }
  const focused = workflow('.github/workflows/native-focused-ui.yml').jobs;
  for (const change of [
    jobs => jobs['focused-case'].strategy.matrix.case.push('another-phone'),
    jobs => jobs['focused-case'].steps.find(row => row.name === 'Observe host DNS before disposable launch').if = 'true',
  ]) {
    const changed = structuredClone(focused); change(changed);
    assert.throws(() => assert.deepEqual(withoutHostDnsSteps(changed, true), focusedOriginal.jobs));
  }
});
test('web verification runs the same bounded host tests as native coverage without replacing any older workload', () => {
  const web = workflow('.github/workflows/web-integration-smoke.yml');
  assert.deepEqual(web.jobs.smoke.steps.filter(row => row.name === hostDnsTestStep.name), [hostDnsTestStep]);
  for (const file of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const source = read('.github/workflows/' + file);
    for (const path of ['scripts/qa/*host-dns*.mjs', 'tests/host-dns-*.test.mjs', 'tests/helpers/host-dns-*.mjs'])
      assert.equal(source.split('"' + path + '"').length - 1, 2);
  }
});
