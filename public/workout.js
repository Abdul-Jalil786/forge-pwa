// ============================================================
// WORKOUT PAGE
// ============================================================

function renderWorkout(){
  const session=getTodaySession();
  const el=document.getElementById('page-workout');
  if(!session){
    el.innerHTML=`
      <div class="rest-hero">
        <div class="rest-emoji">😴</div>
        <div class="rest-title">Rest Day</div>
        <div class="rest-sub">Recovery is where the gains happen.<br>Walk, swim, sleep well.</div>
      </div>
      <div class="sec-label">This Week's Schedule</div>
      ${renderWeekSched()}
    `;
    return;
  }
  const w=WORKOUTS[session];
  const dayLog=getTodayExLog();
  const done=w.exercises.filter(e=>dayLog[e.id]?.done).length;
  const pct=Math.round((done/w.exercises.length)*100);

  el.innerHTML=`
    <div class="week-pill"><div class="wp-dot"></div>${dayName()} — ${w.name}</div>
    <div class="pg-title">${w.name}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:14px;">${w.muscles}</div>
    <div class="pb-wrap">
      <div class="pb-head"><span class="pb-lbl">Session Progress</span><span class="pb-pct" id="wPct">${pct}%</span></div>
      <div class="pb"><div class="pb-fill" id="wBar" style="width:${pct}%"></div></div>
    </div>
    <div class="sec-label">Exercises — Tap to expand & log sets</div>
    <div id="exList">
      ${w.exercises.map(ex=>buildExItem(ex,dayLog)).join('')}
    </div>
    <button class="btn btn-lime btn-full" id="finishBtn" onclick="finishSession()"
      style="${done===w.exercises.length?'':'opacity:.35;pointer-events:none;'}" >
      ${done===w.exercises.length?'✓ FINISH SESSION':`${done}/${w.exercises.length} EXERCISES DONE`}
    </button>
  `;
}

function buildExItem(ex,dayLog){
  const data=dayLog[ex.id]||{};
  const done=!!data.done;
  const sets=data.sets||Array(ex.sets).fill(null).map(()=>({kg:'',reps:''}));
  const best=getBestLift(ex.id);

  return `
  <div class="ex-item${done?' done':''}" id="exi-${ex.id}">
    <div class="ex-hdr" onclick="toggleExpand('${ex.id}')">
      <div class="ex-chk" onclick="event.stopPropagation();toggleExDone('${ex.id}')">
        ${done?'<svg width="12" height="12" fill="none" stroke="#000" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>':''}
      </div>
      <div class="ex-info">
        <div class="ex-name">${ex.name}</div>
        <div class="ex-meta">${ex.sets} sets × ${ex.reps} · Rest ${ex.rest}s${best?` · PB: ${best.kg}kg`:''}</div>
      </div>
      <div class="ex-tag">${ex.muscle}</div>
    </div>
    <div class="ex-body" id="exb-${ex.id}">
      <div class="ex-gif" id="exgif-${ex.id}">
        <div class="ex-gif-placeholder">
          <div style="font-size:24px;margin-bottom:6px;">🎥</div>
          <div style="margin-bottom:8px;">${ex.name}</div>
          <a href="${ex.yt}" target="_blank" style="color:var(--blue);font-size:11px;text-decoration:none;">Watch form video →</a>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:28px 1fr 1fr 28px;gap:5px;margin-bottom:5px;">
        <div class="set-col-hdr">SET</div><div class="set-col-hdr">KG</div><div class="set-col-hdr">REPS</div><div></div>
      </div>
      <div id="sets-${ex.id}">
        ${sets.map((s,i)=>buildSetRow(ex.id,i,s.kg,s.reps)).join('')}
      </div>
      <button class="add-set" onclick="addSet('${ex.id}')">+ Add Set</button>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="saveSets('${ex.id}')">Save Sets</button>
        <button class="btn btn-blue btn-sm" style="flex:1" onclick="startTimer(${ex.rest},'${ex.name}')">⏱ Rest ${ex.rest}s</button>
      </div>
      ${best?`<div class="pb-best">🏆 Personal Best: ${best.kg}kg on ${fmtDate(best.date)}</div>`:''}
    </div>
  </div>`;
}

function buildSetRow(exId,idx,kg,reps){
  return `<div class="set-grid" id="srow-${exId}-${idx}">
    <div class="set-num">${idx+1}</div>
    <input class="set-inp" id="kg-${exId}-${idx}" value="${kg}" placeholder="kg" type="number" step="0.5" inputmode="decimal">
    <input class="set-inp" id="reps-${exId}-${idx}" value="${reps}" placeholder="reps" type="number" inputmode="numeric">
    <button class="set-del" onclick="delSet('${exId}',${idx})">×</button>
  </div>`;
}

function toggleExpand(exId){
  const item=document.getElementById('exi-'+exId);
  if(item)item.classList.toggle('expanded');
}

function toggleExDone(exId){
  const session=getTodaySession(); if(!session)return;
  const w=WORKOUTS[session];
  const ex=w.exercises.find(e=>e.id===exId); if(!ex)return;
  const dayLog=getTodayExLog();
  if(!dayLog[exId])dayLog[exId]={done:false,sets:Array(ex.sets).fill(null).map(()=>({kg:'',reps:''}))};
  dayLog[exId].done=!dayLog[exId].done;
  saveExLog(dayLog);
  renderWorkout();
  renderToday();
}

