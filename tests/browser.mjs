import {chromium} from 'playwright';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdir, readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {members} from '../src/seed-data.js';
let passwords;
try {
  passwords = JSON.parse(await readFile('secrets/demo-passwords.json', 'utf8'));
} catch {
  passwords = Object.fromEntries(members.map(m=>[m.id,'T7'+randomBytes(12).toString('hex')]));
}
const env = {
  ...process.env,
  GCLOUD_PROJECT: process.env.GCLOUD_PROJECT || 'demo-team-availability',
  FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
};
const seed=spawnSync(process.execPath,['scripts/seed.mjs'],{env,input:JSON.stringify(passwords),encoding:'utf8'});
if(seed.status!==0)throw Error('Emulator seed failed: '+seed.stderr);
// Re-running seed with different input must preserve the original passwords.
const second=spawnSync(process.execPath,['scripts/seed.mjs'],{env,input:'{}',encoding:'utf8'});
assert.equal(second.status,0);
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
async function page(context){const p=await context.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5057/?emulator=1');await p.waitForFunction(()=>window.teamStore?.state.connected);await p.getByRole('heading',{name:'每週時段總覽'}).waitFor();return p;}
try {
 const studentContext=await browser.newContext({timezoneId:'America/Los_Angeles',viewport:{width:1280,height:950}});
 const professorContext=await browser.newContext({timezoneId:'Asia/Taipei',viewport:{width:1280,height:950}});
 const p=await page(studentContext),prof=await page(professorContext);
 assert.equal(await prof.locator('input[type="password"]').count(),0);
 await p.getByRole('button',{name:'學生專區',exact:true}).click();
 for(const m of members){
   await p.getByRole('button',{name:m.name,exact:true}).click();
   await p.locator('input[type="password"]').fill(passwords[m.id]);
   await p.getByRole('button',{name:'解鎖',exact:true}).click();
   await p.waitForFunction(id=>window.teamStore.state.member===id && !window.teamStore.state.busy,m.id);
   await p.getByRole('button',{name:'登出',exact:true}).waitFor();
 }
 await p.reload();await p.waitForFunction(()=>window.teamStore.state.member==='dx'&&window.teamStore.state.connected);
 await p.getByRole('button',{name:'學生專區',exact:true}).click();
 assert.equal(await p.locator('input[type="password"]').count(),0);
 console.log('PASS: seven name buttons authenticate; idempotent seed preserves passwords; session survives reload');
 await p.getByRole('button',{name:members[0].name,exact:true}).click();
 console.log('Checking incorrect password');
 await p.locator('input[type="password"]').fill('WrongPassword');await p.getByRole('button',{name:'解鎖',exact:true}).click();await p.waitForFunction(()=>window.teamStore.state.status==='invalid');
 await p.locator('input[type="password"]').fill(passwords.ta);await p.getByRole('button',{name:'解鎖',exact:true}).click();await p.waitForFunction(()=>window.teamStore.state.member==='ta'&&!window.teamStore.state.busy);
 // Use the visible form to create a partial-hour exception inside the displayed week.
 const start=await p.evaluate(()=>window.teamStore.range[0].slice(0,10)+'T08:30');
 await p.locator('input[type="datetime-local"]').nth(0).fill(start);
 await p.locator('input[type="datetime-local"]').nth(1).fill(start.slice(0,10)+'T09:30');
 await p.getByPlaceholder('頭髮骨折要去看醫生').fill('測試同步');
 await p.getByRole('button',{name:'送出，立即更新'}).click();
 await prof.waitForFunction(()=>window.teamStore.state.overrides.some(o=>o.note==='測試同步'));
 assert.equal(await prof.evaluate(()=>window.teamStore.state.overrides.find(o=>o.note==='測試同步').startAt),start);
 await p.waitForFunction(()=>!window.teamStore.state.busy);
 await p.getByRole('button',{name:'學生專區',exact:true}).click();
 await p.getByRole('button',{name:'撤銷',exact:true}).click();await prof.waitForFunction(()=>!window.teamStore.state.overrides.some(o=>o.note==='測試同步'));
 console.log('PASS: public professor receives create/revoke live across device timezones');
 await p.getByText('常規空檔',{exact:true}).click();
 await p.getByRole('button',{name:'全部清空',exact:true}).click();
 await prof.waitForFunction(()=>window.teamStore.state.regEdits.ta && Object.values(window.teamStore.state.regEdits.ta).every(a=>!a.length));
 await p.waitForFunction(()=>!window.teamStore.state.busy);
 await p.getByRole('button',{name:'回到預設',exact:true}).click();
 await prof.waitForFunction(()=>window.teamStore.state.regEdits.ta?.['1']?.length>0);
 await p.waitForFunction(()=>!window.teamStore.state.busy);
 await studentContext.setOffline(true);await p.waitForFunction(()=>!window.teamStore.state.connected);
 assert.equal(await p.getByRole('button',{name:'全部清空',exact:true}).isDisabled(),true);
 await studentContext.setOffline(false);await p.waitForFunction(()=>window.teamStore.state.connected);
 assert.equal(await p.getByRole('button',{name:'全部清空',exact:true}).isEnabled(),true);
 await p.getByRole('button',{name:'關閉',exact:true}).click();
 console.log('PASS: clear/default sync and offline edit disabling/reconnect');
 await mkdir('artifacts',{recursive:true});await p.screenshot({path:'artifacts/desktop.png',fullPage:true});
 const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,timezoneId:'Europe/London'});
 const mobile=await page(mobileContext);await mobile.screenshot({path:'artifacts/mobile.png',fullPage:true});
 assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await mobile.getByRole('button',{name:'Language'}).click();await mobile.getByRole('button',{name:'Student area',exact:true}).waitFor();
 await mobile.getByRole('button',{name:'Next week',exact:true}).click();await mobile.waitForFunction(()=>window.teamStore.state.connected);
 assert.deepEqual(errors,[]);
 console.log('PASS: mobile layout, English switch, week navigation; no uncaught browser errors');
} catch(error) {
 await mkdir('artifacts',{recursive:true});
 for(const [i,c] of browser.contexts().entries())for(const p of c.pages()) {
  await p.screenshot({path:`artifacts/failure-${i}.png`,fullPage:true});
  console.log('Failure status',await p.evaluate(()=>({status:window.teamStore?.state.status,member:window.teamStore?.state.member,busy:window.teamStore?.state.busy,connected:window.teamStore?.state.connected}))); 
 }
 console.log('Browser errors',errors);throw error;
} finally {await browser.close();}
