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
    // Phase 41i: zone-2 cardio card — rest days only, today only
    if(isToday&&typeof renderCardioCard==='function')html+=renderCardioCard(date);
    // Phase 41: mobility section visible on rest days too (today only)
    if(isToday&&typeof renderStretchCards==='function')html+=renderStretchCards();
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
    // Phase 41k: if a workout is minimized for today, show RESUME instead of START
    const saved=(typeof _loadWmState==='function')?_loadWmState():null;
    if(saved&&saved.active){
      const exName=(saved.exIdx!=null&&w.exercises[saved.exIdx])?w.exercises[saved.exIdx].name:'';
      const setInfo=(saved.mode==='set'&&saved.setIdx!=null)?` · Set ${saved.setIdx+1}`:'';
      const modeLabel=({outline:'overview',set:'lifting',rest:'resting',transition:'getting set',effort:'rating effort','timed-effort':'rating effort',exDone:'between exercises'})[saved.mode]||'';
      html+=`<button class="btn btn-lime btn-full" style="margin-bottom:6px;font-size:17px;padding:16px;" onclick="resumeGuidedWorkout()">▶ RESUME${exName?` · ${exName}${setInfo}`:''}</button>
        <div style="text-align:center;margin-bottom:14px;"><span style="font-size:10px;color:var(--text3);">in progress · ${modeLabel}</span> · <span onclick="discardGuidedWorkout()" style="font-size:10px;color:var(--text3);text-decoration:underline;cursor:pointer;">discard</span></div>`;
    } else {
      html+=`<button class="btn btn-lime btn-full" style="margin-bottom:14px;font-size:17px;padding:16px;" onclick="startGuidedWorkout()">🚀 START WORKOUT</button>`;
    }
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

  // Phase 41: mobility section under the exercise list (today only)
  if(isToday&&typeof renderStretchCards==='function')html+=renderStretchCards();

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

    const badge=session?({upper:'U',lower:'L',full:'F',home:'H'}[session]||'•'):'·';
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
  const allEx=getAllExercises();
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
  const allEx=getAllExercises();
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
  const allEx=getAllExercises();
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
let wm = { active:false, exIdx:0, setIdx:0, mode:'outline', restTarget:0, restStarted:0, restInterval:null, setStartedAt:0 };

// Phase 41k: 5s auto-save tick — covers OS-kill / refresh / background-eviction cases
let _wmAutoSaveInterval=null;
function _wmStartAutoSave(){
  if(_wmAutoSaveInterval)return;
  _wmAutoSaveInterval=setInterval(()=>{
    if(wm&&wm.active)_saveWmState();
    else _wmStopAutoSave();
  },5000);
}
function _wmStopAutoSave(){
  if(_wmAutoSaveInterval){clearInterval(_wmAutoSaveInterval);_wmAutoSaveInterval=null;}
}

function startGuidedWorkout(){
  // Phase 41k: if there's already a minimized in-progress session for today, resume it
  const saved=(typeof _loadWmState==='function')?_loadWmState():null;
  if(saved&&saved.active){resumeGuidedWorkout();return;}
  const session=getTodaySession(); if(!session)return showToast('Rest day — no workout');
  wm = { active:true, exIdx:0, setIdx:0, mode:'outline', session, restTarget:0, restStarted:0, restInterval:null, setStartedAt:0 };
  _saveWmState();
  _wmStartAutoSave();
  document.getElementById('workoutMode').classList.add('open');
  _renderWmEntry();
}

// Phase 44: entry router. Order matters — the feel tap comes BEFORE any
// prescription or recovery warning so the answer isn't anchored, then the
// advisory gate choice (if it fires), then the outline.
function _renderWmEntry(){
  const today=todayStr();
  if(typeof getSessionFeel==='function'&&!getSessionFeel(today)){
    wm.mode='feel';_saveWmState();renderWmFeel();return;
  }
  const gate=checkRecoveryGate();
  const ov=(typeof getRecoveryOverride==='function')?getRecoveryOverride(today):null;
  if(gate.lowRecovery&&!(ov&&ov.choice)){
    wm.mode='gate';_saveWmState();renderWmGateChoice(gate);return;
  }
  wm.mode='outline';_saveWmState();renderWmOutline();
}

function renderWmFeel(){
  const btn=(feel,emoji,label,sub)=>`
    <button onclick="wmSetFeel('${feel}')" style="display:block;width:100%;padding:18px 16px;margin-bottom:10px;background:transparent;border:1px solid var(--border);border-radius:14px;cursor:pointer;text-align:left;">
      <div style="font-size:16px;font-weight:700;color:var(--text);">${emoji} ${label}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:3px;">${sub}</div>
    </button>`;
  document.getElementById('wmContent').innerHTML=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div class="wm-title" style="margin-top:70px;">How do you feel?</div>
    <div class="wm-sub" style="margin-bottom:24px;">One tap, before you see today's numbers — it keeps the answer honest.</div>
    ${btn('strong','💪','Strong','Ready to push')}
    ${btn('ok','👍','OK','Normal day')}
    ${btn('tired','😴','Tired','Low energy / rough night')}
  `;
}
function wmSetFeel(feel){
  if(typeof setSessionFeel==='function')setSessionFeel(feel);
  _renderWmEntry();
}

function renderWmGateChoice(gate){
  gate=gate||checkRecoveryGate();
  const feel=(typeof getSessionFeel==='function')?getSessionFeel(todayStr()):null;
  const feelLabel={strong:'💪 Strong',ok:'👍 OK',tired:'😴 Tired'}[feel]||'—';
  document.getElementById('wmContent').innerHTML=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:#ffc107;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:70px;">Recovery flag</div>
    <div class="wm-title" style="margin-top:6px;">Oura says recover<br>(${gate.reason})</div>
    <div class="wm-sub" style="margin-bottom:8px;">You said you feel: <strong style="color:var(--text);">${feelLabel}</strong></div>
    <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:22px;">This is advisory, not an order — readiness scores can under-read shifted sleep schedules. Your call. Either way, the choice is logged so the weekly report can learn what readiness actually predicts for you.</div>
    <button onclick="wmGateChoice('train')" style="display:block;width:100%;padding:16px;margin-bottom:10px;background:rgba(200,255,0,.1);border:1px solid var(--lime);border-radius:14px;cursor:pointer;text-align:left;">
      <div style="font-size:15px;font-weight:700;color:var(--lime);">💪 Train as planned</div>
      <div style="font-size:11px;color:var(--text3);margin-top:3px;">Normal progression prescriptions</div>
    </button>
    <button onclick="wmGateChoice('easy')" style="display:block;width:100%;padding:16px;background:transparent;border:1px solid var(--border);border-radius:14px;cursor:pointer;text-align:left;">
      <div style="font-size:15px;font-weight:700;color:var(--text);">🌙 Take it easy</div>
      <div style="font-size:11px;color:var(--text3);margin-top:3px;">Hold all weights — form and completion, not PRs</div>
    </button>
  `;
}
function wmGateChoice(choice){
  const gate=checkRecoveryGate();
  if(typeof saveRecoveryOverride==='function'){
    saveRecoveryOverride({
      readiness:gate.readiness!=null?gate.readiness:null,
      hrvDown3d:!!gate.hrvDown3d,
      feel:(typeof getSessionFeel==='function')?getSessionFeel(todayStr()):null,
      choice,
      sessionType:wm.session,
    });
  }
  wm.mode='outline';_saveWmState();renderWmOutline();
}

// Phase 41k: ✕ now MINIMIZES the workout — preserves in-progress state for resume.
// True session finish (with reflection + state clear) is finishGuidedWorkout().
// Phase 47b: true if you've logged at least one real set this session today.
function _wmHasLoggedWork(){
  try{
    const dayLog=getExLogForDate(todayStr());
    return Object.entries(dayLog).some(([k,ex])=>k!=='_session'&&ex&&Array.isArray(ex.sets)&&ex.sets.some(s=>s.done&&(s.kg||s.reps||s.seconds)));
  }catch{return false;}
}

