// ============================================================
// WORKOUT PAGE — week view + history navigation + previous-session reference
// ============================================================

let viewDate=null; // null means today

function getViewDate(){return viewDate||todayStr();}
function isViewingToday(){return getViewDate()===todayStr();}
function isViewingFuture(){return getViewDate()>todayStr();}

function setViewDate(d){
  viewDate=(d===todayStr())?null:d;
  renderWorkout();
}

function renderWorkout(){
  const date=getViewDate();
  const session=getSessionTypeForDate(date);
  const el=document.getElementById('page-workout');
  const isToday=isViewingToday();
  const isFuture=isViewingFuture();
  const dateObj=new Date(date+'T12:00:00');
  const dateLabel=dateObj.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'});

  let html=renderWeekStrip();
  html+=`<div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 14px;">
    <div>
      <div style="font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:1px;font-weight:700;">${isToday?'Today':isFuture?'Upcoming':'Past'}</div>
      <div style="font-family:'Archivo Black',sans-serif;font-size:18px;letter-spacing:-.3px;">${dateLabel}</div>
    </div>
    ${!isToday?`<button class="btn btn-ghost btn-sm" onclick="setViewDate(todayStr())">← Today</button>`:''}
  </div>`;

  if(!session){
    html+=`<div class="rest-hero">
      <div class="rest-emoji">😴</div>
      <div class="rest-title">Rest Day</div>
      <div class="rest-sub">${isToday?'Recovery is where the gains happen.<br>Walk, swim, sleep well.':'Rest day.'}</div>
    </div>`;
    el.innerHTML=html;
    return;
  }

  const w=WORKOUTS[session];
  const dayLog=getExLogForDate(date);
  const done=w.exercises.filter(e=>dayLog[e.id]?.done).length;
  const pct=Math.round((done/w.exercises.length)*100);
  const prev=getPreviousSessionData(date,session);

  html+=`<div class="pg-title">${w.name}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:14px;">${w.muscles}</div>`;

  if(isToday && !isFuture){
    html+=`<button class="btn btn-lime btn-full" style="margin-bottom:14px;font-size:17px;padding:16px;" onclick="startGuidedWorkout()">🚀 START WORKOUT</button>`;
  }

  if(isFuture){
    html+=`<div class="card info" style="margin-bottom:10px;text-align:center;font-size:13px;color:var(--text2);padding:14px;">View only — log this on ${dateObj.toLocaleDateString('en-GB',{weekday:'long'})}.</div>`;
  }

  html+=`<div class="pb-wrap">
      <div class="pb-head"><span class="pb-lbl">Session Progress</span><span class="pb-pct">${pct}%</span></div>
      <div class="pb"><div class="pb-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="sec-label">Exercises (tap to view/edit)</div>
    <div id="exList">${w.exercises.map(ex=>buildExItem(ex,dayLog,prev,isFuture)).join('')}</div>`;

  el.innerHTML=html;
}

function renderWeekStrip(){
  const todayD=new Date();
  const days=[];
  // Current week Monday-Sunday based on today
  const todayDow=todayD.getDay(); // 0=Sun
  const monOffset=todayDow===0?-6:1-todayDow;
  const monday=new Date(todayD);
  monday.setDate(todayD.getDate()+monOffset);
  for(let i=0;i<7;i++){
    const d=new Date(monday);d.setDate(monday.getDate()+i);
    days.push(d);
  }

  const initials=['M','T','W','T','F','S','S'];
  const viewing=getViewDate();
  const today=todayStr();

  let html='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:6px;">';
  days.forEach((d,i)=>{
    const key=_ukDate(d);
    const session=getSessionTypeForDate(key);
    const isPast=key<today;
    const isToday=key===today;
    const isViewing=key===viewing;
    const completed=wasSessionCompleted(key);

    let bg='var(--s2)',color='var(--text2)',border='1px solid var(--border)';
    if(isViewing){border='1px solid var(--lime)';}
    if(isToday){bg='rgba(200,255,0,.15)';color='var(--lime)';}
    else if(isPast&&session&&completed){bg='rgba(0,232,122,.12)';color='var(--green)';}
    else if(isPast&&session&&!completed){bg='rgba(255,59,59,.08)';color='var(--red)';}
    else if(!isPast&&!isToday){color='var(--text3)';}

    const badge=session?session==='upper'?'U':'L':'·';
    html+=`<button onclick="setViewDate('${key}')" style="background:${bg};border:${border};border-radius:10px;padding:6px 0;color:${color};cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;font-family:'Archivo',sans-serif;">
      <div style="font-size:10px;font-weight:700;letter-spacing:.5px;">${initials[i]}</div>
      <div style="font-family:'Archivo Black',sans-serif;font-size:13px;line-height:1;">${badge}</div>
      <div style="font-size:9px;font-weight:600;opacity:.7;">${d.getDate()}</div>
    </button>`;
  });
  html+='</div>';
  return html;
}

