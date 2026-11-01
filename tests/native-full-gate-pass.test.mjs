import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseDocument} from 'yaml';
import test from 'node:test';
import {assertFullNativePassReview,fullNativePassFolder,validateFullNativePass} from '../scripts/qa/full-native-pass-evidence.mjs';
import {content} from '../partner-portal/content.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const json=file=>JSON.parse(readFileSync(join(root,fullNativePassFolder,file)));
test('both source events and both authoritative test lanes keep the complete-gate evidence contract',()=>{
  for(const file of ['native-ci.yml','web-integration-smoke.yml']) {
    const workflow=parseDocument(readFileSync(join(root,'.github/workflows',file),'utf8')).toJSON();
    for(const event of ['push','pull_request']) assert(workflow.on[event].paths.includes('tests/native-full-gate-pass.test.mjs'));
    const steps=Object.values(workflow.jobs).flatMap(job=>job.steps??[]).filter(step=>step.name==='Validate complete native pass without release promotion');
    assert.equal(steps.length,1);assert.equal(steps[0].run,'node --test tests/native-full-gate-pass.test.mjs');
  }
});
test('a source-specific complete Native gate includes the ordinary matrix, full replay, primary copies and all focused jobs',()=>{
  assert.deepEqual(validateFullNativePass(root),{sourceSpecificFullGatePassed:true,ordinaryPassed:222,replayGroups:37,
    replayNativeCases:40,primaryCopies:17,focusedJobs:11,probeTransfers:32,intermittencyRepaired:false,physicalDeviceAccepted:false,releaseAccepted:false});
});
test('the public note preserves previous failures and partial phone flow statuses',()=>{
  const note=content.updates.find(row=>row.source===fullNativePassFolder+'README.md');assert(note);
  assert.doesNotMatch(note.title+note.text,/BrowserStack|Firebase|SDK|APK|adbd|CI|Linux/);
  const blocker=content.blockers.find(row=>row.id==='native-evidence-copy');assert(blocker);
  assert.equal(blocker.latestPassingSource,fullNativePassFolder+'README.md');
  assert.equal(blocker.reconnectHistory.source,'docs/release/evidence/copy-reconnect-ecd9b67-2026-10-31/README.md');
  const chat=content.blockers.find(row=>row.id==='chat-send-stability');assert(chat);
  assert.equal(chat.latestPassingSource,fullNativePassFolder+'README.md');assert.doesNotMatch(chat.text,/ne démarre pas/);
  for(const id of ['messages','team-conversation','native-startup']) assert.equal(content.flows.find(row=>row.id===id).status,'partial');
});
for(const key of ['guestObservationDuringFailure','continuousGuestExecutionProven','underlyingCauseConfirmed',
  'earlierCopyFailureRepaired','passAttributedToObservation','currentHeadGateAccepted','physicalDeviceAccepted',
  'productionWrites','releaseAccepted']) test('one successful gate cannot promote '+key,()=>{
    const review=json('review.json');review[key]=true;assert.throws(()=>assertFullNativePassReview(review),new RegExp(key));
  });
for(const [file,change] of [
  ['native-run.json',row=>{row.conclusion='failure';}],
  ['native-jobs.json',row=>{row.jobs.find(job=>job.name.endsWith(' / Isolated team-read-components')).conclusion='failure';}],
  ['head-checks.json',row=>{row.check_runs.find(check=>check.name==='Android native UI tests').status='in_progress';}],
  ['main/replay/adb-pull-trip-change-parent-confirmation.json',row=>{row.completed=false;row.status=1;}],
  ['probe/result.json',row=>{row.guestComparison.continuityProven=true;}],
]) test('rehashing a contradictory '+file+' cannot preserve acceptance',t=>{
  const temporary=mkdtempSync(join(tmpdir(),'sgm-full-gate-contract-'));t.after(()=>rmSync(temporary,{recursive:true,force:true}));
  const folder=join(temporary,fullNativePassFolder);cpSync(join(root,fullNativePassFolder),folder,{recursive:true});
  const previous='docs/release/evidence/transfer-lifecycle-2026-10-31/native-main/replay/results.json';
  mkdirSync(dirname(join(temporary,previous)),{recursive:true});cpSync(join(root,previous),join(temporary,previous));
  const archive=join(temporary,'docs/release/evidence/source-archive');mkdirSync(archive,{recursive:true});
  for(const sources of Object.values(json('source-files.json'))) for(const hash of Object.values(sources))
    cpSync(join(root,'docs/release/evidence/source-archive',hash+'.txt'),join(archive,hash+'.txt'));
  assert.doesNotThrow(()=>validateFullNativePass(temporary));
  const value=json(file);change(value);const bytes=JSON.stringify(value);writeFileSync(join(folder,file),bytes);
  const hashes=json('artifact-sha256.json');hashes[file]=createHash('sha256').update(bytes).digest('hex');
  const provenance=json('archive-verification.json');
  for(const selected of [provenance.main,provenance.probe]) if(selected.members[file]) selected.members[file].sha256=hashes[file];
  const indexBytes=JSON.stringify(provenance);writeFileSync(join(folder,'archive-verification.json'),indexBytes);
  hashes['archive-verification.json']=createHash('sha256').update(indexBytes).digest('hex');
  writeFileSync(join(folder,'artifact-sha256.json'),JSON.stringify(hashes));
  assert.throws(()=>validateFullNativePass(temporary));
});
