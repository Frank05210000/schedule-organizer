/* Self-contained, local PNG rendering; no screenshot service or uploaded data. */
window.openCalendarExport = function (snapshot) {
  const en = snapshot.lang === 'en';
  const tr = (zh, eng) => en ? eng : zh;
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label', tr('匯出日曆圖', 'Export calendar'));
  dialog.style.cssText = 'width:min(1120px,calc(100vw - 40px));max-height:90dvh;overflow:auto;box-sizing:border-box;border:1px solid #d9e2dc;border-radius:20px;padding:24px;background:#f8f9f5;color:#203e34;box-shadow:0 24px 100px #0004;font-family:system-ui,sans-serif';
  dialog.innerHTML = `<style>dialog::backdrop{background:#142d2777}.export-toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:18px}.export-toolbar button,.export-toolbar select{font:inherit;padding:10px 14px;border:1px solid #cbd8cf;border-radius:9px;background:white;color:#203e34;cursor:pointer}.export-toolbar button:disabled{opacity:.5;cursor:wait}.export-toolbar .export-download{background:#21634e;color:white;border-color:#21634e}</style>
    <div class="export-toolbar"><h2 style="font-size:20px;margin:0 auto 0 0">${tr('匯出日曆圖', 'Export calendar')}</h2><button class="export-close" aria-label="${tr('關閉匯出', 'Close export')}">✕</button></div>
    <div class="export-toolbar"><label>${tr('顯示範圍', 'Days')} <select aria-label="${tr('匯出顯示範圍', 'Export days')}"><option value="5">${tr('週一至週五', 'Monday–Friday')}</option><option value="7">${tr('週一至週日', 'Monday–Sunday')}</option></select></label><span style="font-size:13px;color:#64766d">16:9 · 1920 × 1080 · PNG</span><button class="export-download" style="margin-left:auto">${tr('下載 PNG 圖片', 'Download PNG')}</button></div>
    <canvas width="1920" height="1080" role="img" aria-label="${tr('目前週次的出席人數日曆熱圖預覽', 'Weekly attendance heatmap preview')}" style="display:block;width:100%;height:auto;border-radius:12px;border:1px solid #dce4dc"></canvas>
    <p style="font-size:13px;color:#64766d;margin-bottom:0">${tr('使用開啟時的週次、組別與空檔資料；每格為一小時。', 'Uses the week, groups and availability captured when opened; each cell is one hour.')}</p><p class="export-status" role="status" style="font-size:13px"></p>`;
  const previous = document.activeElement;
  document.body.append(dialog);
  const canvas = dialog.querySelector('canvas'), ctx = canvas.getContext('2d');
  const select = dialog.querySelector('select');
  select.value = snapshot.weekend ? '7' : '5';
  const status = dialog.querySelector('.export-status');
  const box = (x,y,w,h,color,r=12) => {ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();};
  const text = (str,x,y,size=24,color='#25483b',weight=400) => {ctx.fillStyle=color;ctx.font=`${weight} ${size}px system-ui, -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif`;ctx.textAlign='left';ctx.fillText(str,x,y);};
  let savedUrl;
  function draw() {
    dialog.querySelector('.export-save')?.remove();
    if(savedUrl) { URL.revokeObjectURL(savedUrl); savedUrl=null; }
    canvas.style.display='block';
    const days = snapshot.days.slice(0,Number(select.value)), total = snapshot.members.length;
    const cells = days.flatMap(d=>d.cells), full = cells.filter(c=>c.count===total).length;
    const eligible = cells.filter(c=>c.count>=snapshot.need && c.count>0).length;
    box(0,0,1920,1080,'#f4f5ee',0);
    box(56,60,7,110,'#2d775b',3);
    text('TEAM AVAILABILITY / '+snapshot.days[0].iso.slice(0,4),84,80,18,'#5f7868',600);
    text(tr('專題・每週空檔日曆','Weekly availability'),80,139,46,'#203f33',700);
    text(`${days[0].iso} — ${days.at(-1).iso}   /   ${tr('台北時間','Taipei time')} UTC+8`,84,182,23,'#60786a');
    text(tr('一起找到，剛剛好的時間。','Make time to meet.'),1444,134,25,'#416550',500);
    box(56,220,1348,744,'#ffffff',22);
    const left=154, top=310, gap=7, width=(1218-gap*(days.length-1))/days.length;
    const rowH=620/snapshot.hours.length;
    text(tr('時間','TIME'),80,274,17,'#7a8b80',600);
    days.forEach((d,i)=>{
      const x=left+i*(width+gap);
      text(d.label,x+12,265,21,'#315741',600);
      text(d.iso.slice(5).replace('-',' / '),x+12,294,18,'#7a8b80');
      d.cells.forEach((c,j)=>{
        const y=top+j*rowH;
        const all=c.count===total, meets=c.count>=snapshot.need && c.count>0;
        const fill=all?'#286349':meets?'#d3e8b6':c.count?'#eaf0e4':'#f4f5f1';
        box(x,y,width,rowH-5,fill,7);
        text(`${c.count}`,x+14,y+(rowH-5)/2+8,25,all?'#ffffff':c.count?'#315440':'#9aa59b',600);
        text(`/ ${total}`,x+48,y+(rowH-5)/2+6,17,all?'#d4e7d7':'#7b8e7c');
        if(all){ctx.fillStyle='#c9e3a7';ctx.beginPath();ctx.arc(x+width-18,y+(rowH-5)/2,4,0,Math.PI*2);ctx.fill();}
      });
    });
    snapshot.hours.forEach((h,i)=>text(String(h).padStart(2,'0')+':00',78,top+i*rowH+27,18,'#748679'));
    text(String(snapshot.hours.at(-1)+1).padStart(2,'0')+':00',78,952,16,'#748679');
    box(1432,220,432,744,'#e8ede1',22);
    text(tr('本週一覽','WEEK AT A GLANCE'),1464,269,20,'#4e7056',600);
    text(String(full).padStart(2,'0'),1464,360,76,'#244d37',600);
    text(tr('格全員有空','slots with everyone available'),1464,399,22);
    text(`${eligible}`,1464,473,46,'#244d37',600);
    text(tr(`格達門檻 · 至少 ${snapshot.need} 人`,`qualifying slots · ${snapshot.need}+ people`),1464,512,21);
    box(1464,546,368,1,'#cad5c4',0);
    text(tr(`篩選組別 ${snapshot.groups.join(' + ')} · ${total} 人`,`Groups ${snapshot.groups.join(' + ')} · ${total} people`),1464,589,22,'#315741',600);
    snapshot.members.forEach((m,i)=>text(m.name,1464+(i%2)*178,630+Math.floor(i/2)*32,21,'#5d7361'));
    const legends=[['#286349',tr('全員有空','Everyone available')],['#d3e8b6',tr('達到人數門檻','Threshold met')],['#eaf0e4',tr('未達門檻','Below threshold')],['#f4f5f1',tr('無人有空','No one available')]];
    legends.forEach(([color,label],i)=>{const y=786+i*35;box(1464,y-17,19,19,color,4);text(label,1496,y,19,'#56705b');});
    text(tr('每格 1 小時 · 數字為可出席人數 · 已計入臨時異動','1 hour per cell · Available attendees · Includes temporary changes'),60,1015,21,'#6c8070');
    text(snapshot.connected?tr('開啟時資料已同步','Synced when opened'):tr('資料可能過期・尚未同步','Possibly stale · Not synced'),1432,1015,19,'#6c8070');
  }
  select.addEventListener('change',draw);
  dialog.querySelector('.export-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{if(savedUrl)URL.revokeObjectURL(savedUrl);dialog.remove();previous?.focus();},{once:true});
  dialog.querySelector('.export-download').onclick=async function () {
    this.disabled=true; status.textContent='';
    try {
      await document.fonts.ready; draw();
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if(!blob)throw Error('PNG encoding failed');
      const url=URL.createObjectURL(blob), link=document.createElement('a');
      link.href=url;link.download=`availability-${snapshot.days[0].iso}-${select.value}days.png`;
      document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      status.textContent=tr('PNG 已產生；若未自動下載，可長按預覽圖片儲存。','PNG created. If needed, save the preview image.');
      // A real image also provides the native Save Image action on mobile browsers.
      const old=dialog.querySelector('.export-save');old?.remove();
      const image=document.createElement('img');image.className='export-save';image.alt=tr('可儲存的日曆圖片','Saveable calendar image');image.src=savedUrl=URL.createObjectURL(blob);image.style.cssText='display:block;width:100%;border-radius:12px';
      canvas.style.display='none';canvas.after(image);
    } catch(e) { status.textContent=tr('圖片產生失敗，請重試。','Could not create the image. Please retry.'); }
    finally {this.disabled=false;}
  };
  draw(); dialog.showModal();
  document.fonts.ready.then(()=>{if(dialog.isConnected)draw();});
};
