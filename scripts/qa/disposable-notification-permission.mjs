import assert from 'node:assert/strict';

const permission='android.permission.POST_NOTIFICATIONS',app='be.sportgreenmoove.app.local';
export function disposableNotificationPermission(device){
  assert.match(device.serial,/^emulator-\d+$/);
  assert.equal(device.shell('getprop','ro.kernel.qemu'),'1');
  assert.equal(device.shell('getprop','ro.build.version.sdk'),'35');
  assert.equal(device.shell('am','get-current-user'),'0');
  const matches=[...device.shell('dumpsys','package',app).matchAll(/^\s+android\.permission\.POST_NOTIFICATIONS: granted=(true|false),/gm)];
  assert.equal(matches.length,1,'Require one readable disposable-app runtime permission');
  return matches[0][1]==='true';
}
export function withDisposableNotificationPermission(device,action){
  const before=disposableNotificationPermission(device);
  let value,failure,restored=false;
  try{
    if(!before)device.shell('pm','grant','--user','0',app,permission);
    assert.equal(disposableNotificationPermission(device),true,'Notification permission grant was not applied');
    value=action();
  }catch(error){failure=error;}
  finally{
    try{
      if(!before)device.shell('pm','revoke','--user','0',app,permission);
      assert.equal(disposableNotificationPermission(device),before,'Disposable notification permission was not restored');restored=true;
    }catch(error){failure=failure?new AggregateError([failure,error],'Trial and notification permission restoration failed'):error;}
  }
  return{value,failure,receipt:{scope:'disposable-local-app-notification-permission-only',originallyGranted:before,restored,completed:restored&&!failure}};
}