function exitGuidedWorkout(){
  // Phase 47b: smart close — if you actually trained this session and haven't seen
  // the recap yet, show the "✓ DONE" recap instead of closing silently. The report
  // used to be gated behind tapping through the very last exercise (Dead Bug on
  // lower day), so finishing your real lifts and closing meant no recap + no
  // low-down. Now any close after real work surfaces the report; the recap screen's
  // own ✕ then closes cleanly (recapShown guards against a re-trigger loop).
  if(wm.active&&!wm.recapShown&&typeof wmFinish==='function'&&_wmHasLoggedWork()){
    if(wm.restInterval)clearInterval(wm.restInterval);
    if(wm.transitionInterval)clearInterval(wm.transitionInterval);
    if(wmTimer.interval)clearInterval(wmTimer.interval);
    wmTimer={running:false,startedAt:0,interval:null,elapsed:0};
    _saveWmState();
    wmFinish();
    return;
  }
  if(wm.restInterval)clearInterval(wm.restInterval);
  if(wm.transitionInterval)clearInterval(wm.transitionInterval);
  if(wmTimer.interval)clearInterval(wmTimer.interval);
  wmTimer={running:false,startedAt:0,interval:null,elapsed:0};
  _saveWmState();
  _wmStopAutoSave();
  document.getElementById('workoutMode').classList.remove('open');
  renderWorkout();
  renderToday();
}

// Phase 41k: true session finish — fires reflection, clears persisted state.
// Called from the FINISH button on the workout-complete screen.
function finishGuidedWorkout(){
  if(wm.restInterval)clearInterval(wm.restInterval);
  if(wm.transitionInterval)clearInterval(wm.transitionInterval);
  if(wmTimer.interval)clearInterval(wmTimer.interval);
  wmTimer={running:false,startedAt:0,interval:null,elapsed:0};

  // Phase 33: fire post-session reflection if user actually completed work
  const sessionType = wm.session;
  const today = todayStr();
  const completedSession = (STATE.exLog || {})[today] || {};
  const hasWork = Object.values(completedSession).some(ex =>
    Array.isArray(ex?.sets) && ex.sets.some(s => s.kg || s.reps || s.seconds)
  );
  const alreadyReflected = STATE.sessionReflections && STATE.sessionReflections[`${today}_${sessionType}`];
  if (hasWork && !alreadyReflected && typeof requestSessionReflection === 'function') {
    requestSessionReflection(sessionType, completedSession);
    if(!STATE.sessionReflections) STATE.sessionReflections = {};
    STATE.sessionReflections[`${today}_${sessionType}`] = true;
    updateLocalCache();
  }

  wm.active=false;
  _wmStopAutoSave();
  try{localStorage.removeItem('forge_active_workout');}catch{}
  document.getElementById('workoutMode').classList.remove('open');
  renderWorkout();
  renderToday();
}

// Phase 41k: persist/restore the in-progress workout across nav + reload.
function _saveWmState(){
  try{
    if(!wm.active){localStorage.removeItem('forge_active_workout');return;}
    const stripped={...wm};
    delete stripped.restInterval;
    delete stripped.transitionInterval;
    delete stripped.timerInterval;
    stripped._savedAt=Date.now();
    localStorage.setItem('forge_active_workout',JSON.stringify(stripped));
  }catch{}
}
function _loadWmState(){
  try{
    const raw=localStorage.getItem('forge_active_workout');
    if(!raw)return null;
    const parsed=JSON.parse(raw);
    if(!parsed||!parsed.active)return null;
    // Stale if > 8 hours old
    if(Date.now()-(parsed._savedAt||0)>8*60*60*1000){
      localStorage.removeItem('forge_active_workout');return null;
    }
    // Stale if session type no longer matches today (e.g. clock rolled past midnight)
    if(typeof getSessionTypeForDate==='function'){
      const todaySession=getSessionTypeForDate(todayStr());
      if(todaySession!==parsed.session){
        localStorage.removeItem('forge_active_workout');return null;
      }
    }
    return parsed;
  }catch{return null;}
}

// Phase 41k: resume a minimized workout exactly where it was left.
function resumeGuidedWorkout(){
  const saved=_loadWmState();
  if(!saved){
    // Nothing to resume — fall through to fresh start
    startGuidedWorkout();
    return;
  }
  wm={...saved,active:true,restInterval:null,transitionInterval:null,timerInterval:null};
  _wmStartAutoSave();
  document.getElementById('workoutMode').classList.add('open');
  switch(wm.mode){
    case 'feel':          _renderWmEntry(); break;
    case 'gate':          _renderWmEntry(); break;
    case 'outline':       renderWmOutline(); break;
    case 'set':           renderWmSet(); break;
    case 'rest':          // restart the rest timer cleanly from now (preserves the remaining feel)
                          wm.restStarted=Date.now(); renderWmRest(); break;
    case 'transition':    wm.transitionStarted=Date.now(); renderWmTransition(); break;
    case 'effort':        renderWmEffort(); break;
    case 'timed-effort':  renderWmTimedEffort(); break;
    case 'exDone':        renderWmExerciseDone(); break;
    default:              renderWmOutline();
  }
}

// Phase 41k: explicit discard from the Train page resume area.
function discardGuidedWorkout(){
  if(!confirm('Discard the in-progress workout? Sets you have logged so far are kept — only the resume state is cleared.'))return;
  if(wm.restInterval)clearInterval(wm.restInterval);
  if(wm.transitionInterval)clearInterval(wm.transitionInterval);
  if(wmTimer.interval)clearInterval(wmTimer.interval);
  wm.active=false;
  _wmStopAutoSave();
  try{localStorage.removeItem('forge_active_workout');}catch{}
  renderWorkout();
}

// Phase 28: per-lift increment scales
const INCREMENT_SCALES = {
  large:  { easy: 5,    solid: 2.5,  fail: 5    },
  medium: { easy: 5,    solid: 2.5,  fail: 2.5  },
  small:  { easy: 2.5,  solid: 1.25, fail: 1.25 },
};
function _incForLift(exObj){
  return INCREMENT_SCALES[exObj.size || 'medium'];
}
function _roundToPlate(kg){
  // Round to nearest 0.25 (covers microplates + standard plates)
  return Math.round(kg * 4) / 4;
}

// Phase 47: set-to-set autoregulation. Pure arithmetic — NO AI (you can't wait
// for a network call mid-rest, and it's an exact rule, not a judgement). Reads
// the set you JUST did (reps + effort) vs the rep range and tells you what to
// load on the NEXT set, shown under the rest countdown. Double-progression:
// keep every working set inside the productive range and quality high.
function _autoregNextSet(ex, lastSet, setIdx){
  if(!ex||isTimeBased(ex)||!lastSet)return null;
  const kg=parseFloat(lastSet.kg), reps=parseInt(lastSet.reps);
  if(!kg||!reps)return null;
  const rm=String(ex.reps).match(/(\d+)[–-](\d+)/);
  if(!rm)return null;
  const lower=parseInt(rm[1]), upper=parseInt(rm[2]);
  const inc=_incForLift(ex);
  const effort=lastSet.effort;
  let dir, kgNext, msg;
  const variants=(arr)=>arr[(setIdx||0)%arr.length];
  if(reps>=upper && effort==='easy'){
    dir='up'; kgNext=_roundToPlate(kg+inc.easy);
    msg=variants([
      `Too light — you topped the range and it flew. ${kgNext}kg next set. Earn it.`,
      `That was easy money. Add ${inc.easy}kg → ${kgNext}kg. Make it count.`,
    ]);
  } else if(reps>=upper){
    dir='up'; kgNext=_roundToPlate(kg+inc.solid);
    msg=variants([
      `Topped the range clean. Nudge to ${kgNext}kg and own it.`,
      `Full range, controlled. ${kgNext}kg next — small step, no ego.`,
    ]);
  } else if(reps<lower){
    dir='down'; kgNext=Math.max(0,_roundToPlate(kg-inc.fail));
    msg=variants([
      `Reps fell short. Back off to ${kgNext}kg — quality over ego, every rep clean.`,
      `That got away from you. Drop to ${kgNext}kg and nail the reps.`,
    ]);
  } else if(effort==='tough'){
    dir='hold'; kgNext=kg;
    msg=variants([
      `A grind, but the reps were there. Hold ${kg}kg — match it, don't chase.`,
      `Hard-earned. Stay at ${kg}kg, same reps. Don't let form slip.`,
    ]);
  } else {
    dir='hold'; kgNext=kg;
    msg=variants([
      `Dialled in. Stay at ${kg}kg — aim ${upper} reps, make this set look like the last.`,
      `Right in the pocket. ${kg}kg again, push for ${upper}.`,
    ]);
  }
  return { dir, kg:kgNext, reps:(dir==='down'?upper:undefined), msg };
}

