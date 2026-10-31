import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [input,destination]=process.argv.slice(2);
assert(input?.startsWith('/') && destination?.startsWith('/') && !existsSync(destination)); mkdirSync(destination,{recursive:true});
const write=(file,row)=>writeFileSync(resolve(destination,file),JSON.stringify(row,null,2)+'\n');
const local='outputs/local-ui-evidence/3b42b1824b7184809ce48528d7ee7a17';
for(const [folder,file,name] of [
  [local,'adb-pull-trip-change-schedule.json','primary-copy.json'],[local,'adb-pull-failure-cleanup.json','cleanup-copy.json'],
  [local,'adb-sync-trip-change-schedule-diagnostics.json','sync-diagnostics.json'],
  [local,'LocalTripChangeScheduleFlowTest-instrumentation.txt','schedule-instrumentation.txt'],
  ['outputs/store-review-screenshots','ordinary-results.json','ordinary-results.json'],
  ['outputs/store-review-screenshots','disposable-store-restore.json','device-restoration.json'],
  ['outputs/focused-safety-ui/full-matrix/host-shutdown','complete.json','host-observation.json']])
  copyFileSync(resolve(input,folder,file),resolve(destination,name));
const gh=args=>JSON.parse(execFileSync('gh',args,{encoding:'utf8'}));
const run=gh(['run','view','40027788818','--repo','MohamedRed/Sports-Green-Moove','--json','databaseId,headSha,status,conclusion,jobs,url']);
assert.equal(run.status,'completed'); assert.equal(run.conclusion,'failure'); write('native-run.json',run);
write('artifact-metadata.json',gh(['api','repos/MohamedRed/Sports-Green-Moove/actions/artifacts/12534551829']));
write('summary.json',{checkedAt:'2026-10-23',sourceCommit:run.headSha,
  scope:'terminal-schedule-primary-copy-offline-observation-not-root-cause-or-full-replay',
  ordinaryPassed:159,ordinarySkipped:52,ordinaryFailed:0,focusedJobsPassed:10,cleanupFilesPulled:102,
  deviceRestorationVerified:true,hostExitVerified:true,deviceOfflineObserved:true,
  fullReplayAccepted:false,primaryCopyAccepted:false,rootCauseConfirmed:false,earlierStartupCauseConfirmed:false,
  physicalTrackingAccepted:false,newMediaPublished:false,productionWrites:false,releaseComplete:false});
write('artifact-sha256.json',Object.fromEntries(readdirSync(destination).map(file=>[file,
  createHash('sha256').update(readFileSync(resolve(destination,file))).digest('hex')])));
console.log('Retained terminal schedule transfer failure and independent cleanup without promoting retry output.');
