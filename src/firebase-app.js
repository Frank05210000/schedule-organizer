import {saveAvailability} from './persistence.js';
import {initializeApp} from 'firebase/app';
import {getFirestore, doc, collection, query, where, orderBy, onSnapshot, getDoc, runTransaction, serverTimestamp, Timestamp, setDoc, deleteDoc, connectFirestoreEmulator} from 'firebase/firestore';
import {TaipeiDate, toInstant, toWall, emptyWeek, sortOverrides, slotState, expandWeek} from './schedule.js';
import {members as defaultMembers, regular as defaultRegular} from './seed-data.js';
window.TaipeiDate = TaipeiDate;
window.scheduleSlotState = slotState;
const ids = ['ta','fe','jy','yl','sx','yx','dx'];
const messages = {
 zh: {loading:'正在連線…', ready:'資料已同步', offline:'離線或連線中斷，資料可能過期；暫停編輯', saving:'儲存中…', saved:'已儲存', login:'切換中…', invalid:'姓名不正確', limited:'嘗試過多，請稍後再試', denied:'沒有編輯權限', conflict:'另一台裝置已修改資料，已重新讀取，請重試', failed:'操作失敗，請稍後重試', config:'尚未設定 Firebase，暫時無法載入排程', init:'團隊資料尚未初始化，暫停編輯'},
 en: {loading:'Connecting…',ready:'Data synced',offline:'Offline or disconnected. Data may be stale; editing paused.',saving:'Saving…',saved:'Saved',login:'Switching…',invalid:'Incorrect name',limited:'Too many attempts. Try later.',denied:'No permission.',conflict:'Changed on another device. Data refreshed; please retry.',failed:'Operation failed. Please retry.',config:'Firebase is not configured. Schedule unavailable.',init:'Team data is not initialized; editing paused.'}
};
class Store {
  state = {
    regEdits:{},
    versions:{},
    defaults:Object.fromEntries(defaultMembers.map(m=>[m.id,expandWeek(defaultRegular[m.id])])),
    overrides:[],
    members:defaultMembers,
    member:null,
    status:'loading',
    busy:false,
    connected:false
  };
  watchers = new Set(); stops = []; weekStop = null; readySources = new Set();
  emit(patch) {Object.assign(this.state,patch); for(const fn of this.watchers) fn(this.state);}
  subscribe(fn) {this.watchers.add(fn);fn(this.state);return ()=>this.watchers.delete(fn);}
  text(lang) {return (messages[lang] || messages.zh)[this.state.status] || messages.zh.failed;}
  async init() {
    try {
      const local = ['localhost','127.0.0.1'].includes(location.hostname) ||
        /^192\.168\./.test(location.hostname) ||
        /^10\./.test(location.hostname) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(location.hostname) ||
        location.hostname.endsWith('.local');
      const emulator = local && (location.port === '5057' || new URLSearchParams(location.search).get('emulator') === '1');
      const response = emulator ? null : await fetch('/firebase-config.json',{cache:'no-store'});
      const config = emulator ? {projectId:'demo-team-availability',apiKey:'demo-key',authDomain:'demo-team-availability.firebaseapp.com'} : await response.json();
      if(!config.projectId || !config.apiKey) throw Error('config');
      this.projectId = config.projectId;
      this.db = getFirestore(initializeApp(config));
      if(emulator) {
        const host = location.hostname;
        connectFirestoreEmulator(this.db,host,8080);
      }
      this.listen('members',snap=>{
        const docs = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.order-b.order);
        return {members: docs.length === 7 ? docs : defaultMembers};
      });
      this.listen('scheduleDefaults',snap=>{
        const docs = Object.fromEntries(snap.docs.map(d=>[d.id,d.data().week]));
        const defaults = Object.keys(docs).length === 7 ? docs : Object.fromEntries(defaultMembers.map(m=>[m.id,expandWeek(defaultRegular[m.id])]));
        return {defaults};
      });
      this.listen('availability',snap=>({regEdits:Object.fromEntries(snap.docs.map(d=>[d.id,d.data().week])),versions:Object.fromEntries(snap.docs.map(d=>[d.id,d.data().version]))}));
      const network=()=>{if(!navigator.onLine)this.emit({connected:false,status:'offline'});else this.watchWeek(...this.range);};
      window.addEventListener('offline',network);window.addEventListener('online',network);
      this.watchWeek(...this.range);
    } catch {this.emit({status:'config',connected:false});}
  }
  snapshot(key, snap, patch) {
    if(snap.metadata.hasPendingWrites) return;
    if(snap.metadata.fromCache) this.readySources.delete(key); else this.readySources.add(key);
    const connected = navigator.onLine && this.readySources.size >= 3;
    this.emit({...patch,connected,status:this.state.busy ? this.state.status : (connected ? 'ready' : (navigator.onLine ? 'loading' : 'offline'))});
  }
  listen(name, convert) {this.stops.push(onSnapshot(collection(this.db,name),{includeMetadataChanges:true},s=>this.snapshot(name,s,convert(s)),()=>this.emit({connected:false,status:'failed'})));}
  watchWeek(start,end) {
    this.range=[start,end]; if(!this.db || !start) return;
    this.weekStop?.();this.readySources.delete('overrides');this.emit({overrides:[],connected:false,status:'loading'});
    this.weekStop=onSnapshot(query(collection(this.db,'overrides'),where('startAt','<',Timestamp.fromDate(toInstant(end))),where('endAt','>',Timestamp.fromDate(toInstant(start))),orderBy('startAt'),orderBy('endAt')),{includeMetadataChanges:true},s=>{
      this.snapshot('overrides',s,{overrides:sortOverrides(s.docs.map(d=>({id:d.id,...d.data()}))).map(o=>({...o,startAt:toWall(o.startAt.toDate()),endAt:toWall(o.endAt.toDate())}))});
    },()=>this.emit({connected:false,status:'failed'}));
  }
  error(e) {
    return e.message === 'conflict' ? 'conflict' : e.message === 'offline' ? 'offline' : 'failed';
  }
  setMember(mid) {
    this.emit({member: ids.includes(mid) ? mid : null, status: this.state.connected ? 'ready' : this.state.status});
  }
  async login(mid) {
    this.setMember(mid);
    return true;
  }
  async logout() {this.emit({member:null});}
  async write(mid, action) {
    if(this.state.busy)return false;
    this.emit({busy:true,status:'saving'});
    try {if(!this.state.connected || !navigator.onLine)throw Error('offline');await action();this.emit({status:'saved'});return true;}
    catch(e) {if(e.current) this.emit({regEdits:{...this.state.regEdits,[mid]:e.current.week},versions:{...this.state.versions,[mid]:e.current.version}});this.emit({status:this.error(e)});return false;}finally {this.emit({busy:false});}
  }
  saveWeek(mid, week) {
    const version=this.state.versions[mid] || 0;
    return this.write(mid,()=>saveAvailability(this.db,mid,{...emptyWeek(),...(week || this.state.defaults[mid])},version));
  }

  addOverride(mid, data) {return this.write(mid,()=>setDoc(doc(collection(this.db,'overrides')),{member:mid,...data,startAt:Timestamp.fromDate(toInstant(data.startAt)),endAt:Timestamp.fromDate(toInstant(data.endAt)),createdAt:serverTimestamp()}));}
  removeOverride(mid,id) {return this.write(mid,()=>deleteDoc(doc(this.db,'overrides',id)));}
}
window.teamStore = new Store();
