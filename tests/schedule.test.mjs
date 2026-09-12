import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TaipeiDate,toInstant,toWall,sortOverrides,slotState,expandWeek,emptyWeek} from '../src/schedule.js';
import {readFileSync} from 'node:fs';
test('Taipei input roundtrips as UTC instant across device timezones',()=>{
 for(const tz of ['America/Los_Angeles','Asia/Taipei','Europe/London']){
  process.env.TZ=tz;
  assert.equal(toInstant('2026-09-13T00:30').toISOString(),'2026-09-12T16:30:00.000Z');
  assert.equal(toWall(toInstant('2026-09-13T00:30')),'2026-09-13T00:30');
  const d=new TaipeiDate('2026-09-13T00:30');assert.equal(d.getDay(),0);assert.equal(d.getHours(),0);
  d.setDate(d.getDate()+1);assert.equal(d.getDay(),1);
 }
});
test('year boundary and now use Taipei calendar',()=>{
 const d=new TaipeiDate(2026,11,31,23);d.setHours(25);assert.equal(d.getFullYear(),2027);assert.equal(d.getDate(),1);
 assert.ok(Math.abs(new TaipeiDate().getTime()-Date.now()-8*3600000)<1000);
});
test('latest override wins, half-open boundaries, revocation and different member',()=>{
 const a={id:'a',member:'ta',startAt:'2026-09-13T23:00',endAt:'2026-09-14T10:00',type:'off',createdAt:{seconds:1,nanoseconds:0}};
 const b={...a,id:'b',type:'on',startAt:'2026-09-14T08:30',endAt:'2026-09-14T09:00',createdAt:{seconds:2,nanoseconds:0}};
 const items=sortOverrides([b,a]);
 assert.equal(slotState(true,items,'ta','2026-09-14T08:00','2026-09-14T09:00').free,true);
 assert.equal(slotState(true,[a],'ta','2026-09-14T08:00','2026-09-14T09:00').free,false);
 assert.equal(slotState(false,items,'ta','2026-09-14T10:00','2026-09-14T11:00').free,false);
 assert.equal(slotState(true,items,'fe','2026-09-14T09:00','2026-09-14T10:00').free,true);
 assert.deepEqual(sortOverrides([{...a,id:'z'},{...a,id:'a'}]).map(o=>o.id),['a','z']);
});
test('clear and default have different meanings',()=>{
 assert.deepEqual(emptyWeek()['1'],[]);assert.deepEqual(expandWeek({1:[[8,10],[18,21]]})['1'],[8,9,18,19,20]);
});
test('component source parses and deployed HTML has no original credentials',()=>{
 const s=readFileSync('public/index.html','utf8');
 const code=s.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
 assert.doesNotThrow(()=>new Function('DCLogic',code));
 assert.doesNotMatch(s,/pin: '\d+'|示範 PIN|Demo PIN|meetslot-overrides-v1|meetslot-reg-v1/);
});
