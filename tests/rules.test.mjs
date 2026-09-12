import {saveAvailability} from '../src/persistence.js';
import {before,after,test} from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,deleteDoc,updateDoc,serverTimestamp,Timestamp,runTransaction,query,where,onSnapshot} from 'firebase/firestore';
import {emptyWeek} from '../src/schedule.js';
let env,anon,ta,fe,outsider;
before(async()=>{
 env=await initializeTestEnvironment({projectId:'demo-rules-test',firestore:{rules:readFileSync('firestore.rules','utf8')}});
 await env.clearFirestore();anon=env.unauthenticatedContext().firestore();ta=env.authenticatedContext('student-ta').firestore();fe=env.authenticatedContext('student-fe').firestore();outsider=env.authenticatedContext('outsider').firestore();
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'memberAccess/student-ta'),{memberId:'ta'});await setDoc(doc(db,'memberAccess/student-fe'),{memberId:'fe'});
  await setDoc(doc(db,'members/ta'),{name:'魏提安',group:'A'});await setDoc(doc(db,'scheduleDefaults/ta'),{week:emptyWeek()});
 });
});
after(async()=>{await env.cleanup();});
const avail=(version=1)=>({week:emptyWeek(),version,updatedAt:serverTimestamp()});
const ov=(member='ta')=>({member,startAt:Timestamp.fromDate(new Date('2026-09-13T15:00Z')),endAt:Timestamp.fromDate(new Date('2026-09-14T02:00Z')),type:'off',note:'公開備註',createdAt:serverTimestamp()});
test('anonymous reads public collections but cannot read identity mapping',async()=>{
 for(const name of ['members','scheduleDefaults','availability','overrides'])await assertSucceeds(getDocs(collection(anon,name)));
 await assertFails(getDoc(doc(anon,'memberAccess/student-ta')));
 await assertFails(getDocs(collection(ta,'memberAccess')));
 await assertSucceeds(getDoc(doc(ta,'memberAccess/student-ta')));
 await assertFails(getDoc(doc(ta,'memberAccess/student-fe')));
});
test('owner writes only own availability; outsiders and identity spoofing blocked',async()=>{
 await assertSucceeds(setDoc(doc(ta,'availability/ta'),avail()));
 await assertFails(setDoc(doc(anon,'availability/fe'),avail()));await assertFails(setDoc(doc(ta,'availability/fe'),avail()));
 await assertFails(setDoc(doc(outsider,'availability/ta'),avail(2)));
 await assertFails(setDoc(doc(ta,'memberAccess/student-ta'),{memberId:'fe'}));
 await assertFails(updateDoc(doc(ta,'members/ta'),{name:'spoof'}));await assertFails(setDoc(doc(ta,'scheduleDefaults/ta'),{week:emptyWeek()}));
 await assertFails(deleteDoc(doc(ta,'availability/ta')));
});
test('availability rejects invalid fields, hours, versions and client timestamps',async()=>{
 const invalid=[{...avail(2),extra:1},{...avail(2),week:{...emptyWeek(),0:[7]}},{...avail(2),week:{...emptyWeek(),0:[8,8]}},{...avail(2),week:{...emptyWeek(),0:['8']}},{...avail(2),week:{0:[]}},{...avail(2),updatedAt:Timestamp.fromMillis(0)},avail(1),avail(2.5)];
 for(const data of invalid)await assertFails(setDoc(doc(ta,'availability/ta'),data));
});
test('concurrent edits detect stale version instead of overwriting',async()=>{
 const edit=()=>saveAvailability(ta,'ta',emptyWeek(),1);
 const results=await Promise.allSettled([edit(),edit()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.find(r=>r.status==='rejected').reason.message,'conflict');
});
test('override ownership, public notes, validation and revocation',async()=>{
 await assertSucceeds(setDoc(doc(ta,'overrides/good'),ov()));
 assert.equal((await getDoc(doc(anon,'overrides/good'))).data().note,'公開備註');
 await assertFails(setDoc(doc(anon,'overrides/anon'),ov()));await assertFails(setDoc(doc(ta,'overrides/other'),ov('fe')));
 const base=ov();for(const patch of [{note:'一'.repeat(16)},{type:'bad'},{endAt:base.startAt},{startAt:'2026-01-01'},{createdAt:Timestamp.fromMillis(0)},{extra:1}])await assertFails(setDoc(doc(ta,'overrides/invalid'),{...base,...patch}));
 await assertFails(updateDoc(doc(ta,'overrides/good'),{member:'fe'}));await assertFails(deleteDoc(doc(fe,'overrides/good')));
 // Cross-week intersection includes a record starting before Monday.
 const snap=await assertSucceeds(getDocs(query(collection(anon,'overrides'),where('startAt','<',Timestamp.fromDate(new Date('2026-09-20T16:00Z'))),where('endAt','>',Timestamp.fromDate(new Date('2026-09-13T16:00Z'))))));assert.equal(snap.size,1);
 await assertSucceeds(deleteDoc(doc(ta,'overrides/good')));
});
test('another anonymous connection receives changes without refresh',async()=>{
 let stop;const received=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('listener timeout')),5000);stop=onSnapshot(doc(anon,'overrides/live'),s=>{if(s.exists()){clearTimeout(timer);resolve(s.data());}},reject);});
 await setDoc(doc(ta,'overrides/live'),ov());assert.equal((await received).member,'ta');stop();await deleteDoc(doc(ta,'overrides/live'));
});