function buildExItem(ex,dayLog,prevSession,readonly){
  const data=dayLog[ex.id]||{};
  const done=!!data.done;
  const timed=isTimeBased(ex);
  const sets=data.sets||Array(ex.sets).fill(null).map(()=>timed?{seconds:''}:{kg:'',reps:''});
  const best=getBestLift(ex.id);
  const bestStr=best?(timed?`PB: ${fmtSec(best.seconds)}`:`PB: ${best.kg}kg`):'';
  const bestDetail=best?(timed?`🏆 Personal Best: ${fmtSec(best.seconds)} on ${fmtDate(best.date)}`:`🏆 Personal Best: ${best.kg}kg on ${fmtDate(best.date)}`):'';

  // Previous session sets for this exercise
  let prevLine='';
  if(prevSession){
    const prevEx=prevSession.log[ex.id];
    if(prevEx?.sets?.length){
      const summary=timed
        ?prevEx.sets.filter(s=>s.seconds).map(s=>fmtSec(s.seconds)).join(', ')
        :prevEx.sets.filter(s=>s.kg||s.reps).map(s=>`${s.kg||'-'}kg × ${s.reps||'-'}`).join(', ');
      if(summary){
        prevLine=`<div style="font-size:11px;color:var(--blue);background:rgba(61,155,255,.08);border-radius:6px;padding:6px 9px;margin-bottom:8px;">↺ Last: ${summary}</div>`;
      }
    }
  }

  return `
  <div class="ex-item${done?' done':''}" id="exi-${ex.id}">
    <div class="ex-hdr" onclick="toggleExpand('${ex.id}')">
      <div class="ex-chk" onclick="event.stopPropagation();${readonly?'':`toggleExDone('${ex.id}')`}">
        ${done?'<svg width="12" height="12" fill="none" stroke="#000" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>':''}
      </div>
      <div class="ex-info">
        <div class="ex-name">${ex.name}</div>
        <div class="ex-meta">${ex.sets} sets × ${ex.reps} · Rest ${ex.rest}s${bestStr?' · '+bestStr:''}</div>
      </div>
      <div class="ex-tag">${ex.muscle}</div>
    </div>
    <div class="ex-body" id="exb-${ex.id}">
      ${prevLine}
      <div class="ex-gif" id="exgif-${ex.id}">
        <div class="ex-gif-placeholder">
          <div style="font-size:24px;margin-bottom:6px;">🎥</div>
          <div style="margin-bottom:8px;">${ex.name}</div>
          <a href="${ex.yt}" target="_blank" style="color:var(--blue);font-size:11px;text-decoration:none;">Watch form video →</a>
        </div>
      </div>
      ${timed?`
      <div style="display:grid;grid-template-columns:28px 1fr 28px;gap:5px;margin-bottom:5px;">
        <div class="set-col-hdr">SET</div><div class="set-col-hdr">SECONDS</div><div></div>
      </div>
      <div id="sets-${ex.id}">
        ${sets.map((s,i)=>buildSetRowTimed(ex.id,i,s.seconds,readonly)).join('')}
      </div>`:`
      <div style="display:grid;grid-template-columns:28px 1fr 1fr 28px;gap:5px;margin-bottom:5px;">
        <div class="set-col-hdr">SET</div><div class="set-col-hdr">KG</div><div class="set-col-hdr">REPS</div><div></div>
      </div>
      <div id="sets-${ex.id}">
        ${sets.map((s,i)=>buildSetRow(ex.id,i,s.kg,s.reps,readonly)).join('')}
      </div>`}
      ${readonly?'':`<button class="add-set" onclick="addSet('${ex.id}')">+ Add Set</button>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="saveSets('${ex.id}')">Save Sets</button>
      </div>`}
      ${best?`<div class="pb-best">${bestDetail}</div>`:''}
    </div>
  </div>`;
}

function buildSetRow(exId,idx,kg,reps,readonly){
  const dis=readonly?'disabled':'';
  return `<div class="set-grid" id="srow-${exId}-${idx}">
    <div class="set-num">${idx+1}</div>
    <input class="set-inp" id="kg-${exId}-${idx}" value="${kg}" placeholder="kg" type="number" step="0.5" inputmode="decimal" ${dis}>
    <input class="set-inp" id="reps-${exId}-${idx}" value="${reps}" placeholder="reps" type="number" inputmode="numeric" ${dis}>
    ${readonly?'<div></div>':`<button class="set-del" onclick="delSet('${exId}',${idx})">×</button>`}
  </div>`;
}

function buildSetRowTimed(exId,idx,seconds,readonly){
  const dis=readonly?'disabled':'';
  return `<div class="set-grid set-grid-timed" id="srow-${exId}-${idx}">
    <div class="set-num">${idx+1}</div>
    <input class="set-inp" id="sec-${exId}-${idx}" value="${seconds||''}" placeholder="sec" type="number" inputmode="numeric" ${dis}>
    ${readonly?'<div></div>':`<button class="set-del" onclick="delSet('${exId}',${idx})">×</button>`}
  </div>`;
}

