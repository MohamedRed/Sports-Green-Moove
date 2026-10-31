import assert from 'node:assert/strict';
import test from 'node:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { validateNativeScheduleCopy } from '../scripts/qa/native-schedule-copy-evidence.mjs';
import { content } from '../partner-portal/content.mjs';

const record=content.nativeScheduleCopyRecheck;
test('passing focused jobs do not erase a failed primary transfer or turn offline observations into a cause',()=>{
  const report=validateNativeScheduleCopy(process.cwd(),record);
  assert.equal(report.focusedJobsPassed,10);assert.equal(report.deviceOfflineObserved,true);assert.equal(report.rootCauseConfirmed,false);
  assert(content.updates.some(row=>row.source===record.source.replace('summary.json','README.md')));
  assert.equal(content.blockers.find(row=>row.id==='notification-native-replay'),undefined);
});
for(const key of ['fullReplayAccepted','primaryCopyAccepted','rootCauseConfirmed','earlierStartupCauseConfirmed',
  'physicalTrackingAccepted','newMediaPublished','productionWrites','releaseComplete']) test('schedule copy evidence cannot promote '+key,t=>{
  const root=mkdtempSync(resolve(tmpdir(),'sgm-schedule-copy-proof-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const base=dirname(record.source);cpSync(base,resolve(root,base),{recursive:true});
  const path=resolve(root,record.source),row=JSON.parse(readFileSync(path));row[key]=true;writeFileSync(path,JSON.stringify(row));
  assert.throws(()=>validateNativeScheduleCopy(root,record));
});
