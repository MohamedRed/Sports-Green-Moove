import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {isAbsolute,resolve,basename} from 'node:path';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';

const [trial,backendPid,helperPid,handoff]=process.argv.slice(2);
assert(isAbsolute(trial??'')&&isAbsolute(handoff??''));
function absent(value) {
  const pid=Number(value);assert(Number.isSafeInteger(pid)&&pid>1);
  try {process.kill(pid,0);return false;}catch(error){assert.equal(error.code,'ESRCH');return true;}
}
assert(absent(backendPid)&&absent(helperPid),'Owned processes must be absent');
assert(!existsSync(resolve(trial,'session.json'))&&!existsSync(handoff));
const ui=readFileSync(resolve(trial,'device-release-ax.txt'),'utf8');
assert(ui.includes('App Live Dashboard')&&ui.includes('Succesfully uninstalled'));
assert(!ui.includes('Description: Stop Session'));
const clipboard=JSON.parse(readFileSync(resolve(trial,'clipboard-state.json')));
assert.equal(clipboard.scope,'browser-api-clipboard-restoration-not-device-proof');
assert.equal(clipboard.hostOriginalClipboardRestored,true);
assert.equal(clipboard.deviceClipboardStateIndependentlyVerified,false);
assert.equal(clipboard.credentialEntryScreenshotsRetained,false);
const log=readFileSync(resolve(trial,'backend.log'),'utf8');
assert(log.includes('Shutting down emulators')&&log.includes('Stopping Logging Emulator'));
const marker=log.split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line))
  .find(row=>row.scope==='owned-local-ui-runtime-disposal');
if(marker) {
  assert.equal(marker.runtimeDirectoryRemoved,true);assert.equal(marker.sessionFileRemoved,true);
  assert(basename(marker.runtimeDirectory).startsWith('sgm-local-runtime-'));assert(!existsSync(marker.runtimeDirectory));
}
writeFileSync(resolve(trial,'disposal.json'),JSON.stringify({recordedAt:new Date().toISOString(),
  scope:'owned-local-runtime-and-observed-phone-release-not-independent-package-absence',
  backendPid:Number(backendPid),helperPid:Number(helperPid),ownedProcessesAbsent:true,privateSessionRemoved:true,
  helperHandoffRemoved:true,phoneReleaseDashboardObserved:true,providerUninstallReportedSuccess:true,
  installedPackageAbsenceIndependentlyVerified:false,runtimeDirectoryAbsenceIndependentlyBound:Boolean(marker),
  ...(marker?{runtimeDirectory:marker.runtimeDirectory,runtimeDirectoryRemoved:true}:{}),
  endpoints:await assertLocalEndpointsClosed([9099,8080,9000,5001]),clipboardCleared:false,
  originalClipboardRestored:clipboard.hostOriginalClipboardRestored,deviceClipboardStateIndependentlyVerified:false,
  realAccountsModified:false,productionWrites:false
},null,2)+'\n',{flag:'wx'});
console.log('Verified owned process/service shutdown, private input removal and observed device release.');
