import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {isAbsolute} from 'node:path';
import {parseHostStat} from '../qa/emulator-host-observation.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
function bootIdentity(value) {
  const id = value.trim(); assert.match(id, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  return hash(id);
}
export function parseGuestAdbdStat(value, pid) {
  assert.match(value, /^\d+ \(adbd\) /);
  const row = parseHostStat(value); assert.equal(row.pid, pid); assert(!['Z','X'].includes(row.state));
  return {pid:row.pid, startedTicks:row.startedTicks};
}
export function summarizeGuestAdbdEvents(value) {
  assert.equal(typeof value,'string'); assert(Buffer.byteLength(value) <= 262144);
  const result = {rawLogsRetained:false, eventLimit:64, matchedEventCount:0, droppedEventCount:0, events:[]};
  for (const line of value.split('\n')) {
    const row = /^(\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+I\s+adbd\s*:\s+(.+)$/.exec(line);
    if (!row) continue;
    const [month,day,hour,minute,second]=row[1].split(/[- :.]/).map(Number);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59 ||
      ![row[2],row[3]].every(id=>/^[1-9]\d{0,9}$/.test(id))) continue;
    const peer = /^host-(\d{1,9}): (connection terminated: (?:read|write) failed|offline|already offline|read thread spawning|write thread spawning|read failed: Success)$/.exec(row[4]);
    const destroyed = /^destroying transport host-(\d{1,9})$/.exec(row[4]);
    if (!peer && !destroyed) continue;
    const actions = {'connection terminated: read failed':'transport-read-failed',
      'connection terminated: write failed':'transport-write-failed', offline:'offline', 'already offline':'already-offline',
      'read thread spawning':'read-thread-started', 'write thread spawning':'write-thread-started',
      'read failed: Success':'read-failed-reported-success'};
    result.events.push({timestampLocal:row[1], pid:Number(row[2]), tid:Number(row[3]),
      connection:Number((peer ?? destroyed)[1]), kind:destroyed ? 'transport-destroyed' : actions[peer[2]]});
    result.matchedEventCount++;
    if (result.events.length > result.eventLimit) {result.events.shift(); result.droppedEventCount++;}
  }
  return result;
}

export function observeTransferGuest(adb, serial, run=spawnSync, {platform=process.platform, env=process.env}={}) {
  assert.equal(platform,'linux'); assert.equal(env.GITHUB_ACTIONS,'true');
  assert.equal(env.SGM_LOCAL_DISPOSABLE_EMULATOR,'true'); assert(isAbsolute(adb)); assert.match(serial,/^emulator-\d+$/);
  const commands=[];
  const read = (id,args,select) => {
    let outcome;
    try {
      outcome=run(adb,['-s',serial,...args],{encoding:'utf8',timeout:3000,maxBuffer:262144,stdio:['ignore','pipe','pipe']});
      if (outcome.status !== 0 || outcome.signal || outcome.error) {
        const error=typeof outcome.stderr === 'string' ? outcome.stderr : '';
        commands.push({id,completed:false,reason:/device offline/.test(error) ? 'device-offline' :
          /[Pp]ermission denied/.test(error) ? 'permission-denied' : 'command-unavailable'}); return null;
      }
      const selected=select(outcome.stdout ?? ''); commands.push({id,completed:true,reason:null}); return selected;
    } catch {commands.push({id,completed:false,reason:'observation-unavailable'}); return null;}
  };
  const before=read('boot-before',['shell','cat','/proc/sys/kernel/random/boot_id'],bootIdentity);
  const pid=read('adbd-pid',['shell','pidof','adbd'],value=>{
    assert.match(value.trim(),/^[1-9]\d{0,9}$/); const id=Number(value.trim()); assert(Number.isSafeInteger(id)); return id;
  });
  const first=pid === null ? null : read('adbd-stat-before',['shell','cat',`/proc/${pid}/stat`],value=>parseGuestAdbdStat(value,pid));
  const after=read('boot-after',['shell','cat','/proc/sys/kernel/random/boot_id'],bootIdentity);
  const last=pid === null ? null : read('adbd-stat-after',['shell','cat',`/proc/${pid}/stat`],value=>parseGuestAdbdStat(value,pid));
  const events=read('adbd-events',['logcat','-d','-b','main','-t','300','-v','threadtime','adbd:I','*:S'],summarizeGuestAdbdEvents);
  const stable=before !== null && before === after && first !== null && last !== null && first.startedTicks === last.startedTicks;
  return {scope:'read-only-disposable-guest-identity-and-adbd-events-not-continuity-or-root-cause',
    observedAt:new Date().toISOString(),completed:stable && events !== null,
    identity:stable ? {bootIdSha256:before,...first} : null, commands, events,
    rawLogsRetained:false, rawBootIdRetained:false, argumentsRead:false, environmentRead:false,
    deviceMutationRequested:false, retryPerformed:false, continuityProven:false, rootCauseConfirmed:false};
}
export function compareTransferGuests(before, after) {
  const known=Boolean(before?.identity && after?.identity);
  const sameBoot=known ? before.identity.bootIdSha256 === after.identity.bootIdSha256 : null;
  return {scope:'sampled-guest-identities-not-continuous-lifecycle-proof',
    sameBootObserved:sameBoot, sameAdbdBirthObserved:known ? sameBoot && before.identity.pid === after.identity.pid &&
      before.identity.startedTicks === after.identity.startedTicks : null,
    continuityProven:false, rootCauseConfirmed:false, releaseAccepted:false};
}
