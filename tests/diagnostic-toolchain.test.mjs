import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,symlinkSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseDocument} from 'yaml';
import {assertPinnedTransferArchive,pinnedTransferTools,prepareTransferToolchain,readTransferToolchainSelection,
  transferToolsIdentity} from '../scripts/diagnostics/transfer-toolchain.mjs';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
function fixture(t){
  const root=realpathSync(mkdtempSync(join(tmpdir(),'sgm-toolchain-')));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const sdk=join(root,'sdk'),temp=join(root,'temp');mkdirSync(sdk);mkdirSync(temp);
  const create=(directory,version,bytes)=>{mkdirSync(directory);writeFileSync(join(directory,'source.properties'),'Pkg.Revision='+version+'\n');
    writeFileSync(join(directory,'adb'),bytes,{mode:0o700});};
  create(join(sdk,'platform-tools'),'37.0.1','original-test-tool');
  const env={ANDROID_HOME:sdk,RUNNER_TEMP:temp,SGM_TRANSFER_TOOLCHAIN_RECEIPT:join(temp,'selection.json'),
    GITHUB_ACTIONS:'true',RUNNER_OS:'Linux',RUNNER_ENVIRONMENT:'github-hosted',SGM_LOCAL_DISPOSABLE_EMULATOR:'true'};
  let stageCalls=0,guards=0;
  const options={platform:'linux',env,noAdbServer:()=>{guards++;},stage:async directory=>{
    stageCalls++;create(join(directory,'platform-tools'),'36.0.2','pinned-test-tool');}};
  return {sdk,root,temp,env,options,create,counts:()=>({stageCalls,guards})};
}
test('default selection never downloads, replaces tools, or stops a server',async t=>{
  const f=fixture(t),before=transferToolsIdentity(join(f.sdk,'platform-tools'));
  const result=await prepareTransferToolchain('sdk-default',f.options);
  assert.deepEqual(f.counts(),{stageCalls:0,guards:1});assert.deepEqual(result.installed,before);
  assert.equal(result.archive,null);assert.equal(result.fallbackPerformed,false);
  assert.deepEqual(readTransferToolchainSelection(f.env.SGM_TRANSFER_TOOLCHAIN_RECEIPT,'sdk-default',before),result);
  await assert.rejects(()=>prepareTransferToolchain('sdk-default',f.options),/fresh runner-private/);
});
test('an explicit pin is checked before boot, swaps only the disposable SDK and binds the exact binary',async t=>{
  const f=fixture(t),result=await prepareTransferToolchain('36.0.2',f.options);
  assert.deepEqual(f.counts(),{stageCalls:1,guards:2});assert.equal(result.before.version,'37.0.1');
  assert.equal(result.installed.version,'36.0.2');assert.notEqual(result.before.adbSha256,result.installed.adbSha256);
  assert.deepEqual(result.archive,pinnedTransferTools);assert.equal(result.productGateChanged,false);
  assert.deepEqual(readTransferToolchainSelection(f.env.SGM_TRANSFER_TOOLCHAIN_RECEIPT,'36.0.2',result.installed),result);
});
for(const choice of ['36.0.0','latest','../sdk',undefined])test('unsupported selection fails before any SDK operation: '+choice,async t=>{
  const f=fixture(t);await assert.rejects(()=>prepareTransferToolchain(choice,f.options));
  assert.equal(transferToolsIdentity(join(f.sdk,'platform-tools')).version,'37.0.1');assert.equal(f.counts().stageCalls,0);
});
for(const change of [{GITHUB_ACTIONS:'false'},{RUNNER_OS:'Darwin'},{RUNNER_ENVIRONMENT:'self-hosted'},
  {SGM_LOCAL_DISPOSABLE_EMULATOR:'false'},{ANDROID_HOME:'relative'},{SGM_TRANSFER_TOOLCHAIN_RECEIPT:'/outside/receipt'}])
  test('non-disposable or out-of-scope context cannot modify the SDK: '+Object.keys(change)[0],async t=>{
    const f=fixture(t);await assert.rejects(()=>prepareTransferToolchain('36.0.2',{...f.options,env:{...f.env,...change}}));
    assert.equal(f.counts().stageCalls,0);assert.equal(transferToolsIdentity(join(f.sdk,'platform-tools')).version,'37.0.1');
  });
