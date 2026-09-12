import {mkdir,readFile,writeFile,chmod} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {members} from '../src/seed-data.js';
await mkdir('secrets',{recursive:true,mode:0o700});
const path='secrets/demo-passwords.json';
let passwords;
try {passwords=JSON.parse(await readFile(path,'utf8'));}catch(e) {
 if(e.code!=='ENOENT')throw e;
 passwords=Object.fromEntries(members.map(m=>[m.id,'demo7'+randomBytes(6).toString('hex')]));
 await writeFile(path,JSON.stringify(passwords,null,2)+'\n',{mode:0o600,flag:'wx'});
}
await chmod(path,0o600);
const result=spawnSync(process.execPath,['scripts/seed.mjs'],{
 env:{...process.env,GCLOUD_PROJECT:'demo-team-availability',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',TEAM_PASSWORD_FILE:path},
 stdio:['ignore','inherit','inherit']
});
if(result.status!==0)process.exit(result.status || 1);
console.log('Local demo ready. Test-only passwords are in secrets/demo-passwords.json.');
