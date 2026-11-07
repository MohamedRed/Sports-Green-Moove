import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {cpSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {teamPushRegistrationFolder as folder,validateTeamPushRegistration} from '../scripts/qa/team-push-registration-evidence.mjs';
import {content} from '../partner-portal/content.mjs';
import {validateTeamAccountRegressions} from '../scripts/qa/team-account-regressions-evidence.mjs';

test('nineteen executed current-account cases remain server-only with both negative trials retained',()=>{
  const result=validateTeamPushRegistration(process.cwd());assert.equal(result.checkpoints,19);
  const team=content.flows.find(row=>row.id==='team-conversation');
  assert.equal(team.pushRegistration.source,folder+'review.json');assert.equal(team.status,'partial');
  assert.equal(team.phone.checkedAt,'2026-10-21');assert.equal(team.alertPhone.checkedAt,'2026-11-01');
  assert.equal(team.images.length,62);assert.equal(team.tour.length,39);assert.match(team.remaining,/app fermée/);
  const update=content.updates.find(row=>row.source===folder+'README.md');assert(update);
  assert.match(update.text,/En local/);assert.match(update.text,/app fermée reste à terminer/);
  assert.doesNotMatch(update.title+update.text,/firebase|browserstack|FCM|token|dispatcher|API|SDK/i);
  assert.equal(validateTeamAccountRegressions(process.cwd()).serviceCases,54);
});
for(const [file,mutate]of [
  ['review.json',row=>row.pushDeliveryVerified=true],['review.json',row=>row.realPhoneTokenRegistered=true],
  ['review.json',row=>row.nativeLifecycleImplemented=true],['review.json',row=>row.dispatcherImplemented=true],
  ['review.json',row=>row.releaseAccepted=true],['review.json',row=>row.wholeHeadAttested=true],
  ['review.json',row=>row.failedFixtureTrialAccepted=true],['services.json',row=>row.steps.pop()],
  ['review.json',row=>row.currentClaimsRechecked=false],['review.json',row=>row.staleClaimTrialAccepted=true],
  ['services.json',row=>row.isolation.protectedBaselinePreserved=false],['services.json',row=>row.emulatorEndpoints.closed=false],
])test('rehashing '+file+' cannot promote incomplete registration evidence',t=>{
  const temp=mkdtempSync(resolve(tmpdir(),'sgm-registration-evidence-'));t.after(()=>rmSync(temp,{recursive:true,force:true}));
  cpSync(resolve(folder),temp,{recursive:true});const path=resolve(temp,file),row=JSON.parse(readFileSync(path));mutate(row);
  writeFileSync(path,JSON.stringify(row));const manifestPath=resolve(temp,'artifact-sha256.json'),manifest=JSON.parse(readFileSync(manifestPath));
  manifest[file]=createHash('sha256').update(readFileSync(path)).digest('hex');writeFileSync(manifestPath,JSON.stringify(manifest));
  assert.throws(()=>validateTeamPushRegistration(process.cwd(),temp));
});