function toggleExpand(exId){
  const item=document.getElementById('exi-'+exId);
  if(item)item.classList.toggle('expanded');
}

function toggleExDone(exId){
  if(isViewingFuture())return;
  const date=getViewDate();
  const session=getSessionTypeForDate(date); if(!session)return;
  const w=WORKOUTS[session];
  const ex=w.exercises.find(e=>e.id===exId); if(!ex)return;
  const dayLog=getExLogForDate(date);
  if(!dayLog[exId])dayLog[exId]={done:false,sets:Array(ex.sets).fill(null).map(()=>isTimeBased(ex)?{seconds:''}:{kg:'',reps:''})};
  dayLog[exId].done=!dayLog[exId].done;
  saveExLogForDate(date,dayLog);
  renderWorkout();
  if(isViewingToday())renderToday();
}

function saveSets(exId){
  if(isViewingFuture())return;
  const date=getViewDate();
  const allEx=[...WORKOUTS.upper.exercises,...WORKOUTS.lower.exercises];
  const exObj=allEx.find(e=>e.id===exId);
  const timed=exObj&&isTimeBased(exObj);
  const dayLog=getExLogForDate(date);
  if(!dayLog[exId])dayLog[exId]={done:true,sets:[]};
  const rows=document.querySelectorAll(`[id^="srow-${exId}-"]`);
  const sets=[];
  if(timed){
    rows.forEach((_,i)=>{
      const sec=document.getElementById(`sec-${exId}-${i}`)?.value||'';
      sets.push({seconds:parseInt(sec)||''});
    });
  }else{
    rows.forEach((_,i)=>{
      const kg=document.getElementById(`kg-${exId}-${i}`)?.value||'';
      const reps=document.getElementById(`reps-${exId}-${i}`)?.value||'';
      sets.push({kg:parseFloat(kg)||'',reps:parseInt(reps)||''});
    });
  }
  dayLog[exId].sets=sets;
  saveExLogForDate(date,dayLog);
  showToast('Sets saved ✓');
  renderWorkout();
}

function addSet(exId){
  const cont=document.getElementById('sets-'+exId);
  const count=cont.querySelectorAll('.set-grid').length;
  const allEx=[...WORKOUTS.upper.exercises,...WORKOUTS.lower.exercises];
  const exObj=allEx.find(e=>e.id===exId);
  if(exObj&&isTimeBased(exObj)){
    cont.insertAdjacentHTML('beforeend',buildSetRowTimed(exId,count,''));
  }else{
    cont.insertAdjacentHTML('beforeend',buildSetRow(exId,count,'',''));
  }
}

function delSet(exId,idx){
  const row=document.getElementById(`srow-${exId}-${idx}`);
  if(row)row.remove();
  const cont=document.getElementById('sets-'+exId);
  const allEx=[...WORKOUTS.upper.exercises,...WORKOUTS.lower.exercises];
  const exObj=allEx.find(e=>e.id===exId);
  const timed=exObj&&isTimeBased(exObj);
  cont.querySelectorAll('.set-grid').forEach((r,i)=>{
    r.id=`srow-${exId}-${i}`;
    r.querySelector('.set-num').textContent=i+1;
    if(timed){
      const sec=r.querySelector('.set-inp');
      if(sec)sec.id=`sec-${exId}-${i}`;
    }else{
      const kg=r.querySelectorAll('.set-inp')[0];
      const rp=r.querySelectorAll('.set-inp')[1];
      if(kg)kg.id=`kg-${exId}-${i}`;
      if(rp)rp.id=`reps-${exId}-${i}`;
    }
    const dl=r.querySelector('.set-del');
    if(dl)dl.setAttribute('onclick',`delSet('${exId}',${i})`);
  });
}

function finishSession(){
  showToast('🔥 Session complete! Great work!');
  renderToday();
}

// ============================================================
// GUIDED WORKOUT MODE
// ============================================================
let wm = { active:false, exIdx:0, setIdx:0, mode:'outline', restTarget:0, restStarted:0, restInterval:null };

function startGuidedWorkout(){
  const session=getTodaySession(); if(!session)return showToast('Rest day — no workout');
  wm = { active:true, exIdx:0, setIdx:0, mode:'outline', session, restTarget:0, restStarted:0, restInterval:null };
  document.getElementById('workoutMode').classList.add('open');
  renderWmOutline();
}

function exitGuidedWorkout(){
  if(wm.restInterval)clearInterval(wm.restInterval);
  if(wmTimer.interval)clearInterval(wmTimer.interval);
  wmTimer={running:false,startedAt:0,interval:null,elapsed:0};
  wm.active=false;
  document.getElementById('workoutMode').classList.remove('open');
  renderWorkout();
  renderToday();
}

