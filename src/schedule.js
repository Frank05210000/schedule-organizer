// Calendar arithmetic uses UTC-backed wall-clock values; persistence converts Taipei to UTC.
export class TaipeiDate extends Date {
  constructor(...args) {
    if (!args.length) super(Date.now() + 8 * 3600000);
    else if (args.length > 1) super(Date.UTC(...args));
    else if (typeof args[0] === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(args[0])) super(args[0] + 'Z');
    else super(args[0]);
  }
}
for (const part of ['FullYear','Month','Date','Day','Hours','Minutes','Seconds','Milliseconds']) {
  TaipeiDate.prototype['get' + part] = Date.prototype['getUTC' + part];
  if (part !== 'Day') TaipeiDate.prototype['set' + part] = Date.prototype['setUTC' + part];
}
export const toInstant = value => new Date(value + '+08:00');
export const toWall = value => new Date(value.getTime() + 8 * 3600000).toISOString().slice(0,16);
export function emptyWeek() { return Object.fromEntries(Array.from({length:7},(_,d)=>[d,[]])); }
export function expandWeek(ranges) {
  return Object.fromEntries(Array.from({length:7},(_,d)=>[d,(ranges[d] || []).flatMap(([s,e])=>Array.from({length:e-s},(_,i)=>s+i))]));
}
export function sortOverrides(items) {
  return items.sort((a,b)=> (a.createdAt?.seconds || 0)-(b.createdAt?.seconds || 0) || (a.createdAt?.nanoseconds || 0)-(b.createdAt?.nanoseconds || 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
export function slotState(regular, overrides, member, start, end) {
  let free = regular, override = null;
  for (const o of overrides) {
    if (o.member === member && start < o.endAt && end > o.startAt) { free = o.type === 'on'; override = o; }
  }
  return {free, override};
}
