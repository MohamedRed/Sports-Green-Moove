import assert from 'node:assert/strict';
import test from 'node:test';
import {cpSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {validateNotificationInboxPhone,notificationInboxEvidence} from '../scripts/qa/notification-inbox-phone-evidence.mjs';
import {content, captures} from '../partner-portal/content.mjs';
import {tours} from '../partner-portal/tours.mjs';
import {validateTeamConversationRecords} from '../partner-portal/team-conversation-evidence.mjs';

test('portal publishes only four bounded phone crops and preserves historical dates and tours',()=>{
  const team=content.flows.find(flow=>flow.id==='team-conversation');
  validateTeamConversationRecords(process.cwd(),team,captures);
  assert.equal(team.status,'partial');assert.equal(team.checkedAt,'2026-11-01');
  assert.equal(team.phone.checkedAt,'2026-10-21');assert.equal(team.readPhone.checkedAt,'2026-10-21');
  const fresh=team.images.filter(row=>row.file.startsWith('team-alert-phone-'));
  assert.equal(fresh.length,4);assert(fresh.every(row=>row.checkedAt==='2026-11-01'&&row.alt.includes('1 novembre')));
  assert(team.images.filter(row=>!fresh.includes(row)).every(row=>row.checkedAt==='2026-10-21'));
  assert.equal(tours['team-conversation'].length,36);
  assert.deepEqual(team.images.slice(0,4).map(row=>row.file),fresh.map(row=>row.file));
  const update=content.updates[0];assert.equal(update.source,dirname(notificationInboxEvidence)+'/README.md');
  assert.match(update.text,/app fermée reste à faire/);assert.match(team.remaining,/app fermée/);
  assert.doesNotMatch(JSON.stringify([update,fresh]),/browserstack|firebase|android|kotlin|polling/i);
});

test('both nine-checkpoint phone runs retain the negative preview and the bounded successful recheck',()=>{
  const run=validateNotificationInboxPhone(process.cwd());assert.equal(run.physicalDevice,true);assert.equal(run.pushDeliveryVerified,false);
  assert.equal(Object.keys(run.publishedCaptures).length,4);
});
for(const key of ['pushDeliveryVerified','tapNavigationVerified','phonePeerUsed','managerUiExecuted',
  'installedApkIndependentlyHashed','wholeHeadAttested','iosExecuted','physicalGpsVerified','releaseEvidenceAccepted','firstPreviewAccepted'])
  test('retained in-app result cannot promote '+key,t=>{
    const temp=mkdtempSync(resolve(tmpdir(),'sgm-alert-evidence-'));t.after(()=>rmSync(temp,{recursive:true,force:true}));
    cpSync(resolve(dirname(notificationInboxEvidence)),temp,{recursive:true});
    const path=resolve(temp,'run.json'),run=JSON.parse(readFileSync(path));run[key]=true;writeFileSync(path,JSON.stringify(run));
    assert.throws(()=>validateNotificationInboxPhone(process.cwd(),path));
  });
