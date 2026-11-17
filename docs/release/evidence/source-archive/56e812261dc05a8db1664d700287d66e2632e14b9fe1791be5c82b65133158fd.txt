import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {existsSync,lstatSync,mkdtempSync,readFileSync,realpathSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {isAbsolute,join,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';

export const pinnedTransferTools=Object.freeze({version:'36.0.2',
  url:'https://dl.google.com/android/repository/platform-tools_r36.0.2-linux.zip',
  sha256:'3afdea91441815ab41254193df0343d92c1b1c0d0237165c3a345c8af8891c31'});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function assertPinnedTransferArchive(bytes){assert.equal(sha(bytes),pinnedTransferTools.sha256,'Pinned archive digest mismatch');}
export function transferToolsIdentity(directory){
  assert(!lstatSync(directory).isSymbolicLink() && lstatSync(directory).isDirectory());
  const binary=join(directory,'adb');assert(lstatSync(binary).isFile() && !lstatSync(binary).isSymbolicLink());
  const version=/^Pkg.Revision\s*=\s*([\d.]+)\s*$/m.exec(readFileSync(join(directory,'source.properties'),'utf8'))?.[1];
  assert(version,'Tool revision is required');return {version,adbSha256:sha(readFileSync(binary))};
}
export async function stagePinnedTransferTools(directory){
  const response=await fetch(pinnedTransferTools.url,{redirect:'error',signal:AbortSignal.timeout(60_000)});
  assert(response.ok,'Pinned archive download failed');const parts=[];let length=0;
  for await(const chunk of response.body){length+=chunk.length;assert(length<=32*1024*1024,'Archive size exceeds diagnostic limit');parts.push(chunk);}
  const bytes=Buffer.concat(parts);assertPinnedTransferArchive(bytes);
  const archive=join(directory,'official-linux-tools.zip');writeFileSync(archive,bytes,{mode:0o600,flag:'wx'});
  execFileSync('unzip',['-q',archive,'-d',directory],{timeout:30_000,stdio:'pipe'});
  assert.equal(transferToolsIdentity(join(directory,'platform-tools')).version,pinnedTransferTools.version);
}
function assertNoAdbServer(){
  const result=spawnSync('pgrep',['-x','(adb|emulator|qemu-system-.*)'],{encoding:'utf8',timeout:3000,stdio:'pipe'});
  assert.equal(result.status,1,'Refuse to replace tools while a server or virtual device is present');assert(!result.error && !result.signal);
}
export async function prepareTransferToolchain(requested,{platform=process.platform,env=process.env,
  stage=stagePinnedTransferTools,noAdbServer=assertNoAdbServer}={}){
  assert.equal(platform,'linux');assert.equal(env.GITHUB_ACTIONS,'true');assert.equal(env.RUNNER_OS,'Linux');
  assert.equal(env.RUNNER_ENVIRONMENT,'github-hosted');
  assert.equal(env.SGM_LOCAL_DISPOSABLE_EMULATOR,'true');assert(['sdk-default',pinnedTransferTools.version].includes(requested));
  const root=env.ANDROID_HOME,receipt=env.SGM_TRANSFER_TOOLCHAIN_RECEIPT,temp=env.RUNNER_TEMP;
  assert(isAbsolute(root??'') && isAbsolute(receipt??'') && isAbsolute(temp??''));
  assert.equal(realpathSync(root),root);assert.equal(realpathSync(temp),temp);
  assert(resolve(receipt).startsWith(temp+sep) && !existsSync(receipt),'A fresh runner-private receipt is required');
  const tools=join(root,'platform-tools'),before=transferToolsIdentity(tools);let workspace;
  noAdbServer();
  try{
    if(requested!=='sdk-default'){
      workspace=mkdtempSync(join(root,'.sgm-transfer-tools-'));
      await stage(workspace);
      const staged=join(workspace,'platform-tools');assert.equal(transferToolsIdentity(staged).version,requested);
      noAdbServer();assert.deepEqual(transferToolsIdentity(tools),before,'Installed tools changed during preparation');
      renameSync(tools,join(workspace,'original-platform-tools'));renameSync(staged,tools);
    }
    const installed=transferToolsIdentity(tools);if(requested!=='sdk-default')assert.equal(installed.version,requested);
    const record={scope:'explicit-disposable-transfer-toolchain-not-release-or-fallback',requested,before,installed,
      archive:requested==='sdk-default'?null:pinnedTransferTools,selectedBeforeEmulatorBoot:true,
      fallbackPerformed:false,productGateChanged:false,releaseAccepted:false};
    writeFileSync(receipt,JSON.stringify(record,null,2)+'\n',{mode:0o600,flag:'wx'});return record;
  }finally{if(workspace)rmSync(workspace,{recursive:true});}
}
export function readTransferToolchainSelection(path,requested,installed){
  assert(isAbsolute(path??''));const record=JSON.parse(readFileSync(path));
  assert.equal(record.scope,'explicit-disposable-transfer-toolchain-not-release-or-fallback');
  assert.equal(record.requested,requested);assert(['sdk-default',pinnedTransferTools.version].includes(requested));
  assert.deepEqual(record.installed,installed);assert.equal(record.selectedBeforeEmulatorBoot,true);
  for(const key of ['fallbackPerformed','productGateChanged','releaseAccepted'])assert.equal(record[key],false);
  if(requested!=='sdk-default'){assert.equal(installed.version,requested);assert.deepEqual(record.archive,pinnedTransferTools);}
  else assert.equal(record.archive,null);
  return record;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{assert.equal(process.argv.length,3);const result=await prepareTransferToolchain(process.argv[2]);
    console.log(JSON.stringify({requested:result.requested,installed:result.installed,fallbackPerformed:false,releaseAccepted:false}));
  }catch{console.error('Explicit diagnostic toolchain preparation failed; no fallback is permitted.');process.exitCode=1;}
}