function suggestWeight(exId, prevSession, setIdx){
  const exObj=[...WORKOUTS.upper.exercises,...WORKOUTS.lower.exercises].find(e=>e.id===exId);
  if(!exObj)return null;
  const timed=isTimeBased(exObj);

  if(timed){
    return suggestTime(exId,exObj,prevSession,setIdx);
  }

  if(!prevSession||!prevSession.log[exId])return null;
  const repMatch=String(exObj.reps).match(/(\d+)[–-](\d+)/);
  const lowerRep=repMatch?parseInt(repMatch[1]):null;
  const upperRep=repMatch?parseInt(repMatch[2]):null;
  const sets=(prevSession.log[exId].sets||[]).filter(s=>s.kg&&s.reps);
  if(!sets.length)return null;
  const refSet = (typeof setIdx==='number' && sets[setIdx]) ? sets[setIdx] : sets[0];
  const lastKg=parseFloat(refSet.kg);
  const lastReps=parseInt(refSet.reps);
  const efforts=sets.map(s=>s.effort).filter(e=>e);
  const hasEffort=efforts.length>0;
  const prevSummary = sets.map(s=>`${s.kg}×${s.reps}`).join(', ');

  if(!upperRep){
    return { kg:lastKg, reps:lastReps, reason:`Last: ${prevSummary}`, dir:null };
  }

  const allHitUpper=sets.every(s=>parseInt(s.reps)>=upperRep);
  const firstFailed=parseInt(sets[0].reps)<(lowerRep||0);

  if(hasEffort){
    const allEasy=efforts.every(e=>e==='easy');
    const mostlySolid=efforts.filter(e=>e==='solid').length>=efforts.length/2;
    const anyTough=efforts.some(e=>e==='tough');
    if(allEasy&&allHitUpper) return { kg:lastKg+5, reps:lowerRep, reason:`+5kg ↑ (last: ${prevSummary}, felt easy)`, dir:'up' };
    if(mostlySolid&&allHitUpper) return { kg:lastKg+2.5, reps:lowerRep, reason:`+2.5kg ↑ (last: ${prevSummary}, solid)`, dir:'up' };
    if(anyTough&&!allHitUpper) return { kg:lastKg, reps:lastReps, reason:`Hold weight (last: ${prevSummary}, was tough)`, dir:null };
  }

  if(allHitUpper) return { kg:lastKg+2.5, reps:lowerRep, reason:`+2.5kg ↑ (last: ${prevSummary})`, dir:'up' };
  if(firstFailed) return { kg:Math.max(0,lastKg-2.5), reps:upperRep, reason:`-2.5kg ↓ (last: ${prevSummary}, struggled)`, dir:'down' };
  const targetReps = Math.min(upperRep, lastReps+1);
  return { kg:lastKg, reps:targetReps, reason:`Same weight, target ${targetReps} reps (last: ${prevSummary})`, dir:null };
}

function suggestTime(exId,exObj,prevSession,setIdx){
  // Parse prescribed range from reps string like "30–45s"
  const rm=String(exObj.reps).match(/(\d+)[–-](\d+)/);
  const lower=rm?parseInt(rm[1]):30;
  const upper=rm?parseInt(rm[2]):45;

  if(!prevSession||!prevSession.log[exId])return{seconds:lower,reason:`Try ${fmtSec(lower)} — first time`,dir:null,timed:true};
  const sets=(prevSession.log[exId].sets||[]).filter(s=>s.seconds);
  if(!sets.length)return{seconds:lower,reason:`Try ${fmtSec(lower)} — first time`,dir:null,timed:true};
  const refSet=(typeof setIdx==='number'&&sets[setIdx])?sets[setIdx]:sets[0];
  const lastSec=parseInt(refSet.seconds);
  const prevSummary=sets.map(s=>fmtSec(s.seconds)).join(', ');
  const effort=prevSession.log[exId].effort||sets[sets.length-1]?.effort;
  const allHitPrescribed=sets.every(s=>parseInt(s.seconds)>=upper);

  if(allHitPrescribed&&(effort==='easy'||effort==='maybe')){
    return{seconds:lastSec+5,reason:`Try ${fmtSec(lastSec+5)} — beat last week's ${fmtSec(lastSec)}`,dir:'up',timed:true};
  }
  if(allHitPrescribed&&effort==='hard'){
    return{seconds:lastSec,reason:`Hold ${fmtSec(lastSec)} — match last week`,dir:null,timed:true};
  }
  if(!allHitPrescribed){
    return{seconds:lastSec,reason:`Hold ${fmtSec(lastSec)} — match last week (last: ${prevSummary})`,dir:null,timed:true};
  }
  // Default: progress
  return{seconds:lastSec+5,reason:`Try ${fmtSec(lastSec+5)} — beat last week's ${fmtSec(lastSec)}`,dir:'up',timed:true};
}

