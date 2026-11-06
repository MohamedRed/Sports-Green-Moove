import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

export function checkOperationalPlatformEvidence() {
  const directory = mkdtempSync(join(tmpdir(), 'sgm-operational-platform-'));
  try {
    const artifact = join(directory, 'synthetic-assertion-fixture.txt');
    writeFileSync(artifact, 'Validator fixture only, not a physical test result.');
    const example = JSON.parse(readFileSync('docs/release/evidence-manifest.example.json'));
    const manifest = JSON.parse(readFileSync('docs/release/evidence-manifest.json'));
    const schema = JSON.parse(readFileSync('docs/release/evidence-schema.json'));
    const rule = schema.properties.operationalUserFlowEvidence.properties.items.items.allOf[0];
    const deviceIds = example.operationalUserFlowEvidence.items.filter(entry => entry.platformRuns).map(entry => entry.id);
    assert.deepEqual(rule.if.properties.id.enum, deviceIds);
    assert.deepEqual(rule.then.properties.platformRuns.allOf.map(entry => entry.contains.properties.platform.const), ['ios', 'android']);
    const id = 'team_push_closed_app_delivery';
    const row = platform => ({platform, status: 'passed', deviceKind: 'physical', deviceModel: 'synthetic validator model',
      osVersion: 'synthetic validator OS', appBuild: 'synthetic-validator-build', tester: 'synthetic validator',
      completedAt: '2026-11-06T12:00:00.000Z', observedResult: 'Synthetic validator assertion, not delivery proof.', evidenceRefs: [artifact]});
    const save = value => {
      const path = join(directory, 'manifest.json'); writeFileSync(path, JSON.stringify(value)); return path;
    };
    const item = value => value.operationalUserFlowEvidence.items.find(entry => entry.id === id);
    const incomplete = structuredClone(example);
    item(incomplete).status = 'accepted'; item(incomplete).platformRuns = [row('android')];
    const result = spawnSync(process.execPath, ['scripts/validate-release-evidence.mjs', '--allow-placeholders', save(incomplete)],
      {encoding: 'utf8'});
    assert.equal(result.status, 1, 'Android-only evidence must not accept a two-platform operational flow');
    assert.match(result.stderr, /team_push_closed_app_delivery.*ios/);
    const full = structuredClone(example);
    for (const entry of full.operationalUserFlowEvidence.items) if (entry.id.startsWith('team_push_') || entry.id === 'booking_ride_chat_access_revocation') {
      entry.status = 'accepted'; entry.platformRuns = [row('ios'), row('android')];
    }
    execFileSync(process.execPath, ['scripts/validate-release-evidence.mjs', '--allow-placeholders', save(full)], {stdio: 'pipe'});
    for (const deviceId of deviceIds) {
      const invalid = structuredClone(full);
      invalid.operationalUserFlowEvidence.items.find(entry => entry.id === deviceId).platformRuns.pop();
      const rejected = spawnSync(process.execPath, ['scripts/validate-release-evidence.mjs', '--allow-placeholders', save(invalid)], {encoding: 'utf8'});
      assert.equal(rejected.status, 1, deviceId + ' requires both platforms'); assert(rejected.stderr.includes(deviceId));
    }
    for (const [label, change] of [
      ['missing platform', entry => { entry.platformRuns.pop(); }],
      ['duplicate platform', entry => { entry.platformRuns[0] = row('android'); }],
      ['duplicate item', (entry, value) => { value.operationalUserFlowEvidence.items.push(structuredClone(entry)); }],
      ['unknown platform', entry => { entry.platformRuns.push(row('web')); }],
      ['simulator evidence', entry => { entry.platformRuns[0].deviceKind = 'simulator'; }],
      ['missing metadata', entry => { delete entry.platformRuns[0].appBuild; }],
      ['empty artifacts', entry => { entry.platformRuns[0].evidenceRefs = []; }],
      ['invalid completion', entry => { entry.platformRuns[0].completedAt = 'not-a-time'; }],
      ['unsupported private field', entry => { entry.platformRuns[0].accessToken = 'synthetic-never-a-token'; }],
    ]) {
      const invalid = structuredClone(full); change(item(invalid), invalid);
      const rejected = spawnSync(process.execPath, ['scripts/validate-release-evidence.mjs', '--allow-placeholders', save(invalid)], {encoding: 'utf8'});
      assert.equal(rejected.status, 1, label + ' must be rejected');
      assert.match(rejected.stderr, /team_push_closed_app_delivery/);
    }
    const reportWith = change => {
      const value = structuredClone(manifest), entry = item(value);
      entry.status = 'accepted'; entry.platformRuns = [row('ios'), row('android')]; change(entry);
      return JSON.parse(execFileSync(process.execPath, ['scripts/report-release-gaps.mjs', '--json', '--manifest', save(value)], {encoding: 'utf8'}));
    };
    assert(!reportWith(() => {}).operationalUserFlowEvidence.missing.includes(id));
    for (const change of [entry => { entry.platformRuns.pop(); }, entry => { entry.platformRuns[0].status = 'pending'; },
      entry => { entry.platformRuns[0].evidenceRefs = [join(directory, 'missing.txt')]; }]) {
      const report = reportWith(change);
      assert(report.operationalUserFlowEvidence.missing.includes(id));
      assert.equal(report.operationalUserFlowEvidence.ok, false);
    }
    const pending = structuredClone(example);
    item(pending).platformRuns = [{platform: 'ios', status: 'pending'}, {platform: 'android', status: 'pending'}];
    execFileSync(process.execPath, ['scripts/validate-release-evidence.mjs', '--allow-placeholders', save(pending)], {stdio: 'pipe'});
  } finally { rmSync(directory, {recursive: true, force: true}); }
}