for(const at of [1,2])test('a pre-existing server/device at guard '+at+' prevents replacement without killing it',async t=>{
  const f=fixture(t);let checks=0;
  await assert.rejects(()=>prepareTransferToolchain('36.0.2',{...f.options,noAdbServer:()=>{if(++checks===at)throw Error('busy');}}),/busy/);
  assert.equal(transferToolsIdentity(join(f.sdk,'platform-tools')).version,'37.0.1');
  assert.equal(existsSync(f.env.SGM_TRANSFER_TOOLCHAIN_RECEIPT),false);
});
for(const kind of ['download','digest','revision','symlink','changed-original'])test('failed '+kind+' preparation never falls back or writes acceptance',async t=>{
  const f=fixture(t);await assert.rejects(()=>prepareTransferToolchain('36.0.2',{...f.options,stage:async directory=>{
    if(kind==='download')throw Error('unavailable');
    if(kind==='digest')assertPinnedTransferArchive(Buffer.from('corrupted archive'));
    f.create(join(directory,'platform-tools'),kind==='revision'?'37.0.1':'36.0.2','candidate');
    if(kind==='symlink'){rmSync(join(directory,'platform-tools/adb'));symlinkSync(join(f.sdk,'platform-tools/adb'),join(directory,'platform-tools/adb'));}
    if(kind==='changed-original')writeFileSync(join(f.sdk,'platform-tools/adb'),'concurrent replacement');
  }}));
  assert.equal(transferToolsIdentity(join(f.sdk,'platform-tools')).version,'37.0.1');
  assert.equal(existsSync(f.env.SGM_TRANSFER_TOOLCHAIN_RECEIPT),false);
});
test('a missing, mismatched or promoted receipt cannot authorize the actual transfer probe',async t=>{
  const f=fixture(t),record=await prepareTransferToolchain('36.0.2',f.options),path=f.env.SGM_TRANSFER_TOOLCHAIN_RECEIPT;
  assert.throws(()=>readTransferToolchainSelection(join(f.temp,'absent'),'36.0.2',record.installed));
  for(const changes of [{requested:'sdk-default'},{selectedBeforeEmulatorBoot:false},{fallbackPerformed:true},
    {productGateChanged:true},{releaseAccepted:true},{installed:{...record.installed,adbSha256:'a'.repeat(64)}},
    {archive:{...record.archive,sha256:'a'.repeat(64)}}]){
    writeFileSync(path,JSON.stringify({...record,...changes}));
    assert.throws(()=>readTransferToolchainSelection(path,'36.0.2',record.installed));
  }
});
test('the comparison is explicit, before boot and fail-closed, without replacing the product gate',()=>{
  const workflow=parseDocument(read('.github/workflows/android-transport-probe.yml')).toJSON();
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.platform_tools.options,['sdk-default','36.0.2']);
  assert.equal(workflow.on.workflow_dispatch.inputs.platform_tools.default,'sdk-default');
  const step=workflow.jobs['generated-file-transfer'].steps.find(row=>row.uses?.startsWith('reactivecircus/'));
  assert.equal(step.with['pre-emulator-launch-script'],'node scripts/diagnostics/transfer-toolchain.mjs "$SGM_TRANSFER_TOOLCHAIN"');
  assert.equal(step.env.SGM_TRANSFER_TOOLCHAIN,"${{ inputs.platform_tools || 'sdk-default' }}");
  const entry=read('scripts/diagnostics/run-adb-transfer-probe.mjs');
  assert(entry.indexOf('const toolchain=readTransferToolchainSelection')<entry.indexOf('const result = runTransferProbe'));
  assert(!read('.github/workflows/native-ci.yml').includes('transfer-toolchain.mjs'));
  const smoke=parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for(const steps of [smoke.jobs.smoke.steps,workflow.jobs['generated-file-transfer'].steps]){
    const checks=steps.filter(row=>row.name==='Test explicit diagnostic toolchain selection');assert.equal(checks.length,1);
    assert.equal(checks[0].run,'node --test tests/diagnostic-toolchain.test.mjs');
    assert.equal(checks[0]['continue-on-error'],undefined);
  }
  for(const event of ['push','pull_request'])for(const path of ['scripts/diagnostics/transfer-toolchain.mjs','tests/diagnostic-toolchain.test.mjs'])
    assert(smoke.on[event].paths.includes(path));
  const source=read('scripts/diagnostics/transfer-toolchain.mjs');assert(!source.includes('kill-server'));
  assert(source.includes("redirect:'error'"));assert(source.includes('assertPinnedTransferArchive(bytes)'));
});