// Phase 47: static one-line form cues per lift. Written once (form doesn't
// change week to week) — NOT AI-generated. Keyed by exercise id; silent if none.
const FORM_CUES = {
  u1:'Drive through your mid-chest, elbows ~45°, don\'t flare.',
  u2:'Control the stretch, press up and slightly in.',
  u3:'Chest up, pull to the belly, squeeze the shoulder blades.',
  u4:'Brace the core, press overhead without leaning back.',
  u5:'Lead with the elbows, pull to the collarbone, no swinging.',
  u6:'Elbows pinned, no swing — slow on the way down.',
  u7:'Lock the elbows in, full extension, squeeze at the bottom.',
  u8:'Pull to the forehead, rotate the knuckles back.',
  u9:'Squeeze glutes + abs, straight line head to heels.',
  l1:'Full depth, knees tracking over toes, drive through the heels.',
  l2:'Hinge at the hips, soft knees, feel the hamstrings, flat back.',
  l3:'Pause and squeeze the quad at the top, control the descent.',
  l4:'No swing — squeeze the hamstring, control all the way back.',
  l5:'Drive hips up, ribs down, squeeze hard at the top.',
  l6:'Full stretch at the bottom, pause at the top, no bouncing.',
  l8:'Curl the spine, exhale and squeeze — don\'t yank the neck.',
  h1:'Heels down, chest tall, elbows inside the knees at the bottom.',
  h2:'Body in a straight line, lower with control, full lockout.',
  h3:'Pull to the hip, flat back, no rotation through the torso.',
  h4:'Hinge, dumbbells close to the legs, stretch then squeeze.',
  h5:'Lead with the elbows, raise to shoulder height, no swing.',
  core_dead_bug:'Press the lower back flat, move slow, opposite arm + leg.',
};

// Phase 28: recovery gate — checks today's Oura readiness + HRV trend
// Returns { lowRecovery: bool, reason: string }
function checkRecoveryGate(){
  const today = (typeof todayStr === 'function') ? todayStr() : new Date().toISOString().slice(0,10);
  const recovery = (typeof STATE !== 'undefined' && STATE.recovery) || {};
  const todayRec = recovery[today];
  if(!todayRec) return { lowRecovery: false, reason: '' };

  const readiness = todayRec.readiness; // exposed in the return for Phase 44 logging
  // Check HRV trend over last 4 days (including today). Need 3+ falling days to flag.
  const hrvSeries = [];
  for(let i = 0; i < 4; i++){
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0,10);
    const r = recovery[key];
    if(r && typeof r.hrv === 'number') hrvSeries.push({ date: key, hrv: r.hrv });
  }
  hrvSeries.reverse(); // oldest first
  let fallingStreak = 0;
  for(let i = 1; i < hrvSeries.length; i++){
    if(hrvSeries[i].hrv < hrvSeries[i-1].hrv) fallingStreak++;
    else fallingStreak = 0;
  }
  const hrvDown3d = fallingStreak >= 3;

  if(typeof readiness === 'number' && readiness < 60){
    return { lowRecovery: true, reason: `readiness ${readiness}` + (hrvDown3d ? `, HRV ↓3d` : ''), readiness, hrvDown3d };
  }
  if(hrvDown3d){
    return { lowRecovery: true, reason: `HRV down 3 days running`, readiness: typeof readiness==='number'?readiness:null, hrvDown3d };
  }
  return { lowRecovery: false, reason: '', readiness: typeof readiness==='number'?readiness:null, hrvDown3d };
}

// Phase 44: the gate is ADVISORY. Oura under-scores shifted sleep schedules, so
// the user decides — "train" restores normal progression prescriptions for the
// day, "easy" keeps the hold behaviour. The choice is logged for calibration.
function effectiveRecoveryGate(){
  const gate=checkRecoveryGate();
  if(!gate.lowRecovery)return gate;
  const ov=(typeof getRecoveryOverride==='function')?getRecoveryOverride(todayStr()):null;
  if(ov&&ov.choice==='train')return {...gate,lowRecovery:false,overridden:'train'};
  if(ov&&ov.choice==='easy')return {...gate,overridden:'easy'};
  return gate;
}

// Phase 28: stall detection — has weight been held same for 3+ sessions without hitting upper rep?
function detectStall(exId, exObj, prevSessions){
  if(!prevSessions || prevSessions.length < 3) return null;
  const rm = String(exObj.reps).match(/(\d+)[–-](\d+)/);
  const upperRep = rm ? parseInt(rm[2]) : null;
  if(!upperRep) return null;

  // Get latest weight at this exercise
  const recentSets = prevSessions[0]?.log[exId]?.sets?.filter(s => s.kg && s.reps) || [];
  if(recentSets.length === 0) return null;
  const baselineKg = parseFloat(recentSets[0].kg);

  // Check if same weight + no top-of-range hit across 3+ sessions
  let stalledSessions = 0;
  for(const sess of prevSessions){
    const sets = (sess.log[exId]?.sets || []).filter(s => s.kg && s.reps);
    if(sets.length === 0) break;
    const sessKg = parseFloat(sets[0].kg);
    if(Math.abs(sessKg - baselineKg) > 0.1) break; // weight changed → not stalled
    const hitUpper = sets.some(s => parseInt(s.reps) >= upperRep);
    if(hitUpper) break; // hit top of range → progressing
    stalledSessions++;
  }
  if(stalledSessions < 3) return null;
  const deloadKg = _roundToPlate(baselineKg * 0.88);
  return {
    baselineKg,
    deloadKg,
    sessions: stalledSessions,
    reason: `Deload — stalled ${stalledSessions} sessions at ${baselineKg}kg. Try ${deloadKg}kg today, then return to ${baselineKg}kg+ next time.`,
  };
}

// Phase 38: injury overlay — reduces prescribed load on injured lifts.
// mild ×0.80 · moderate ×0.65 · severe → hold / see doctor.
function _applyInjuryToSuggestion(exId, sug){
  if(!sug)return sug;
  const sev=(typeof getInjurySeverity==='function')?getInjurySeverity(exId):null;
  if(!sev)return sug;
  const inj=(typeof getInjuryForExercise==='function')?getInjuryForExercise(exId):null;
  const nm=inj&&inj.name?inj.name:'injury';
  if(sev==='severe'){
    return {...sug, dir:null, injured:'severe',
      reason:`⚠️ INJURY (${nm}) — do not load this lift. Hold or skip it; see a doctor before progressing.`};
  }
  const factor=(typeof INJURY_WEIGHT_FACTOR!=='undefined'&&INJURY_WEIGHT_FACTOR[sev])||0.8;
  if(sug.timed){
    const sec=Math.max(5,Math.round((sug.seconds||0)*factor));
    return {...sug, seconds:sec, dir:'down', injured:sev,
      reason:`⚠️ Injury (${nm}, ${sev}) — cut to ${Math.round(factor*100)}%: try ${fmtSec(sec)}. ${sug.reason||''}`.trim()};
  }
  const kg=_roundToPlate(Math.max(0,(sug.kg||0)*factor));
  return {...sug, kg, dir:'down', injured:sev,
    reason:`⚠️ Injury (${nm}, ${sev}) — cut to ${Math.round(factor*100)}%: ${kg}kg. ${sug.reason||''}`.trim()};
}

