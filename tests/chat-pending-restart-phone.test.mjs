import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {content,captures} from '../partner-portal/content.mjs';
import {chatPendingRestartPhoneFolder,assertChatPendingRestartReview,validateChatPendingRestartPhone}
  from '../scripts/qa/chat-pending-restart-phone-evidence.mjs';
import {chatPendingRestartCaptures} from '../partner-portal/chat-pending-restart-phone.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const json=file=>JSON.parse(readFileSync(join(root,chatPendingRestartPhoneFolder,file)));
test('the actual phone pre-commit pending restart retains nine protected checkpoints and one message',()=>{
  assert.deepEqual(validateChatPendingRestartPhone(root),{physicalPreCommitPendingRestartPassed:true,checkpoints:9,messages:1,
    notifications:1,originalPendingIdentityAccepted:false,postCommitResponseLossAccepted:false,releaseAccepted:false});
});
test('three reviewed phone captures precede every historical chat image and tour without promoting the whole flow',()=>{
  const flow=content.flows.find(row=>row.id==='messages');assert.equal(flow.status,'partial');assert.equal(flow.checkedAt,'2026-10-31');
  assert.equal(flow.pendingSendRestartPhone.source,chatPendingRestartPhoneFolder+'review.json');
  assert.match(flow.remaining,/confirmation perdue/);assert.match(flow.remaining,/clavier sur iPhone/);
  const files=Object.keys(chatPendingRestartCaptures);assert.equal(files.length,3);assert.equal(flow.images.length,28);
  assert.deepEqual(flow.images.slice(0,3).map(row=>row.file),files);assert.deepEqual(flow.tour.slice(0,3).map(row=>row.image),files);
  for(const [id,path]of Object.entries(chatPendingRestartCaptures))assert.equal(captures[id],path);
  assert.equal(flow.images.filter(row=>row.file.startsWith('chat-draft-replay-')).length,2);
  assert.equal(flow.images.filter(row=>row.file.startsWith('chat-draft-')&&!row.file.startsWith('chat-draft-replay-')).length,3);
  assert.equal(flow.images.filter(row=>row.file.startsWith('chat-phone-')&&!row.file.startsWith('chat-phone-pending-')).length,4);
  assert.equal(flow.tour.filter(row=>!row.image.startsWith('chat-phone-pending-')).length,6);
  assert.equal(content.blockers.find(row=>row.id==='chat-pending-restart').source,chatPendingRestartPhoneFolder+'README.md');
  const progress=content.updates.find(row=>row.source===chatPendingRestartPhoneFolder+'README.md');assert(progress);
  assert.doesNotMatch(progress.title+progress.text,/BrowserStack|Firebase|SDK|APK|localhost|adbd/);
});
for(const key of ['independentProcessIdsObserved','originalPendingIdentityIndependentlyObserved','postCommitResponseLossAccepted',
  'accountSwitchOnPhoneAccepted','peerPhoneAccepted','realRadioLossAccepted','trackingAccepted','iOSAccepted',
  'pushDeliveryAccepted','productionWrites','realPayments','applicationDeployed','releaseAccepted'])
  test('the actual pre-commit phone retry cannot promote '+key,()=>{
    const review=json('review.json');review[key]=true;assert.throws(()=>assertChatPendingRestartReview(review),new RegExp(key));
  });
for(const [file,change]of [
  ['records/pending-restored.json',row=>{row.state=json('records/parent-sent.json').state;}],
  ['records/parent-sent.json',row=>{row.state.documents.messages.push(row.state.documents.messages.at(-1));}],
  ['records/signed-out.json',row=>{row.state.claims=[];}],
  ['disposal.json',row=>{row.packageAbsenceIndependentlyVerified=true;}],
  ['preparation-observations.json',row=>{row.videoRecordingStarted=true;}],
]) test('rehashing a contradictory '+file+' does not accept the phone result',t=>{
  const temporary=mkdtempSync(join(tmpdir(),'sgm-pending-restart-proof-'));t.after(()=>rmSync(temporary,{recursive:true,force:true}));
  const folder=join(temporary,chatPendingRestartPhoneFolder);cpSync(join(root,chatPendingRestartPhoneFolder),folder,{recursive:true});
  const archive=join(temporary,'docs/release/evidence/source-archive');mkdirSync(archive,{recursive:true});
  for(const hash of Object.values(json('source-files.json')))cpSync(join(root,'docs/release/evidence/source-archive',hash+'.txt'),join(archive,hash+'.txt'));
  assert.doesNotThrow(()=>validateChatPendingRestartPhone(temporary));
  const value=json(file);change(value);const bytes=JSON.stringify(value);writeFileSync(join(folder,file),bytes);
  const hashes=json('artifact-sha256.json');hashes[file]=createHash('sha256').update(bytes).digest('hex');
  writeFileSync(join(folder,'artifact-sha256.json'),JSON.stringify(hashes));assert.throws(()=>validateChatPendingRestartPhone(temporary));
});
test('the record and physical evidence tests run on both CI events without removing the previous chat coverage',()=>{
  for(const file of ['native-ci.yml','web-integration-smoke.yml']) {
    const workflow=parseDocument(readFileSync(join(root,'.github/workflows',file),'utf8')).toJSON();
    for(const event of ['push','pull_request'])assert(workflow.on[event].paths.includes('tests/chat-pending-restart*.test.mjs'));
    const steps=Object.values(workflow.jobs).flatMap(job=>job.steps??[]).filter(step=>step.name==='Validate controlled chat phone records and evidence');
    assert.equal(steps.length,1);assert.equal(steps[0].run,'node --test tests/chat-network-phone-checkpoints.test.mjs tests/chat-network-phone-evidence.test.mjs tests/chat-pending-restart-checkpoints.test.mjs tests/chat-pending-restart-phone.test.mjs');
    assert.equal(steps[0].if,undefined);assert.equal(steps[0]['continue-on-error'],undefined);
  }
});
