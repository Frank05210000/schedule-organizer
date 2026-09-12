import {initializeApp, applicationDefault} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {members,regular} from '../src/seed-data.js';
import {expandWeek} from '../src/schedule.js';
import {readFile} from 'node:fs/promises';
const projectId=process.env.GCLOUD_PROJECT;
if(!projectId)throw Error('Set GCLOUD_PROJECT explicitly.');
const emulator=!!process.env.FIREBASE_AUTH_EMULATOR_HOST && !!process.env.FIRESTORE_EMULATOR_HOST;
if(projectId.startsWith('demo-') && !emulator)throw Error('Demo projects require both emulators.');
if(!projectId.startsWith('demo-') && emulator)throw Error('Use a demo project for emulator seeding.');
// Secrets are accepted over stdin or a private file only; never printed or bundled.
const input=await readFile(process.env.TEAM_PASSWORD_FILE || '/dev/stdin','utf8');
const passwords=JSON.parse(input);
initializeApp({projectId,...(emulator ? {} : {credential:applicationDefault()})});
const auth=getAuth(),db=getFirestore();
const accounts=new Map();
for(const m of members) {
  try {
    const user=await auth.getUserByEmail(`${m.id}@${projectId}.invalid`);
    if(user.uid!==`team-${m.id}`)throw Error(`Unexpected existing account for ${m.id}; inspect manually instead of granting access.`);
    accounts.set(m.id,user);
  }
  catch(e) {if(e.code!=='auth/user-not-found')throw e;}
  if(!accounts.has(m.id)) {
    const password=passwords[m.id];
    if(typeof password!=='string'||password.length<6||!/[a-z]/.test(password)||!/[0-9]/.test(password))throw Error(`Invalid initial password for ${m.id}`);
  }
}
for(const [order,m] of members.entries()) {
  const email=`${m.id}@${projectId}.invalid`;
  const user=accounts.get(m.id) || await auth.createUser({uid:`team-${m.id}`,email,password:passwords[m.id],displayName:m.name});
  const records=[['members',m.id,{...m,order}],['memberAccess',user.uid,{memberId:m.id}],['scheduleDefaults',m.id,{week:expandWeek(regular[m.id])}]];
  for(const [name,id,data]of records){const ref=db.doc(`${name}/${id}`);await db.runTransaction(async tx=>{const current=await tx.get(ref);if(!current.exists)tx.create(ref,data);else if(name==='scheduleDefaults')tx.set(ref,data);else if(name==='memberAccess' && current.data().memberId!==m.id)throw Error('Existing identity mapping differs; inspect manually.');});}
  console.log(`Ready: ${m.id} (existing accounts and passwords preserved)`);
}