function suggestWeight(exId, prevSession, setIdx, opts){
  return _applyInjuryToSuggestion(exId, _suggestWeightCore(exId, prevSession, setIdx, opts));
}

function _suggestWeightCore(exId, prevSession, setIdx, opts){
  const exObj=getAllExercises().find(e=>e.id===exId);
  if(!exObj)return null;
  const timed=isTimeBased(exObj);

  if(timed){
    return suggestTime(exId,exObj,prevSession,setIdx,opts);
  }

  // Phase 47: skip ≠ reset. If the most recent same-type session omitted or
  // skipped this lift, fall back to the last session that actually has data for
  // it — so a skip never makes the engine forget your real last working weight.
  const _hasEx=(s)=>s&&s.log&&s.log[exId]&&(s.log[exId].sets||[]).some(x=>x.kg&&x.reps);
  if(!_hasEx(prevSession)&&opts&&Array.isArray(opts.prevSessions)){
    prevSession=opts.prevSessions.find(_hasEx)||prevSession;
  }

  if(!prevSession||!prevSession.log[exId])return null;
  const repMatch=String(exObj.reps).match(/(\d+)[–-](\d+)/);
  const lowerRep=repMatch?parseInt(repMatch[1]):null;
  const upperRep=repMatch?parseInt(repMatch[2]):null;
  const sets=(prevSession.log[exId].sets||[]).filter(s=>s.kg&&s.reps);
  if(!sets.length)return null;

  // Phase 32: use the MODAL (most-frequent) weight as the reference, not set[0].
  // This handles "top set + back-off" patterns where set 1 might be light warm-up
  // and one set might be a heavy attempt that's not the user's true working weight.
  // Tiebreak: prefer the HEAVIEST weight among ties (closer to true working set).
  const weightCounts = {};
  for(const s of sets){
    const k = String(parseFloat(s.kg));
    weightCounts[k] = (weightCounts[k]||0) + 1;
  }
  const weightEntries = Object.entries(weightCounts).map(([k,c])=>({kg:parseFloat(k), count:c}));
  weightEntries.sort((a,b) => b.count - a.count || b.kg - a.kg);
  const modalKg = weightEntries[0].kg;
  // The sets that match the modal weight — used for rep-range check
  const modalSets = sets.filter(s => Math.abs(parseFloat(s.kg) - modalKg) < 0.1);
  const refSet = modalSets[0]; // most-frequent weight, first occurrence
  const lastKg=modalKg;
  const lastReps=parseInt(refSet.reps);
  const efforts=modalSets.map(s=>s.effort).filter(e=>e);
  const hasEffort=efforts.length>0;
  const prevSummary = sets.map(s=>`${s.kg}×${s.reps}`).join(', ');
  const workingSummary = modalSets.length < sets.length
    ? ` (working: ${modalKg}kg × ${modalSets.map(s=>s.reps).join(',')})`
    : '';
  const inc = _incForLift(exObj);

  // Check 1: recovery gate (skip when caller hasn't passed it — only the outline page checks)
  if(opts?.lowRecovery){
    return { kg:lastKg, reps:lastReps, reason:`Hold — low recovery (${opts.recoveryReason}). Focus on form.`, dir:null, recovery:'low' };
  }

  // Check 2: stall detection (needs multi-session data)
  if(opts?.prevSessions){
    const stall = detectStall(exId, exObj, opts.prevSessions);
    if(stall){
      // Phase 44: holdKg exposes the stalled weight so the UI can offer
      // "hold instead" — the deload math itself is unchanged.
      return { kg:stall.deloadKg, reps:upperRep||lastReps, reason:stall.reason, dir:'down', deload:true, holdKg:stall.baselineKg };
    }
  }

  if(!upperRep){
    return { kg:lastKg, reps:lastReps, reason:`Last: ${prevSummary}`, dir:null };
  }

  // Use ONLY the modal-weight sets for rep-range judgement (filters out warm-ups + experimental top sets)
  const allHitUpper = modalSets.every(s=>parseInt(s.reps)>=upperRep);
  const firstFailed = parseInt(modalSets[0].reps)<(lowerRep||0);

  // Check 3: smart progression with per-lift increments
  if(hasEffort){
    const allEasy=efforts.every(e=>e==='easy');
    const mostlySolid=efforts.filter(e=>e==='solid').length>=efforts.length/2;
    const anyTough=efforts.some(e=>e==='tough');
    if(allEasy&&allHitUpper)    return { kg:_roundToPlate(lastKg+inc.easy),  reps:lowerRep, reason:`+${inc.easy}kg ↑ (last: ${prevSummary}${workingSummary}, felt easy)`, dir:'up' };
    if(mostlySolid&&allHitUpper) return { kg:_roundToPlate(lastKg+inc.solid), reps:lowerRep, reason:`+${inc.solid}kg ↑ (last: ${prevSummary}${workingSummary}, solid)`, dir:'up' };
    if(anyTough&&!allHitUpper)   return { kg:lastKg, reps:lastReps, reason:`Hold weight (last: ${prevSummary}${workingSummary}, was tough)`, dir:null };
  }

  if(allHitUpper)  return { kg:_roundToPlate(lastKg+inc.solid), reps:lowerRep, reason:`+${inc.solid}kg ↑ (last: ${prevSummary}${workingSummary})`, dir:'up' };
  if(firstFailed)  return { kg:Math.max(0,_roundToPlate(lastKg-inc.fail)), reps:upperRep, reason:`-${inc.fail}kg ↓ (last: ${prevSummary}${workingSummary}, struggled)`, dir:'down' };
  const targetReps = Math.min(upperRep, lastReps+1);
  return { kg:lastKg, reps:targetReps, reason:`Same weight, target ${targetReps} reps (last: ${prevSummary}${workingSummary})`, dir:null };
}

function suggestTime(exId,exObj,prevSession,setIdx,opts){
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

  // Phase 28: recovery gate
  if(opts?.lowRecovery){
    return{seconds:lastSec,reason:`Hold ${fmtSec(lastSec)} — low recovery (${opts.recoveryReason}). Focus on form.`,dir:null,timed:true,recovery:'low'};
  }

  if(allHitPrescribed&&(effort==='easy'||effort==='maybe')){
    return{seconds:lastSec+5,reason:`Try ${fmtSec(lastSec+5)} — beat last week's ${fmtSec(lastSec)}`,dir:'up',timed:true};
  }
  if(allHitPrescribed&&effort==='hard'){
    return{seconds:lastSec,reason:`Hold ${fmtSec(lastSec)} — match last week`,dir:null,timed:true};
  }
  if(!allHitPrescribed){
    return{seconds:lastSec,reason:`Hold ${fmtSec(lastSec)} — match last week (last: ${prevSummary})`,dir:null,timed:true};
  }
  return{seconds:lastSec+5,reason:`Try ${fmtSec(lastSec+5)} — beat last week's ${fmtSec(lastSec)}`,dir:'up',timed:true};
}

