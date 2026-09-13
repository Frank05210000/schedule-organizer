// Browser integration with isolated fixture data; no Firebase connection.
import {chromium} from 'playwright';
import {build} from 'esbuild';
import {readFile, mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const fixture=await build({stdin:{contents:`import {TaipeiDate,slotState,expandWeek} from './src/schedule.js';import {members,regular} from './src/seed-data.js';window.TaipeiDate=TaipeiDate;window.scheduleSlotState=slotState;window.teamStore={subscribe(fn){fn({members,defaults:Object.fromEntries(members.map(m=>[m.id,expandWeek(regular[m.id])])),connected:true,regEdits:{},overrides:[]});return ()=>{}},watchWeek(){},init(){},text(){return '資料已同步'},stops:[]};`,resolveDir:process.cwd()},bundle:true,write:false,format:'iife'});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1360,height:1000},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname!=='calendar.test')return route.abort();
  const path=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
  if(path==='firebase-app.js')return route.fulfill({body:fixture.outputFiles[0].text,contentType:'application/javascript'});
  try {await route.fulfill({body:await readFile('public/'+path),contentType:path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':path.endsWith('.html')?'text/html':'image/svg+xml'});}catch{await route.abort();}
 });
 await page.goto('http://calendar.test/');
 await page.getByRole('button',{name:'匯出日曆圖',exact:true}).click();
 const range=page.getByRole('combobox',{name:'匯出顯示範圍'});
 assert.equal(await range.inputValue(),'7');
 const seven=await page.locator('canvas').evaluate(c=>c.toDataURL());
 await range.selectOption('5');
 assert.notEqual(await page.locator('canvas').evaluate(c=>c.toDataURL()),seven);
 await mkdir('artifacts',{recursive:true});
 await page.locator('canvas').screenshot({path:'artifacts/calendar-export-weekdays.png'});
 const downloaded=page.waitForEvent('download');
 await page.getByRole('button',{name:'下載 PNG 圖片'}).click();
 const download=await downloaded;assert.match(download.suggestedFilename(),/-5days.png$/);
 await download.saveAs('artifacts/calendar-export-1920.png');
 const png=await readFile('artifacts/calendar-export-1920.png');assert.equal(png.readUInt32BE(16),1920);assert.equal(png.readUInt32BE(20),1080);
 await range.selectOption('7');assert.equal(await page.locator('canvas').isVisible(),true);
 await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'匯出日曆圖',exact:true}).click();
 assert.equal(await range.inputValue(),'5');
 await range.selectOption('7');
 await page.screenshot({path:'artifacts/calendar-export-mobile.png'});
 assert.ok(await page.getByRole('dialog').evaluate(d=>d.scrollWidth<=d.clientWidth));
 assert.deepEqual(errors,[]);
 console.log('PASS: page integration, 5/7-day previews, PNG 1920×1080 download, Escape, mobile layout; fixture data only');
}finally{await browser.close();}
