import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {copyFileSync,existsSync,mkdirSync,readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';

const root=resolve(import.meta.dirname,'../..'),download=process.argv[2];assert(isAbsolute(download??''));
const base=resolve(root,'docs/release/evidence/notification-sampling-59dbd3c-2026-11-01');assert(!existsSync(base));mkdirSync(base);
const gh=(...args)=>JSON.parse(execFileSync('/opt/homebrew/bin/gh',args,{encoding:'utf8',maxBuffer:4*1024*1024}));
const run=gh('run','view','41299644811','--repo','MohamedRed/Sports-Green-Moove','--json','headSha,databaseId,status,conclusion,jobs,url');
assert.equal(run.headSha,'59dbd3c292a767ded035826fd2a9f8630f1a4620');assert.equal(run.conclusion,'failure');assert.equal(run.status,'completed');
const artifact=gh('api','repos/MohamedRed/Sports-Green-Moove/actions/artifacts/13081302612');
const save=(name,row)=>writeFileSync(resolve(base,name),JSON.stringify(row,null,2)+'\n',{flag:'wx'});
save('native-run.json',run);save('artifact.json',artifact);
const ordinary=resolve(download,'outputs/store-review-screenshots'),failure=resolve(ordinary,'ordinary-failure');
for(const file of ['ordinary-instrumentation.txt','ordinary-results.json','native-suite-status.json','disposable-store-restore.json'])
  copyFileSync(resolve(ordinary,file),resolve(base,file));
copyFileSync(resolve(failure,'rejected-primary-copy.json'),resolve(base,'rejected-primary-copy.json'));
const rejected='notification-inbox-revoked-308240241406';mkdirSync(resolve(base,'rejected'));
for(const extension of ['png','json'])copyFileSync(resolve(failure,'rejected-primary-captures',rejected+'.'+extension),resolve(base,'rejected',rejected+'.'+extension));
const source=resolve(base,'rejected',rejected+'.png'),bytes=readFileSync(source),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const raw=execFileSync('/opt/homebrew/bin/ffmpeg',['-v','error','-i',source,'-f','rawvideo','-pix_fmt','rgba','pipe:1'],{maxBuffer:16*1024*1024});
assert.equal(raw.length,1080*2400*4);const all=new Set(),sampled=new Set();
for(let y=0;y<2400;y++)for(let x=0;x<1080;x++){const color=raw.readUInt32BE((y*1080+x)*4);all.add(color);if(x%16===0&&y%16===0)sampled.add(color);}
assert.equal(all.size,260);assert.equal(sampled.size,10);
save('decoded-pixels.json',{scope:'local-decoder-analysis-not-ui-replay',decoder:'ffmpeg rawvideo rgba',imageSha256:sha(bytes),
  width:1080,height:2400,pixels:raw.length/4,allDistinctColors:all.size,stride16DistinctColors:sampled.size,
  originalThresholdExclusive:16,originalSamplePredicate:false,fullPixelPredicate:true,imageModified:false,recaptured:false});
const asset=resolve(root,'android/app/src/androidTest/assets/qa');mkdirSync(asset,{recursive:true});
const fixture=resolve(asset,'notification-empty-state.png');assert(!existsSync(fixture));copyFileSync(source,fixture);
const replay=resolve(download,'outputs/local-ui-evidence/a2f7661076f4769edefbfbf6925a6786');mkdirSync(resolve(base,'replay'));
for(const file of ['results.json',...readdirSync(replay).filter(file=>/^adb-pull-.+\.json$/.test(file))])
  copyFileSync(resolve(replay,file),resolve(base,'replay',file));
const paths=['android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalUiCapture.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/NotificationInboxFlowTest.kt','android/app/src/androidTest/java/be/sportgreenmoove/app/ui/RejectedPrimaryBitmap.kt'];
const sourceFiles=Object.fromEntries(paths.map(file=>{
  const bytes=execFileSync('git',['show',run.headSha+':'+file],{cwd:root}),hash=sha(bytes),target=resolve(root,'docs/release/evidence/source-archive',hash+'.txt');
  if(!existsSync(target))writeFileSync(target,bytes,{flag:'wx'});else assert.equal(sha(readFileSync(target)),hash);return[file,hash];
}));
save('review.json',{scope:'retained-failed-gate-with-proven-sparse-sampling-false-rejection',headSha:run.headSha,workflowId:run.databaseId,
  testedAt:'2026-11-01',sourceFiles,rejectedBitmapRetained:true,samplingFalseRejectionProven:true,repairVerified:false,
  downloadedArchiveDigestIndependentlyVerified:false,wholeHeadAttested:false,pushDeliveryVerified:false,releaseAccepted:false,publishedCaptures:{}});
const regular=readdirSync(base,{recursive:true}).filter(file=>statSync(resolve(base,file)).isFile());
save('artifact-sha256.json',Object.fromEntries(regular.sort().map(file=>[file,sha(readFileSync(resolve(base,file)))])));
console.log('Retained original failure: 260 full-image colors versus 10 sampled colors; full workflow remains failed.');