function renderWmOutline(){
  const w=WORKOUTS[wm.session];
  const date=todayStr();
  const prev=getPreviousSessionData(date,wm.session);
  const prevSessions=getPreviousSessions(date,wm.session,5);
  const gate=effectiveRecoveryGate(); // Phase 44: honours the user's train/easy choice
  const opts={ lowRecovery: gate.lowRecovery, recoveryReason: gate.reason, prevSessions };
  const banner = gate.overridden==='train'
    ? `<div style="background:rgba(200,255,0,.06);border:1px solid rgba(200,255,0,.25);border-radius:10px;padding:12px 14px;margin-bottom:20px;font-size:12px;color:var(--text2);line-height:1.5;">⚡ Low recovery flagged (${gate.reason}) — <strong style="color:var(--lime);">you chose to train as planned.</strong> Normal prescriptions below; listen to your body set to set.</div>`
    : gate.lowRecovery
    ? `<div style="background:rgba(255,193,7,.12);border:1px solid rgba(255,193,7,.4);border-radius:10px;padding:12px 14px;margin-bottom:20px;font-size:12px;color:#ffc107;line-height:1.5;">🌙 <strong>Taking it easy today</strong> (${gate.reason}). Form and finishing every set — not PRs. Suggestions hold last weights.</div>`
    : '';

  // Phase 38: injury banner — lists active injuries affecting today's lifts
  const injuredEx = w.exercises.filter(ex=>typeof isExerciseInjured==='function'&&isExerciseInjured(ex.id));
  const injuryBanner = injuredEx.length
    ? `<div style="background:rgba(255,59,59,.1);border:1px solid rgba(255,59,59,.4);border-radius:10px;padding:12px 14px;margin-bottom:20px;font-size:12px;color:#ff6b6b;line-height:1.5;">🩹 <strong>Active injury</strong> — ${injuredEx.length} lift${injuredEx.length>1?'s':''} today affected (${injuredEx.map(e=>e.name).join(', ')}). Loads are reduced automatically. Train pain-free; stop if it hurts.</div>`
    : '';

  // Phase 33: build prescriptions array for AI brief
  const prescriptions = w.exercises.map(ex => {
    const sug = suggestWeight(ex.id, prev, undefined, opts);
    return {
      exId: ex.id,
      name: ex.name,
      kg: sug?.kg,
      reps: sug?.reps,
      seconds: sug?.seconds,
      deload: !!sug?.deload,
      recovery: sug?.recovery,
    };
  });

  // Phase 42d: calibration banner — first sessions have no history to prescribe from
  const calCount = prescriptions.filter(p => p.kg == null && p.seconds == null).length;
  const calibrationBanner = calCount >= 3
    ? `<div style="background:rgba(61,155,255,.08);border:1px solid rgba(61,155,255,.3);border-radius:10px;padding:12px 14px;margin-bottom:20px;font-size:12px;color:var(--blue);line-height:1.5;">🎯 <strong>Calibration session</strong> — no history yet on ${calCount} lift${calCount>1?'s':''}. For each one, find a weight you could lift for the target reps with about 2 reps left in the tank. Log what you do — the app progresses it automatically from your next session.</div>`
    : '';

  // Cache key for this session brief
  const briefKey = `${date}_${wm.session}`;
  const cached = (STATE.sessionBriefs || {})[briefKey];
  const briefSlot = cached
    ? _renderBriefHTML(cached)
    : `<div id="ai-brief-slot" style="background:rgba(200,255,0,.04);border:1px solid rgba(200,255,0,.2);border-radius:10px;padding:12px 14px;margin-bottom:20px;font-size:12px;color:var(--text3);line-height:1.5;">🧠 <em>AI brief loading…</em></div>`;

  const html=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div class="wm-title">${w.name}</div>
    <div class="wm-sub">${w.muscles} · ${w.exercises.length} exercises · ~${w.duration} mins</div>
    ${banner}
    ${injuryBanner}
    ${calibrationBanner}
    ${briefSlot}
    <div class="wm-h">Today's Plan</div>
    <div style="margin-bottom:24px;" id="wm-exercise-list">
      ${w.exercises.map((ex,i)=>{
        const sug=suggestWeight(ex.id,prev,undefined,opts);
        const timed=isTimeBased(ex);
        const arrow=sug?.dir==='up'?'<span class="wm-arrow-up">↑</span>':sug?.dir==='down'?'<span class="wm-arrow-down">↓</span>':'';
        const wt=sug?(timed?`@ ${fmtSec(sug.seconds)} ${arrow}`:`@ ${sug.kg}kg ${arrow}`):(timed?'':'<span style="font-size:9px;color:var(--blue);font-weight:700;letter-spacing:1px;">FIND WEIGHT</span>');
        const badge=sug?.injured==='severe'?'<span style="font-size:9px;color:#ff6b6b;font-weight:700;letter-spacing:1px;display:block;margin-top:2px;">⚠ DO NOT LOAD</span>':sug?.injured?'<span style="font-size:9px;color:#ff6b6b;font-weight:700;letter-spacing:1px;display:block;margin-top:2px;">INJURY −</span>':sug?.deload?'<span style="font-size:9px;color:var(--orange);font-weight:700;letter-spacing:1px;display:block;margin-top:2px;">DELOAD</span>':sug?.recovery==='low'?'<span style="font-size:9px;color:#ffc107;font-weight:700;letter-spacing:1px;display:block;margin-top:2px;">HOLD</span>':'';
        const cueId = `cue-${ex.id}`;
        const cueText = cached?.perExercise?.find(c => c.exId === ex.id)?.cue || '';
        return `<div class="wm-ex-row"><div style="flex:1;"><div style="font-size:10px;color:var(--text3);font-weight:700;">${i+1}.</div><div class="wm-ex-name">${ex.name}</div><div id="${cueId}" style="font-size:11px;color:var(--lime);margin-top:4px;line-height:1.4;${cueText?'':'display:none;'}">${cueText}</div></div><div class="wm-ex-spec">${ex.sets}×${ex.reps}<br>${wt}${badge}</div></div>`;
      }).join('')}
    </div>
    <button class="wm-cta" onclick="wmStartFirstSet()">START WORKOUT →</button>
  `;
  document.getElementById('wmContent').innerHTML=html;

  // Phase 33: fire off the AI brief in background if not cached
  if (!cached && typeof requestSessionBrief === 'function') {
    requestSessionBrief(wm.session, prescriptions, briefKey);
  }
}

function _renderBriefHTML(brief){
  return `<div id="ai-brief-slot" style="background:rgba(200,255,0,.06);border:1px solid rgba(200,255,0,.3);border-radius:10px;padding:12px 14px;margin-bottom:20px;font-size:12px;color:var(--text2);line-height:1.6;">
    <div style="font-size:9px;color:var(--lime);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:6px;">🧠 AI Brief</div>
    <div style="color:var(--text);">${(brief.strategy||'').replace(/</g,'&lt;')}</div>
  </div>`;
}

// Phase 33b: in-workout access to the cached AI brief
function _wmBrief(){
  const key=`${todayStr()}_${wm.session}`;
  return (STATE.sessionBriefs||{})[key]||null;
}
function _wmCueHTML(exId){
  const b=_wmBrief();
  if(!b)return '';
  const c=(b.perExercise||[]).find(x=>x.exId===exId);
  if(!c||!c.cue)return '';
  return `<div style="background:rgba(200,255,0,.06);border:1px solid rgba(200,255,0,.25);border-radius:8px;padding:10px 12px;margin-bottom:20px;font-size:12px;color:var(--lime);line-height:1.5;">🧠 ${c.cue.replace(/</g,'&lt;')}</div>`;
}
function _wmStrategyBtnHTML(){
  const b=_wmBrief();
  if(!b||!b.strategy)return '';
  return `<button onclick="wmShowStrategy()" style="background:transparent;border:1px solid var(--border2);color:var(--text3);font-size:11px;padding:5px 12px;border-radius:100px;cursor:pointer;">🧠 Session strategy</button>`;
}
function wmShowStrategy(){
  const b=_wmBrief();
  if(!b||!b.strategy)return;
  if(typeof _showInfoModal==='function'){
    _showInfoModal('Session Strategy',`<div style="font-size:13px;line-height:1.7;color:var(--text2);">${b.strategy.replace(/</g,'&lt;')}</div>`);
  }else{
    alert(b.strategy);
  }
}

function wmStartFirstSet(){
  wm.exIdx=0; wm.setIdx=0; wm.mode='set';
  wm.setStartedAt=Date.now();
  _wmMarkSessionStart();
  _wmMarkExerciseStart();
  renderWmSet();
}

// Phase 38: session + exercise timing helpers
function _wmMarkSessionStart(){
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  if(!dayLog._session||typeof dayLog._session!=='object')dayLog._session={};
  if(!dayLog._session.startedAt)dayLog._session.startedAt=Date.now();
  // Phase 46: record what was actually trained so progression matches reality,
  // not the calendar (handles training off the rigid 4-day cycle).
  if(!dayLog._session.sessionType&&wm&&wm.session)dayLog._session.sessionType=wm.session;
  saveExLogForDate(date,dayLog);
}
function _wmMarkExerciseStart(){
  const w=WORKOUTS[wm.session];
  const ex=w.exercises[wm.exIdx]; if(!ex)return;
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  if(!dayLog[ex.id])dayLog[ex.id]={done:false,sets:[]};
  if(!dayLog[ex.id].exerciseStartedAt)dayLog[ex.id].exerciseStartedAt=Date.now();
  saveExLogForDate(date,dayLog);
}
function _wmMarkExerciseDone(){
  const w=WORKOUTS[wm.session];
  const ex=w.exercises[wm.exIdx]; if(!ex)return;
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  if(!dayLog[ex.id])return;
  dayLog[ex.id].exerciseCompletedAt=Date.now();
  if(dayLog[ex.id].exerciseStartedAt){
    dayLog[ex.id].totalExerciseDuration=Math.round((Date.now()-dayLog[ex.id].exerciseStartedAt)/1000);
  }
  saveExLogForDate(date,dayLog);
}

function renderWmSet(){
  const w=WORKOUTS[wm.session];
  const ex=w.exercises[wm.exIdx];
  const timed=isTimeBased(ex);
  if(timed){renderWmSetTimed();return;}
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const prev=getPreviousSessionData(date,wm.session);
  const prevSessions=getPreviousSessions(date,wm.session,5);
  const gate=effectiveRecoveryGate(); // Phase 44: honours the user's train/easy choice
  const sug=suggestWeight(ex.id,prev,wm.setIdx,{lowRecovery:gate.lowRecovery,recoveryReason:gate.reason,prevSessions});
  const existingSet=dayLog[ex.id]?.sets?.[wm.setIdx];
  const startKg=existingSet?.kg||((wm.autoReg&&wm.autoReg.forSetIdx===wm.setIdx)?wm.autoReg.kg:null)||sug?.kg||'';
  const repMatch=String(ex.reps).match(/(\d+)[–-](\d+)/);
  const targetReps=existingSet?.reps||((wm.autoReg&&wm.autoReg.forSetIdx===wm.setIdx&&wm.autoReg.reps)?wm.autoReg.reps:null)||sug?.reps||(repMatch?parseInt(repMatch[2]):8);
  // Phase 38: warm-up prompt on the very first working set of the session
  const isSessionOpener=wm.exIdx===0&&wm.setIdx===0;
  const workKg=parseFloat(startKg)||0;
  const warmKg=isSessionOpener&&workKg>0?Math.round((workKg*0.5)/2.5)*2.5:0;
  const warmupBlock=warmKg>0
    ? `<div style="background:rgba(61,155,255,.08);border:1px solid rgba(61,155,255,.3);border-radius:10px;padding:10px 12px;margin-bottom:16px;font-size:12px;color:var(--blue);line-height:1.5;">🔥 <strong>Warm up first.</strong> Before this working set do 1–2 light sets at ~${warmKg}kg (50% of today's load), 8–10 easy reps. Don't log warm-ups.</div>`
    : '';
  // Phase 47: per-exercise panel on the first set — what you did last time + a
  // static form cue. Deterministic, no AI. Later sets get the rest-screen autoreg.
  const lastForEx=(prev&&prev.log[ex.id]&&Array.isArray(prev.log[ex.id].sets))
    ? prev.log[ex.id].sets.filter(s=>s.kg&&s.reps).map(s=>`${s.kg}×${s.reps}`).join(', ')
    : null;
  const formCue=(typeof FORM_CUES!=='undefined')?FORM_CUES[ex.id]:null;
  const panelBlock=(wm.setIdx===0)?`
    ${lastForEx?`<div style="font-size:12px;color:var(--text2);background:rgba(61,155,255,.06);border-radius:8px;padding:8px 11px;margin-bottom:8px;"><span style="color:var(--text3);">Last time:</span> ${lastForEx}${prev.date?` · ${prev.date}`:''}</div>`:''}
    ${formCue?`<div style="font-size:12px;color:var(--text2);background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px 11px;margin-bottom:8px;line-height:1.5;"><span style="color:var(--lime);font-weight:700;">Form:</span> ${formCue}</div>`:''}`:'';
  const html=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:32px;">Exercise ${wm.exIdx+1} of ${w.exercises.length}</div>
    <div class="wm-title" style="margin-top:6px;">${ex.name}</div>
    <div class="wm-sub">Set ${wm.setIdx+1} of ${ex.sets} · Target ${ex.reps} reps</div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
      <a href="${ex.yt}" target="_blank" style="color:var(--blue);font-size:12px;text-decoration:none;">🎥 Watch form →</a>
      ${_wmStrategyBtnHTML()}
    </div>
    ${_wmCueHTML(ex.id)}
    ${panelBlock}
    ${warmupBlock}
    <div class="wm-h">Weight</div>
    <div class="wm-stepper">
      <button class="wm-step-btn" onclick="wmStepKg(-2.5)">−</button>
      <input id="wm-kg" type="number" step="0.5" inputmode="decimal" value="${startKg}">
      <button class="wm-step-btn" onclick="wmStepKg(2.5)">+</button>
    </div>
    ${sug?`<div class="wm-progress-hint">${sug.reason}</div>`:`<div class="wm-progress-hint" style="color:var(--blue);">First time on this lift — find a weight you could manage for ${ex.reps} reps with ~2 left in the tank. Logged today, auto-progressed next session.</div>`}
    ${sug&&sug.deload&&sug.holdKg?`
      ${((STATE.profile&&STATE.profile.personal&&STATE.profile.personal.phase)||null)==='cut'?`<div style="font-size:11px;color:var(--text3);line-height:1.5;margin-top:6px;">On a cut, holding the same weight while your bodyweight drops <strong style="color:var(--text2);">is</strong> progress. A deload is a tool, not a failure — but it's your call.</div>`:''}
      <button onclick="wmHoldInsteadOfDeload('${ex.id}',${sug.holdKg})" style="display:block;width:100%;margin-top:8px;padding:11px;background:transparent;border:1px solid var(--border);border-radius:10px;color:var(--text2);font-size:12px;cursor:pointer;">Hold ${sug.holdKg}kg instead</button>
    `:''}
    <div class="wm-h" style="margin-top:24px;">Reps</div>
    <div class="wm-stepper">
      <button class="wm-step-btn" onclick="wmStepReps(-1)">−</button>
      <input id="wm-reps" type="number" inputmode="numeric" value="${targetReps}">
      <button class="wm-step-btn" onclick="wmStepReps(1)">+</button>
    </div>
    <button class="wm-cta" onclick="wmMarkSetDone(${ex.rest})">SET DONE</button>
    <div style="display:flex;gap:14px;justify-content:center;margin-top:12px;">
      <span onclick="wmAddExerciseNote('${ex.id}')" style="font-size:11px;color:var(--text3);text-decoration:underline;cursor:pointer;">+ note</span>
      <span onclick="wmSkipExercise()" style="font-size:11px;color:var(--text3);text-decoration:underline;cursor:pointer;">Skip this exercise</span>
    </div>
  `;
  document.getElementById('wmContent').innerHTML=html;
}

// Phase 44: user opts out of a prescribed deload — keep the stalled weight,
// log the choice for the weekly calibration review.
function wmHoldInsteadOfDeload(exId,kg){
  const inp=document.getElementById('wm-kg');
  if(inp)inp.value=kg;
  if(typeof saveRecoveryOverride==='function'&&typeof getRecoveryOverride==='function'){
    const ov=getRecoveryOverride(todayStr())||{};
    saveRecoveryOverride({deloadHolds:{...(ov.deloadHolds||{}),[exId]:'hold'}});
  }
  showToast('Holding '+kg+'kg — aim to beat last session\'s reps');
}

// Timer state for time-based exercises
let wmTimer={running:false,startedAt:0,interval:null,elapsed:0};

function renderWmSetTimed(){
  const w=WORKOUTS[wm.session];
  const ex=w.exercises[wm.exIdx];
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const prev=getPreviousSessionData(date,wm.session);
  const prevSessions=getPreviousSessions(date,wm.session,5);
  const gate=effectiveRecoveryGate(); // Phase 44: honours the user's train/easy choice
  const sug=suggestWeight(ex.id,prev,wm.setIdx,{lowRecovery:gate.lowRecovery,recoveryReason:gate.reason,prevSessions});
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
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
      <a href="${ex.yt}" target="_blank" style="color:var(--blue);font-size:12px;text-decoration:none;">🎥 Watch form →</a>
      ${_wmStrategyBtnHTML()}
    </div>
    ${_wmCueHTML(ex.id)}
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
  dayLog[ex.id].sets[wm.setIdx]={seconds,done:true,doneAt:Date.now(),
    setStartedAt:wm.setStartedAt||null,setCompletedAt:Date.now()};
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
  _wmMarkExerciseDone();
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
  const prevEffort=dayLog[ex.id].sets[wm.setIdx]?.effort;
  dayLog[ex.id].sets[wm.setIdx]={kg,reps,done:true,doneAt:Date.now(),
    setStartedAt:wm.setStartedAt||null,setCompletedAt:Date.now()};
  if(prevEffort)dayLog[ex.id].sets[wm.setIdx].effort=prevEffort;
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
    _wmMarkExerciseDone();
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
  // Phase 47: compute the next-set call from the set just done; store it so the
  // next set pre-fills, and show it UNDER the countdown so you load up in time.
  const ar=_autoregNextSet(ex,lastSet,wm.setIdx+1);
  if(ar)wm.autoReg={forSetIdx:wm.setIdx+1,kg:ar.kg,reps:ar.reps};
  const arColor=ar?(ar.dir==='up'?'var(--lime)':ar.dir==='down'?'#ffc107':'var(--blue)'):'';
  const arBg=ar?(ar.dir==='up'?'rgba(200,255,0,.08)':ar.dir==='down'?'rgba(255,193,7,.1)':'rgba(61,155,255,.08)'):'';
  const arArrow=ar?(ar.dir==='up'?'↑':ar.dir==='down'?'↓':'→'):'';
  const arPanel=ar?`<div style="background:${arBg};border:1px solid ${arColor};border-radius:12px;padding:13px 14px;margin:0 0 14px;">
      <div style="font-size:10px;color:${arColor};text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:4px;">Next set ${arArrow} ${ar.kg}kg</div>
      <div style="font-size:13px;color:var(--text);line-height:1.5;">${ar.msg}</div>
    </div>`:'';
  const html=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:32px;">Resting</div>
    <div class="wm-sub" style="margin-top:8px;">✓ Set ${wm.setIdx+1}: ${setDesc}${lastSet?.effort?' '+effortEmoji[lastSet.effort]:''}</div>
    <div style="text-align:center;padding:40px 0 24px;">
      <div id="wm-timer" style="font-family:'Archivo Black',sans-serif;font-size:88px;letter-spacing:-4px;color:var(--lime);line-height:1;">${wm.restTarget}s</div>
      <div id="wm-timer-status" style="font-size:14px;color:var(--text2);margin-top:8px;">counting down</div>
    </div>
    ${arPanel}
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
    // Phase 38: green while plenty of rest left, amber in the final 20s
    if(remaining>20){
      t.style.color='var(--lime)';
      s.textContent='resting — recover fully';
    }else{
      t.style.color='#ffc107';
      s.textContent='almost ready — get set';
    }
    if(b){b.textContent='SKIP REST · START NEXT SET';b.classList.add('ghost');b.classList.remove('over');}
  } else {
    const over=Math.floor(-remaining);
    if(t.dataset.transitioned!=='true'){
      t.dataset.transitioned='true';
      if(navigator.vibrate)navigator.vibrate([200,100,200,100,200]);
    }
    t.textContent='+'+over+'s';
    t.style.color='var(--red)';
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
  const setObj=dayLog[ex.id]?.sets?.[wm.setIdx];
  if(setObj){
    setObj.restAfter=elapsed;
    setObj.restStartedAt=wm.restStarted;
    setObj.restCompletedAt=Date.now();
    setObj.actualRestSeconds=elapsed;
    setObj.prescribedRestSeconds=wm.restTarget;
  }
  saveExLogForDate(date,dayLog);
  if(wm.restInterval){clearInterval(wm.restInterval);wm.restInterval=null;}
  // Phase 41h: 15s transition window — walking to bench, lying down, getting positioned
  wm.mode='transition';
  wm.transitionStarted=Date.now();
  wm.prevSetIdx=wm.setIdx; // remember which set the transition belongs to
  wm.setIdx++;
  renderWmTransition();
}

function renderWmTransition(){
  if(wm.restInterval){clearInterval(wm.restInterval);wm.restInterval=null;}
  const w=WORKOUTS[wm.session];
  const ex=w.exercises[wm.exIdx];
  if(!ex)return;
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const prev=getPreviousSessionData(date,wm.session);
  const prevSessions=getPreviousSessions(date,wm.session,5);
  const gate=effectiveRecoveryGate(); // Phase 44: honours the user's train/easy choice
  const sug=suggestWeight(ex.id,prev,wm.setIdx,{lowRecovery:gate.lowRecovery,recoveryReason:gate.reason,prevSessions});
  const timed=isTimeBased(ex);
  const existingSet=dayLog[ex.id]?.sets?.[wm.setIdx];
  const startKg=existingSet?.kg||((wm.autoReg&&wm.autoReg.forSetIdx===wm.setIdx)?wm.autoReg.kg:null)||sug?.kg||'';
  const repMatch=String(ex.reps).match(/(\d+)[–-](\d+)/);
  const targetReps=existingSet?.reps||((wm.autoReg&&wm.autoReg.forSetIdx===wm.setIdx&&wm.autoReg.reps)?wm.autoReg.reps:null)||sug?.reps||(repMatch?parseInt(repMatch[2]):8);
  const upcoming=timed
    ? `${fmtSec(sug?.seconds||0)} hold`
    : `${startKg||'?'}kg × ${targetReps} reps`;
  document.getElementById('wmContent').innerHTML=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:32px;">Get into position</div>
    <div class="wm-title" style="font-size:22px;margin-top:6px;">${ex.name}</div>
    <div class="wm-sub" style="margin-bottom:30px;">Set ${wm.setIdx+1} of ${ex.sets} · ${upcoming}</div>
    <div style="text-align:center;padding:30px 0;">
      <div id="wm-trans" style="font-family:'Archivo Black',sans-serif;font-size:96px;letter-spacing:-4px;color:var(--blue);line-height:1;">15</div>
      <div style="font-size:14px;color:var(--text2);margin-top:8px;">walk over · lie down · grip the bar</div>
    </div>
    <button class="wm-cta" onclick="wmFinishTransition()">I'M READY →</button>
  `;
  let r=15;
  wm.transitionInterval=setInterval(()=>{
    r--;
    const el=document.getElementById('wm-trans');
    if(el){el.textContent=Math.max(0,r); if(r<=5)el.style.color='var(--orange)';}
    if(r<=0){clearInterval(wm.transitionInterval);wm.transitionInterval=null;wmFinishTransition();}
  },1000);
}

function wmFinishTransition(){
  if(wm.transitionInterval){clearInterval(wm.transitionInterval);wm.transitionInterval=null;}
  const elapsed=Math.round((Date.now()-(wm.transitionStarted||Date.now()))/1000);
  // Stamp transition time on the PREVIOUS set's record (which the transition followed)
  const w=WORKOUTS[wm.session];
  const ex=w.exercises[wm.exIdx];
  if(ex && typeof wm.prevSetIdx==='number'){
    const date=todayStr();
    const dayLog=getExLogForDate(date);
    const prevSet=dayLog[ex.id]?.sets?.[wm.prevSetIdx];
    if(prevSet){
      prevSet.transitionSeconds=elapsed;
      saveExLogForDate(date,dayLog);
    }
  }
  wm.mode='set';
  wm.setStartedAt=Date.now();
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
  wm.autoReg=null; // Phase 47: don't carry a set-to-set call across exercises
  if(wm.exIdx>=w.exercises.length-1){wmFinish();return;}
  wm.exIdx++;
  wm.setIdx=0;
  wm.mode='set';
  wm.setStartedAt=Date.now();
  _wmMarkExerciseStart();
  renderWmSet();
}

// Phase 47: skip an exercise — a deliberate "not today", NOT a failure. No sets
// are logged, so the progression engine carries your last real session forward
// (no deload), and the score/recap exclude it. The coach is told you chose to skip.
function wmSkipExercise(){
  const w=WORKOUTS[wm.session];
  const ex=w.exercises[wm.exIdx];
  if(!confirm(`Skip ${ex.name}? It won't count against you — your next session won't deload from a skip.`))return;
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  dayLog[ex.id]={done:false,skipped:true,skippedAt:Date.now(),sets:[]};
  saveExLogForDate(date,dayLog);
  wm.autoReg=null;
  showToast(`${ex.name} skipped — no harm done`);
  if(wm.exIdx>=w.exercises.length-1){wmFinish();return;}
  wm.exIdx++;
  wm.setIdx=0;
  wm.mode='set';
  wm.setStartedAt=Date.now();
  _wmMarkExerciseStart();
  renderWmSet();
}

// Phase 47: per-exercise running note — sticks to the lift until changed,
// resurfaces every session, and feeds the AI session brief + weekly report.
function wmAddExerciseNote(exId){
  const cur=(typeof getExerciseNote==='function')?getExerciseNote(exId):'';
  const note=prompt('Note for this exercise (carries to your next session — e.g. "narrower grip", "left shoulder twinge"):',cur||'');
  if(note===null)return;
  if(typeof setExerciseNote==='function')setExerciseNote(exId,note.trim());
  showToast(note.trim()?'Note saved — your coach will see it':'Note cleared');
}

// Phase 47: one-off note for today's session (e.g. "rushed, poor sleep").
function wmAddSessionNote(){
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const cur=(dayLog._session&&dayLog._session.note)||'';
  const note=prompt('Note for today\'s session (one-off, fed into the weekly report):',cur);
  if(note===null)return;
  if(!dayLog._session||typeof dayLog._session!=='object')dayLog._session={};
  dayLog._session.note=note.trim().slice(0,300);
  saveExLogForDate(date,dayLog);
  showToast('Session note saved');
}

function wmFinish(){
  wm.recapShown=true; // Phase 47b: recap is now on screen — let the next ✕ close cleanly
  const w=WORKOUTS[wm.session];
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  // Phase 38: stamp session completion timing
  if(dayLog._session&&typeof dayLog._session==='object'){
    dayLog._session.completedAt=Date.now();
    if(dayLog._session.startedAt)dayLog._session.totalDuration=Math.round((Date.now()-dayLog._session.startedAt)/1000);
    // Phase 44: session score — volume vs 4-week average + effort mix.
    // Stored with the session for the weekly calibration review.
    if(typeof computeSessionScore==='function'){
      dayLog._session.score=computeSessionScore(date,wm.session);
    }
    saveExLogForDate(date,dayLog);
  }
  const totalVolume=Object.values(dayLog).reduce((tot,ex)=>tot+((ex&&ex.sets)||[]).reduce((s,x)=>s+(parseFloat(x.kg)||0)*(parseInt(x.reps)||0),0),0);
  const totalSets=Object.values(dayLog).reduce((tot,ex)=>tot+((ex&&ex.sets)||[]).filter(s=>s.done).length,0);
  const sessDur=(dayLog._session&&dayLog._session.totalDuration)?dayLog._session.totalDuration:0;
  const durStr=sessDur>0?` · ${Math.round(sessDur/60)} min`:'';
  const volStr=totalVolume>0?` · ${totalVolume.toFixed(0)}kg total volume`:'';
  // Phase 47: deterministic end-of-session recap — how you're getting on.
  // Free, always works. The AI reflection (on FINISH) adds a warm line on top.
  const score=dayLog._session&&dayLog._session.score;
  const feel=(typeof getSessionFeel==='function')?getSessionFeel(date):null;
  const skipped=w.exercises.filter(ex=>dayLog[ex.id]&&dayLog[ex.id].skipped).map(ex=>ex.name);
  const sessNote=dayLog._session&&dayLog._session.note;
  let verdict='',vColor='var(--text2)';
  if(score&&score.pct!=null){
    if(score.pct>=105){verdict=`${score.pct}% of your 4-week average — a strong session.`;vColor='var(--lime)';}
    else if(score.pct>=95){verdict=`${score.pct}% of your 4-week average — right on form.`;vColor='var(--lime)';}
    else if(score.pct>=85){verdict=`${score.pct}% of your average — a touch down, nothing alarming.`;vColor='#ffc107';}
    else {verdict=`${score.pct}% of your average — a light one. Worth noting why (sleep? time? how you felt?).`;vColor='#ffc107';}
  }
  const em=score&&score.effortMix;
  const effStr=(em&&em.rated>0)?`${em.easy} easy · ${em.solid} solid · ${em.tough} tough`:'';
  const recap=`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:14px;margin:8px 0 16px;text-align:left;">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px;">How you got on</div>
      <div style="font-size:13px;color:var(--text);line-height:1.6;">${totalSets} sets${volStr}${durStr}</div>
      ${verdict?`<div style="font-size:12px;color:${vColor};margin-top:6px;line-height:1.5;">${verdict}</div>`:''}
      ${effStr?`<div style="font-size:11px;color:var(--text3);margin-top:6px;">Effort: ${effStr}</div>`:''}
      ${skipped.length?`<div style="font-size:11px;color:var(--text3);margin-top:6px;">Skipped: ${skipped.join(', ')} — carried forward, no deload.</div>`:''}
      ${feel?`<div style="font-size:11px;color:var(--text3);margin-top:6px;">You came in feeling: ${feel}.</div>`:''}
      ${sessNote?`<div style="font-size:11px;color:var(--text2);margin-top:6px;font-style:italic;">"${(typeof _esc==='function'?_esc(sessNote):sessNote)}"</div>`:''}
    </div>`;
  const html=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:40px;text-align:center;">Workout complete</div>
    <div class="wm-title" style="text-align:center;font-size:32px;color:var(--green);margin-top:8px;">✓ ${w.name} DONE</div>
    <div style="text-align:center;font-size:40px;margin:16px 0;">🔥</div>
    ${recap}
    <div style="text-align:center;margin-bottom:14px;"><span onclick="wmAddSessionNote()" style="font-size:11px;color:var(--text3);text-decoration:underline;cursor:pointer;">+ add a note about today</span></div>
    <button class="wm-cta" onclick="finishGuidedWorkout()">FINISH</button>
  `;
  document.getElementById('wmContent').innerHTML=html;
  showToast('🔥 Session complete! Great work!');
}
