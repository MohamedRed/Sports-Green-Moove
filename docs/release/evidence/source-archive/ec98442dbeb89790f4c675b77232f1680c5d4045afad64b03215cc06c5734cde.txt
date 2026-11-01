import {randomUUID} from 'node:crypto';
import {Timestamp} from 'firebase-admin/firestore';
import {auth,db,call,signIn} from './local-flow-client.mjs';

export async function prepareTeamAlertFixture() {
  const clubId='sgm-qa-club-green-wavre',teamId='sgm-qa-team-alerts',childId='sgm-qa-team-alert-child';
  const parent=await signIn('p@example.test'),driver=await signIn('d@example.test'),manager=await signIn('c@example.test');
  const create=async(name,roles=['parent'])=>{
    const uid='sgm-qa-team-alert-'+name,email=name+'-team-alert@example.test';
    await auth.createUser({uid,email,password:process.env.SGM_QA_PASSWORD});
    await auth.setCustomUserClaims(uid,{roleKeys:roles});const actor=await signIn(email);
    await call('initializeUserProfile',actor);
    await db.collection('memberships').doc(uid+'_'+clubId).set({userId:uid,clubId,status:'active',updatedAt:Timestamp.now()});
    return actor;
  };
  const actors={parent,driver,manager,unverified:await create('unverified'),mixed:await create('mixed'),
    linked:await create('linked'),childProfile:await create('child-profile'),disabled:await create('disabled',['driver']),
    otherAdult:await create('adult',['driver'])};
  for(const actor of [parent,driver,manager]) {
    await call('initializeUserProfile',actor);
    await db.collection('memberships').doc(actor.uid+'_'+clubId).update({updatedAt:Timestamp.now()});
  }
  await db.collection('teams').doc(teamId).create({clubId,name:'Equipe alertes QA',status:'active'});
  const guardianIds=[parent.uid,actors.unverified.uid,actors.mixed.uid,actors.linked.uid,actors.childProfile.uid];
  await db.collection('children').doc(childId).create({displayName:'Enfant alertes QA',guardianUserIds:guardianIds});
  await db.collection('memberships').doc(childId+'_'+clubId).create({userId:childId,clubId,status:'active',updatedAt:Timestamp.now()});
  async function enroll(actor,child) {
    const view=await call('getTeamEnrollmentView',actor,{teamId,...(child?{childId:child}:{})});
    const requested=await call('requestTeamEnrollment',actor,{teamId,...(child?{childId:child}:{}),
      expectedTeamInstanceId:view.teamInstanceId,expectedEnrollmentId:view.id,expectedRevision:view.revision,requestId:randomUUID()});
    const approved=await call('transitionTeamEnrollment',manager,{enrollmentId:view.id,action:'approve',
      expectedRevision:requested.revision,requestId:randomUUID()});
    return{view,approved};
  }
  async function guardian(actor,action,revision,subject=childId) {
    return call('transitionGuardianVerification',action==='request'?actor:manager,{childId:subject,clubId,parentUserId:actor.uid,
      action,expectedRevision:revision,requestId:randomUUID()});
  }
  const member=await enroll(driver);
  await enroll(actors.otherAdult);await enroll(actors.disabled);
  let parentVerificationId;
  for(const actor of [parent,actors.mixed,actors.linked,actors.childProfile]) {
    await guardian(actor,'request',0);const verified=await guardian(actor,'verify',1);
    if(actor.uid===parent.uid)parentVerificationId=verified.verificationId;
  }
  const childEnrollment=await enroll(parent,childId);
  async function prepareSecondChild() {
    const id=childId+'-second';
    await db.collection('children').doc(id).create({displayName:'Second enfant alertes QA',guardianUserIds:[parent.uid]});
    await db.collection('memberships').doc(id+'_'+clubId).create({userId:id,clubId,status:'active',updatedAt:Timestamp.now()});
    await guardian(parent,'request',0,id);await guardian(parent,'verify',1,id);
    return enroll(parent,id);
  }
  await auth.setCustomUserClaims(actors.mixed.uid,{roleKeys:['parent','child']});
  await db.collection('users').doc(actors.childProfile.uid).update({'roles.child':true});
  await db.collection('childAccountLinks').doc(actors.linked.uid).create({accountUserId:actors.linked.uid,childId,status:'verified'});
  await auth.updateUser(actors.disabled.uid,{disabled:true});
  return{clubId,teamId,childId,actors,guardianIds,guardian,enroll,member,childEnrollment,prepareSecondChild,parentVerificationId,
    target:{teamId,expectedTeamInstanceId:member.view.teamInstanceId}};
}
