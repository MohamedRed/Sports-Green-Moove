import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { waitForDisposableDevice } from './disposable-device-cleanup.mjs';

const simStates = new Set(['UNKNOWN', 'ABSENT', 'PIN_REQUIRED', 'PUK_REQUIRED', 'NETWORK_LOCKED',
  'READY', 'NOT_READY', 'PERM_DISABLED', 'CARD_IO_ERROR', 'CARD_RESTRICTED', 'LOADED', 'PRESENT']);

function exactlyOne(lines, expression) {
  const matches = lines.map((line) => expression.exec(line)).filter(Boolean);
  assert.equal(matches.length, 1, 'Unrecognized subscription diagnostic schema');
  return matches[0][1];
}

// Never retain the raw service dump: it includes SIM, phone and subscriber identifiers.
export function parseSubscriptionDiagnostics(output) {
  const lines = output.split(/\r?\n/).map((line) => line.trim());
  assert.equal(lines.filter((line) => line === 'SubscriptionManagerService:').length, 1);
  const modemCount = Number(exactlyOne(lines, /^Active modem count=([0-8])$/));
  const allSubscriptionsLoaded = exactlyOne(lines, /^areAllSubscriptionsLoaded=(true|false)$/) === 'true';
  const defaults = {};
  for (const name of ['defaultSubId', 'defaultVoiceSubId', 'defaultDataSubId', 'activeDataSubId', 'defaultSmsSubId']) {
    const value = Number(exactlyOne(lines, new RegExp(`^${name}=(-?\\d{1,10})$`)));
    assert(Number.isInteger(value) && value >= -2147483648 && value <= 2147483647);
    defaults[name] = value >= 0;
  }
  const mapping = lines.map((line) => /^Logical SIM slot ([0-7]): subId=(\d{1,10})$/.exec(line)).filter(Boolean);
  assert.equal(mapping.length, lines.filter((line) => line.startsWith('Logical SIM slot ')
    && line !== 'Logical SIM slot sub id mapping:').length, 'Unrecognized SIM-slot mapping');
  const slots = mapping.map((match) => Number(match[1]));
  assert.equal(new Set(slots).size, slots.length);
  assert(slots.every((slot) => slot < modemCount));
  const sims = lines.map((line) => /^mSimState\[([0-7])\]=(\w+)$/.exec(line)).filter(Boolean);
  assert.equal(sims.length, modemCount, 'Missing SIM-state diagnostic');
  assert.equal(new Set(sims.map((match) => match[1])).size, modemCount);
  assert(sims.every((match) => Number(match[1]) < modemCount && simStates.has(match[2])));

  // Local-log events preserve ordering without IDs, timestamps or free-form messages.
  const events = [];
  for (const line of lines) {
    const state = /updateSimState: slot [0-7] (\w+)$/.exec(line)?.[1];
    if (state && simStates.has(state)) events.push(`sim-${state}`);
    else if (/updateSubscription: No ICCID available for phone [0-7]$/.test(line)) events.push('missing-icc-id');
    else if (/updateSubscription: current mapping \[\]$/.test(line)) events.push('mapping-empty');
    else if (/updateSubscription: current mapping \[slot [0-7]: subId=\d+\]$/.test(line)) events.push('mapping-single');
    else if (/markSubscriptionsInactive: slot [0-7]$/.test(line)) events.push('subscription-inactive');
    else if (/Database has not been initialized\./.test(line)) events.push('database-not-initialized');
  }
  return { modemCount, allSubscriptionsLoaded, defaultSubscriptionValid: defaults,
    mappedSlotCount: slots.length, simStates: sims.sort((a, b) => Number(a[1]) - Number(b[1])).map((match) => match[2]),
    recognizedEventCount: events.length, eventsTruncated: events.length > 128, events: events.slice(-128) };
}

export function collectDisposableSubscriptions(adb, serial, runId, phase, outputDir,
  execute = execFileSync, write = writeFileSync) {
  assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
  assert.match(serial, /^emulator-\d+$/); assert.match(runId, /^[a-f0-9]{32}$/);
  assert(['before', 'after'].includes(phase)); assert(isAbsolute(outputDir));
  waitForDisposableDevice(adb, serial, execute);
  let output;
  try {
    output = execute(adb, ['-s', serial, 'shell', 'dumpsys', 'isub'],
      { encoding: 'utf8', timeout: 30_000, maxBuffer: 2 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    // Child-process errors embed raw stdout/stderr; do not attach them to the public failure.
    throw new Error('Disposable subscription diagnostic command failed; raw output withheld');
  }
  const diagnostic = parseSubscriptionDiagnostics(output);
  const receipt = { projectId: 'demo-sgm-local-qa', runId, phase,
    scope: 'read-only-disposable-subscription-summary', recordedAt: new Date().toISOString(), ...diagnostic };
  write(resolve(outputDir, `chat-subscriptions-${phase}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}
