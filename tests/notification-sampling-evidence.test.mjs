import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {cpSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {parseDocument} from 'yaml';
import {notificationSamplingFolder as folder,validateNotificationSampling} from '../scripts/qa/notification-sampling-evidence.mjs';

test('original failed gate proves sparse-color false rejection, not a repaired full gate',()=>{
  assert.equal(validateNotificationSampling(process.cwd()).samplingFalseRejectionProven,true);
});
for(const [file,mutate]of [
  ['review.json',row=>row.repairVerified=true],['review.json',row=>row.pushDeliveryVerified=true],
  ['review.json',row=>row.releaseAccepted=true],['review.json',row=>row.wholeHeadAttested=true],
  ['native-run.json',row=>row.conclusion='success'],['ordinary-results.json',row=>row.failed=0],
  ['decoded-pixels.json',row=>row.allDistinctColors=10],['decoded-pixels.json',row=>row.imageModified=true],
  ['decoded-pixels.json',row=>row.recaptured=true],['replay/adb-pull-confirmed-restart.json',row=>row.completed=false],
])test('sampling evidence rejects rehashed contradiction in '+file,t=>{
  const temp=mkdtempSync(resolve(tmpdir(),'sgm-sampling-'));t.after(()=>rmSync(temp,{recursive:true,force:true}));
  cpSync(resolve(folder),temp,{recursive:true});const path=resolve(temp,file),row=JSON.parse(readFileSync(path));
  mutate(row);writeFileSync(path,JSON.stringify(row));
  const manifest=resolve(temp,'artifact-sha256.json'),hashes=JSON.parse(readFileSync(manifest));
  hashes[file]=createHash('sha256').update(readFileSync(path)).digest('hex');writeFileSync(manifest,JSON.stringify(hashes));
  assert.throws(()=>validateNotificationSampling(process.cwd(),temp));
});
test('all captures use one full-pixel predicate with the unchanged threshold and original fixture',()=>{
  const base='android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';
  const capture=readFileSync(base+'LocalUiCapture.kt','utf8'),scan=readFileSync(base+'PrimaryCaptureColors.kt','utf8');
  assert(capture.includes('val colors = primaryCaptureColors(bitmap)'));assert(capture.includes('check(colors.size > 16)'));
  assert.equal(capture.match(/captureToImage\(/g).length,1);assert(!capture.includes('step 16'));
  assert(scan.includes('for (y in 0 until bitmap.height)'));assert(scan.includes('for (color in row)'));
  assert(scan.includes('if (colors.size > 16) return colors'));
  const regression=readFileSync(base+'PrimaryCaptureColorsTest.kt','utf8');
  assert(regression.includes('assertEquals(16, primaryCaptureColors(image).size)'));
  assert(regression.includes('assertEquals(10, rejectedBitmapSamples(image).size)'));
  assert(regression.includes('notification-empty-state.png'));
  for(const file of ['native-ci.yml','web-integration-smoke.yml']){
    const workflow=parseDocument(readFileSync('.github/workflows/'+file,'utf8')).toJSON();
    for(const event of ['push','pull_request'])assert(workflow.on[event].paths.includes('tests/notification-sampling-evidence.test.mjs'));
    assert(Object.values(workflow.jobs).some(job=>job.steps?.some(step=>step.run?.includes('tests/notification-sampling-evidence.test.mjs'))));
  }
});
