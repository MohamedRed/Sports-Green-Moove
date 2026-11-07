import {spawnSync} from 'node:child_process';
import {closeSync, constants, fstatSync, lstatSync, openSync, readSync, readlinkSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {summarizeResolverConfiguration} from './host-dns-configuration.mjs';

const primary = '/etc/resolv.conf', upstream = '/run/systemd/resolve/resolv.conf';
const layouts = new Map([[primary, 'regular'], ['/run/systemd/resolve/stub-resolv.conf', 'systemd-stub'],
  [upstream, 'systemd-upstream'], ['/usr/lib/systemd/resolv.conf', 'systemd-static']]);
const fs = {closeSync, fstatSync, lstatSync, openSync, readSync, readlinkSync};
const fail = kind => {throw Object.assign(new Error('Host resolver input unavailable; raw data withheld'), {observationKind: kind});};
const kinds = new Set(['unsupported-link', 'untrusted-owner', 'not-regular', 'oversized', 'changed-during-read', 'invalid-utf8', 'malformed-configuration']);
function reason(error) {
  if (kinds.has(error?.observationKind)) return error.observationKind;
  if (error?.code === 'ENOENT') return 'not-found';
  if (['EACCES', 'EPERM'].includes(error?.code)) return 'not-readable';
  return 'input-unavailable';
}
function inspectFile(path, io) {
  let fd, result;
  try {
    let target = path;
    const entry = io.lstatSync(path);
    if (entry.uid !== 0) fail('untrusted-owner');
    if (entry.isSymbolicLink()) {
      target = resolve(dirname(path), io.readlinkSync(path));
      if (path !== primary || !layouts.has(target) || target === primary) fail('unsupported-link');
    } else if (!entry.isFile()) fail('not-regular');
    fd = io.openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = io.fstatSync(fd);
    if (!before.isFile()) fail('not-regular');
    if (before.uid !== 0 || (before.mode & 0o022)) fail('untrusted-owner');
    if (before.size > 65536) fail('oversized');
    const buffer = Buffer.alloc(65537); let length = 0, count;
    do {count = io.readSync(fd, buffer, length, buffer.length - length, null); length += count;} while (count && length < buffer.length);
    if (length > 65536) fail('oversized');
    const after = io.fstatSync(fd);
    if (['ino', 'dev', 'size', 'mtimeMs', 'uid', 'mode'].some(key => before[key] !== after[key])) fail('changed-during-read');
    let raw, configuration;
    try {raw = new TextDecoder('utf-8', {fatal: true}).decode(buffer.subarray(0, length));} catch {fail('invalid-utf8');}
    try {configuration = summarizeResolverConfiguration(raw);} catch {fail('malformed-configuration');}
    result = {requested: true, observed: true, layout: layouts.get(target), configuration};
  } catch (error) {result = {requested: true, observed: false, reason: reason(error)};}
  finally {
    if (fd !== undefined) try {io.closeSync(fd);} catch {result = {requested: true, observed: false, reason: 'close-unavailable'};}
  }
  return result;
}

function inspectService(run) {
  try {
    const result = run('/usr/bin/systemctl', ['is-active', 'systemd-resolved.service'], {encoding: 'utf8',
      timeout: 2000, maxBuffer: 4096, env: {PATH: '/usr/bin:/bin', LC_ALL: 'C'}, stdio: ['ignore', 'pipe', 'pipe']});
    if (result.error || result.signal) return {requested: true, observed: false,
      reason: result.error?.code === 'ETIMEDOUT' ? 'timed-out' : 'service-observation-unavailable'};
    const state = String(result.stdout ?? '').trim();
    if (![0, 3, 4].includes(result.status) || !['active', 'reloading', 'inactive', 'failed', 'activating', 'deactivating',
      'maintenance', 'refreshing', 'unknown'].includes(state)) return {requested: true, observed: false, reason: 'unrecognized-service-state'};
    return {requested: true, observed: true, state, exitStatus: result.status};
  } catch {return {requested: true, observed: false, reason: 'service-observation-unavailable'};}
}

export function inspectHostDnsConfiguration({platform = process.platform, io = fs, run = spawnSync} = {}) {
  if (platform !== 'linux') return {supported: false, reason: 'unsupported-host'};
  const config = inspectFile(primary, io);
  // Upstream metadata is an independent observation, never a replacement resolver.
  const upstreamConfig = config.observed && ['systemd-stub', 'systemd-static'].includes(config.layout) ? inspectFile(upstream, io) :
    {requested: false, observed: false, reason: 'not-applicable'};
  return {supported: true, atomicObservation: false, primary: config, systemdUpstream: upstreamConfig,
    resolvedService: inspectService(run), dnsQueriesIssued: false, networkRequestsIssued: false,
    settingsChanged: false, serviceChanged: false, exactEmulatorDnsBindingVerified: false, rootCauseConfirmed: false};
}