function saveSets(exId){
  const dayLog=getTodayExLog();
  if(!dayLog[exId])dayLog[exId]={done:true,sets:[]};
  const rows=document.querySelectorAll(`[id^="srow-${exId}-"]`);
  const sets=[];
  rows.forEach((_,i)=>{
    const kg=document.getElementById(`kg-${exId}-${i}`)?.value||'';
    const reps=document.getElementById(`reps-${exId}-${i}`)?.value||'';
    sets.push({kg:parseFloat(kg)||'',reps:parseInt(reps)||''});
  });
  dayLog[exId].sets=sets;
  saveExLog(dayLog);
  showToast('Sets saved ✓');
  // Update PB display
  renderWorkout();
}

function addSet(exId){
  const cont=document.getElementById('sets-'+exId);
  const count=cont.querySelectorAll('.set-grid').length;
  cont.insertAdjacentHTML('beforeend',buildSetRow(exId,count,'',''));
}

function delSet(exId,idx){
  const row=document.getElementById(`srow-${exId}-${idx}`);
  if(row)row.remove();
  const cont=document.getElementById('sets-'+exId);
  cont.querySelectorAll('.set-grid').forEach((r,i)=>{
    r.id=`srow-${exId}-${i}`;
    r.querySelector('.set-num').textContent=i+1;
    const kg=r.querySelectorAll('.set-inp')[0];
    const rp=r.querySelectorAll('.set-inp')[1];
    const dl=r.querySelector('.set-del');
    if(kg)kg.id=`kg-${exId}-${i}`;
    if(rp)rp.id=`reps-${exId}-${i}`;
    if(dl)dl.setAttribute('onclick',`delSet('${exId}',${i})`);
  });
}

function finishSession(){
  showToast('🔥 Session complete! Great work!');
  renderToday();
}

function renderWeekSched(){
  const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const today=dayOfWeek();
  const todayIdx=[1,2,3,4,5,6,0].indexOf(today);
  return days.map((d,i)=>{
    const s=SCHEDULE[i];
    const isToday=i===todayIdx;
    return `<div class="card${isToday?' hi':''}" style="padding:12px 14px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="font-family:'Archivo Black',sans-serif;font-size:16px;width:36px;color:${isToday?'var(--lime)':'var(--text2)'};">${d}</div>
        <div style="flex:1;">
          <div style="font-weight:600;font-size:13px;">${s?WORKOUTS[s].name:'Rest + Steps'}</div>
          <div style="font-size:11px;color:var(--text2);">10,000 steps${!s&&(i===1||i===3)?' · Swim':''}</div>
        </div>
        <span style="font-size:9px;font-weight:700;padding:3px 8px;border-radius:4px;${s?'background:rgba(200,255,0,.08);color:var(--lime);':'background:var(--s3);color:var(--text3);'}">${s?s.toUpperCase():'REST'}</span>
        ${isToday?'<span style="font-size:10px;font-weight:700;color:var(--lime);">TODAY</span>':''}
      </div>
    </div>`;
  }).join('');
}

// ============================================================
// REST TIMER
// ============================================================
let timerInterval=null;
let timerRemaining=0;
let timerTotal=0;
const CIRCUMFERENCE=2*Math.PI*90; // r=90

function startTimer(secs,exName){
  timerTotal=secs;
  timerRemaining=secs;
  document.getElementById('timerExName').textContent=exName;
  document.getElementById('timerNextSet').textContent='';
  document.getElementById('timerOverlay').classList.add('open');
  updateTimerDisplay();
  if(timerInterval)clearInterval(timerInterval);
  timerInterval=setInterval(()=>{
    timerRemaining--;
    if(timerRemaining<=0){
      timerRemaining=0;
      updateTimerDisplay();
      clearInterval(timerInterval);
      // Vibrate if available
      if(navigator.vibrate)navigator.vibrate([200,100,200]);
      document.getElementById('timerNextSet').textContent='GO! Start your next set';
      document.getElementById('timerCircle').style.stroke='var(--green)';
      setTimeout(stopTimer,2000);
    } else {
      updateTimerDisplay();
    }
  },1000);
}

function updateTimerDisplay(){
  const el=document.getElementById('timerNum');
  const circle=document.getElementById('timerCircle');
  if(el)el.textContent=timerRemaining;
  if(circle){
    const progress=(timerRemaining/timerTotal);
    const offset=CIRCUMFERENCE*(1-progress);
    circle.style.strokeDashoffset=offset;
    circle.style.strokeDasharray=CIRCUMFERENCE;
    circle.style.stroke=timerRemaining<=5?'var(--red)':'var(--lime)';
  }
}

function skipTimer(){stopTimer();}
function stopTimer(){
  if(timerInterval)clearInterval(timerInterval);
  document.getElementById('timerOverlay').classList.remove('open');
  const circle=document.getElementById('timerCircle');
  if(circle){circle.style.stroke='var(--lime)';circle.style.strokeDashoffset=0;}
}
