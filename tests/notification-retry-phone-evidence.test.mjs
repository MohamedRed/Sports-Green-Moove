import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {cpSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {notificationRetryPhoneFolder,validateNotificationRetryPhone} from '../scripts/qa/notification-retry-phone-evidence.mjs';
import {content,captures} from '../partner-portal/content.mjs';
import {tours} from '../partner-portal/tours.mjs';

test('seven retained phone checkpoints verify notification-only retry and honest disposal',()=>{
  const run=validateNotificationRetryPhone(process.cwd());
  assert.equal(run.checkpoints,7);assert.equal(run.unrelatedListReloadsObserved,0);
});

test('only three fresh retry crops precede every historical image and tour',()=>{
  const run=validateNotificationRetryPhone(process.cwd()),flow=content.flows.find(row=>row.id==='team-conversation');
  const fresh=flow.images.filter(row=>row.file.startsWith('team-alert-retry-'));
  assert.equal(fresh.length,3);assert.deepEqual(flow.images.slice(0,3),fresh);
  assert.equal(flow.images.length,62);assert.equal(tours['team-conversation'].length,39);
  assert.deepEqual(tours['team-conversation'].slice(0,3).map(row=>row.image),fresh.map(row=>row.file));
  assert(fresh.every(row=>row.checkedAt==='2026-11-01'&&row.alt.includes('1 novembre')));
  for(const [id,file]of Object.entries(run.publishedCaptures))assert.equal(captures[id],notificationRetryPhoneFolder+file);
  assert.equal(flow.status,'partial');assert.match(flow.remaining,/app fermée/);
  assert.equal(flow.phone.checkedAt,'2026-10-21');assert.equal(flow.readPhone.checkedAt,'2026-10-21');
  const update=content.updates.find(row=>row.source===notificationRetryPhoneFolder+'README.md');assert(update);
  assert.match(update.text,/erreur simulée/);
  assert.doesNotMatch(JSON.stringify([update,fresh]),/browserstack|firebase|android|kotlin|polling/i);
});

for(const key of ['pushDeliveryVerified','reviewPaginationPhysicallyVerified','componentTestsExecutedLocally',
  'phonePeerUsed','managerUiExecuted','installedApkIndependentlyHashed','wholeHeadAttested','realRadioLossVerified',
  'physicalGpsVerified','iosExecuted','earlierCaptureFailureOverridden','releaseEvidenceAccepted'])
  test('even rehashed retry evidence cannot promote '+key,t=>{
    const temp=mkdtempSync(resolve(tmpdir(),'sgm-retry-evidence-'));t.after(()=>rmSync(temp,{recursive:true,force:true}));
    cpSync(resolve(notificationRetryPhoneFolder),temp,{recursive:true});
    const path=resolve(temp,'run.json'),run=JSON.parse(readFileSync(path));run[key]=true;
    writeFileSync(path,JSON.stringify(run));
    const checksumPath=resolve(temp,'artifact-sha256.json'),checksums=JSON.parse(readFileSync(checksumPath));
    checksums['run.json']=createHash('sha256').update(readFileSync(path)).digest('hex');writeFileSync(checksumPath,JSON.stringify(checksums));
    assert.throws(()=>validateNotificationRetryPhone(process.cwd(),temp));
  });
