import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { waitForDisposableDevice } from './disposable-device-cleanup.mjs';

function selectionEvent(message) {
  let match = /^isReadyToReevaluate: subInfoInitialized=(true|false), carrierConfigsLoaded=(true|false), satelliteEnabledOrBeingEnabled=(true|false)$/.exec(message);
  if (match) return { type: 'readiness', subscriptionsInitialized: match[1] === 'true',
    carrierConfigurationsLoaded: match[2] === 'true', satelliteEnabledOrEnabling: match[3] === 'true' };
  match = /^onAllSubscriptionsLoaded: mSubInfoInitialized=(true|false)$/.exec(message);
  if (match) return { type: 'subscriptions-loaded', previouslyInitialized: match[1] === 'true' };
  if (/^Carrier config subId -?\d{1,10} is not loaded\.$/.test(message)) return { type: 'carrier-configuration-missing' };
  if (/^onCarrierConfigChanged phoneId -?\d{1,10} subId -?\d{1,10}$/.test(message)) return { type: 'carrier-configuration-change' };
  if (/^Radio unavailable on phone \d, clearing sub info initialized flag$/.test(message)) return { type: 'radio-unavailable' };
  if (/^updateDefaultValues: to only primary sub \d{1,10}$/.test(message)) return { type: 'single-primary-selected' };
  if (message === 'updateDefaults: No active sub. Setting default to INVALID sub.') return { type: 'no-active-subscription' };
  match = /^updateDefaultValues: change: ([0-7])$/.exec(message);
  if (match) return { type: 'primary-list-change', change: Number(match[1]) };
  const messages = { onSubscriptionsChanged: 'subscriptions-changed', updateDefaults: 'update-defaults',
    onDefaultDataSettingChanged: 'default-data-changed' };
  return Object.hasOwn(messages, message) ? { type: messages[message] } : null;
}

// Retain enums/booleans only: these OS messages also contain subscription IDs.
export function parseDefaultSelectionDiagnostics(output) {
  assert.equal(typeof output, 'string');
  assert(Buffer.byteLength(output) <= 2 * 1024 * 1024, 'Default selection diagnostic exceeds its bounded input');
  const events = [];
  let unrecognizedMessageCount = 0;
  for (const line of output.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
    if (/^--------- beginning of (main|radio|system)$/.test(line)) continue;
    const match = /^[VDIWEF]\/MultiSimSettingController\(\s*\d+\): (.*)$/.exec(line);
    assert(match, 'Unexpected default selection diagnostic format; raw output withheld');
    const event = selectionEvent(match[1]);
    if (event) events.push(event);
    else unrecognizedMessageCount++;
  }
  return { source: 'bounded-controller-log-history-not-current-os-state',
    recognizedEventCount: events.length, unrecognizedMessageCount,
    eventsTruncated: events.length > 128, events: events.slice(-128),
    lastReadiness: events.findLast((event) => event.type === 'readiness') ?? null };
}

export function collectDefaultSelectionDiagnostics(adb, serial, runId, phase, outputDir,
  execute = execFileSync, write = writeFileSync) {
  assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
  assert.match(serial, /^emulator-\d+$/); assert.match(runId, /^[a-f0-9]{32}$/);
  assert(['before', 'after'].includes(phase)); assert(isAbsolute(outputDir));
  waitForDisposableDevice(adb, serial, execute);
  let output;
  try {
    output = execute(adb, ['-s', serial, 'logcat', '-b', 'main', '-b', 'radio', '-b', 'system',
      '-d', '-v', 'brief', '-t', '2048', 'MultiSimSettingController:D', '*:S'],
    { encoding: 'utf8', timeout: 30_000, maxBuffer: 2 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    throw new Error('Disposable default selection diagnostic command failed; raw output withheld');
  }
  const receipt = { projectId: 'demo-sgm-local-qa', runId, phase,
    scope: 'read-only-disposable-default-selection-history', recordedAt: new Date().toISOString(),
    ...parseDefaultSelectionDiagnostics(output) };
  write(resolve(outputDir, `chat-default-selection-${phase}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}
