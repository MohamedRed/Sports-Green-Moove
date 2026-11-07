import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {compareTransferGuests, observeTransferGuest, parseGuestAdbdStat,
  summarizeGuestAdbdEvents} from '../scripts/diagnostics/adb-transfer-guest.mjs';
import {assertCopyReconnectReview,copyReconnectFolder,validateCopyReconnect} from '../scripts/qa/copy-reconnect-evidence.mjs';
import {content} from '../partner-portal/content.mjs';

const boot='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', changed='bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee';
const env={GITHUB_ACTIONS:'true',SGM_LOCAL_DISPOSABLE_EMULATOR:'true'};
const stat=(ticks='12345',state='S',pid=1715,name='adbd')=>`${pid} (${name}) ${[state,1,...Array(17).fill(0),ticks].join(' ')}`;
const line=message=>'10-31 22:41:06.638 1715 1788 I adbd : '+message;
function fixture({secondBoot=boot,secondStat=stat(),pidOutput='1715\n',failureId}={}) {
  const calls=[];
  const run=(adb,args,options)=>{
    assert.equal(adb,'/sdk/adb'); assert.deepEqual(args.slice(0,2),['-s','emulator-5554']);
    assert.equal(options.timeout,3000); assert.equal(options.maxBuffer,262144);
    const index=calls.length; calls.push(args.slice(2));
    if(index===failureId) return {status:1,stderr:'adb: device offline PRIVATE-SECRET',signal:null};
    const values=[boot,pidOutput,stat(),secondBoot,secondStat,
      [line('host-18: connection terminated: write failed'),line('host-19: read thread spawning'),
        line('adbd_auth: PRIVATE-SECRET')].join('\n')];
    return {status:0,signal:null,stdout:values[index],stderr:'PRIVATE-SECRET'};
  };
  return {calls,read:()=>observeTransferGuest('/sdk/adb','emulator-5554',run,{platform:'linux',env})};
}
test('bounded read-only guest observations retain boot digest and process birth, never raw IDs or auth logs',()=>{
  const f=fixture(), result=f.read(); assert.equal(result.completed,true); assert.equal(f.calls.length,6);
  assert.deepEqual(result.identity,{bootIdSha256:createHash('sha256').update(boot).digest('hex'),pid:1715,startedTicks:'12345'});
  assert.equal(result.commands.length,6); assert(result.commands.every(row=>row.completed));
  assert.deepEqual(result.events.events.map(row=>row.kind),['transport-write-failed','read-thread-started']);
  for(const key of ['rawLogsRetained','rawBootIdRetained','argumentsRead','environmentRead','deviceMutationRequested',
    'retryPerformed','continuityProven','rootCauseConfirmed']) assert.equal(result[key],false,key);
  assert.doesNotMatch(JSON.stringify(result),new RegExp(boot+'|PRIVATE-SECRET|adbd_auth'));
  assert.deepEqual(f.calls.at(-1),['logcat','-d','-b','main','-t','300','-v','threadtime','adbd:I','*:S']);
});
test('reboot, changed daemon birth and zombie state during a snapshot cannot establish identity',()=>{
  for(const options of [{secondBoot:changed},{secondStat:stat('99999')},{secondStat:stat('12345','Z')}]) {
    const result=fixture(options).read(); assert.equal(result.completed,false); assert.equal(result.identity,null);
  }
});
test('a malformed daemon selector cannot become a device command path',()=>{
  const f=fixture({pidOutput:'1715; PRIVATE-SECRET'}), result=f.read();
  assert.equal(result.completed,false); assert.equal(result.identity,null);
  assert(!f.calls.some(args=>args.some(value=>value.startsWith('/proc/1715'))));
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE-SECRET/);
});
test('an offline metadata request remains explicitly unavailable and is never retried',()=>{
  const f=fixture({failureId:2}), result=f.read(); assert.equal(result.identity,null);
  assert.deepEqual(result.commands[2],{id:'adbd-stat-before',completed:false,reason:'device-offline'});
  assert.equal(result.completed,false); assert.equal(f.calls.length,6);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE-SECRET|stderr|stdout/);
});
test('daemon identity checks reject replacement names, mismatched PIDs and zombies',()=>{
  for(const value of [stat('1','S',999),stat('1','S',1715,'other'),stat('1','Z')])
    assert.throws(()=>parseGuestAdbdStat(value,1715));
});
test('the narrow event allowlist excludes auth, payloads, unsupported tags and malformed clocks',()=>{
  const messages=['host-18: connection terminated: read failed','host-18: connection terminated: write failed',
    'host-18: offline','host-19: already offline','host-19: read thread spawning','host-19: write thread spawning',
    'host-18: read failed: Success','destroying transport host-18'];
  const result=summarizeGuestAdbdEvents([...messages.map(line),line('Calling send_auth_request... PRIVATE-SECRET'),
    line('host-19: read failed: PRIVATE-SECRET'),line('WRTE PRIVATE-SECRET'),
    line(messages[0]).replace('10-31','99-99'),line(messages[0]).replace('I adbd','I private-tag')].join('\n'));
  assert.equal(result.events.length,8); assert.equal(result.matchedEventCount,8);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE-SECRET|auth|WRTE|99-99|private-tag/);
  const bounded=summarizeGuestAdbdEvents(Array(80).fill(line(messages[0])).join('\n'));
  assert.equal(bounded.events.length,64); assert.equal(bounded.droppedEventCount,16);
  assert.throws(()=>summarizeGuestAdbdEvents('x'.repeat(262145)));
});
test('sampled sameness, replacement and missing metadata never claim continuous execution or root cause',()=>{
  const before=fixture().read(), same=compareTransferGuests(before,structuredClone(before));
  assert.equal(same.sameBootObserved,true); assert.equal(same.sameAdbdBirthObserved,true);
  const replaced=structuredClone(before); replaced.identity.startedTicks='9999';
  assert.equal(compareTransferGuests(before,replaced).sameAdbdBirthObserved,false);
  const rebooted=structuredClone(before); rebooted.identity.bootIdSha256='b'.repeat(64);
  assert.equal(compareTransferGuests(before,rebooted).sameBootObserved,false);
  const unavailable=compareTransferGuests(before,{identity:null});
  assert.equal(unavailable.sameBootObserved,null); assert.equal(unavailable.sameAdbdBirthObserved,null);
  for(const result of [same,unavailable]) for(const key of ['continuityProven','rootCauseConfirmed','releaseAccepted']) assert.equal(result[key],false,key);
});
test('foreign devices, non-CI hosts and unapproved environments are refused before device access',()=>{
  let calls=0; const run=()=>{calls++;};
  for(const [adb,serial,options] of [['adb','emulator-5554',{platform:'linux',env}],
    ['/sdk/adb','personal-phone',{platform:'linux',env}], ['/sdk/adb','emulator-5554',{platform:'darwin',env}],
    ['/sdk/adb','emulator-5554',{platform:'linux',env:{}}]]) assert.throws(()=>observeTransferGuest(adb,serial,run,options));
  assert.equal(calls,0);
});
test('guest sampling stays after app-absence checks, before original transfers and before remote cleanup',()=>{
  const source=readFileSync(new URL('../scripts/diagnostics/adb-transfer-probe.mjs',import.meta.url),'utf8');
  assert(source.indexOf("'product-app-absence'") < source.indexOf('report.guestBefore = observeGuest('));
  assert(source.indexOf('report.guestBefore = observeGuest(') < source.indexOf('for (let index = 0; index < transferTrialCount; index++)'));
  assert(source.indexOf('report.guestAfter = observeGuest(') < source.indexOf('report.cleanup ='));
  const guest=readFileSync(new URL('../scripts/diagnostics/adb-transfer-guest.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(guest,/wait-for-device|reconnect|kill-server|settings put|requestNetwork|writeFile|cmdline|environ['"]|getIdToken|Bearer/);
});

const root=fileURLToPath(new URL('..',import.meta.url));
test('the capacity recheck preserves the failed primary and later cleanup copy as different outcomes',()=>{
  assert.deepEqual(validateCopyReconnect(root),{ordinaryPassed:222,focusedPassed:11,capacityBlocksThisRun:false,
    primaryCopyPassed:false,fullNativeGateAccepted:false});
  assert(!content.blockers.some(row=>row.id==='native-device-capacity'));
  assert(content.updates.some(row=>row.source===copyReconnectFolder+'README.md'));
  assert.equal(content.blockers.find(row=>row.id==='native-evidence-copy').reconnectHistory.source,copyReconnectFolder+'README.md');
  assert.equal(content.flows.find(row=>row.id==='messages').status,'partial');
});
for(const key of ['unusedToolRemovalExercised','previousCapacityFailureBlocksThisRun','guestBirthObserved',
  'guestBootIdentityObserved','rootCauseConfirmed','primaryFailureReplacedByCleanup','fullNativeGateAccepted',
  'productCodeChanged','physicalDeviceAccepted','productionWrites','releaseAccepted'])
  test('the retained copy cannot promote '+key,()=>{
    const review=JSON.parse(readFileSync(new URL('../'+copyReconnectFolder+'review.json',import.meta.url)));
    review[key]=true;assert.throws(()=>assertCopyReconnectReview(review),new RegExp(key));
  });