function renderWmOutline(){
  const w=WORKOUTS[wm.session];
  const date=todayStr();
  const prev=getPreviousSessionData(date,wm.session);
  const html=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div class="wm-title">${w.name}</div>
    <div class="wm-sub">${w.muscles} · ${w.exercises.length} exercises · ~${w.duration} mins</div>
    <div class="wm-h">Today's Plan</div>
    <div style="margin-bottom:24px;">
      ${w.exercises.map((ex,i)=>{
        const sug=suggestWeight(ex.id,prev);
        const timed=isTimeBased(ex);
        const arrow=sug?.dir==='up'?'<span class="wm-arrow-up">↑</span>':sug?.dir==='down'?'<span class="wm-arrow-down">↓</span>':'';
        const wt=sug?(timed?`@ ${fmtSec(sug.seconds)} ${arrow}`:`@ ${sug.kg}kg ${arrow}`):'';
        return `<div class="wm-ex-row"><div><div style="font-size:10px;color:var(--text3);font-weight:700;">${i+1}.</div><div class="wm-ex-name">${ex.name}</div></div><div class="wm-ex-spec">${ex.sets}×${ex.reps}<br>${wt}</div></div>`;
      }).join('')}
    </div>
    <button class="wm-cta" onclick="wmStartFirstSet()">START WORKOUT →</button>
  `;
  document.getElementById('wmContent').innerHTML=html;
}

function wmStartFirstSet(){
  wm.exIdx=0; wm.setIdx=0; wm.mode='set';
  renderWmSet();
}

function renderWmSet(){
  const w=WORKOUTS[wm.session];
  const ex=w.exercises[wm.exIdx];
  const timed=isTimeBased(ex);
  if(timed){renderWmSetTimed();return;}
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const prev=getPreviousSessionData(date,wm.session);
  const sug=suggestWeight(ex.id,prev,wm.setIdx);
  const existingSet=dayLog[ex.id]?.sets?.[wm.setIdx];
  const startKg=existingSet?.kg||sug?.kg||'';
  const repMatch=String(ex.reps).match(/(\d+)[–-](\d+)/);
  const targetReps=existingSet?.reps||sug?.reps||(repMatch?parseInt(repMatch[2]):8);
  const html=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:32px;">Exercise ${wm.exIdx+1} of ${w.exercises.length}</div>
    <div class="wm-title" style="margin-top:6px;">${ex.name}</div>
    <div class="wm-sub">Set ${wm.setIdx+1} of ${ex.sets} · Target ${ex.reps} reps</div>
    <a href="${ex.yt}" target="_blank" style="color:var(--blue);font-size:12px;text-decoration:none;display:block;margin-bottom:24px;">🎥 Watch ${ex.name} form →</a>
    <div class="wm-h">Weight</div>
    <div class="wm-stepper">
      <button class="wm-step-btn" onclick="wmStepKg(-2.5)">−</button>
      <input id="wm-kg" type="number" step="0.5" inputmode="decimal" value="${startKg}">
      <button class="wm-step-btn" onclick="wmStepKg(2.5)">+</button>
    </div>
    ${sug?`<div class="wm-progress-hint">${sug.reason}</div>`:''}
    <div class="wm-h" style="margin-top:24px;">Reps</div>
    <div class="wm-stepper">
      <button class="wm-step-btn" onclick="wmStepReps(-1)">−</button>
      <input id="wm-reps" type="number" inputmode="numeric" value="${targetReps}">
      <button class="wm-step-btn" onclick="wmStepReps(1)">+</button>
    </div>
    <button class="wm-cta" onclick="wmMarkSetDone(${ex.rest})">SET DONE</button>
  `;
  document.getElementById('wmContent').innerHTML=html;
}

// Timer state for time-based exercises
let wmTimer={running:false,startedAt:0,interval:null,elapsed:0};

