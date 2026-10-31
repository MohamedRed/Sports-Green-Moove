import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { waitForDisposableDevice } from './disposable-device-cleanup.mjs';

const inputLimit = 2 * 1024 * 1024;
const invalid = 'Unexpected carrier loader state; raw output withheld';

// The dump also contains carrier settings and cached SIM filenames. Never retain it.
export function parseCarrierDiagnostics(output) {
  assert.equal(typeof output, 'string');
  assert(Buffer.byteLength(output) <= inputLimit, 'Carrier diagnostic exceeds its bounded input');
  const lines = output.split(/\r?\n/);
  assert(/^CarrierConfigLoader: com\.android\.phone\.CarrierConfigLoader@[a-f0-9]+$/.test(lines[0]), invalid);
  const end = lines.indexOf('CarrierConfigLoader local log=');
  assert(end > 0, invalid);
  const state = lines.slice(1, end);
  const field = (name) => {
    const matches = state.filter((line) => line.startsWith(`${name}=`));
    assert.equal(matches.length, 1, invalid);
    return matches[0].slice(name.length + 1);
  };
  const count = field('mNumPhones');
  assert(/^[1-8]$/.test(count), invalid);
  const phoneCount = Number(count);
  const slots = state.filter((line) => line.startsWith('Phone Id = '));
  assert.equal(slots.length, phoneCount, invalid);
  assert(slots.every((line, index) => line === `Phone Id = ${index}`), invalid);
  const configBundlePresent = {};
  for (const [name, fieldName] of Object.entries({ defaultApp: 'mConfigFromDefaultApp',
    carrierApp: 'mConfigFromCarrierApp', persistentOverride: 'mPersistentOverrideConfigs',
    transientOverride: 'mOverrideConfigs' })) {
    configBundlePresent[name] = slots.map((slot, index) => {
      const start = state.indexOf(slot) + 1;
      const end = index + 1 < phoneCount ? state.indexOf(slots[index + 1]) : state.length;
      const matches = state.slice(start, end).filter(line => line.trimStart().startsWith(`${fieldName} :`));
      assert.equal(matches.length, 1, invalid);
      const match = new RegExp(`^\\s+${fieldName} :\\s*(null)?\\s*$`).exec(matches[0]);
      assert(match !== null, invalid);
      return match[1] !== 'null';
    });
  }
  const booleans = (name) => {
    const value = field(name);
    assert(/^\[(true|false)(, (true|false))*\]$/.test(value), invalid);
    const parsed = JSON.parse(value);
    assert.equal(parsed.length, phoneCount, invalid);
    return parsed;
  };
  return {
    source: 'current-carrier-loader-state-not-default-selection-readiness', phoneCount,
    configChangeSent: booleans('mHasSentConfigChange'),
    fromSystemUnlocked: booleans('mFromSystemUnlocked'),
    serviceBoundForNoSimConfig: booleans('mServiceBoundForNoSimConfig'),
    configBundlePresent,
  };
}

export function collectCarrierDiagnostics(adb, serial, runId, phase, outputDir,
  execute = execFileSync, write = writeFileSync) {
  assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
  assert.match(serial, /^emulator-\d+$/); assert.match(runId, /^[a-f0-9]{32}$/);
  assert(['before', 'after'].includes(phase)); assert(isAbsolute(outputDir));
  waitForDisposableDevice(adb, serial, execute);
  let output;
  try {
    output = execute(adb, ['-s', serial, 'shell', 'dumpsys', 'carrier_config'],
      { encoding: 'utf8', timeout: 30_000, maxBuffer: inputLimit, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    throw new Error('Disposable carrier loader diagnostic command failed; raw output withheld');
  }
  const receipt = { projectId: 'demo-sgm-local-qa', runId, phase,
    scope: 'read-only-disposable-carrier-loader-state', recordedAt: new Date().toISOString(),
    ...parseCarrierDiagnostics(output) };
  write(resolve(outputDir, `chat-carrier-${phase}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}
