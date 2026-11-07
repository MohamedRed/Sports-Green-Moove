import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';

export async function runTeamPushInvalidationChecks({check,db,call,parent,otherAdult,newMessage,plan,delivery,dispatch}) {
  const {teamPushInstallationId,teamPushTokenId,teamPushRegistrationRecordSchema,teamPushRegistrationFingerprint}=
    await import('../../functions/lib/domain/teamPushRegistration.js');
  const {teamPushLeaseMs}=await import('../../functions/lib/domain/teamPushDispatch.js');
  const fresh=()=>({installationId:randomUUID(),installationSecret:randomBytes(32).toString('hex'),revision:1,
    platform:'android',token:'synthetic_token_'+randomBytes(48).toString('hex')});
  const ref=device=>db.collection('teamPushInstallations').doc(teamPushInstallationId(device.installationId));
  const index=device=>db.collection('teamPushTokens').doc(teamPushTokenId(device.token));
  const register=(device,actor=parent)=>call('registerTeamPushDevice',actor,device);
  const remove=(device,actor=parent)=>register({...device,revision:device.revision+1,token:null},actor);
  const prepared=async()=>{
    const device=fresh();await register(device);const m=await newMessage(),ids=await plan(m);
    const target=(await Promise.all(ids.map(async id=>({id,row:(await delivery(m,id).get()).data()}))))
      .find(value=>value.row.installationId===ref(device).id);assert(target);
    return {device,m,id:target.id};
  };
  const unchanged=async(device,before)=>assert.deepEqual((await ref(device).get()).data(),before);
  const reject=async()=>({status:'rejected',reason:'invalid_token'});
  await check('invalid-token-retires-current-binding-blocks-frozen-alerts-and-requires-a-new-revision',async()=>{
    const {device,m,id}=await prepared(),next=await newMessage(),ids=await plan(next);
    const before=(await ref(device).get()).data();await dispatch(m.id,id,reject);
    const retired=teamPushRegistrationRecordSchema.parse((await ref(device).get()).data());
    assert.equal(retired.active,false);assert.equal(retired.token,null);assert.equal(retired.revision,device.revision);
    assert.equal(retired.secretHash,before.secretHash);assert(retired.createdAt.isEqual(before.createdAt));
    assert.equal(retired.fingerprint,teamPushRegistrationFingerprint(parent.uid,retired));
    assert.equal((await index(device).get()).exists,false);
    let sends=0;
    for(const frozen of ids)if((await delivery(next,frozen).get()).get('installationId')===ref(device).id){
      await dispatch(next.id,frozen,async()=>{sends++;return {status:'accepted',providerId:'never-sent'};});
      assert.equal((await delivery(next,frozen).get()).get('status'),'suppressed');
    }
    assert.equal(sends,0);await assert.rejects(()=>register(device),/latest local revision/);
    const renewed={...device,revision:2,token:fresh().token};await register(renewed);
    assert.equal((await ref(device).get()).get('active'),true);assert.equal((await index(renewed).get()).exists,true);
    await remove(renewed);
  });
  for(const action of ['token-refresh','account-switch','signout'])
    await check('late-invalid-token-preserves-'+action,async()=>{
      const {device,m,id}=await prepared();let expected;
      const current={...device,revision:2,...(action==='token-refresh'?{token:fresh().token}:action==='signout'?{token:null}:{})};
      const actor=action==='account-switch'?otherAdult:parent;
      await dispatch(m.id,id,async()=>{await register(current,actor);expected=(await ref(device).get()).data();return reject();});
      await unchanged(device,expected);
      if(current.token)assert.equal((await index(current).get()).get('userId'),actor.uid);
      assert.equal((await delivery(m,id).get()).get('status'),'invalid_token');
      if(current.token)await remove(current,actor);
    });
  await check('late-invalid-token-cannot-delete-a-token-rebound-to-another-installation',async()=>{
    const {device,m,id}=await prepared(),replacement={...fresh(),token:device.token};let before,owner;
    await dispatch(m.id,id,async()=>{
      await remove(device);await register(replacement,otherAdult);
      before=(await ref(replacement).get()).data();owner=(await index(replacement).get()).data();return reject();
    });
    await unchanged(replacement,before);assert.deepEqual((await index(replacement).get()).data(),owner);
    assert.equal((await ref(device).get()).get('active'),false);await remove(replacement,otherAdult);
  });
  await check('configuration-temporary-and-unknown-errors-never-retire-device-registration',async()=>{
    for(const reason of ['configuration','temporary','unknown']){
      const {device,m,id}=await prepared(),before=(await ref(device).get()).data(),owner=(await index(device).get()).data();
      const run=()=>dispatch(m.id,id,async()=>({status:'rejected',reason}));
      if(reason==='configuration')await run();else await assert.rejects(run,/pending/);
      await unchanged(device,before);assert.deepEqual((await index(device).get()).data(),owner);await remove(device);
    }
  });
  await check('concurrent-invalid-results-retire-the-same-binding-idempotently',async()=>{
    const {device,m,id}=await prepared(),next=await newMessage(),ids=await plan(next);
    const second=(await Promise.all(ids.map(async id=>({id,row:(await delivery(next,id).get()).data()}))))
      .find(value=>value.row.installationId===ref(device).id);assert(second);
    let entered=0,release;const both=new Promise(resolve=>release=resolve);
    const timeout=setTimeout(()=>release(),10_000);
    const sender=async()=>{if(++entered===2)release();await both;return reject();};
    try{await Promise.all([dispatch(m.id,id,sender),dispatch(next.id,second.id,sender)]);assert.equal(entered,2);}
    finally{clearTimeout(timeout);release();}
    assert.equal((await ref(device).get()).get('active'),false);assert.equal((await index(device).get()).exists,false);
    for(const [message,target]of [[m,id],[next,second.id]])assert.equal((await delivery(message,target).get()).get('status'),'invalid_token');
  });
  await check('late-invalid-result-with-an-expired-lease-cannot-retire-the-winning-registration',async()=>{
    const {device,m,id}=await prepared(),before=(await ref(device).get()).data(),now=Date.now();
    await assert.rejects(()=>dispatch(m.id,id,async()=>{
      await dispatch(m.id,id,async()=>({status:'accepted',providerId:'synthetic-new-lease'}),()=>now+teamPushLeaseMs+1000);
      return reject();
    },()=>now),/pending/);
    await unchanged(device,before);assert.equal((await index(device).get()).exists,true);
    assert.equal((await delivery(m,id).get()).get('status'),'accepted');await remove(device);
  });
}