function renderWmSetTimed(){
  const w=WORKOUTS[wm.session];
  const ex=w.exercises[wm.exIdx];
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const prev=getPreviousSessionData(date,wm.session);
  const sug=suggestWeight(ex.id,prev,wm.setIdx);
  const existingSet=dayLog[ex.id]?.sets?.[wm.setIdx];
  const alreadyDone=existingSet?.done&&existingSet?.seconds;

  // Build set indicators
  const totalSets=dayLog[ex.id]?.sets?.length||ex.sets;
  let setsHtml='';
  for(let i=0;i<Math.max(totalSets,wm.setIdx+1);i++){
    const s=dayLog[ex.id]?.sets?.[i];
    const isCurrent=i===wm.setIdx;
    const isDone=s?.done&&s?.seconds;
    setsHtml+=`<div class="wm-timer-set${isCurrent?' current':''}${isDone?' completed':''}" ${isDone&&!isCurrent?`onclick="wmRedoTimedSet(${i})"`:''}>
      <span class="wm-timer-set-label">SET ${i+1}</span>
      <span class="wm-timer-set-val">${isDone?fmtSec(s.seconds):'0:00'}</span>
    </div>`;
  }

  const html=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:32px;">Exercise ${wm.exIdx+1} of ${w.exercises.length}</div>
    <div class="wm-title" style="margin-top:6px;">${ex.name}</div>
    <div class="wm-sub">Set ${wm.setIdx+1} of ${ex.sets} · Target ${ex.reps}</div>
    <a href="${ex.yt}" target="_blank" style="color:var(--blue);font-size:12px;text-decoration:none;display:block;margin-bottom:24px;">🎥 Watch ${ex.name} form →</a>
    ${sug?`<div class="wm-progress-hint">${sug.reason}</div>`:''}
    <div style="text-align:center;padding:40px 0;">
      <div id="wm-hold-timer" class="wm-hold-timer">${alreadyDone?fmtSec(existingSet.seconds):'0:00'}</div>
    </div>
    <div id="wm-timer-sets" style="margin-bottom:16px;">${setsHtml}</div>
    <button id="wm-timer-btn" class="wm-timer-start" onclick="wmToggleTimer(${ex.rest})">${alreadyDone?'REDO':'START'}</button>
  `;
  document.getElementById('wmContent').innerHTML=html;
  wmTimer={running:false,startedAt:0,interval:null,elapsed:0};
}

function wmToggleTimer(restSec){
  if(wmTimer.running){
    // STOP
    clearInterval(wmTimer.interval);
    wmTimer.running=false;
    const seconds=Math.floor((Date.now()-wmTimer.startedAt)/1000);
    wmTimer.elapsed=seconds;
    const display=document.getElementById('wm-hold-timer');
    if(display){display.textContent=fmtSec(seconds);display.classList.remove('active');display.classList.add('done');}
    const btn=document.getElementById('wm-timer-btn');
    if(btn){btn.textContent='SET DONE';btn.className='wm-timer-start done';btn.onclick=()=>wmTimedSetDone(restSec);}
  }else{
    // START
    wmTimer.startedAt=Date.now();
    wmTimer.running=true;
    const display=document.getElementById('wm-hold-timer');
    if(display){display.classList.add('active');display.classList.remove('done');}
    const btn=document.getElementById('wm-timer-btn');
    if(btn){btn.textContent='STOP';btn.className='wm-timer-start stop';}
    wmTimer.interval=setInterval(()=>{
      const elapsed=Math.floor((Date.now()-wmTimer.startedAt)/1000);
      const d=document.getElementById('wm-hold-timer');
      if(d)d.textContent=fmtSec(elapsed);
    },100);
  }
}

function wmTimedSetDone(restSec){
  const w=WORKOUTS[wm.session];
  const ex=w.exercises[wm.exIdx];
  const seconds=wmTimer.elapsed;
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  if(!dayLog[ex.id])dayLog[ex.id]={done:false,sets:[]};
  while(dayLog[ex.id].sets.length<=wm.setIdx)dayLog[ex.id].sets.push({seconds:0,done:false});
  dayLog[ex.id].sets[wm.setIdx]={seconds,done:true,doneAt:Date.now()};
  if(dayLog[ex.id].sets.filter(s=>s.done).length>=ex.sets)dayLog[ex.id].done=true;
  saveExLogForDate(date,dayLog);

  const isLastSet=wm.setIdx>=ex.sets-1;
  if(isLastSet){
    wm.mode='effort';
    renderWmTimedEffort();
  }else{
    wm.restTarget=restSec;
    wm.mode='rest';
    wm.restStarted=Date.now();
    renderWmRest();
  }
}

function wmRedoTimedSet(idx){
  wm.setIdx=idx;
  renderWmSetTimed();
}

function renderWmTimedEffort(){
  const w=WORKOUTS[wm.session];
  const ex=w.exercises[wm.exIdx];
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const sets=dayLog[ex.id]?.sets||[];
  const lastSec=sets[sets.length-1]?.seconds||0;
  const html=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:32px;">All sets done</div>
    <div class="wm-title" style="font-size:22px;margin-top:6px;">${ex.name} — ${fmtSec(lastSec)}</div>
    <div class="wm-sub" style="margin-bottom:24px;">Could you have held longer?</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px;">
      <button class="wm-time-effort-btn" onclick="wmRecordTimedEffort('easy')">YES</button>
      <button class="wm-time-effort-btn" onclick="wmRecordTimedEffort('hard')">NO</button>
      <button class="wm-time-effort-btn" onclick="wmRecordTimedEffort('maybe')">MAYBE +5s</button>
    </div>
    <button class="wm-cta ghost" onclick="wmRecordTimedEffort(null)">Skip rating</button>
  `;
  document.getElementById('wmContent').innerHTML=html;
}

function wmRecordTimedEffort(effort){
  const w=WORKOUTS[wm.session];
  const ex=w.exercises[wm.exIdx];
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  if(dayLog[ex.id]&&effort){
    dayLog[ex.id].effort=effort;
    // Also store on last set for compatibility
    const sets=dayLog[ex.id].sets||[];
    if(sets.length)sets[sets.length-1].effort=effort;
    saveExLogForDate(date,dayLog);
  }
  wm.mode='exDone';
  renderWmExerciseDone();
}

