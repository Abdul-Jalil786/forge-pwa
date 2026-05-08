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

  // Date header with "Today" button when not on today
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
      <div class="rest-sub">${isToday?'Recovery is where the gains happen.<br>Walk, swim, sleep well.':isFuture?'Rest day — no training scheduled.':'Rest day.'}</div>
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
    <div style="font-size:12px;color:var(--text2);margin-bottom:6px;">${w.muscles}</div>`;

  if(prev){
    const prevDateLabel=new Date(prev.date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
    html+=`<div style="font-size:11px;color:var(--text3);margin-bottom:14px;">↺ Previous ${session.toUpperCase()}: ${prevDateLabel}</div>`;
  } else {
    html+=`<div style="margin-bottom:14px;"></div>`;
  }

  if(isFuture){
    html+=`<div class="card info" style="margin-bottom:10px;text-align:center;font-size:13px;color:var(--text2);padding:14px;">View only — log this on ${dateObj.toLocaleDateString('en-GB',{weekday:'long'})}.</div>`;
  }

  html+=`<div class="pb-wrap">
      <div class="pb-head"><span class="pb-lbl">Session Progress</span><span class="pb-pct">${pct}%</span></div>
      <div class="pb"><div class="pb-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="sec-label">Exercises — Tap to expand & log sets</div>
    <div id="exList">
      ${w.exercises.map(ex=>buildExItem(ex,dayLog,prev,isFuture)).join('')}
    </div>`;

  if(!isFuture){
    html+=`<button class="btn btn-lime btn-full" onclick="finishSession()" style="${done===w.exercises.length?'':'opacity:.35;pointer-events:none;'}">
      ${done===w.exercises.length?'✓ FINISH SESSION':`${done}/${w.exercises.length} EXERCISES DONE`}
    </button>`;
  }

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
    const key=d.toISOString().split('T')[0];
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
  const sets=data.sets||Array(ex.sets).fill(null).map(()=>({kg:'',reps:''}));
  const best=getBestLift(ex.id);

  // Previous session sets for this exercise
  let prevLine='';
  if(prevSession){
    const prevEx=prevSession.log[ex.id];
    if(prevEx?.sets?.length){
      const summary=prevEx.sets.filter(s=>s.kg||s.reps).map(s=>`${s.kg||'-'}kg × ${s.reps||'-'}`).join(', ');
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
        <div class="ex-meta">${ex.sets} sets × ${ex.reps} · Rest ${ex.rest}s${best?` · PB: ${best.kg}kg`:''}</div>
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
      <div style="display:grid;grid-template-columns:28px 1fr 1fr 28px;gap:5px;margin-bottom:5px;">
        <div class="set-col-hdr">SET</div><div class="set-col-hdr">KG</div><div class="set-col-hdr">REPS</div><div></div>
      </div>
      <div id="sets-${ex.id}">
        ${sets.map((s,i)=>buildSetRow(ex.id,i,s.kg,s.reps,readonly)).join('')}
      </div>
      ${readonly?'':`<button class="add-set" onclick="addSet('${ex.id}')">+ Add Set</button>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="saveSets('${ex.id}')">Save Sets</button>
        <button class="btn btn-blue btn-sm" style="flex:1" onclick="startTimer(${ex.rest},'${ex.name}')">⏱ Rest ${ex.rest}s</button>
      </div>`}
      ${best?`<div class="pb-best">🏆 Personal Best: ${best.kg}kg on ${fmtDate(best.date)}</div>`:''}
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
  if(!dayLog[exId])dayLog[exId]={done:false,sets:Array(ex.sets).fill(null).map(()=>({kg:'',reps:''}))};
  dayLog[exId].done=!dayLog[exId].done;
  saveExLogForDate(date,dayLog);
  renderWorkout();
  if(isViewingToday())renderToday();
}

function saveSets(exId){
  if(isViewingFuture())return;
  const date=getViewDate();
  const dayLog=getExLogForDate(date);
  if(!dayLog[exId])dayLog[exId]={done:true,sets:[]};
  const rows=document.querySelectorAll(`[id^="srow-${exId}-"]`);
  const sets=[];
  rows.forEach((_,i)=>{
    const kg=document.getElementById(`kg-${exId}-${i}`)?.value||'';
    const reps=document.getElementById(`reps-${exId}-${i}`)?.value||'';
    sets.push({kg:parseFloat(kg)||'',reps:parseInt(reps)||''});
  });
  dayLog[exId].sets=sets;
  saveExLogForDate(date,dayLog);
  showToast('Sets saved ✓');
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

// ============================================================
// REST TIMER
// ============================================================
let timerInterval=null;
let timerRemaining=0;
let timerTotal=0;
const CIRCUMFERENCE=2*Math.PI*90;

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
