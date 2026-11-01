import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {cpSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {content,captures} from '../partner-portal/content.mjs';
import {chatAccountSwitchPhoneFolder,assertChatAccountSwitchReview,validateChatAccountSwitchPhone}
  from '../scripts/qa/chat-account-switch-phone-evidence.mjs';
import {chatAccountSwitchCaptures} from '../partner-portal/chat-account-switch-phone.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const json=file=>JSON.parse(readFileSync(join(root,chatAccountSwitchPhoneFolder,file)));
test('the physical account switch retains eleven protected checkpoints and one explicit parent message',()=>{
  const attributes=execFileSync('git',['check-attr','text','whitespace','--',chatAccountSwitchPhoneFolder+'ci/LocalChatNetworkFlowTest-instrumentation.txt'],{cwd:root,encoding:'utf8'});
  assert.match(attributes,/text: unset/);assert.match(attributes,/whitespace: unset/);
  assert.deepEqual(validateChatAccountSwitchPhone(root),{physicalControlledAccountSwitchPassed:true,checkpoints:11,messages:1,
    notifications:1,originalPendingIdentityAccepted:false,postCommitResponseLossAccepted:false,releaseAccepted:false});
});
test('three reviewed account-switch captures precede all 28 older chat images and nine tour steps',()=>{
  const flow=content.flows.find(row=>row.id==='messages');assert.equal(flow.status,'partial');assert.equal(flow.checkedAt,'2026-11-01');
  assert.equal(flow.pendingSendAccountSwitchPhone.source,chatAccountSwitchPhoneFolder+'review.json');
  assert.match(flow.remaining,/deux téléphones/);assert.match(flow.remaining,/iPhone/);
  const images=flow.images.filter(row=>!row.file.startsWith('chat-receipt-phone-'));
  const tour=flow.tour.filter(row=>!row.image.startsWith('chat-receipt-phone-'));
  const files=Object.keys(chatAccountSwitchCaptures);assert.equal(files.length,3);assert.equal(images.length,31);
  assert.deepEqual(images.slice(0,3).map(row=>row.file),files);assert.deepEqual(tour.slice(0,3).map(row=>row.image),files);
  assert.equal(images.filter(row=>!files.includes(row.file)).length,28);assert.equal(tour.length,12);
  for(const [id,path]of Object.entries(chatAccountSwitchCaptures))assert.equal(captures[id],path);
  assert.equal(flow.pendingSendRestartPhone.checkedAt,'2026-10-31');assert.equal(flow.networkRecoveryPhone.checkedAt,'2026-10-31');
  const progress=content.updates.find(row=>row.source===chatAccountSwitchPhoneFolder+'README.md');assert(progress);
  assert.doesNotMatch(progress.title+progress.text,/BrowserStack|Firebase|SDK|APK|localhost|adbd/);
});
for(const key of ['originalPendingIdentityIndependentlyObserved','postCommitResponseLossAccepted','processRestartAccepted',
  'peerPhoneAccepted','realRadioLossAccepted','trackingAccepted','iOSAccepted','pushDeliveryAccepted',
  'productionWrites','realPayments','applicationDeployed','releaseAccepted'])
  test('the controlled account switch cannot promote '+key,()=>{
    const review=json('review.json');review[key]=true;assert.throws(()=>assertChatAccountSwitchReview(review),new RegExp(key));
  });
for(const [file,change]of [
  ['records/driver-conversation-empty.json',row=>{row.state=json('records/parent-sent.json').state;}],
  ['records/parent-sent.json',row=>{row.state.documents.messages.push(row.state.documents.messages.at(-1));}],
  ['records/signed-out.json',row=>{row.state.claims=[];}],
  ['ci/local-chat-network-ui.json',row=>{row.completed=true;}],
  ['disposal.json',row=>{row.packageAbsenceIndependentlyVerified=true;}],
])test('rehashing contradictory '+file+' does not accept this phone result',t=>{
  const temporary=mkdtempSync(join(tmpdir(),'sgm-account-switch-proof-'));t.after(()=>rmSync(temporary,{recursive:true,force:true}));
  const folder=join(temporary,chatAccountSwitchPhoneFolder);cpSync(join(root,chatAccountSwitchPhoneFolder),folder,{recursive:true});
  const archive=join(temporary,'docs/release/evidence/source-archive');mkdirSync(archive,{recursive:true});
  for(const hash of Object.values(json('source-files.json')))cpSync(join(root,'docs/release/evidence/source-archive',hash+'.txt'),join(archive,hash+'.txt'));
  assert.doesNotThrow(()=>validateChatAccountSwitchPhone(temporary));
  const value=json(file);change(value);const bytes=JSON.stringify(value);writeFileSync(join(folder,file),bytes);
  const hashes=json('artifact-sha256.json');hashes[file]=createHash('sha256').update(bytes).digest('hex');
  writeFileSync(join(folder,'artifact-sha256.json'),JSON.stringify(hashes));assert.throws(()=>validateChatAccountSwitchPhone(temporary));
});
test('both CI events watch and run record and physical account-switch checks',()=>{
  for(const file of ['native-ci.yml','web-integration-smoke.yml']){
    const workflow=parseDocument(readFileSync(join(root,'.github/workflows',file),'utf8')).toJSON();
    for(const event of ['push','pull_request'])assert(workflow.on[event].paths.includes('tests/chat-account-switch*.test.mjs'));
    const steps=Object.values(workflow.jobs).flatMap(job=>job.steps??[]).filter(step=>step.name==='Validate chat account-switch checkpoints');
    assert.equal(steps.length,1);assert.equal(steps[0].run,'node --test tests/chat-account-switch-checkpoints.test.mjs tests/chat-account-switch-phone.test.mjs');
    assert.equal(steps[0].if,undefined);assert.equal(steps[0]['continue-on-error'],undefined);
  }
});