function wmStepKg(delta){
  const el=document.getElementById('wm-kg');
  const cur=parseFloat(el.value)||0;
  el.value=Math.max(0,Math.round((cur+delta)*2)/2);
}
function wmStepReps(delta){
  const el=document.getElementById('wm-reps');
  const cur=parseInt(el.value)||0;
  el.value=Math.max(0,cur+delta);
}

function wmMarkSetDone(restSec){
  const w=WORKOUTS[wm.session];
  const ex=w.exercises[wm.exIdx];
  const kg=parseFloat(document.getElementById('wm-kg').value)||'';
  const reps=parseInt(document.getElementById('wm-reps').value)||'';
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  if(!dayLog[ex.id])dayLog[ex.id]={done:false,sets:[]};
  while(dayLog[ex.id].sets.length<=wm.setIdx)dayLog[ex.id].sets.push({kg:'',reps:'',done:false});
  dayLog[ex.id].sets[wm.setIdx]={kg,reps,done:true,doneAt:Date.now()};
  if(dayLog[ex.id].sets.filter(s=>s.done).length>=ex.sets)dayLog[ex.id].done=true;
  saveExLogForDate(date,dayLog);
  wm.restTarget=restSec;
  wm.mode='effort';
  renderWmEffort();
}

function renderWmEffort(){
  const w=WORKOUTS[wm.session];
  const ex=w.exercises[wm.exIdx];
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const lastSet=dayLog[ex.id]?.sets?.[wm.setIdx];
  const html=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:32px;">Set ${wm.setIdx+1} done ✓</div>
    <div class="wm-title" style="font-size:22px;margin-top:6px;">${lastSet?.kg||'-'}kg × ${lastSet?.reps||'-'} reps</div>
    <div class="wm-sub">How did that feel?</div>
    <button class="wm-effort-btn" onclick="wmRecordEffort('easy')">
      <div class="em">😌</div>
      <div class="lbl">EASY<div class="desc">Could've done 3+ more reps</div></div>
    </button>
    <button class="wm-effort-btn" onclick="wmRecordEffort('solid')">
      <div class="em">💪</div>
      <div class="lbl">SOLID<div class="desc">1-2 reps left in tank</div></div>
    </button>
    <button class="wm-effort-btn" onclick="wmRecordEffort('tough')">
      <div class="em">🔥</div>
      <div class="lbl">TOUGH<div class="desc">All-out, fought for reps</div></div>
    </button>
    <button class="wm-cta ghost" onclick="wmRecordEffort(null)">Skip rating</button>
  `;
  document.getElementById('wmContent').innerHTML=html;
}

function wmRecordEffort(effort){
  const w=WORKOUTS[wm.session];
  const ex=w.exercises[wm.exIdx];
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  if(dayLog[ex.id]?.sets?.[wm.setIdx]&&effort){
    dayLog[ex.id].sets[wm.setIdx].effort=effort;
    saveExLogForDate(date,dayLog);
  }
  const isLastSet=wm.setIdx>=ex.sets-1;
  if(isLastSet){
    wm.mode='exDone';
    renderWmExerciseDone();
  } else {
    wm.mode='rest';
    wm.restStarted=Date.now();
    renderWmRest();
  }
}

function renderWmRest(){
  const w=WORKOUTS[wm.session];
  const ex=w.exercises[wm.exIdx];
  const timed=isTimeBased(ex);
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const lastSet=dayLog[ex.id]?.sets?.[wm.setIdx];
  const effortEmoji={easy:'😌',solid:'💪',tough:'🔥',hard:'🔥',maybe:'🤔'};
  const setDesc=timed?fmtSec(lastSet?.seconds||0):`${lastSet?.kg||'-'}kg × ${lastSet?.reps||'-'}`;
  const html=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:32px;">Resting</div>
    <div class="wm-sub" style="margin-top:8px;">✓ Set ${wm.setIdx+1}: ${setDesc}${lastSet?.effort?' '+effortEmoji[lastSet.effort]:''}</div>
    <div style="text-align:center;padding:60px 0;">
      <div id="wm-timer" style="font-family:'Archivo Black',sans-serif;font-size:96px;letter-spacing:-4px;color:var(--lime);line-height:1;">${wm.restTarget}s</div>
      <div id="wm-timer-status" style="font-size:14px;color:var(--text2);margin-top:8px;">counting down</div>
    </div>
    <div class="wm-meta">Next: Set ${wm.setIdx+2} of ${ex.sets} · ${ex.name}</div>
    <button id="wm-next-btn" class="wm-cta ghost" onclick="wmStartNextSet()">SKIP REST · START NEXT SET</button>
  `;
  document.getElementById('wmContent').innerHTML=html;
  if(wm.restInterval)clearInterval(wm.restInterval);
  wm.restInterval=setInterval(updateWmRest,200);
  updateWmRest();
}

