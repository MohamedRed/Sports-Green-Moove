import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
export const teamAccountRegressionFolder='docs/release/evidence/team-current-account-regressions-2026-11-01/';
export function validateTeamAccountRegressions(root,folder=teamAccountRegressionFolder){
  const base=resolve(root,folder),json=file=>JSON.parse(readFileSync(resolve(base,file)));assertEvidenceBundleChecksums(base);
  const review=json('review.json');assert.equal(review.scope,'five-team-service-regressions-after-current-account-guard-not-phone-or-release');
  assert.equal(review.testedAt.slice(0,10),'2026-11-01');assert.equal(review.flowCount,5);assert.equal(review.serviceCases,54);
  const names=['conversation','directory','reads','alerts','inbox'],counts=[18,6,12,11,7];assert.equal(review.runs.length,5);
  assert.equal(new Set(review.runs.map(row=>row.runId)).size,5);
  for(const [index,name]of names.entries()){
    const row=json(name+'.json');assert.equal(review.runs[index].name,name);assert.equal(review.runs[index].runId,row.runId);
    assert.equal(review.runs[index].testedAt,row.testedAt);assert.equal(review.runs[index].steps,counts[index]);
    assert.equal(row.projectId,'demo-sgm-local-qa');assert.equal(row.testedAt.slice(0,10),'2026-11-01');
    assert.equal(row.steps.length,counts[index]);assert(row.steps.every(step=>step.status==='passed'));assert.equal(new Set(row.steps.map(step=>step.id)).size,counts[index]);
    if(name==='conversation')assert.equal(row.protectedBaselinePreserved,true);else assert.equal(row.isolation.protectedBaselinePreserved,true);
    for(const key of ['isolatedEnvironmentDestroyed','adminClientClosed'])assert.equal(row[key],true,key);
    assert.deepEqual(row.emulatorEndpoints,{host:'127.0.0.1',ports:[9099,8080,9000,5001],closed:true});
    for(const key of ['physicalDevice','nativeUiExecuted','productionWrites'])assert.equal(row[key],false,key);
    if(['alerts','inbox'].includes(name)){
      assert.equal(row.firestoreClientTerminated,true);assert.equal(row.pushDeliveryVerified,false);assert.equal(row.providerRequests,0);
    }else assert(!Object.hasOwn(row,'firestoreClientTerminated'),'Do not invent a separately measured client termination');
    assertRetainedSourceFiles(root,row.sourceFiles);
  }
  for(const key of ['legacySourcePrePostBound','individualFirestoreClientTerminationIndependentlyRecordedForFirstThree',
    'physicalDevice','nativeUiExecuted','pushDeliveryVerified','productionWrites','releaseAccepted','wholeHeadAttested'])assert.equal(review[key],false,key);
  assert.equal(review.providerRequests,0);assert.deepEqual(review.publishedCaptures,{});assertRetainedSourceFiles(root,review.sourceFiles);return review;
}