function updateWmRest(){
  if(!wm.active||wm.mode!=='rest')return;
  const elapsed=(Date.now()-wm.restStarted)/1000;
  const remaining=wm.restTarget-elapsed;
  const t=document.getElementById('wm-timer');
  const s=document.getElementById('wm-timer-status');
  const b=document.getElementById('wm-next-btn');
  if(!t)return;
  if(remaining>0){
    t.textContent=Math.ceil(remaining)+'s';
    t.style.color='var(--lime)';
    s.textContent='counting down';
    if(b){b.textContent='SKIP REST · START NEXT SET';b.classList.add('ghost');b.classList.remove('over');}
  } else {
    const over=Math.floor(-remaining);
    if(t.dataset.transitioned!=='true'){
      t.dataset.transitioned='true';
      if(navigator.vibrate)navigator.vibrate([200,100,200,100,200]);
    }
    t.textContent='+'+over+'s';
    t.style.color='var(--orange)';
    s.textContent='GO! Tap to start next set';
    if(b){b.textContent='START NEXT SET';b.classList.remove('ghost');b.classList.add('over');}
  }
}

function wmStartNextSet(){
  const elapsed=Math.floor((Date.now()-wm.restStarted)/1000);
  const w=WORKOUTS[wm.session];
  const ex=w.exercises[wm.exIdx];
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  if(dayLog[ex.id]?.sets?.[wm.setIdx])dayLog[ex.id].sets[wm.setIdx].restAfter=elapsed;
  saveExLogForDate(date,dayLog);
  if(wm.restInterval){clearInterval(wm.restInterval);wm.restInterval=null;}
  wm.setIdx++;
  wm.mode='set';
  renderWmSet();
}

function renderWmExerciseDone(){
  const w=WORKOUTS[wm.session];
  const ex=w.exercises[wm.exIdx];
  const timed=isTimeBased(ex);
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const sets=dayLog[ex.id]?.sets||[];
  const exEffort=dayLog[ex.id]?.effort;
  const volume=timed?0:sets.reduce((s,x)=>s+(parseFloat(x.kg)||0)*(parseInt(x.reps)||0),0);
  const isLastEx=wm.exIdx>=w.exercises.length-1;
  const effortEmoji={easy:'😌',solid:'💪',tough:'🔥',hard:'🔥',maybe:'🤔'};
  const effortLabel={easy:'easy',hard:'hard',maybe:'maybe +5s'};
  const subText=timed
    ?`${sets.filter(s=>s.done).length} sets${exEffort?' · effort: '+effortLabel[exEffort]:''}`
    :`${sets.filter(s=>s.done).length} sets · ${volume>0?volume.toFixed(0)+'kg total volume':''}`;
  const html=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:32px;">Exercise ${wm.exIdx+1} complete</div>
    <div class="wm-title" style="color:var(--green);margin-top:6px;">✓ ${ex.name}</div>
    <div class="wm-sub">${subText}</div>
    <div class="wm-h" style="margin-top:24px;">Sets</div>
    ${sets.filter(s=>s.done).map((s,i)=>{
      const val=timed?fmtSec(s.seconds):`${s.kg}kg × ${s.reps}`;
      return `<div class="wm-set-summary"><div>Set ${i+1}</div><div>${val}${s.effort?' '+effortEmoji[s.effort]:''}${s.restAfter?` · ${s.restAfter}s rest`:''}</div></div>`;
    }).join('')}
    <button class="wm-cta" style="margin-top:24px;" onclick="wmNextExercise()">${isLastEx?'FINISH WORKOUT 🎉':'NEXT EXERCISE →'}</button>
  `;
  document.getElementById('wmContent').innerHTML=html;
}

function wmNextExercise(){
  const w=WORKOUTS[wm.session];
  if(wm.exIdx>=w.exercises.length-1){wmFinish();return;}
  wm.exIdx++;
  wm.setIdx=0;
  wm.mode='set';
  renderWmSet();
}

function wmFinish(){
  const w=WORKOUTS[wm.session];
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const totalVolume=Object.values(dayLog).reduce((tot,ex)=>tot+(ex.sets||[]).reduce((s,x)=>s+(parseFloat(x.kg)||0)*(parseInt(x.reps)||0),0),0);
  const totalSets=Object.values(dayLog).reduce((tot,ex)=>tot+(ex.sets||[]).filter(s=>s.done).length,0);
  const volStr=totalVolume>0?` · ${totalVolume.toFixed(0)}kg total volume`:'';
  const html=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:60px;text-align:center;">Workout complete</div>
    <div class="wm-title" style="text-align:center;font-size:36px;color:var(--green);margin-top:8px;">✓ ${w.name} DONE</div>
    <div style="text-align:center;font-size:48px;margin:24px 0;">🔥</div>
    <div style="text-align:center;color:var(--text2);font-size:14px;margin-bottom:16px;">${w.exercises.length}/${w.exercises.length} exercises · ${totalSets} sets${volStr}</div>
    <button class="wm-cta" onclick="exitGuidedWorkout()">FINISH</button>
  `;
  document.getElementById('wmContent').innerHTML=html;
  showToast('🔥 Session complete! Great work!');
}
