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
  const dayLogTop=getExLogForDate(date);
  // Phase 56: a make-up logged on a calendar rest day renders as that session type.
  const isMakeup=!session&&!!(dayLogTop._session&&(dayLogTop._session.makeup||dayLogTop._session.forDate));
  const renderSession=session||(isMakeup&&typeof _classifyLoggedSession==='function'?_classifyLoggedSession(dayLogTop):null);
  const el=document.getElementById('page-workout');
  const isToday=isViewingToday();
  const isFuture=isViewingFuture();
  const dateObj=new Date(date+'T12:00:00');
  const dateLabel=dateObj.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'});

  let html=renderWeekStrip();
  if(typeof renderPhaseBanner==='function')html+=renderPhaseBanner(false); // Phase 54
  html+=`<div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 14px;">
    <div>
      <div style="font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:1px;font-weight:700;">${isToday?'Today':isFuture?'Upcoming':'Past'}</div>
      <div style="font-family:'Archivo Black',sans-serif;font-size:18px;letter-spacing:-.3px;">${dateLabel}</div>
    </div>
    ${!isToday?`<button class="btn btn-ghost btn-sm" onclick="setViewDate(todayStr())">← Today</button>`:''}
  </div>`;

  // DEV-ONLY: start-any-workout panel (staging). Returns '' in production.
  html+=renderDevTestPanel();

  if(!renderSession){
    // Phase 56: on a rest/empty day, offer to make up an adjacent missed session
    // (or resume one already in progress). Never overwrites a scheduled session.
    if(isToday){
      const savedMu=(typeof _loadWmState==='function')?_loadWmState():null;
      if(savedMu&&savedMu.active){
        html+=`<button class="btn btn-lime btn-full" style="margin-bottom:12px;font-size:16px;padding:15px;" onclick="resumeGuidedWorkout()">▶ RESUME workout</button>`;
      }else{
        const missed=(typeof getMissedSession==='function')?getMissedSession(date):null;
        if(missed){
          const mw=getWorkout(missed.type);
          html+=`<div class="card" style="border-color:var(--orange);background:rgba(255,85,0,.05);margin-bottom:12px;">
            <div style="font-size:13px;font-weight:700;color:var(--orange);margin-bottom:4px;">↩️ Missed session</div>
            <div style="font-size:12px;color:var(--text2);margin-bottom:10px;line-height:1.5;">You didn't log your <b>${mw?mw.name:missed.type}</b> on ${fmtDate(missed.date)}. Make it up today — it logs against that session and <b>nothing else on your calendar moves</b>.</div>
            <button class="btn btn-lime btn-full" style="margin-bottom:6px;" onclick="startGuidedWorkout('${missed.type}','${missed.date}')">🔁 Make up ${mw?mw.name:missed.type}</button>
            <button class="btn btn-ghost btn-full" style="font-size:12px;color:var(--text3);" onclick="skipMissedSessionAndRefresh('${missed.date}','${missed.type}')">Skip it — leave the calendar as is</button>
          </div>`;
        }
      }
    }
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

  const w=getWorkout(renderSession);
  const dayLog=getExLogForDate(date);
  const done=w.exercises.filter(e=>dayLog[e.id]?.done).length;
  const pct=Math.round((done/w.exercises.length)*100);
  const prev=getPreviousSessionData(date,renderSession);

  html+=`<div class="pg-title">${w.name}${isMakeup?' <span style="font-size:12px;color:var(--lime);vertical-align:middle;">· MAKE-UP</span>':''}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:14px;">${w.muscles}${isMakeup&&dayLogTop._session.forDate?` · was due ${fmtDate(dayLogTop._session.forDate)}`:''}</div>`;

  // Phase 50: deterministic pre-session report (today's plan + last-session recap)
  if(isToday && !isFuture && session) html+=buildSessionReport(date,session);

  if(isToday && !isFuture){
    // Phase 41k: if a workout is minimized for today, show RESUME instead of START
    const saved=(typeof _loadWmState==='function')?_loadWmState():null;
    if(saved&&saved.active){
      const exName=(saved.exIdx!=null&&w.exercises[saved.exIdx])?w.exercises[saved.exIdx].name:'';
      const setInfo=(saved.mode==='set'&&saved.setIdx!=null)?` · Set ${saved.setIdx+1}`:'';
      const modeLabel=({outline:'overview',set:'lifting',rest:'resting',transition:'getting set',carrySwitch:'switching sides',effort:'rating effort','timed-effort':'rating effort',exDone:'between exercises'})[saved.mode]||'';
      html+=`<button class="btn btn-lime btn-full" style="margin-bottom:6px;font-size:17px;padding:16px;" onclick="resumeGuidedWorkout()">▶ RESUME${exName?` · ${exName}${setInfo}`:''}</button>
        <div style="text-align:center;margin-bottom:14px;"><span style="font-size:10px;color:var(--text3);">in progress · ${modeLabel}</span> · <span onclick="discardGuidedWorkout()" style="font-size:10px;color:var(--text3);text-decoration:underline;cursor:pointer;">discard</span></div>`;
    } else if(session) {
      html+=`<button class="btn btn-lime btn-full" style="margin-bottom:14px;font-size:17px;padding:16px;" onclick="startGuidedWorkout()">🚀 START WORKOUT</button>`;
    }
  }

  if(isFuture){
    html+=`<div class="card info" style="margin-bottom:10px;text-align:center;font-size:13px;color:var(--text2);padding:14px;">View only — log this on ${dateObj.toLocaleDateString('en-GB',{weekday:'long'})}.</div>`;
  }

  // Phase 70: deload banner on the day view — keyed on the VIEWED date, so a
  // previewed deload week is explained (reduced sets + ~60% load) even before you
  // start it, and a normal week viewed during a deload week shows nothing.
  if(typeof _isDeloadDate==='function' && _isDeloadDate(date)){
    html+=`<div style="background:rgba(255,152,0,.1);border:1px solid rgba(255,152,0,.4);border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:12px;color:var(--orange);line-height:1.5;">🔄 <strong>Deload week</strong> — planned recovery. Loads drop to ~60% and sets to 2 for the main lifts. Move well, leave reps in the tank; you come back stronger next week.</div>`;
  }

  html+=`<div class="pb-wrap">
      <div class="pb-head"><span class="pb-lbl">Session Progress</span><span class="pb-pct">${pct}%</span></div>
      <div class="pb"><div class="pb-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="sec-label">Exercises (tap to view/edit)</div>
    <div id="exList">${w.exercises.map(ex=>buildExItem(ex,dayLog,prev,isFuture,date)).join('')}</div>`;

  // Phase 41: mobility section under the exercise list (today only)
  if(isToday&&typeof renderStretchCards==='function')html+=renderStretchCards();

  el.innerHTML=html;
}

// Shift the viewed week forward/back by whole weeks (keeps the same weekday
// selected) so you can look ahead at next week's plan or back at history.
function shiftViewWeek(delta){
  const cur=new Date(getViewDate()+'T12:00:00');
  cur.setDate(cur.getDate()+delta*7);
  setViewDate(_ukDate(cur));
}
function goToThisWeek(){ setViewDate(todayStr()); }

function renderWeekStrip(){
  const days=[];
  // Monday–Sunday of the VIEWED week (so ‹ › navigation can move to other weeks).
  const anchor=new Date(getViewDate()+'T12:00:00');
  const aDow=anchor.getDay(); // 0=Sun
  const monOffset=aDow===0?-6:1-aDow;
  const monday=new Date(anchor);
  monday.setDate(anchor.getDate()+monOffset);
  for(let i=0;i<7;i++){
    const d=new Date(monday);d.setDate(monday.getDate()+i);
    days.push(d);
  }

  const initials=['M','T','W','T','F','S','S'];
  const viewing=getViewDate();
  const today=todayStr();

  // Header: ‹ prev · week label (+ "This week" reset) · next ›
  const mondayKey=_ukDate(monday);
  const todayMon=(()=>{const t=new Date(today+'T12:00:00');const dow=t.getDay();t.setDate(t.getDate()+(dow===0?-6:1-dow));return _ukDate(t);})();
  const weekDelta=Math.round((new Date(mondayKey+'T12:00:00')-new Date(todayMon+'T12:00:00'))/(7*86400000));
  const weekLabel=weekDelta===0?'This week':weekDelta===1?'Next week':weekDelta===-1?'Last week':(weekDelta>0?`In ${weekDelta} weeks`:`${-weekDelta} weeks ago`);
  const sunKey=_ukDate(days[6]);
  const rangeLabel=`${monday.toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – ${days[6].toLocaleDateString('en-GB',{day:'numeric',month:'short'})}`;
  let html=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
    <button onclick="shiftViewWeek(-1)" aria-label="Previous week" style="background:var(--s2);border:1px solid var(--border);border-radius:8px;color:var(--text2);width:34px;height:34px;cursor:pointer;font-size:16px;">‹</button>
    <div style="text-align:center;cursor:pointer;" onclick="goToThisWeek()">
      <div style="font-size:12px;font-weight:700;color:${weekDelta===0?'var(--lime)':'var(--text)'};">${weekLabel}</div>
      <div style="font-size:10px;color:var(--text3);">${rangeLabel}${weekDelta!==0?' · tap for today':''}</div>
    </div>
    <button onclick="shiftViewWeek(1)" aria-label="Next week" style="background:var(--s2);border:1px solid var(--border);border-radius:8px;color:var(--text2);width:34px;height:34px;cursor:pointer;font-size:16px;">›</button>
  </div>`;
  html+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:6px;">';
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

    const badge=session?({upper:'U',lower:'L',full:'F',home:'H',upperA:'UA',lowerA:'LA',upperB:'UB',lowerB:'LB',zone2:'Z2'}[session]||'•'):'·';
    html+=`<button onclick="setViewDate('${key}')" style="background:${bg};border:${border};border-radius:10px;padding:6px 0;color:${color};cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;font-family:'Archivo',sans-serif;">
      <div style="font-size:10px;font-weight:700;letter-spacing:.5px;">${initials[i]}</div>
      <div style="font-family:'Archivo Black',sans-serif;font-size:13px;line-height:1;">${badge}</div>
      <div style="font-size:9px;font-weight:600;opacity:.7;">${d.getDate()}</div>
    </button>`;
  });
  html+='</div>';
  return html;
}

// Phase 50: short "Nd ago" label from a date string.
function _daysAgoLabel(dateStr){
  if(!dateStr)return '';
  const today=new Date(todayStr()+'T12:00:00');
  const d=new Date(dateStr+'T12:00:00');
  const days=Math.round((today-d)/86400000);
  if(days<=0)return 'today';
  if(days===1)return 'yesterday';
  if(days<7)return days+'d ago';
  const wk=Math.round(days/7);
  return wk<=1?'1wk ago':wk+'wk ago';
}

// Phase 50: strength-tier chip for a lift (reuses the Track-page standards).
// Returns '' unless the lift has a standard AND we have bodyweight + age —
// so core/isolation lifts (Pallof, Dead Bug, plank) show nothing, by design.
function _exLevelChip(exId){
  if(typeof STRENGTH_STD==='undefined'||!STRENGTH_STD[exId])return '';
  if(typeof _bestEstimated1RM!=='function'||typeof _classifyLift!=='function'||typeof _ageAdjustFactor!=='function')return '';
  const personal=(STATE.profile||{}).personal||{};
  const age=personal.age, sexKey=personal.sex==='female'?'female':'male';
  const wl=STATE.weightLog||[], bl=STATE.bfLog||[];
  const cw=wl.length?wl[wl.length-1].weight:null;
  const cbf=bl.length?bl[bl.length-1].bf:null;
  const lbm=(cw&&cbf)?cw*(1-cbf/100):null;
  if(!cw||!age)return '';
  const est=_bestEstimated1RM(exId);
  if(!est)return '';
  const cls=_classifyLift(est,cw,lbm,_ageAdjustFactor(age),STRENGTH_STD[exId][sexKey]||STRENGTH_STD[exId].male);
  if(!cls)return '';
  return `<span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${cls.color};white-space:nowrap;">${cls.label}</span>`;
}

// Phase 50: deterministic pre-session report shown above START WORKOUT (today
// only). Today's plan + a recap of the last same-type session — all from local
// data, no AI call. The AI strategy brief still fires when you tap START.
function buildSessionReport(date,session){
  const w=getWorkout(session);
  if(!w)return '';
  const prev=(typeof getPreviousSessionData==='function')?getPreviousSessionData(date,session):null;
  let lastBlock;
  if(prev){
    const score=(prev.log._session&&prev.log._session.score)||((typeof computeSessionScore==='function')?computeSessionScore(prev.date,session):null);
    const vol=(typeof computeSessionVolume==='function')?computeSessionVolume(prev.log):0;
    let setCount=0;
    for(const [k,ex] of Object.entries(prev.log)){
      if(k.startsWith('_')||!ex||!Array.isArray(ex.sets))continue;
      setCount+=ex.sets.filter(s=>s.done&&(s.kg||s.reps||s.seconds)).length;
    }
    const pct=score?score.pct:null;
    let verdict='',dot='';
    if(pct!=null){
      if(pct>=105){verdict='Strong last time — match or beat it.';dot='🟢';}
      else if(pct>=95){verdict='Right on form last time — repeat it.';dot='🟢';}
      else if(pct>=85){verdict='A touch down last time — bring it today.';dot='🟡';}
      else {verdict='A light one last time — let\'s go.';dot='🟡';}
    }
    const em=score?score.effortMix:null;
    const effStr=(em&&em.rated>0)?`${em.easy} easy · ${em.solid} solid · ${em.tough} tough`:'';
    const dlabel=new Date(prev.date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
    const metaBits=[];
    if(vol>0)metaBits.push(`${Math.round(vol).toLocaleString()} kg`);
    if(setCount)metaBits.push(`${setCount} sets`);
    if(pct!=null)metaBits.push(`${dot} ${pct}% of 4-wk avg`);
    lastBlock=`
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-top:11px;">Last ${w.name.toLowerCase()} · ${_daysAgoLabel(prev.date)} · ${dlabel}</div>
      ${metaBits.length?`<div style="font-size:13px;color:var(--text);margin-top:3px;">${metaBits.join(' · ')}</div>`:''}
      ${effStr?`<div style="font-size:11px;color:var(--text3);margin-top:3px;">Effort: ${effStr}</div>`:''}
      ${verdict?`<div style="font-size:12px;color:var(--lime);margin-top:5px;">${verdict}</div>`:''}`;
  } else {
    lastBlock=`<div style="font-size:12px;color:var(--text3);margin-top:11px;">First ${w.name.toLowerCase()} logged here — we'll track from today. 💪</div>`;
  }
  return `<div class="card" style="margin-bottom:14px;border-color:var(--border2);padding:12px 14px;">
    <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Today's session</div>
    <div style="font-size:13px;color:var(--text);margin-top:3px;">${w.exercises.length} exercises · ~${w.duration} min</div>
    ${lastBlock}
  </div>`;
}

function buildExItem(ex,dayLog,prevSession,readonly,refDate){
  const data=dayLog[ex.id]||{};
  const done=!!data.done;
  const timed=isTimeBased(ex);
  const sets=data.sets||Array(_effectiveSets(ex,refDate)).fill(null).map(()=>timed?{seconds:''}:{kg:'',reps:''});
  const best=getBestLift(ex.id);
  const bestStr=best?(timed?`PB: ${fmtSec(best.seconds)}`:`PB: ${best.kg}kg`):'';
  const bestDetail=best?(timed?`🏆 Personal Best: ${fmtSec(best.seconds)} on ${fmtDate(best.date)}`:`🏆 Personal Best: ${best.kg}kg on ${fmtDate(best.date)}`):'';

  // Phase 50: last-session summary + strength level, now shown ALWAYS-VISIBLE
  // under the plan line (was previously only inside the expanded body).
  // History is keyed on the EXERCISE ID, not the session type: the same-type
  // prevSession is preferred, but if it doesn't contain this lift (e.g. after a
  // programme switch the old 'upper' sessions no longer match 'upperA'), fall
  // back to the most recent session of ANY type that logged it — so months of
  // real history never render as "no history yet".
  let histSession=(prevSession&&prevSession.log[ex.id]&&(prevSession.log[ex.id].sets||[]).length)?prevSession:null;
  if(!histSession&&typeof getLastExercisePerformance==='function'){
    histSession=getLastExercisePerformance(ex.id, refDate||(typeof todayStr==='function'?todayStr():'9999-12-31'));
  }
  let lastSummary='';
  if(histSession){
    const prevEx=histSession.log[ex.id];
    if(prevEx?.sets?.length){
      if(typeof isCarry==='function'&&isCarry(ex)){ // Phase 53: "L 38s/R 35s" per set
        lastSummary=prevEx.sets.filter(s=>s.leftSeconds!=null||s.rightSeconds!=null).map(s=>`L${s.leftSeconds||0}s/R${s.rightSeconds||0}s`).join(' · ');
      }else{
        lastSummary=timed
          ?prevEx.sets.filter(s=>s.seconds).map(s=>fmtSec(s.seconds)).join(', ')
          :prevEx.sets.filter(s=>s.kg||s.reps).map(s=>`${s.kg||'-'}×${s.reps||'-'}`).join(', ');
      }
    }
  }
  const levelChip=_exLevelChip(ex.id);
  const daysAgo=histSession?_daysAgoLabel(histSession.date):'';
  let lastLine='';
  if(lastSummary||levelChip){
    const left=lastSummary
      ?`<span style="color:var(--blue);">↺ Last: ${lastSummary}${daysAgo?` · ${daysAgo}`:''}</span>`
      :`<span style="color:var(--text3);">no history yet</span>`;
    lastLine=`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;margin-top:4px;">${left}${levelChip}</div>`;
  }

  return `
  <div class="ex-item${done?' done':''}" id="exi-${ex.id}">
    <div class="ex-hdr" onclick="toggleExpand('${ex.id}')">
      <div class="ex-chk" onclick="event.stopPropagation();${readonly?'':`toggleExDone('${ex.id}')`}">
        ${done?'<svg width="12" height="12" fill="none" stroke="#000" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>':''}
      </div>
      <div class="ex-info">
        <div class="ex-name">${ex.name}</div>
        <div class="ex-meta">${_effectiveSets(ex,refDate)} sets × ${ex.reps} · Rest ${ex.rest}s${bestStr?' · '+bestStr:''}</div>
        ${lastLine}
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
  const w=getWorkout(session);
  const ex=w.exercises.find(e=>e.id===exId); if(!ex)return;
  const dayLog=getExLogForDate(date);
  if(!dayLog[exId])dayLog[exId]={done:false,sets:Array(_effectiveSets(ex,date)).fill(null).map(()=>isTimeBased(ex)?{seconds:''}:{kg:'',reps:''})};
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
let wm = { active:false, exIdx:0, setIdx:0, mode:'outline', restTarget:0, restStarted:0, restInterval:null, setStartedAt:0, postExercise:false, mobDrillId:'mob_deepsquat' };

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

// ── DEV-ONLY (staging) ────────────────────────────────────────────────────────
// Start any workout on demand, ignoring the schedule, so changes can be tested
// without waiting for a scheduled day. Both the panel and this entry point are
// hard-gated on the server's isDev flag (window.__ENV__.isDev), so in production
// the panel is never rendered AND this function is a no-op even if called.
function renderDevTestPanel(){
  if(!(window.__ENV__ && window.__ENV__.isDev) || typeof WORKOUTS!=='object') return '';
  const btns=Object.keys(WORKOUTS).map(k=>
    `<button class="btn btn-ghost btn-sm" style="margin:3px;font-size:11px;" onclick="devStartWorkout('${k}')">${WORKOUTS[k].name}</button>`
  ).join('');
  const today=(typeof todayStr==='function')?todayStr():'';
  const logged=Object.keys((STATE.exLog||{})[today]||{}).filter(k=>k[0]!=='_').length;
  return `<div class="card" style="border:1px dashed var(--orange);background:rgba(255,85,0,.06);margin-bottom:14px;">
    <div style="font-size:11px;font-weight:800;color:var(--orange);letter-spacing:1px;margin-bottom:3px;">🧪 DEV · TEST SESSIONS</div>
    <div style="font-size:10px;color:var(--text3);margin-bottom:8px;line-height:1.5;">Staging only — start any session on demand (ignores the schedule). Runs the real guided flow, including the Easy / Solid / Tough effort screen.</div>
    <div style="display:flex;flex-wrap:wrap;">${btns}</div>
    <button class="btn btn-ghost btn-sm" style="margin-top:8px;width:100%;font-size:11px;color:var(--red);border-color:var(--red);" onclick="devClearToday()">🧹 Clear today's training${logged?` (${logged} logged)`:''}</button>
  </div>`;
}
function devStartWorkout(type){
  if(!(window.__ENV__ && window.__ENV__.isDev)) return; // hard guard — never runs in production
  if(!WORKOUTS[type]) return;
  startGuidedWorkout(type);
}
// DEV-ONLY: wipe today's logged training (sets, session, rest-gap fillers) AND any
// in-progress guided session, so a test can be re-run from scratch. Hard-gated on
// isDev; never available in production.
function devClearToday(){
  if(!(window.__ENV__ && window.__ENV__.isDev)) return;
  const date=todayStr();
  if(!confirm(`Clear ALL of today's logged training (${date})? This wipes every set logged today so you can re-test. (dev only)`))return;
  // Bin any in-progress guided session first.
  try{ if(typeof wm==='object'&&wm){wm.active=false; if(wm.restInterval)clearInterval(wm.restInterval);} }catch(e){}
  try{ localStorage.removeItem('forge_active_workout'); }catch(e){}
  const wmEl=document.getElementById('workoutMode'); if(wmEl)wmEl.classList.remove('open');
  // Wipe today's exercise log (empty object → server + local).
  if(typeof saveExLogForDate==='function')saveExLogForDate(date,{});
  if(typeof showToast==='function')showToast("Today's training cleared — start fresh");
  if(typeof renderWorkout==='function')renderWorkout();
  if(typeof renderToday==='function')renderToday();
}
// ──────────────────────────────────────────────────────────────────────────────

function startGuidedWorkout(overrideSession,forDate){
  // Phase 41k: if there's already a minimized in-progress session for today, resume it
  const saved=(typeof _loadWmState==='function')?_loadWmState():null;
  if(saved&&saved.active){resumeGuidedWorkout();return;}
  // Phase 56: overrideSession + forDate let a MISSED session be made up on a rest day.
  const session=overrideSession||getTodaySession(); if(!session)return showToast('Rest day — no workout');
  wm = { active:true, exIdx:0, setIdx:0, mode:'outline', session, restTarget:0, restStarted:0, restInterval:null, setStartedAt:0, makeupForDate:forDate||null, postExercise:false, mobDrillId:'mob_deepsquat' };
  _saveWmState();
  _wmStartAutoSave();
  document.getElementById('workoutMode').classList.add('open');
  _renderWmEntry();
}

// Phase 56: mark a missed session skipped (calendar stays untouched) and refresh.
function skipMissedSessionAndRefresh(date,type){
  const nm=(WORKOUTS[type]&&WORKOUTS[type].name)||type;
  if(!confirm(`Skip the missed ${nm} from ${fmtDate(date)}? Your calendar stays exactly as it is — later sessions don't move.`))return;
  if(typeof skipMissedSession==='function')skipMissedSession(date,type);
  showToast('Marked skipped — calendar unchanged');
  if(typeof renderWorkout==='function')renderWorkout();
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
  if(typeof _kbClearTimer==='function')_kbClearTimer(); if(typeof _kbWakeRelease==='function')_kbWakeRelease(); // Phase 92: stop EMOM timer + release wake lock
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
    case 'carrySwitch':   renderWmCarrySwitch(); break;
    case 'effort':        { const _ex=getWorkout(wm.session)?.exercises?.[wm.exIdx];
                            ((typeof isCarry==='function'&&_ex&&isCarry(_ex))?renderWmCarryEffort:renderWmEffort)(); break; }
    case 'timed-effort':  renderWmTimedEffort(); break;
    case 'exDone':        renderWmExerciseDone(); break;
    // Phase 92: don't resume a live EMOM mid-round — return to its start screen.
    case 'kbStart':
    case 'kbRun':
    case 'kbDone':        if(wm.kb&&wm.kb.interval){clearInterval(wm.kb.interval);wm.kb.interval=null;} renderWmKbStart(kbSuggestion((typeof getKbLoad==='function')?getKbLoad():20)); break;
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

// Phase 60: scheduled deload (upper-lower-5d-fixed only) — every 5th week,
// anchored to the user's own programmeStartDate. Reads STATE for the active
// programme; returns {weekInCycle,isDeload} or null (so it's a total no-op for
// every other programme). Pure maths live in programme-shared.deloadWeekInfo.
function _scheduledDeload(dateStr){
  if(typeof STATE==='undefined'||!STATE.profile)return null;
  if(STATE.profile.programId!=='upper-lower-5d-fixed')return null;
  if(typeof FORGE_PROGRAMME==='undefined'||!FORGE_PROGRAMME.deloadWeekInfo)return null;
  return FORGE_PROGRAMME.deloadWeekInfo(STATE.profile.programmeStartDate,dateStr);
}
// Phase 70: user-configured deload cadence — program-agnostic, decoupled from the
// training rotation. profile.deloadConfig = {enabled, everyWeeks, anchorMonday}.
// A deload week recurs every `everyWeeks` weeks from `anchorMonday` (a Monday),
// forward only. Returns {weekIdx,everyWeeks,isDeload} or null when not configured.
function _manualDeloadInfo(dateStr){
  if(typeof STATE==='undefined'||!STATE.profile)return null;
  const cfg=STATE.profile.deloadConfig;
  if(!cfg||!cfg.enabled||!cfg.anchorMonday||!dateStr)return null;
  const every=parseInt(cfg.everyWeeks)||8;
  if(every<1)return null;
  const start=new Date(cfg.anchorMonday+'T12:00:00');
  const target=new Date(dateStr+'T12:00:00');
  const days=Math.floor((target-start)/86400000);
  if(days<0)return null; // before the anchor week: cadence hasn't started
  const weekIdx=Math.floor(days/7);
  return { weekIdx, everyWeeks:every, isDeload:(weekIdx%every)===0 };
}
// Unified resolver: an explicit user config (when enabled) wins over the built-in
// 5-day-program schedule, so a manual cadence fully governs when it's set.
function _deloadInfoFor(dateStr){
  const m=_manualDeloadInfo(dateStr);
  if(m)return m;
  return _scheduledDeload(dateStr);
}
// Is any deload cadence active for this user (config OR built-in 5-day program)?
function _deloadActiveForUser(){
  if(typeof STATE==='undefined'||!STATE.profile)return false;
  const cfg=STATE.profile.deloadConfig;
  return !!((cfg&&cfg.enabled)||STATE.profile.programId==='upper-lower-5d-fixed');
}
function _isDeloadDate(dateStr){ const d=_deloadInfoFor(dateStr); return !!(d&&d.isDeload); }
function isDeloadWeekToday(){ return _isDeloadDate(typeof todayStr==='function'?todayStr():null); }
// Prescribed set count for a session: a deload week caps weighted lifts at 2
// sets. Rehab / cardio / timed holds keep their template set count. Pass the
// date being rendered so a previewed future/past day reflects THAT week's deload
// state (Phase 70); omit it and it falls back to today (guided mode is today-only).
function _effectiveSets(ex,dateStr){
  if(!ex)return 3;
  const deload=dateStr?_isDeloadDate(dateStr):isDeloadWeekToday();
  if(deload&&!_isRehabOrCardio(ex)&&!isTimeBased(ex))return 2;
  return ex.sets;
}
// Rehab + cardio are exempt from load progression AND scheduled deload.
function _isRehabOrCardio(exObj){ return !!(exObj&&(exObj.category==='rehab'||exObj.cardio||exObj.size==='cardio')); }
// Most-frequent (modal) working weight an exercise was logged at in one session.
function _modalKgOf(session,exId){
  const sets=((session&&session.log&&session.log[exId]&&session.log[exId].sets)||[]).filter(s=>s.kg&&s.reps);
  if(!sets.length)return null;
  const c={}; for(const s of sets){const k=String(parseFloat(s.kg));c[k]=(c[k]||0)+1;}
  const e=Object.entries(c).map(([k,n])=>({kg:parseFloat(k),count:n}));
  e.sort((a,b)=>b.count-a.count||b.kg-a.kg);
  return e[0].kg;
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
  let dir, kgNext, repsNext, msg;
  const variants=(arr)=>arr[(setIdx||0)%arr.length];
  // Order matters: reps-missed and Tough are checked BEFORE the "topped the range"
  // bumps, so a set rated tough NEVER goes up — even at the top of the range.
  // Mirrors the session-to-session rule (any Tough set = at/near failure → hold).
  // Each branch sets an explicit `repsNext` target that matches the same
  // double-progression philosophy as _suggestWeightCore, so the next-set prefill
  // (renderWmSet/renderWmTransition) shows a rep target consistent with the
  // guidance — kg is UNCHANGED, only the rep target is now always populated.
  if(reps<lower){
    // Reps missed → drop weight. At the lighter load the range top is an
    // achievable target to nail cleanly (same intent as the stall-deload path).
    dir='down'; kgNext=Math.max(0,_roundToPlate(kg-inc.fail)); repsNext=upper;
    msg=variants([
      `Reps fell short. Back off to ${kgNext}kg — quality over ego, every rep clean.`,
      `That got away from you. Drop to ${kgNext}kg and nail the reps.`,
    ]);
  } else if(effort==='tough'){
    // In range but a grind → hold BOTH weight and reps, repeat the set.
    dir='hold'; kgNext=kg; repsNext=reps;
    msg=variants([
      `A grind, but the reps were there. Hold ${kg}kg — match it, don't chase.`,
      `Hard-earned. Stay at ${kg}kg, same reps. Don't let form slip.`,
    ]);
  } else if(reps>=upper && effort==='easy'){
    // Topped, easy → +weight and RESET reps to the floor to work back up
    // (double progression). Was previously showing the range top — backwards.
    dir='up'; kgNext=_roundToPlate(kg+inc.easy); repsNext=lower;
    msg=variants([
      `Too light — you topped the range and it flew. ${kgNext}kg next set. Earn it.`,
      `That was easy money. Add ${inc.easy}kg → ${kgNext}kg. Make it count.`,
    ]);
  } else if(reps>=upper){
    // Topped, solid → +weight, reps reset to the floor.
    dir='up'; kgNext=_roundToPlate(kg+inc.solid); repsNext=lower;
    msg=variants([
      `Topped the range clean. Nudge to ${kgNext}kg and own it.`,
      `Full range, controlled. ${kgNext}kg next — small step, no ego.`,
    ]);
  } else {
    // In range, not topped → hold weight, aim ONE more rep (capped at the top).
    dir='hold'; kgNext=kg; repsNext=Math.min(upper, reps+1);
    msg=variants([
      `Dialled in. Stay at ${kg}kg — aim ${upper} reps, make this set look like the last.`,
      `Right in the pocket. ${kg}kg again, push for ${upper}.`,
    ]);
  }
  // reps is NEVER undefined; final guard keeps it a sane integer within the range.
  if(!Number.isFinite(repsNext)) repsNext=lower;
  return { dir, kg:kgNext, reps:repsNext, msg };
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
  core_pallof:'Press straight out from the chest and hold — resist the rotation, brace, don\'t twist.',
  core_suitcase:'Single-arm carry. Go heavier on the LEFT side to correct left/right asymmetry. Stay tall, no leaning.',
  neck_ext:'Light cable, slow controlled extension — small range, never crank or jerk the neck.',
  neck_front:'Tuck the chin toward the chest under light tension — slow and smooth, no snapping.',
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
  // Phase 60: prefer the CURRENT session's template exercise (opts.exObj) so the
  // rep range / size / increments come from the programme being trained today —
  // the same id (e.g. Shoulder Press) has different ranges across templates.
  const exObj=((opts&&opts.exObj&&opts.exObj.id===exId)?opts.exObj:null)||getAllExercises().find(e=>e.id===exId);
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
  // Phase 60: cross-type carryover. If no SAME-type session has this exercise
  // (e.g. a shared id moved into a new programme's session), fall back to the
  // most recent session of ANY type that logged it — so history carries over.
  if(!_hasEx(prevSession)&&typeof getLastExercisePerformance==='function'){
    const _xfer=getLastExercisePerformance(exId,(opts&&opts.forDate)||(typeof todayStr==='function'?todayStr():'9999-12-31'));
    if(_hasEx(_xfer))prevSession=_xfer;
  }
  // Progression REFERENCES are per-exercise, keyed on the id across ALL session
  // types. The same-type prevSessions (from getPreviousSessions) go blank after a
  // programme switch, which would blind stall-detection and the deload-base
  // lookup to months of real history. Replace them with every session that
  // logged THIS exercise (any type), most recent first — this is a SUPERSET of
  // the same-type sessions that contain the lift, and it's exercise-pure so
  // detectStall never breaks early on a session that simply omitted this lift.
  // Session-type filtering stays only where it's genuinely session-scoped (the
  // recap card, make-up logic).
  if(typeof getExercisePreviousSessions==='function'){
    const _fd=(opts&&opts.forDate)||(typeof todayStr==='function'?todayStr():'9999-12-31');
    const _all=getExercisePreviousSessions(exId,_fd,8);
    if(_all.length){
      // Rep-range-aware per day (Phase 60b). On an undulating split a lift can
      // carry a different rep target on different days (Leg Press 8–10 on Lower
      // A, 10–12 on Lower B). The right weight for 8 reps is NOT the right weight
      // for 12, so a low-rep-day weight must neither seed nor be judged on a
      // high-rep day. Prefer history logged under the SAME rep range as today's
      // session; fall back to all history only when today's range has never been
      // trained (genuine first-time calibration for this rep target). This keeps
      // cross-programme carryover intact (same lift + same range still links).
      let _ref=_all;
      const _todayKey=(typeof _repRangeKey==='function')?_repRangeKey(exObj.reps):null;
      if(_todayKey&&typeof _sessionRepRangeFor==='function'){
        const _match=_all.filter(s=>_repRangeKey(_sessionRepRangeFor(exId,s.log))===_todayKey);
        if(_match.length)_ref=_match;
      }
      opts=Object.assign({},opts,{prevSessions:_ref});
      const _prevKey=(prevSession&&prevSession.log&&_todayKey&&typeof _sessionRepRangeFor==='function')?_repRangeKey(_sessionRepRangeFor(exId,prevSession.log)):null;
      if(!_hasEx(prevSession)||(_todayKey&&_prevKey!==_todayKey))prevSession=_ref[0];
    }
  }

  // Phase 60 + 70: scheduled-deload overlay. HIGHEST precedence — overrides
  // double-progression AND reactive stall-deload. Applies to the built-in 5-day
  // schedule OR a user-configured cadence (profile.deloadConfig, Phase 70).
  // Deload-week sessions are excluded from the progression reference, so the week
  // AFTER a deload builds off the last real (non-deload) working weight, not 60%.
  const _forDate=(opts&&opts.forDate)||(typeof todayStr==='function'?todayStr():null);
  const _dlToday=_forDate?_deloadInfoFor(_forDate):null;
  const _fiveDay=_deloadActiveForUser();
  const _cands=[]; if(prevSession&&prevSession.date)_cands.push(prevSession);
  if(opts&&Array.isArray(opts.prevSessions))for(const s of opts.prevSessions){ if(s&&s.date&&!_cands.some(c=>c.date===s.date))_cands.push(s); }
  const _nonDeload=_fiveDay?_cands.filter(s=>!_isDeloadDate(s.date)):_cands;
  if(_dlToday&&_dlToday.isDeload&&!_isRehabOrCardio(exObj)){
    const _base=_nonDeload.find(s=>_modalKgOf(s,exId)!=null)||_cands.find(s=>_modalKgOf(s,exId)!=null);
    const _baseKg=_base?_modalKgOf(_base,exId):null;
    if(_baseKg!=null){
      const _rm=String(exObj.reps).match(/(\d+)/);
      const _lo=_rm?parseInt(_rm[1]):8;
      const _dk=_roundToPlate(_baseKg*0.60);
      return { kg:_dk, reps:_lo, dir:'down', deload:true, scheduledDeload:true, setsOverride:2,
        reason:`Deload week — 60% of ${_baseKg}kg, 2 light sets. Move well, leave reps in the tank.` };
    }
  }
  // Not a deload week today: never reference a deload (60%) session for progression.
  if(_fiveDay&&(!_dlToday||!_dlToday.isDeload)&&prevSession&&prevSession.date&&_isDeloadDate(prevSession.date)&&_nonDeload.length){
    prevSession=_nonDeload[0];
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

  // Check 2: stall detection (needs multi-session data). On the 5-day split,
  // deload weeks are excluded so a planned 60% week never counts as a "stall".
  if(opts?.prevSessions){
    const stall = detectStall(exId, exObj, _fiveDay?(_nonDeload.length?_nonDeload:opts.prevSessions):opts.prevSessions);
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

  // Check 3: smart progression with per-lift increments.
  // Rule: weight only goes UP on Easy or Solid sessions that reach the top of the
  // rep range. ANY set rated Tough = at/near failure -> HOLD weight + reps and repeat
  // next session. Never auto-deload on a single session — the 3-session stall detector
  // (Check 2 above) owns all deloads.
  if(hasEffort){
    const allEasy=efforts.every(e=>e==='easy');
    const anyTough=efforts.some(e=>e==='tough');
    if(anyTough){
      return { kg:lastKg, reps:lastReps, reason:`Hold ${lastKg}kg × ${lastReps} — was tough, repeat it (last: ${prevSummary}${workingSummary})`, dir:null };
    }
    if(allEasy&&allHitUpper){
      return { kg:_roundToPlate(lastKg+inc.easy), reps:lowerRep, reason:`+${inc.easy}kg ↑ (last: ${prevSummary}${workingSummary}, felt easy)`, dir:'up' };
    }
    if(allHitUpper){
      return { kg:_roundToPlate(lastKg+inc.solid), reps:lowerRep, reason:`+${inc.solid}kg ↑ (last: ${prevSummary}${workingSummary}, solid)`, dir:'up' };
    }
    const t=Math.min(upperRep, lastReps+1);
    return { kg:lastKg, reps:t, reason:`Same weight, aim ${t} reps (last: ${prevSummary}${workingSummary})`, dir:null };
  }

  // No effort rating: hit top of range -> small bump; otherwise hold and climb reps.
  if(allHitUpper)  return { kg:_roundToPlate(lastKg+inc.solid), reps:lowerRep, reason:`+${inc.solid}kg ↑ (last: ${prevSummary}${workingSummary})`, dir:'up' };
  const targetReps = Math.min(upperRep, lastReps+1);
  return { kg:lastKg, reps:targetReps, reason:`Same weight, target ${targetReps} reps (last: ${prevSummary}${workingSummary})`, dir:null };
}

function suggestTime(exId,exObj,prevSession,setIdx,opts){
  // Phase 60: Zone 2 cardio works in MINUTES — nudge toward the target, hard-cap
  // at capMin, never a weight progression. Duration still stored in `seconds` so
  // it reuses the timed set infra; `minutes` + cardio flag drive the display.
  if(exObj&&exObj.cardio){
    const cm=String(exObj.reps).match(/(\d+)[–-](\d+)/);
    const loMin=cm?parseInt(cm[1]):40, hiMin=cm?parseInt(cm[2]):45;
    const cap=exObj.capMin||hiMin;
    const cs=((prevSession&&prevSession.log[exId]&&prevSession.log[exId].sets)||[]).filter(s=>s.seconds||s.minutes);
    if(!cs.length)return{seconds:loMin*60,minutes:loMin,reason:`Walk ${loMin}–${hiMin} min at an easy, conversational (Zone 2) pace`,dir:null,timed:true,cardio:true};
    const lastMin=cs[0].minutes?parseInt(cs[0].minutes):Math.round(parseInt(cs[0].seconds)/60);
    if(lastMin>=cap)return{seconds:cap*60,minutes:cap,reason:`Hold ${cap} min — at your Zone 2 target`,dir:null,timed:true,cardio:true};
    const nextMin=Math.min(cap,lastMin+5);
    return{seconds:nextMin*60,minutes:nextMin,reason:`Aim ${nextMin} min (build to ${cap})`,dir:'up',timed:true,cardio:true};
  }
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
  // Phase 69: optional per-exercise duration ceiling (e.g. mobility holds cap at
  // 120s). Uncapped exercises (plank, wall-sit) keep cap=Infinity → unchanged.
  const cap=(exObj&&exObj.capSeconds)?exObj.capSeconds:Infinity;
  // climb to `target`, clamped at the cap. At/over the cap → stop suggesting more.
  const climb=(target,note)=>{
    const n=Math.min(target,cap);
    if(n<=lastSec)return{seconds:cap===Infinity?lastSec:cap,reason:`Hold ${fmtSec(cap===Infinity?lastSec:cap)} — at your ${cap===Infinity?'':cap+'s '}${cap===Infinity?'level':'mobility cap'}`,dir:null,timed:true,capped:cap!==Infinity};
    return{seconds:n,reason:note(n),dir:'up',timed:true};
  };

  if(opts?.lowRecovery){
    return{seconds:lastSec,reason:`Hold ${fmtSec(lastSec)} — low recovery (${opts.recoveryReason}). Focus on form.`,dir:null,timed:true,recovery:'low'};
  }
  // Tough = at limit -> hold and repeat (mirrors the weighted-lift rule).
  if(effort==='tough'){
    return{seconds:lastSec,reason:`Hold ${fmtSec(lastSec)} — was tough, repeat it`,dir:null,timed:true};
  }
  // Easy/Solid AND held the full prescribed time -> add time (easy = bigger jump).
  if(allHitPrescribed&&effort==='easy'){
    return climb(lastSec+10,(n)=>`Try ${fmtSec(n)} — beat last ${fmtSec(lastSec)} (felt easy)`);
  }
  if(allHitPrescribed&&effort==='solid'){
    return climb(lastSec+5,(n)=>`Try ${fmtSec(n)} — beat last ${fmtSec(lastSec)} (solid)`);
  }
  // Didn't reach prescribed time, or unrated -> hold and repeat. No single-session deload.
  if(!allHitPrescribed){
    return{seconds:lastSec,reason:`Hold ${fmtSec(lastSec)} — match last (last: ${prevSummary})`,dir:null,timed:true};
  }
  return climb(lastSec+5,(n)=>`Try ${fmtSec(n)} — beat last ${fmtSec(lastSec)}`);
}

function renderWmOutline(){
  const w=getWorkout(wm.session);
  const date=todayStr();
  const outlineDayLog=getExLogForDate(date); // Phase 63: reflect anything done during rest on resume
  const prev=getPreviousSessionData(date,wm.session);
  const prevSessions=getPreviousSessions(date,wm.session,5);
  const gate=effectiveRecoveryGate(); // Phase 44: honours the user's train/easy choice
  const opts={ lowRecovery: gate.lowRecovery, recoveryReason: gate.reason, prevSessions };
  const banner = gate.overridden==='train'
    ? `<div style="background:rgba(200,255,0,.06);border:1px solid rgba(200,255,0,.25);border-radius:10px;padding:12px 14px;margin-bottom:20px;font-size:12px;color:var(--text2);line-height:1.5;">⚡ Low recovery flagged (${gate.reason}) — <strong style="color:var(--lime);">you chose to train as planned.</strong> Normal prescriptions below; listen to your body set to set.</div>`
    : gate.lowRecovery
    ? `<div style="background:rgba(255,193,7,.12);border:1px solid rgba(255,193,7,.4);border-radius:10px;padding:12px 14px;margin-bottom:20px;font-size:12px;color:#ffc107;line-height:1.5;">🌙 <strong>Taking it easy today</strong> (${gate.reason}). Form and finishing every set — not PRs. Suggestions hold last weights.</div>`
    : '';

  // Phase 60: scheduled deload-week banner (5-day split, every 5th week)
  const deloadBanner = (typeof isDeloadWeekToday==='function' && isDeloadWeekToday())
    ? `<div style="background:rgba(255,152,0,.1);border:1px solid rgba(255,152,0,.4);border-radius:10px;padding:12px 14px;margin-bottom:20px;font-size:12px;color:var(--orange);line-height:1.5;">🔄 <strong>Deload week</strong> — planned recovery. Loads drop to ~60% and sets to 2. Move well, leave reps in the tank; you come back stronger next week.</div>`
    : '';

  // Phase 38: injury banner — lists active injuries affecting today's lifts
  const injuredEx = w.exercises.filter(ex=>typeof isExerciseInjured==='function'&&isExerciseInjured(ex.id));
  const injuryBanner = injuredEx.length
    ? `<div style="background:rgba(255,59,59,.1);border:1px solid rgba(255,59,59,.4);border-radius:10px;padding:12px 14px;margin-bottom:20px;font-size:12px;color:#ff6b6b;line-height:1.5;">🩹 <strong>Active injury</strong> — ${injuredEx.length} lift${injuredEx.length>1?'s':''} today affected (${injuredEx.map(e=>e.name).join(', ')}). Loads are reduced automatically. Train pain-free; stop if it hurts.</div>`
    : '';

  // Phase 33: build prescriptions array for AI brief
  const prescriptions = w.exercises.map(ex => {
    const sug = suggestWeight(ex.id, prev, undefined, {...opts, exObj:ex});
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
    ${deloadBanner}
    ${banner}
    ${injuryBanner}
    ${calibrationBanner}
    ${briefSlot}
    <div class="wm-h">Today's Plan</div>
    <div style="margin-bottom:24px;" id="wm-exercise-list">
      ${w.exercises.map((ex,i)=>{
        const sug=suggestWeight(ex.id,prev,undefined,{...opts, exObj:ex});
        const timed=isTimeBased(ex);
        const arrow=sug?.dir==='up'?'<span class="wm-arrow-up">↑</span>':sug?.dir==='down'?'<span class="wm-arrow-down">↓</span>':'';
        const wt=sug?(timed?`@ ${fmtSec(sug.seconds)} ${arrow}`:`@ ${sug.kg}kg ${arrow}`):(timed?'':'<span style="font-size:9px;color:var(--blue);font-weight:700;letter-spacing:1px;">FIND WEIGHT</span>');
        const badge=sug?.injured==='severe'?'<span style="font-size:9px;color:#ff6b6b;font-weight:700;letter-spacing:1px;display:block;margin-top:2px;">⚠ DO NOT LOAD</span>':sug?.injured?'<span style="font-size:9px;color:#ff6b6b;font-weight:700;letter-spacing:1px;display:block;margin-top:2px;">INJURY −</span>':sug?.deload?'<span style="font-size:9px;color:var(--orange);font-weight:700;letter-spacing:1px;display:block;margin-top:2px;">DELOAD</span>':sug?.recovery==='low'?'<span style="font-size:9px;color:#ffc107;font-weight:700;letter-spacing:1px;display:block;margin-top:2px;">HOLD</span>':'';
        const cueId = `cue-${ex.id}`;
        const cueText = cached?.perExercise?.find(c => c.exId === ex.id)?.cue || '';
        const setsShown = sug?.setsOverride || ex.sets; // deload overrides to 2
        // Phase 63: tick exercises already knocked out during a rest gap.
        const exLog=outlineDayLog[ex.id];
        const exDone=!!(exLog&&(exLog.done||exLog.skipped));
        if(exDone)return `<div class="wm-ex-row" style="opacity:.5;"><div style="flex:1;"><div style="font-size:10px;color:var(--text3);font-weight:700;">${i+1}.</div><div class="wm-ex-name">${ex.name}</div></div><div class="wm-ex-spec"><span style="color:var(--green);font-weight:700;">${exLog.skipped?'skipped':'✓ done'}</span></div></div>`;
        return `<div class="wm-ex-row"><div style="flex:1;"><div style="font-size:10px;color:var(--text3);font-weight:700;">${i+1}.</div><div class="wm-ex-name">${ex.name}</div><div id="${cueId}" style="font-size:11px;color:var(--lime);margin-top:4px;line-height:1.4;${cueText?'':'display:none;'}">${cueText}</div></div><div class="wm-ex-spec">${setsShown}×${ex.reps}<br>${wt}${badge}</div></div>`;
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
  // Phase 63: start at the first exercise not already knocked out during rest.
  const first=_wmFirstPendingIdx();
  if(first===-1){wm.exIdx=0;wmFinish();return;}
  wm.exIdx=first;
  wm.setIdx=_wmFirstUndoneSetIdx(getWorkout(wm.session).exercises[first].id);
  wm.mode='set';
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
  // Phase 56: make-up link — done on `date`, counts for the missed session's date.
  if(wm&&wm.makeupForDate){dayLog._session.forDate=wm.makeupForDate;dayLog._session.makeup=true;}
  saveExLogForDate(date,dayLog);
}
function _wmMarkExerciseStart(){
  const w=getWorkout(wm.session);
  const ex=w.exercises[wm.exIdx]; if(!ex)return;
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  if(!dayLog[ex.id])dayLog[ex.id]={done:false,sets:[]};
  if(!dayLog[ex.id].exerciseStartedAt)dayLog[ex.id].exerciseStartedAt=Date.now();
  saveExLogForDate(date,dayLog);
}
function _wmMarkExerciseDone(){
  const w=getWorkout(wm.session);
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
  const w=getWorkout(wm.session);
  const ex=w.exercises[wm.exIdx];
  if(typeof isCarry==='function'&&isCarry(ex)){renderWmSetCarry();return;}
  const timed=isTimeBased(ex);
  if(timed){renderWmSetTimed();return;}
  // Phase 92 Part 2: KB Swing switches from normal 3×10 (Phase 1) to the guided
  // EMOM timer (Phase 2+), driven by the per-load progression engine. Phase 1 falls
  // through to the normal weighted path below.
  if(ex.id==='kb_swing'&&typeof kbSuggestion==='function'){
    const kbSug=kbSuggestion((typeof getKbLoad==='function')?getKbLoad():20);
    if(kbSug&&kbSug.type==='emom'){ renderWmKbStart(kbSug); return; }
  }
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const prev=getPreviousSessionData(date,wm.session);
  const prevSessions=getPreviousSessions(date,wm.session,5);
  const gate=effectiveRecoveryGate(); // Phase 44: honours the user's train/easy choice
  const sug=suggestWeight(ex.id,prev,wm.setIdx,{lowRecovery:gate.lowRecovery,recoveryReason:gate.reason,prevSessions,exObj:ex});
  const existingSet=dayLog[ex.id]?.sets?.[wm.setIdx];
  const startKg=existingSet?.kg||((wm.autoReg&&wm.autoReg.forSetIdx===wm.setIdx)?wm.autoReg.kg:null)||sug?.kg||'';
  const repMatch=String(ex.reps).match(/(\d+)[–-](\d+)/);
  const singleRep=String(ex.reps).match(/^\s*(\d+)\s*$/); // Phase 92: fixed-rep lifts (KB 3×10) target that number
  const targetReps=existingSet?.reps||((wm.autoReg&&wm.autoReg.forSetIdx===wm.setIdx&&wm.autoReg.reps)?wm.autoReg.reps:null)||sug?.reps||(repMatch?parseInt(repMatch[2]):(singleRep?parseInt(singleRep[1]):8));
  // Phase 38: warm-up prompt on the very first working set of the session
  const isSessionOpener=wm.exIdx===0&&wm.setIdx===0;
  const workKg=parseFloat(startKg)||0;
  const warmKg=isSessionOpener&&workKg>0?Math.round((workKg*0.5)/2.5)*2.5:0;
  const warmupBlock=warmKg>0
    ? `<div style="background:rgba(61,155,255,.08);border:1px solid rgba(61,155,255,.3);border-radius:10px;padding:10px 12px;margin-bottom:16px;font-size:12px;color:var(--blue);line-height:1.5;">🔥 <strong>Warm up first.</strong> Before this working set do 1–2 light sets at ~${warmKg}kg (50% of today's load), 8–10 easy reps. Don't log warm-ups.</div>`
    : '';
  // Phase 47: per-exercise panel on the first set — what you did last time + a
  // static form cue. Deterministic, no AI. Later sets get the rest-screen autoreg.
  // History is id-keyed: prefer the same-type session, else the most recent
  // session of ANY type that logged this lift, so it survives a programme switch.
  const lastForExSess=(prev&&prev.log[ex.id]&&Array.isArray(prev.log[ex.id].sets)&&prev.log[ex.id].sets.some(s=>s.kg&&s.reps))
    ? prev
    : ((typeof getLastExercisePerformance==='function')?getLastExercisePerformance(ex.id,date):null);
  const lastForEx=(lastForExSess&&lastForExSess.log[ex.id]&&Array.isArray(lastForExSess.log[ex.id].sets))
    ? lastForExSess.log[ex.id].sets.filter(s=>s.kg&&s.reps).map(s=>`${s.kg}×${s.reps}`).join(', ')
    : null;
  const formCue=(typeof FORM_CUES!=='undefined')?FORM_CUES[ex.id]:null;
  const panelBlock=(wm.setIdx===0)?`
    ${lastForEx?`<div style="font-size:12px;color:var(--text2);background:rgba(61,155,255,.06);border-radius:8px;padding:8px 11px;margin-bottom:8px;"><span style="color:var(--text3);">Last time:</span> ${lastForEx}${lastForExSess.date?` · ${lastForExSess.date}`:''}</div>`:''}
    ${formCue?`<div style="font-size:12px;color:var(--text2);background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px 11px;margin-bottom:8px;line-height:1.5;"><span style="color:var(--lime);font-weight:700;">Form:</span> ${formCue}</div>`:''}`:'';
  const html=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:32px;">Exercise ${wm.exIdx+1} of ${w.exercises.length}</div>
    <div class="wm-title" style="margin-top:6px;">${ex.name}</div>
    <div class="wm-sub">Set ${wm.setIdx+1} of ${_effectiveSets(ex)} · Target ${ex.reps} reps</div>
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
  const w=getWorkout(wm.session);
  const ex=w.exercises[wm.exIdx];
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const prev=getPreviousSessionData(date,wm.session);
  const prevSessions=getPreviousSessions(date,wm.session,5);
  const gate=effectiveRecoveryGate(); // Phase 44: honours the user's train/easy choice
  const sug=suggestWeight(ex.id,prev,wm.setIdx,{lowRecovery:gate.lowRecovery,recoveryReason:gate.reason,prevSessions,exObj:ex});
  const existingSet=dayLog[ex.id]?.sets?.[wm.setIdx];
  const alreadyDone=existingSet?.done&&existingSet?.seconds;

  // Build set indicators
  const totalSets=dayLog[ex.id]?.sets?.length||_effectiveSets(ex);
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
    <div class="wm-sub">Set ${wm.setIdx+1} of ${_effectiveSets(ex)} · Target ${ex.reps}</div>
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

// Phase 53: reusable count-up stopwatch primitives. Shared by the plank/hold
// timer AND the suitcase-carry per-side timers (and any future timed move). They
// only manage wmTimer state + the live tick on a display element; the CALLER owns
// the button text/handler, so each flow advances how it likes.
function _wmCountUpStart(displayId){
  wmTimer.startedAt=Date.now();
  wmTimer.running=true;
  const d=document.getElementById(displayId);
  if(d){d.classList.add('active');d.classList.remove('done');}
  wmTimer.interval=setInterval(()=>{
    const el=document.getElementById(displayId);
    if(el)el.textContent=fmtSec(Math.floor((Date.now()-wmTimer.startedAt)/1000));
  },100);
}
function _wmCountUpStop(displayId){
  clearInterval(wmTimer.interval);
  wmTimer.running=false;
  const seconds=Math.floor((Date.now()-wmTimer.startedAt)/1000);
  wmTimer.elapsed=seconds;
  const d=document.getElementById(displayId);
  if(d){d.textContent=fmtSec(seconds);d.classList.remove('active');d.classList.add('done');}
  return seconds;
}
// Phase 61: countdown from a target (suitcase carry). Ticks down; when it reaches
// 0 (held the full time) it stops, buzzes, and fires onDone(). Stopping early
// returns the seconds actually held (capped at the target).
function _wmCountDownStart(displayId,targetSec,onDone){
  wmTimer.startedAt=Date.now();
  wmTimer.running=true;
  wmTimer.target=targetSec;
  const d=document.getElementById(displayId);
  if(d){d.classList.add('active');d.classList.remove('done');}
  wmTimer.interval=setInterval(()=>{
    const elapsed=Math.floor((Date.now()-wmTimer.startedAt)/1000);
    const remaining=Math.max(0,targetSec-elapsed);
    const el=document.getElementById(displayId);
    if(el)el.textContent=_fmtCarrySec(remaining);
    if(remaining<=0){
      clearInterval(wmTimer.interval); wmTimer.running=false; wmTimer.elapsed=targetSec;
      if(el){el.textContent=_fmtCarrySec(0);el.classList.remove('active');el.classList.add('done');}
      if(navigator.vibrate)navigator.vibrate([200,100,200]);
      if(typeof onDone==='function')onDone();
    }
  },100);
}
function _wmCountDownStop(displayId){
  clearInterval(wmTimer.interval);
  wmTimer.running=false;
  const elapsed=Math.floor((Date.now()-wmTimer.startedAt)/1000);
  const held=Math.min(elapsed,wmTimer.target||elapsed);
  wmTimer.elapsed=held;
  const d=document.getElementById(displayId);
  if(d){d.textContent=_fmtCarrySec(held);d.classList.remove('active');d.classList.add('done');}
  return held;
}

function wmToggleTimer(restSec){
  if(wmTimer.running){
    _wmCountUpStop('wm-hold-timer');
    const btn=document.getElementById('wm-timer-btn');
    if(btn){btn.textContent='SET DONE';btn.className='wm-timer-start done';btn.onclick=()=>wmTimedSetDone(restSec);}
  }else{
    _wmCountUpStart('wm-hold-timer');
    const btn=document.getElementById('wm-timer-btn');
    if(btn){btn.textContent='STOP';btn.className='wm-timer-start stop';}
  }
}

function wmTimedSetDone(restSec){
  const w=getWorkout(wm.session);
  const ex=w.exercises[wm.exIdx];
  const seconds=wmTimer.elapsed;
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  if(!dayLog[ex.id])dayLog[ex.id]={done:false,sets:[]};
  while(dayLog[ex.id].sets.length<=wm.setIdx)dayLog[ex.id].sets.push({seconds:0,done:false});
  dayLog[ex.id].sets[wm.setIdx]={seconds,done:true,doneAt:Date.now(),
    setStartedAt:wm.setStartedAt||null,setCompletedAt:Date.now()};
  if(dayLog[ex.id].sets.filter(s=>s.done).length>=_effectiveSets(ex))dayLog[ex.id].done=true;
  saveExLogForDate(date,dayLog);

  const isLastSet=wm.setIdx>=_effectiveSets(ex)-1;
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

// ---- Phase 53 + 61: SUITCASE CARRY — TIME double progression, weight per side ----
// Seconds behave like reps: a 40–60s "range" per side. Each session you count
// DOWN from a target time; hit it on both sides across all sets and the target
// climbs +10s (40→50→60). Hold the top (60s) on every set and it adds +5kg and
// resets to 40s — exactly the rep-range double progression, on a time axis.
// Effort steers it (easy/solid → advance, tough → hold). Weight is per side so
// the user can load the weak side heavier; both sides progress together.
// Carries cap at 60s, so always show plain seconds ("60s"), never mm:ss ("1:00").
function _fmtCarrySec(s){return Math.round(s)+'s';}
const CARRY_TIME_STEP=10, CARRY_WEIGHT_INC=5, CARRY_WEIGHT_DROP=2.5;
function suggestCarry(exId,prevSession){
  const ex=(typeof getAllExercises==='function')?getAllExercises().find(e=>e.id===exId):null;
  const LOW=(ex&&ex.targetSecondsLow)||40, HIGH=(ex&&ex.targetSecondsHigh)||60;
  const prev=prevSession&&prevSession.log&&prevSession.log[exId];
  const sets=(prev&&Array.isArray(prev.sets))?prev.sets.filter(s=>s&&s.done&&(s.leftSeconds!=null||s.rightSeconds!=null)):[];
  if(!sets.length){
    return {leftKg:'',rightKg:'',targetSeconds:LOW,
      reason:`First time — pick a weight you can hold ~${_fmtCarrySec(LOW)} per side, tall and level. Build to ${_fmtCarrySec(HIGH)}, then add weight.`};
  }
  const last=sets[sets.length-1];
  const prevLeftKg=last.leftKg!=null?last.leftKg:'';
  const prevRightKg=last.rightKg!=null?last.rightKg:(prevLeftKg!==''?prevLeftKg:'');
  const lastTarget=last.targetSeconds||LOW;
  const need=_effectiveSets(ex)||3;
  const hitAll=sets.length>=need&&sets.every(s=>(s.leftSeconds||0)>=lastTarget&&(s.rightSeconds||0)>=lastTarget);
  const effort=last.effort; // easy | solid | tough | undefined
  const up=v=>v===''?'':Math.round((parseFloat(v)+CARRY_WEIGHT_INC)*4)/4;
  const down=v=>v===''?'':Math.max(0,Math.round((parseFloat(v)-CARRY_WEIGHT_DROP)*4)/4);
  if(hitAll){
    if(lastTarget>=HIGH){
      if(effort==='tough'){
        return {leftKg:prevLeftKg,rightKg:prevRightKg,targetSeconds:HIGH,
          reason:`Held ${_fmtCarrySec(HIGH)} everywhere but it was a fight — stay here and own it before adding weight.`};
      }
      return {leftKg:up(prevLeftKg),rightKg:up(prevRightKg),targetSeconds:LOW,
        reason:`✅ Held ${_fmtCarrySec(HIGH)} on every set — up ${CARRY_WEIGHT_INC}kg, back to ${_fmtCarrySec(LOW)}. Climb again.`};
    }
    if(effort==='tough'){
      return {leftKg:prevLeftKg,rightKg:prevRightKg,targetSeconds:lastTarget,
        reason:`${_fmtCarrySec(lastTarget)} was a grind — repeat it at this weight before climbing.`};
    }
    const next=Math.min(HIGH,lastTarget+CARRY_TIME_STEP);
    return {leftKg:prevLeftKg,rightKg:prevRightKg,targetSeconds:next,
      reason:`Held ${_fmtCarrySec(lastTarget)} clean — climb to ${_fmtCarrySec(next)}, same weight.`};
  }
  const worst=Math.min(...sets.map(s=>Math.min(s.leftSeconds||0,s.rightSeconds||0)));
  if(worst<LOW){
    return {leftKg:down(prevLeftKg),rightKg:down(prevRightKg),targetSeconds:LOW,
      reason:`Couldn't hold ${_fmtCarrySec(LOW)} — drop ${CARRY_WEIGHT_DROP}kg and rebuild from the floor.`};
  }
  return {leftKg:prevLeftKg,rightKg:prevRightKg,targetSeconds:lastTarget,
    reason:`Short of ${_fmtCarrySec(lastTarget)} — repeat the weight and time, nail all sets.`};
}

function wmCarryStepKg(delta){
  const el=document.getElementById('wm-carry-kg');
  if(!el)return;
  const cur=parseFloat(el.value)||0;
  el.value=Math.max(0,Math.round((cur+delta)*4)/4);
}

function renderWmSetCarry(){
  const w=getWorkout(wm.session);
  const ex=w.exercises[wm.exIdx];
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const LOW=ex.targetSecondsLow||40, HIGH=ex.targetSecondsHigh||60;
  const set=dayLog[ex.id]?.sets?.[wm.setIdx]||{};
  // Derive the side from what's already captured this set (robust to resume).
  const side=(set.leftSeconds!=null&&set.rightSeconds==null)?'right':'left';
  wm.carrySide=side;
  wm.carrySeconds=0;
  wmTimer={running:false,startedAt:0,interval:null,elapsed:0};

  const prev=getPreviousSessionData(date,wm.session);
  const sug=(typeof suggestCarry==='function')?suggestCarry(ex.id,prev):null;
  let defaultKg=(side==='left')
    ? (set.leftKg!=null?set.leftKg:(sug?sug.leftKg:''))
    : (set.rightKg!=null?set.rightKg:(set.leftKg!=null?set.leftKg:(sug?sug.rightKg:'')));
  if(defaultKg==null)defaultKg='';
  // Countdown target for THIS session: the suggested time, or the value already
  // stored on this set when resuming mid-set. Same target for both sides + all sets.
  const target=(set.targetSeconds!=null?set.targetSeconds:((sug&&sug.targetSeconds!=null)?sug.targetSeconds:LOW));
  wm.carryTarget=target;

  let setsHtml='';
  for(let i=0;i<_effectiveSets(ex);i++){
    const s=dayLog[ex.id]?.sets?.[i]||{};
    const lDone=s.leftSeconds!=null,rDone=s.rightSeconds!=null;
    const isCur=i===wm.setIdx;
    const val=(lDone||rDone)?`L${s.leftSeconds||0}/R${s.rightSeconds||0}`:'—';
    setsHtml+=`<div class="wm-timer-set${isCur?' current':''}${lDone&&rDone?' completed':''}">
      <span class="wm-timer-set-label">SET ${i+1}</span>
      <span class="wm-timer-set-val">${val}</span>
    </div>`;
  }

  const sideLabel=side==='left'?'LEFT SIDE':'RIGHT SIDE';
  const sideColor=side==='left'?'var(--lime)':'var(--blue)';
  document.getElementById('wmContent').innerHTML=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:32px;">Exercise ${wm.exIdx+1} of ${w.exercises.length}</div>
    <div class="wm-title" style="margin-top:6px;">${ex.name}</div>
    <div class="wm-sub">Set ${wm.setIdx+1} of ${_effectiveSets(ex)} · aim ${_fmtCarrySec(target)} per side · range ${_fmtCarrySec(LOW)}–${_fmtCarrySec(HIGH)}</div>
    <div style="display:flex;align-items:center;gap:10px;margin:8px 0 10px;flex-wrap:wrap;">
      <a href="${ex.yt}" target="_blank" style="color:var(--blue);font-size:12px;text-decoration:none;">🎥 Watch form →</a>
    </div>
    ${(typeof _wmCueHTML==='function')?_wmCueHTML(ex.id):''}
    ${sug&&sug.reason?`<div class="wm-progress-hint">${sug.reason}</div>`:''}
    <div style="font-family:'Archivo Black',sans-serif;font-size:28px;color:${sideColor};letter-spacing:1px;text-align:center;margin:8px 0 4px;">${sideLabel}</div>
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:6px;">
      <span style="font-size:12px;color:var(--text3);">weight</span>
      <button class="btn btn-ghost btn-sm" style="width:38px;" onclick="wmCarryStepKg(-1.25)">–</button>
      <input id="wm-carry-kg" type="number" step="0.25" inputmode="decimal" value="${defaultKg}" placeholder="kg" style="width:84px;text-align:center;font-size:20px;font-family:'Archivo Black',sans-serif;background:var(--s2);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:8px;">
      <button class="btn btn-ghost btn-sm" style="width:38px;" onclick="wmCarryStepKg(1.25)">+</button>
      <span style="font-size:12px;color:var(--text3);">kg</span>
    </div>
    <div style="position:relative;text-align:center;padding:22px 0;">
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Archivo Black',sans-serif;font-size:70px;color:var(--text);opacity:.10;pointer-events:none;">${_fmtCarrySec(target)}</div>
      <div id="wm-carry-timer" class="wm-hold-timer" style="position:relative;">${_fmtCarrySec(target)}</div>
    </div>
    <div id="wm-timer-sets" style="margin-bottom:16px;">${setsHtml}</div>
    <button id="wm-carry-btn" class="wm-timer-start" onclick="wmToggleCarryTimer()">START · ${sideLabel}</button>
  `;
}

function wmToggleCarryTimer(){
  const btn=document.getElementById('wm-carry-btn');
  if(wmTimer.running){
    // Stopped early — log the seconds actually held (capped at target).
    wm.carrySeconds=_wmCountDownStop('wm-carry-timer');
    _wmCarrySideReady();
  }else{
    // Count DOWN from the session target; auto-completes (held full time) at 0.
    _wmCountDownStart('wm-carry-timer',wm.carryTarget||40,()=>{ wm.carrySeconds=wm.carryTarget||40; _wmCarrySideReady(); });
    if(btn){btn.textContent='STOP';btn.className='wm-timer-start stop';}
  }
}
// Side timer finished (auto or manual) — arm the advance button, don't auto-jump.
function _wmCarrySideReady(){
  const btn=document.getElementById('wm-carry-btn');
  if(btn){btn.textContent=(wm.carrySide==='left')?'NEXT — RIGHT SIDE →':'SET DONE ✓';btn.className='wm-timer-start done';btn.onclick=wmCarrySideDone;}
}

function wmCarrySideDone(){
  const w=getWorkout(wm.session);
  const ex=w.exercises[wm.exIdx];
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const kg=parseFloat(document.getElementById('wm-carry-kg')?.value);
  const seconds=wm.carrySeconds||0;
  if(!dayLog[ex.id])dayLog[ex.id]={done:false,sets:[]};
  while(dayLog[ex.id].sets.length<=wm.setIdx)dayLog[ex.id].sets.push({});
  const set=dayLog[ex.id].sets[wm.setIdx]||{};
  if(wm.carrySide==='left'){
    set.leftKg=isNaN(kg)?'':kg; set.leftSeconds=seconds;
    set.targetSeconds=wm.carryTarget||set.targetSeconds||40; // record what we aimed for
    set.setStartedAt=set.setStartedAt||wm.setStartedAt||Date.now();
    dayLog[ex.id].sets[wm.setIdx]=set;
    saveExLogForDate(date,dayLog);
    wm.carrySeconds=0;
    wmTimer={running:false,startedAt:0,interval:null,elapsed:0};
    // Phase 61: 5-second switch-hands window before the RIGHT side.
    wm.mode='carrySwitch';
    renderWmCarrySwitch();
    return;
  }
  // RIGHT side → set complete
  set.rightKg=isNaN(kg)?'':kg; set.rightSeconds=seconds;
  set.targetSeconds=wm.carryTarget||set.targetSeconds||40;
  set.done=true; set.doneAt=Date.now(); set.setCompletedAt=Date.now();
  dayLog[ex.id].sets[wm.setIdx]=set;
  if(dayLog[ex.id].sets.filter(s=>s.done).length>=_effectiveSets(ex))dayLog[ex.id].done=true;
  saveExLogForDate(date,dayLog);
  wm.carrySeconds=0; wm.carrySide='left';
  wmTimer={running:false,startedAt:0,interval:null,elapsed:0};
  if(wm.setIdx>=_effectiveSets(ex)-1){
    // Last set — rate effort (drives the weight-add), then finish the exercise.
    wm.mode='effort';
    renderWmCarryEffort();
  }else{
    wm.restTarget=ex.rest;
    wm.mode='rest';
    wm.restStarted=Date.now();
    renderWmRest();
  }
}

// Phase 61: 5-second "switch hands" window between the LEFT and RIGHT carry.
function renderWmCarrySwitch(){
  if(wm.carrySwitchInterval){clearInterval(wm.carrySwitchInterval);wm.carrySwitchInterval=null;}
  const w=getWorkout(wm.session);
  const ex=w.exercises[wm.exIdx];
  if(!ex)return;
  document.getElementById('wmContent').innerHTML=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:32px;">Switch hands</div>
    <div class="wm-title" style="font-size:22px;margin-top:6px;">${ex.name}</div>
    <div class="wm-sub" style="margin-bottom:30px;">Set the weight down, pick it up in the <strong style="color:var(--blue);">RIGHT</strong> hand — stand tall.</div>
    <div style="text-align:center;padding:30px 0;">
      <div id="wm-switch-timer" style="font-family:'Archivo Black',sans-serif;font-size:96px;letter-spacing:-4px;color:var(--blue);line-height:1;">5</div>
      <div style="font-size:14px;color:var(--text2);margin-top:8px;">right side starts automatically</div>
    </div>
    <button class="wm-cta" onclick="wmStartRightSide()">START RIGHT NOW →</button>
  `;
  let r=5;
  wm.carrySwitchInterval=setInterval(()=>{
    r--;
    const el=document.getElementById('wm-switch-timer');
    if(el)el.textContent=Math.max(0,r);
    if(r<=0){clearInterval(wm.carrySwitchInterval);wm.carrySwitchInterval=null;if(navigator.vibrate)navigator.vibrate([200,100,200]);wmStartRightSide();}
  },1000);
}
function wmStartRightSide(){
  if(wm.carrySwitchInterval){clearInterval(wm.carrySwitchInterval);wm.carrySwitchInterval=null;}
  wm.mode='set';
  wm.carrySide='right';
  wm.carrySeconds=0;
  wmTimer={running:false,startedAt:0,interval:null,elapsed:0};
  renderWmSetCarry(); // side derives to RIGHT (left already logged)
}

// Phase 61: effort rating for the carry (drives the weight-add). Mirrors the
// timed-hold effort screen; stored on the last set + exercise for suggestCarry.
function renderWmCarryEffort(){
  const w=getWorkout(wm.session);
  const ex=w.exercises[wm.exIdx];
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const s=dayLog[ex.id]?.sets?.[wm.setIdx]||{};
  document.getElementById('wmContent').innerHTML=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:32px;">All sets done</div>
    <div class="wm-title" style="font-size:22px;margin-top:6px;">${ex.name} — L ${_fmtCarrySec(s.leftSeconds||0)} / R ${_fmtCarrySec(s.rightSeconds||0)}</div>
    <div class="wm-sub">How did that feel?</div>
    <button class="wm-effort-btn" onclick="wmRecordCarryEffort('easy')">
      <div class="em">😌</div>
      <div class="lbl">EASY<div class="desc">Could've held a lot longer</div></div>
    </button>
    <button class="wm-effort-btn" onclick="wmRecordCarryEffort('solid')">
      <div class="em">💪</div>
      <div class="lbl">SOLID<div class="desc">10-15s left in the tank</div></div>
    </button>
    <button class="wm-effort-btn" onclick="wmRecordCarryEffort('tough')">
      <div class="em">🔥</div>
      <div class="lbl">TOUGH<div class="desc">At my limit, grip was going</div></div>
    </button>
    <button class="wm-cta ghost" onclick="wmRecordCarryEffort(null)">Skip rating</button>
  `;
}
function wmRecordCarryEffort(effort){
  const w=getWorkout(wm.session);
  const ex=w.exercises[wm.exIdx];
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  if(dayLog[ex.id]&&effort){
    dayLog[ex.id].effort=effort;
    const sets=dayLog[ex.id].sets||[];
    if(sets.length)sets[sets.length-1].effort=effort; // suggestCarry reads last set's effort
    saveExLogForDate(date,dayLog);
  }
  _wmMarkExerciseDone();
  _wmEnterPostExerciseRest(ex); // Phase 83
}

function wmRedoTimedSet(idx){
  wm.setIdx=idx;
  renderWmSetTimed();
}

// ===================== Phase 92 Part 2: KB Swing guided EMOM =====================
// Full-screen EMOM finisher: per-minute rounds, progress ring, beep+vibrate each
// minute, a soft 55s warning, pause + honest end-early, screen kept awake. Reuses
// setInterval + navigator.vibrate; adds a small WebAudio beep + wakeLock (no refactor
// of the existing wm/rest timers). Target comes from the per-load engine (kb-emom.js).
let _kbAudioCtx=null;
function _kbBeep(freq,ms,vol){ try{
  const AC=window.AudioContext||window.webkitAudioContext; if(!AC)return;
  if(!_kbAudioCtx)_kbAudioCtx=new AC();
  const o=_kbAudioCtx.createOscillator(),g=_kbAudioCtx.createGain();
  o.type='sine'; o.frequency.value=freq||880; g.gain.value=(vol==null?0.25:vol);
  o.connect(g); g.connect(_kbAudioCtx.destination);
  o.start(); o.stop(_kbAudioCtx.currentTime+((ms||160)/1000));
}catch(e){} }
let _kbWakeLock=null;
function _kbWakeAcquire(){ try{ if(navigator.wakeLock&&navigator.wakeLock.request){ navigator.wakeLock.request('screen').then(w=>{_kbWakeLock=w;}).catch(()=>{}); } }catch(e){} }
function _kbWakeRelease(){ try{ if(_kbWakeLock){_kbWakeLock.release();_kbWakeLock=null;} }catch(e){} }
function _kbClearTimer(){ if(wm.kb&&wm.kb.interval){clearInterval(wm.kb.interval);wm.kb.interval=null;} }

// Session-start screen: today's target + reason + PB + inline load change + manual override.
function renderWmKbStart(sug){
  wm.mode='kbStart';
  const load=(typeof getKbLoad==='function')?getKbLoad():20;
  const pbs=(typeof getKbPBs==='function')?getKbPBs():{};
  const pbStr=Object.keys(pbs).sort((a,b)=>+a-+b).map(k=>`${k}kg: ${pbs[k]} ✓`).join(' · ');
  const mins=(wm.kbOverrideMin!=null)?wm.kbOverrideMin:sug.minutes;
  const overridden=(wm.kbOverrideMin!=null&&wm.kbOverrideMin!==sug.minutes);
  wm._kbSug=sug;
  document.getElementById('wmContent').innerHTML=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:32px;">Finisher · Kettlebell Swing</div>
    <div class="wm-title" style="font-size:20px;margin-top:6px;">Today's target</div>
    <div style="background:rgba(200,255,0,.06);border:1px solid rgba(200,255,0,.28);border-radius:14px;padding:16px;margin:14px 0;">
      <div style="font-family:'Archivo Black',sans-serif;font-size:26px;color:var(--lime);letter-spacing:-1px;">EMOM ${mins} min × ${sug.reps}</div>
      <div style="font-size:13px;color:var(--text2);margin-top:6px;">@ ${load}kg${overridden?' · <span style="color:#ffc107;">manual override</span>':''}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:8px;line-height:1.5;">${sug.reason}${sug.capped?' 🛡️':''}</div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">
      <div style="font-size:12px;color:var(--text2);">Weight</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <button onclick="wmKbLoadStep(-2)" style="width:38px;height:38px;border-radius:9px;border:1px solid var(--border2);background:var(--bg2);color:var(--text);font-size:20px;cursor:pointer;">−</button>
        <div style="min-width:64px;text-align:center;font-family:'Archivo Black',sans-serif;font-size:18px;">${load}kg</div>
        <button onclick="wmKbLoadStep(2)" style="width:38px;height:38px;border-radius:9px;border:1px solid var(--border2);background:var(--bg2);color:var(--text);font-size:20px;cursor:pointer;">+</button>
      </div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:16px;">
      <div style="font-size:12px;color:var(--text2);">Minutes <span style="color:var(--text3);">(override)</span></div>
      <div style="display:flex;align-items:center;gap:8px;">
        <button onclick="wmKbMinStep(-1)" style="width:38px;height:38px;border-radius:9px;border:1px solid var(--border2);background:var(--bg2);color:var(--text);font-size:20px;cursor:pointer;">−</button>
        <div style="min-width:64px;text-align:center;font-family:'Archivo Black',sans-serif;font-size:18px;">${mins} min</div>
        <button onclick="wmKbMinStep(1)" style="width:38px;height:38px;border-radius:9px;border:1px solid var(--border2);background:var(--bg2);color:var(--text);font-size:20px;cursor:pointer;">+</button>
      </div>
    </div>
    ${pbStr?`<div style="font-size:11px;color:var(--text3);margin-bottom:14px;">🏆 ${pbStr}</div>`:''}
    <button class="wm-cta" onclick="wmKbBegin()">START EMOM →</button>
    <button class="wm-cta ghost" style="margin-top:8px;" onclick="wmKbSkip()">Skip finisher</button>
  `;
}
function wmKbLoadStep(delta){
  const cur=(typeof getKbLoad==='function')?getKbLoad():20;
  const next=Math.max(4,cur+delta);
  if(typeof setKbLoad==='function')setKbLoad(next);
  wm.kbOverrideMin=null; // new weight → re-enter on the new load's ladder
  renderWmKbStart(kbSuggestion(next));
}
function wmKbMinStep(delta){
  const base=(wm.kbOverrideMin!=null)?wm.kbOverrideMin:(wm._kbSug?wm._kbSug.minutes:5);
  wm.kbOverrideMin=Math.max(1,base+delta);
  renderWmKbStart(wm._kbSug);
}
function wmKbBegin(){
  const sug=wm._kbSug||{}; const mins=(wm.kbOverrideMin!=null)?wm.kbOverrideMin:sug.minutes;
  wm.mode='kbRun';
  wm.kb={ target:mins, reps:sug.reps||12, load:(typeof getKbLoad==='function')?getKbLoad():20,
    roundsTarget:mins, startedAt:Date.now(), pausedMs:0, pausedAt:0, paused:false,
    interval:null, lastMin:-1, lastTick:-1, overridden:(wm.kbOverrideMin!=null&&wm.kbOverrideMin!==sug.minutes) };
  _kbWakeAcquire();
  renderWmKbTimer();
  _kbClearTimer();
  wm.kb.interval=setInterval(updateWmKbTimer,200);
  updateWmKbTimer();
}
function _kbElapsedSec(){
  const kb=wm.kb; if(!kb)return 0;
  const ref=kb.paused?kb.pausedAt:Date.now();
  return Math.max(0,(ref-kb.startedAt-kb.pausedMs)/1000);
}
function renderWmKbTimer(){
  const kb=wm.kb;
  document.getElementById('wmContent').innerHTML=`
    <div style="text-align:center;padding-top:24px;">
      <div id="kb-round" style="font-family:'Archivo Black',sans-serif;font-size:30px;color:var(--lime);letter-spacing:-1px;">ROUND 1/${kb.roundsTarget}</div>
      <div style="position:relative;width:220px;height:220px;margin:18px auto 8px;">
        <svg viewBox="0 0 220 220" style="width:100%;height:100%;transform:rotate(-90deg);">
          <circle cx="110" cy="110" r="96" fill="none" stroke="var(--border)" stroke-width="12"/>
          <circle id="kb-ring" cx="110" cy="110" r="96" fill="none" stroke="var(--lime)" stroke-width="12" stroke-linecap="round" stroke-dasharray="603.2" stroke-dashoffset="0"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div id="kb-sec" style="font-family:'Archivo Black',sans-serif;font-size:64px;line-height:1;color:var(--text);">60</div>
          <div style="font-size:11px;color:var(--text3);letter-spacing:1px;">SEC THIS MINUTE</div>
        </div>
      </div>
      <div style="font-family:'Archivo Black',sans-serif;font-size:34px;color:var(--orange);letter-spacing:-1px;">${kb.reps} SWINGS</div>
      <div style="font-size:12px;color:var(--text3);margin-top:2px;">every minute · @ ${kb.load}kg</div>
    </div>
    <div style="display:flex;gap:10px;margin-top:22px;">
      <button id="kb-pausebtn" class="wm-cta ghost" style="flex:1;" onclick="wmKbTogglePause()">⏸ PAUSE</button>
      <button class="wm-cta" style="flex:1;background:rgba(255,85,0,.14);border-color:var(--red);color:var(--red);" onclick="wmKbEnd(false)">END EARLY</button>
    </div>
  `;
}
function updateWmKbTimer(){
  const kb=wm.kb; if(!kb||wm.mode!=='kbRun')return;
  const el=_kbElapsedSec();
  const totalSec=kb.roundsTarget*60;
  if(el>=totalSec){ wmKbEnd(true); return; }
  const minIdx=Math.floor(el/60);
  const secIn=el-minIdx*60;
  const round=Math.min(kb.roundsTarget,minIdx+1);
  const rEl=document.getElementById('kb-round'); if(rEl)rEl.textContent=`ROUND ${round}/${kb.roundsTarget}`;
  const sEl=document.getElementById('kb-sec'); if(sEl)sEl.textContent=Math.max(0,Math.ceil(60-secIn));
  const ring=document.getElementById('kb-ring');
  if(ring){ const C=603.2; ring.setAttribute('stroke-dashoffset',String(C*(secIn/60))); }
  if(!kb.paused){
    // minute-start beep + vibrate (round 1 at t=0, then each new minute)
    if(minIdx!==kb.lastMin&&minIdx<kb.roundsTarget){ kb.lastMin=minIdx; _kbBeep(900,180,0.3); if(navigator.vibrate)navigator.vibrate([180,60,180]); }
    // soft 5-second warning tick at 55s
    if(secIn>=55&&kb.lastTick!==minIdx&&minIdx<kb.roundsTarget-0){ kb.lastTick=minIdx; _kbBeep(520,90,0.14); if(navigator.vibrate)navigator.vibrate(60); }
  }
}
function wmKbTogglePause(){
  const kb=wm.kb; if(!kb)return;
  if(kb.paused){ kb.pausedMs+=(Date.now()-kb.pausedAt); kb.paused=false; kb.pausedAt=0; }
  else { kb.paused=true; kb.pausedAt=Date.now(); }
  const b=document.getElementById('kb-pausebtn'); if(b)b.textContent=kb.paused?'▶ RESUME':'⏸ PAUSE';
}
function wmKbEnd(complete){
  const kb=wm.kb; if(!kb)return;
  const el=_kbElapsedSec();
  // rounds completed = full minutes elapsed (a minute counts once its swings are done);
  // "complete" (timer ran out) = the full target.
  const rounds=complete?kb.roundsTarget:Math.min(kb.roundsTarget,Math.floor(el/60));
  wmKbFinish(rounds);
}
function wmKbSkip(){
  // Skip the finisher entirely — no set logged, exercise marked skipped (no deload).
  const date=todayStr(); const dayLog=getExLogForDate(date);
  dayLog.kb_swing={done:false,skipped:true,skippedAt:Date.now(),sets:[]};
  saveExLogForDate(date,dayLog);
  wm.kbOverrideMin=null;
  if(typeof wmNextExercise==='function')wmNextExercise();
}
function wmKbFinish(rounds){
  _kbClearTimer(); _kbWakeRelease();
  const kb=wm.kb||{}; const date=todayStr();
  const outcome=(typeof logKbEmomSet==='function')
    ? logKbEmomSet(date,{load:kb.load,rounds:rounds,roundsTarget:kb.roundsTarget,repsPerMin:kb.reps,durationMin:kb.roundsTarget,overridden:kb.overridden})
    : 'PARTIAL';
  _wmMarkExerciseDone();
  wm.kbOverrideMin=null;
  wm.mode='kbDone'; renderWmKbDone(rounds,outcome);
}
function renderWmKbDone(rounds,outcome){
  const kb=wm.kb||{};
  const emoji=outcome==='FULL'?'🔥':outcome==='PARTIAL'?'💪':'·';
  const col=outcome==='FULL'?'var(--lime)':outcome==='PARTIAL'?'#ffc107':'var(--text3)';
  // preview next session's target on this load now that history includes this set
  const next=(typeof kbSuggestion==='function')?kbSuggestion(kb.load):null;
  document.getElementById('wmContent').innerHTML=`
    <div style="text-align:center;padding-top:40px;">
      <div style="font-size:56px;">${emoji}</div>
      <div style="font-family:'Archivo Black',sans-serif;font-size:30px;color:${col};margin-top:8px;">EMOM ${rounds}/${kb.roundsTarget}</div>
      <div style="font-size:14px;color:var(--text2);margin-top:4px;">${outcome} · ${kb.reps} swings/min @ ${kb.load}kg</div>
      ${next?`<div style="font-size:12px;color:var(--text3);margin-top:16px;line-height:1.5;">Next ${kb.load}kg target: <b>EMOM ${next.minutes} min × ${next.reps}</b><br>${next.reason}</div>`:''}
    </div>
    <button class="wm-cta" style="margin-top:28px;" onclick="wmKbDoneContinue()">FINISH WORKOUT 🎉</button>
  `;
}
function wmKbDoneContinue(){ if(typeof wmNextExercise==='function')wmNextExercise(); }

function renderWmTimedEffort(){
  const w=getWorkout(wm.session);
  const ex=w.exercises[wm.exIdx];
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const sets=dayLog[ex.id]?.sets||[];
  const lastSec=sets[sets.length-1]?.seconds||0;
  const html=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:32px;">All sets done</div>
    <div class="wm-title" style="font-size:22px;margin-top:6px;">${ex.name} — ${fmtSec(lastSec)}</div>
    <div class="wm-sub">How did that feel?</div>
    <button class="wm-effort-btn" onclick="wmRecordTimedEffort('easy')">
      <div class="em">😌</div>
      <div class="lbl">EASY<div class="desc">Could've held a lot longer</div></div>
    </button>
    <button class="wm-effort-btn" onclick="wmRecordTimedEffort('solid')">
      <div class="em">💪</div>
      <div class="lbl">SOLID<div class="desc">10-15s left in the tank</div></div>
    </button>
    <button class="wm-effort-btn" onclick="wmRecordTimedEffort('tough')">
      <div class="em">🔥</div>
      <div class="lbl">TOUGH<div class="desc">At my limit, couldn't hold more</div></div>
    </button>
    <button class="wm-cta ghost" onclick="wmRecordTimedEffort(null)">Skip rating</button>
  `;
  document.getElementById('wmContent').innerHTML=html;
}

function wmRecordTimedEffort(effort){
  const w=getWorkout(wm.session);
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
  _wmEnterPostExerciseRest(ex); // Phase 83
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
  const w=getWorkout(wm.session);
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
  if(dayLog[ex.id].sets.filter(s=>s.done).length>=_effectiveSets(ex))dayLog[ex.id].done=true;
  saveExLogForDate(date,dayLog);
  wm.restTarget=restSec;
  wm.mode='effort';
  renderWmEffort();
}

function renderWmEffort(){
  const w=getWorkout(wm.session);
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
  const w=getWorkout(wm.session);
  const ex=w.exercises[wm.exIdx];
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  if(dayLog[ex.id]?.sets?.[wm.setIdx]&&effort){
    dayLog[ex.id].sets[wm.setIdx].effort=effort;
    saveExLogForDate(date,dayLog);
  }
  const isLastSet=wm.setIdx>=_effectiveSets(ex)-1;
  if(isLastSet){
    _wmMarkExerciseDone();
    _wmEnterPostExerciseRest(ex); // Phase 83: a rest gap + filler before the summary
  } else {
    wm.mode='rest';
    wm.restStarted=Date.now();
    renderWmRest();
  }
}

function renderWmRest(){
  const w=getWorkout(wm.session);
  const ex=w.exercises[wm.exIdx];
  const timed=isTimeBased(ex);
  const carry=(typeof isCarry==='function')&&isCarry(ex); // Phase 53
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const lastSet=dayLog[ex.id]?.sets?.[wm.setIdx];
  const effortEmoji={easy:'😌',solid:'💪',tough:'🔥',hard:'🔥',maybe:'🤔'};
  const setDesc=carry?`L ${lastSet?.leftSeconds||0}s · R ${lastSet?.rightSeconds||0}s`:timed?fmtSec(lastSet?.seconds||0):`${lastSet?.kg||'-'}kg × ${lastSet?.reps||'-'}`;
  // Phase 47: compute the next-set call from the set just done; store it so the
  // next set pre-fills, and show it UNDER the countdown so you load up in time.
  // Phase 53: carries don't autoregulate (per-side time, no rep target).
  // Phase 83: in the post-exercise rest there's no next set of THIS lift, so no
  // autoregulation call — the panel just offers accessories/mobility then continues.
  const ar=(carry||wm.postExercise)?null:_autoregNextSet(ex,lastSet,wm.setIdx+1);
  if(ar)wm.autoReg={forSetIdx:wm.setIdx+1,kg:ar.kg,reps:ar.reps};
  const arColor=ar?(ar.dir==='up'?'var(--lime)':ar.dir==='down'?'#ffc107':'var(--blue)'):'';
  const arBg=ar?(ar.dir==='up'?'rgba(200,255,0,.08)':ar.dir==='down'?'rgba(255,193,7,.1)':'rgba(61,155,255,.08)'):'';
  const arArrow=ar?(ar.dir==='up'?'↑':ar.dir==='down'?'↓':'→'):'';
  const arPanel=ar?`<div style="background:${arBg};border:1px solid ${arColor};border-radius:12px;padding:13px 14px;margin:0 0 14px;">
      <div style="font-size:10px;color:${arColor};text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:4px;">Next set ${arArrow} ${ar.kg}kg</div>
      <div style="font-size:13px;color:var(--text);line-height:1.5;">${ar.msg}</div>
    </div>`:'';
  // Phase 63: rest-gap accessories — do the session's own small/rehab work DURING
  // this rest and log it as REAL sets (see _wmAccessoryPanelHTML). Supersedes the
  // Phase 62 throwaway filler: because the accessory IS the end-of-session
  // exercise, knocking it out here ticks it off and removes it from the end,
  // instead of the old behaviour where the rest drill and its standalone twin were
  // two separate items (band pull-apart done in a rest gap still showing up later).
  // Logging never touches the countdown — it re-renders only the panel's own rows.
  const accessoryPanel=_wmAccessoryPanelHTML(ex.id);
  const html=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:32px;">Resting</div>
    <div class="wm-sub" style="margin-top:8px;">✓ Set ${wm.setIdx+1}: ${setDesc}${lastSet?.effort?' '+effortEmoji[lastSet.effort]:''}</div>
    <div style="text-align:center;padding:40px 0 24px;">
      <div id="wm-timer" style="font-family:'Archivo Black',sans-serif;font-size:88px;letter-spacing:-4px;color:var(--lime);line-height:1;">${wm.restTarget}s</div>
      <div id="wm-timer-status" style="font-size:14px;color:var(--text2);margin-top:8px;">counting down</div>
    </div>
    ${accessoryPanel}
    ${arPanel}
    ${wm.postExercise
      ? `<div class="wm-meta">${(()=>{const ni=_wmNextPendingIdx(wm.exIdx);const ne=ni>=0?w.exercises[ni]:null;return ne?`Next up: ${ne.name}`:'Wrapping up';})()}</div>
    <button id="wm-next-btn" class="wm-cta ghost" onclick="wmEndPostExerciseRest()">SKIP REST · CONTINUE →</button>`
      : `<div class="wm-meta">Next: Set ${wm.setIdx+2} of ${_effectiveSets(ex)} · ${ex.name}</div>
    <button id="wm-next-btn" class="wm-cta ghost" onclick="wmStartNextSet()">SKIP REST · START NEXT SET</button>`}
  `;
  document.getElementById('wmContent').innerHTML=html;
  if(wm.restInterval)clearInterval(wm.restInterval);
  if(wm._mobInterval){clearInterval(wm._mobInterval);wm._mobInterval=null;} // Phase 69: independent mobility timer
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
  const post=wm.postExercise; // Phase 83: between-exercise rest labels differ
  if(remaining>0){
    t.textContent=Math.ceil(remaining)+'s';
    // Phase 38: green while plenty of rest left, amber in the final 20s
    if(remaining>20){
      t.style.color='var(--lime)';
      s.textContent='resting — recover fully';
    }else{
      t.style.color='#ffc107';
      s.textContent=post?'almost done — next exercise soon':'almost ready — get set';
    }
    if(b){b.textContent=post?'SKIP REST · CONTINUE →':'SKIP REST · START NEXT SET';b.classList.add('ghost');b.classList.remove('over');}
  } else {
    const over=Math.floor(-remaining);
    if(t.dataset.transitioned!=='true'){
      t.dataset.transitioned='true';
      if(navigator.vibrate)navigator.vibrate([200,100,200,100,200]);
    }
    t.textContent='+'+over+'s';
    t.style.color='var(--red)';
    s.textContent=post?'Done — tap to continue':'GO! Tap to start next set';
    if(b){b.textContent=post?'CONTINUE →':'START NEXT SET';b.classList.remove('ghost');b.classList.add('over');}
  }
}

// ===================== Phase 63: rest-gap accessories =====================
// "Knock it out during rest" — do the session's small/rehab accessory work in a
// compound lift's rest gaps and log it as a REAL set. Because the accessory IS
// the end-of-session exercise, completing it here marks it done so the main flow
// skips it later (see _wmNextPendingIdx / wmNextExercise). Fixes the duplication
// where a rest drill and its standalone twin were two separate to-dos.

// Eligible accessories for the given resting lift: small OR rehab, rep-based, in
// THIS session, not the lift currently being rested, not already done/skipped.
function _wmRestAccessories(currentExId){
  const w=getWorkout(wm.session);
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  return (w.exercises||[]).filter(ex=>{
    if(ex.id===currentExId)return false;
    if(isTimeBased(ex))return false;
    if(typeof isCarry==='function'&&isCarry(ex))return false;
    // Only rehab/band shoulder work is a rest-gap accessory — the proper isolation
    // lifts (Pallof, Lateral Raise, Face Pull, curls, Dead Bug) are done in the main
    // flow, not squeezed into rest. The Asian squat covers the no-band fallback.
    if(ex.category!=='rehab')return false;
    const log=dayLog[ex.id];
    if(log&&(log.done||log.skipped))return false;
    return true;
  });
}
// Most band work is bodyweight (no kg). A rehab move flagged `weighted` (e.g. Band
// External Rotation done on the cable stack) gets a kg stepper.
function _wmAccessoryWeighted(ex){ return !!(ex&&ex.weighted); }
// Locked state after you've logged your one accessory set for THIS rest — shows
// what you did and that it resumes next rest, with no second Log button.
function _wmAccessoryLockedHTML(exId){
  const w=getWorkout(wm.session);
  const ex=(w.exercises||[]).find(e=>e.id===exId)||{name:exId};
  const dayLog=getExLogForDate(todayStr());
  const doneCount=((dayLog[exId]&&dayLog[exId].sets)||[]).filter(s=>s.done).length;
  const target=_effectiveSets(ex);
  const complete=doneCount>=target;
  const msg=complete
    ? `✓ ${ex.name} complete · ${doneCount}/${target} — next one on your next rest`
    : `✓ ${ex.name} logged · ${doneCount}/${target} — next set on your next rest`;
  return `<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:10px;font-size:13px;color:var(--green);font-weight:700;line-height:1.4;">${msg}</div>`;
}
function _wmAccessoryRowsHTML(currentExId){
  // One-set-per-rest lock: if you've already logged an accessory set this rest
  // gap, hold that state (no second log) until the next rest starts.
  if(wm.restAccLoggedId && wm.restAccGapLogged===wm.restStarted){
    return _wmAccessoryLockedHTML(wm.restAccLoggedId);
  }
  const accs=_wmRestAccessories(currentExId);
  // Phase 63b: no session accessory left to knock out → fall back to the Asian
  // (deep) squat hold as an optional mobility drill for the rest gap.
  if(!accs.length)return _wmMobilityFallbackHTML(currentExId);
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const prev=(typeof getPreviousSessionData==='function')?getPreviousSessionData(date,wm.session):null;
  const btnS='width:34px;height:34px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);color:var(--text);font-size:18px;font-weight:700;cursor:pointer;line-height:1;';
  const inS='width:46px;text-align:center;background:var(--bg2);border:1px solid var(--border2);border-radius:8px;color:var(--text);font-size:15px;padding:7px 0;';
  // Show ONLY the one accessory to do right now — carry it through its sets across
  // rest gaps, then it drops out and the next incomplete one takes its place.
  const _more=accs.length-1;
  return accs.slice(0,1).map(ex=>{
    const sets=(dayLog[ex.id]&&Array.isArray(dayLog[ex.id].sets))?dayLog[ex.id].sets.filter(s=>s.done):[];
    const doneCount=sets.length;
    const target=_effectiveSets(ex);
    const repNums=String(ex.reps).match(/\d+/g);
    const rangeTop=repNums?parseInt(repNums[repNums.length-1]):12;
    const weighted=_wmAccessoryWeighted(ex);
    const sug=weighted?suggestWeight(ex.id,prev,doneCount,{exObj:ex}):null;
    // Phase 63a: ground the defaults in what you actually did last time so each set
    // nudges you to match or beat it (same idea as the main set screen), falling
    // back to the rep-range top / progression weight for a first-timer. Reference
    // the SAME set position last session, else its last set.
    const last=(typeof getLastExercisePerformance==='function')?getLastExercisePerformance(ex.id,date):null;
    const lastSets=(last&&last.log&&last.log[ex.id]&&Array.isArray(last.log[ex.id].sets))?last.log[ex.id].sets.filter(s=>s.reps||s.kg):[];
    const refSet=lastSets[doneCount]||lastSets[lastSets.length-1]||null;
    const defReps=(refSet&&parseInt(refSet.reps))||rangeTop;
    const lastKg=(refSet&&parseFloat(refSet.kg))||null;
    const defKg=weighted?((sug&&sug.kg!=null)?sug.kg:(lastKg!=null?lastKg:'')):'';
    const lastRef=refSet?`last ${refSet.kg?refSet.kg+'kg×':''}${refSet.reps||'—'}`:'';
    const kgControl=weighted?`
        <div style="display:flex;align-items:center;gap:5px;">
          <button onclick="_wmAccStep('kg-${ex.id}',-2.5)" style="${btnS}">−</button>
          <input id="wm-acc-kg-${ex.id}" type="number" step="0.5" inputmode="decimal" value="${defKg}" style="${inS}">
          <span style="font-size:11px;color:var(--text3);">kg</span>
          <button onclick="_wmAccStep('kg-${ex.id}',2.5)" style="${btnS}">+</button>
        </div>`:'';
    return `<div style="border-top:1px solid var(--border);padding-top:10px;margin-top:10px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">
          <div style="font-size:14px;color:var(--text);font-weight:700;min-width:0;">${ex.name}</div>
          <div style="font-size:11px;color:var(--text2);flex-shrink:0;">${target}×${ex.reps}${lastRef?` · <span style="color:var(--text3);">${lastRef}</span>`:''} · <span style="color:var(--lime);">${doneCount}/${target} done</span></div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:5px;">
            <button onclick="_wmAccStep('reps-${ex.id}',-1)" style="${btnS}">−</button>
            <input id="wm-acc-reps-${ex.id}" type="number" inputmode="numeric" value="${defReps}" style="${inS}">
            <span style="font-size:11px;color:var(--text3);">reps</span>
            <button onclick="_wmAccStep('reps-${ex.id}',1)" style="${btnS}">+</button>
          </div>
          ${kgControl}
          <button onclick="wmRestLogSet('${ex.id}')" style="margin-left:auto;padding:9px 14px;background:rgba(200,255,0,.14);border:1px solid var(--lime);border-radius:8px;color:var(--lime);font-size:12px;font-weight:700;cursor:pointer;">✓ Log set</button>
        </div>
      </div>`;
  }).join('')
  +(_more>0?`<div style="font-size:11px;color:var(--text3);margin-top:12px;padding-top:9px;border-top:1px dashed var(--border);">Then: ${accs[1].name}${_more>1?` · +${_more-1} more`:''}</div>`:'');
}
function _wmAccessoryPanelHTML(currentExId){
  // Phase 63b: always render — real accessories when there are any, else the
  // deep-squat mobility fallback. Header adapts to what's shown.
  const hasAcc=_wmRestAccessories(currentExId).length>0;
  const title=hasAcc?'Knock out accessories now':'Rest-gap mobility';
  const sub=hasAcc
    ?'Do these during your rest — logged for real, so they drop off the end of the session.'
    :'No accessories left for this session — sink into a deep (Asian) squat while you rest to open hips + ankles.';
  return `<div style="background:rgba(200,255,0,.04);border:1px solid rgba(200,255,0,.22);border-radius:12px;padding:12px 14px;margin:0 0 14px;">
      <div style="font-size:10px;color:var(--lime);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">${title}</div>
      <div style="font-size:11px;color:var(--text2);margin-top:2px;line-height:1.4;">${sub}</div>
      <div id="wm-rest-acc-rows">${_wmAccessoryRowsHTML(currentExId)}</div>
    </div>`;
}
// Phase 69: rest-gap Deep Squat mobility hold — a REAL timed drill (replaces the
// dead Phase-63b _fillers filler). Shown when a rest gap has no session accessory
// left. Optional. Runs a count-up stopwatch on its OWN interval (wm._mobInterval),
// independent of the rest countdown, so it never gates or touches the next set. On
// "Done" it logs a {seconds,done} set into the mob_deepsquat exercise (counts as
// seconds-volume, progresses by duration via suggestTime) AND — for stretch users
// — ticks the restMobility 0/7 tracker tile (and nothing else).
// Phase 83: two rest-gap mobility drills to choose from — a deep-squat hold (hips/
// ankles) and a 45s plank (core). `wm.mobDrillId` holds the current selection; each
// drill logs to its OWN exercise (own seconds-volume + duration progression). The
// restMobility 0/7 tile is credited the same either way (day-level compliance dot).
const MOB_STRETCH_TYPE='restMobility';
const MOB_STRETCH_ID='rm_deep_squat';
const MOB_DRILLS=[
  { id:'mob_deepsquat', emoji:'🧘', label:'Deep Squat', full:'Deep Squat Hold', fallbackTarget:60, hint:'Hold a deep squat ~60s' },
  { id:'mob_plank',     emoji:'🧱', label:'Plank',      full:'Plank',           fallbackTarget:45, hint:'Brace a hard plank ~45s' },
];
function _mobDrillId(){ return wm.mobDrillId||MOB_DRILLS[0].id; }
function _mobDrillMeta(){ const id=_mobDrillId(); return MOB_DRILLS.find(d=>d.id===id)||MOB_DRILLS[0]; }
function _mobDrill(){ const id=_mobDrillId(); return (typeof getAllExercises==='function')?getAllExercises().find(e=>e.id===id):null; }
// Most recent PRIOR day (any session type) that logged the hold — suggestTime's
// progression reference, since the drill can be done on any training day.
function _mobPrevSession(date){
  const id=_mobDrillId();
  const log=(typeof getExLog==='function')?getExLog():{};
  const dates=Object.keys(log).filter(d=>d<date&&log[d]&&log[d][id]&&Array.isArray(log[d][id].sets)&&log[d][id].sets.some(s=>s&&s.seconds)).sort();
  if(!dates.length)return null;
  const d=dates[dates.length-1];
  return {log:{[id]:log[d][id]}};
}
function _wmMobilityFallbackHTML(currentExId){
  const date=todayStr();
  const id=_mobDrillId();
  const meta=_mobDrillMeta();
  const drill=_mobDrill();
  const loggedThisRest=wm._mobLoggedRest===wm.restStarted&&wm.restStarted!=null;
  const sug=(drill&&typeof suggestTime==='function')?suggestTime(id,drill,_mobPrevSession(date),0):null;
  const pb=(typeof getBestLift==='function')?getBestLift(id):null;
  const target=sug?sug.seconds:meta.fallbackTarget;
  const hint=sug?sug.reason:meta.hint;
  const pbStr=(pb&&pb.seconds)?` · PB ${fmtSec(pb.seconds)}`:'';
  // Drill picker (deep squat / plank) — only before you log this rest's hold.
  const chips=loggedThisRest?'':`<div style="display:flex;gap:6px;margin-top:8px;">${MOB_DRILLS.map(d=>{
    const on=d.id===id;
    return `<button onclick="wmSelectMobDrill('${d.id}')" style="flex:1;padding:7px 4px;border-radius:8px;border:1px solid ${on?'var(--lime)':'var(--border2)'};background:${on?'rgba(200,255,0,.12)':'var(--bg2)'};color:${on?'var(--lime)':'var(--text2)'};font-size:12px;font-weight:700;cursor:pointer;">${d.emoji} ${d.label}</button>`;
  }).join('')}</div>`;
  const actions=loggedThisRest
    ? `<span id="wm-mob-state" style="font-size:12px;font-weight:700;color:${wm._mobLastStatus==='done'?'var(--green)':'var(--text3)'};">${wm._mobLastStatus==='done'?`✓ Held ${fmtSec(wm._mobLastSeconds||0)}`:'Skipped'}</span>`
    : `<button id="wm-mob-btn" onclick="wmRestMobilityStart()" style="padding:8px 12px;background:rgba(0,200,120,.14);border:1px solid var(--green);border-radius:8px;color:var(--green);font-size:12px;font-weight:700;cursor:pointer;">▶ Start hold</button>
       <button onclick="wmRestMobilitySkip()" style="padding:8px 12px;background:transparent;border:1px solid var(--border);border-radius:8px;color:var(--text3);font-size:12px;cursor:pointer;">Skip</button>`;
  return `<div style="border-top:1px solid var(--border);padding-top:10px;margin-top:10px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">
        <div style="font-size:14px;color:var(--text);font-weight:700;">${meta.emoji} ${meta.full}</div>
        <div style="font-size:11px;color:var(--text2);flex-shrink:0;">target ${fmtSec(target)}${pbStr} · optional</div>
      </div>
      <div style="font-size:11px;color:var(--text2);margin-top:2px;line-height:1.4;">${hint}</div>
      ${chips}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:8px;">
        <div id="wm-mob-timer" style="font-family:'Archivo Black',sans-serif;font-size:30px;color:var(--lime);letter-spacing:-1px;line-height:1;">${loggedThisRest&&wm._mobLastStatus==='done'?fmtSec(wm._mobLastSeconds||0):'0:00'}</div>
        <div id="wm-rest-mob-actions" style="display:flex;gap:6px;flex-shrink:0;">${actions}</div>
      </div>
    </div>`;
}
// Switch the active rest-gap mobility drill (deep squat <-> plank). Stops any running
// hold, then re-renders only the fallback panel so the countdown is untouched.
function wmSelectMobDrill(id){
  if(!MOB_DRILLS.some(d=>d.id===id))return;
  if(wm._mobInterval){clearInterval(wm._mobInterval);wm._mobInterval=null;}
  wm._mobStartedAt=0;
  wm.mobDrillId=id;
  const w=getWorkout(wm.session);
  const curId=(w.exercises[wm.exIdx]||{}).id;
  const box=document.getElementById('wm-rest-acc-rows');
  if(box)box.innerHTML=_wmAccessoryRowsHTML(curId);
}
// Start the deep-squat count-up on its own interval (never the rest countdown).
function wmRestMobilityStart(){
  if(wm._mobInterval){clearInterval(wm._mobInterval);wm._mobInterval=null;}
  wm._mobStartedAt=Date.now();
  wm._mobInterval=setInterval(()=>{
    const el=document.getElementById('wm-mob-timer');
    if(el)el.textContent=fmtSec(Math.floor((Date.now()-wm._mobStartedAt)/1000));
  },200);
  const btn=document.getElementById('wm-mob-btn');
  if(btn){btn.textContent='✓ Done';btn.setAttribute('onclick','wmRestMobilityDone()');btn.style.background='rgba(200,255,0,.14)';btn.style.borderColor='var(--lime)';btn.style.color='var(--lime)';}
}
// Log the hold as a real {seconds} working set + tick the restMobility tile.
function wmRestMobilityDone(){
  const seconds=wm._mobStartedAt?Math.floor((Date.now()-wm._mobStartedAt)/1000):0;
  if(wm._mobInterval){clearInterval(wm._mobInterval);wm._mobInterval=null;}
  wm._mobStartedAt=0;
  const date=todayStr();
  const drillId=_mobDrillId();
  const dayLog=getExLogForDate(date);
  if(!dayLog[drillId]||!Array.isArray(dayLog[drillId].sets))dayLog[drillId]={sets:[]};
  dayLog[drillId].sets.push({seconds,done:true,doneAt:Date.now(),setCompletedAt:Date.now(),viaRest:true});
  saveExLogForDate(date,dayLog);
  // Tick the restMobility 0/7 tile — restMobility type ONLY (never morning/evening/flexibility).
  // Either drill credits the same day-level tile; record the specific drill's stretch id.
  if(typeof isStretchUser==='function'&&isStretchUser()){
    const stretchId=drillId==='mob_plank'?'rm_plank':MOB_STRETCH_ID;
    if(typeof markStretchDone==='function')markStretchDone(date,MOB_STRETCH_TYPE,stretchId);
    if(typeof saveStretchSession==='function')saveStretchSession(date,MOB_STRETCH_TYPE);
  }
  wm._mobLoggedRest=wm.restStarted; wm._mobLastStatus='done'; wm._mobLastSeconds=seconds;
  const box=document.getElementById('wm-rest-mob-actions');
  if(box)box.innerHTML=`<span id="wm-mob-state" style="font-size:12px;font-weight:700;color:var(--green);">✓ Held ${fmtSec(seconds)}</span>`;
}
function wmRestMobilitySkip(){
  if(wm._mobInterval){clearInterval(wm._mobInterval);wm._mobInterval=null;}
  wm._mobStartedAt=0;
  wm._mobLoggedRest=wm.restStarted; wm._mobLastStatus='skipped';
  const box=document.getElementById('wm-rest-mob-actions');
  if(box)box.innerHTML=`<span id="wm-mob-state" style="font-size:12px;font-weight:700;color:var(--text3);">Skipped</span>`;
}
// Nudge a rest-accessory reps/kg field. Keys: 'reps-<exId>' or 'kg-<exId>'.
function _wmAccStep(key,delta){
  const el=document.getElementById('wm-acc-'+key);
  if(!el)return;
  if(key.indexOf('kg-')===0){
    const cur=parseFloat(el.value)||0; el.value=Math.max(0,Math.round((cur+delta)*2)/2);
  }else{
    const cur=parseInt(el.value)||0; el.value=Math.max(0,cur+delta);
  }
}
// Log one real working set for a rest-gap accessory. Writes into the accessory's
// own exLog entry (never the resting lift's), marks it done at target set count,
// and re-renders ONLY the accessory rows so the rest countdown is untouched.
function wmRestLogSet(exId){
  const w=getWorkout(wm.session);
  const ex=(w.exercises||[]).find(e=>e.id===exId);
  if(!ex)return;
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const repsEl=document.getElementById('wm-acc-reps-'+exId);
  const kgEl=document.getElementById('wm-acc-kg-'+exId);
  const reps=repsEl?(parseInt(repsEl.value)||''):'';
  const kg=kgEl?(parseFloat(kgEl.value)||''):'';
  if(!dayLog[ex.id]||typeof dayLog[ex.id]!=='object')dayLog[ex.id]={done:false,sets:[]};
  if(!Array.isArray(dayLog[ex.id].sets))dayLog[ex.id].sets=[];
  if(!dayLog[ex.id].exerciseStartedAt)dayLog[ex.id].exerciseStartedAt=Date.now();
  const sets=dayLog[ex.id].sets;
  let idx=0; while(sets[idx]&&sets[idx].done)idx++;
  sets[idx]={kg,reps,done:true,doneAt:Date.now(),setCompletedAt:Date.now(),viaRest:true};
  const target=_effectiveSets(ex);
  const doneCount=sets.filter(s=>s.done).length;
  if(doneCount>=target){
    dayLog[ex.id].done=true;
    dayLog[ex.id].exerciseCompletedAt=Date.now();
    if(dayLog[ex.id].exerciseStartedAt)dayLog[ex.id].totalExerciseDuration=Math.round((Date.now()-dayLog[ex.id].exerciseStartedAt)/1000);
  }
  saveExLogForDate(date,dayLog);
  // One accessory set per rest: mark THIS rest gap as used so the panel locks
  // (no second Log button) until the next rest, when the same accessory (if not
  // yet finished) comes back for its next set.
  wm.restAccGapLogged=wm.restStarted;
  wm.restAccLoggedId=ex.id;
  const box=document.getElementById('wm-rest-acc-rows');
  const curId=(w.exercises[wm.exIdx]||{}).id;
  if(box)box.innerHTML=_wmAccessoryRowsHTML(curId);
  showToast(doneCount>=target?`✓ ${ex.name} complete`:`✓ ${ex.name} · set ${doneCount}/${target} — next set on your next rest`);
}

// Is an exercise finished for today (all sets done, or deliberately skipped)?
function _wmExComplete(exId){
  const log=getExLogForDate(todayStr())[exId];
  return !!(log&&(log.done||log.skipped));
}
// First set index not yet logged for an exercise (handles accessories partly done
// during rest — the main flow resumes at the next unlogged set, not set 1).
function _wmFirstUndoneSetIdx(exId){
  const log=getExLogForDate(todayStr())[exId];
  const sets=(log&&Array.isArray(log.sets))?log.sets:[];
  let i=0; while(sets[i]&&sets[i].done)i++;
  return i;
}
// Next exercise index after `from` that isn't already complete/skipped (-1 = none).
function _wmNextPendingIdx(from){
  const ex=getWorkout(wm.session).exercises;
  for(let i=from+1;i<ex.length;i++)if(!_wmExComplete(ex[i].id))return i;
  return -1;
}
// First pending exercise index in the session (-1 = none left).
function _wmFirstPendingIdx(){ return _wmNextPendingIdx(-1); }

function wmStartNextSet(){
  wm.postExercise=false; // Phase 83: normal between-set rest, not the post-exercise one
  if(wm._mobInterval){clearInterval(wm._mobInterval);wm._mobInterval=null;} // Phase 69: stop any running mobility hold timer
  const elapsed=Math.floor((Date.now()-wm.restStarted)/1000);
  const w=getWorkout(wm.session);
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
  const w=getWorkout(wm.session);
  const ex=w.exercises[wm.exIdx];
  if(!ex)return;
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const prev=getPreviousSessionData(date,wm.session);
  const prevSessions=getPreviousSessions(date,wm.session,5);
  const gate=effectiveRecoveryGate(); // Phase 44: honours the user's train/easy choice
  const sug=suggestWeight(ex.id,prev,wm.setIdx,{lowRecovery:gate.lowRecovery,recoveryReason:gate.reason,prevSessions,exObj:ex});
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
    <div class="wm-sub" style="margin-bottom:30px;">Set ${wm.setIdx+1} of ${_effectiveSets(ex)} · ${upcoming}</div>
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
  const w=getWorkout(wm.session);
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

// Phase 83: after an exercise's final set, run one more rest gap with the same
// filler panel (remaining rehab accessory, else a deep-squat/plank mobility hold)
// BEFORE the exercise-complete summary — a standard between-exercise slot to knock
// out accessories/mobility. Skipped after the LAST exercise (nothing follows), so
// it never adds friction to finishing.
function _wmEnterPostExerciseRest(ex){
  if(_wmNextPendingIdx(wm.exIdx)===-1){ wm.postExercise=false; wm.mode='exDone'; renderWmExerciseDone(); return; }
  wm.mode='rest';
  wm.postExercise=true;
  wm.restStarted=Date.now();
  wm.restTarget=(ex&&ex.rest)?ex.rest:60;
  renderWmRest();
}
// End the post-exercise rest → show the exercise-complete summary.
function wmEndPostExerciseRest(){
  if(wm.restInterval){clearInterval(wm.restInterval);wm.restInterval=null;}
  if(wm._mobInterval){clearInterval(wm._mobInterval);wm._mobInterval=null;}
  wm.postExercise=false;
  wm.mode='exDone';
  renderWmExerciseDone();
}

function renderWmExerciseDone(){
  const w=getWorkout(wm.session);
  const ex=w.exercises[wm.exIdx];
  const timed=isTimeBased(ex);
  const carry=(typeof isCarry==='function')&&isCarry(ex); // Phase 53
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  const sets=dayLog[ex.id]?.sets||[];
  const exEffort=dayLog[ex.id]?.effort;
  const volume=(timed||carry)?0:sets.reduce((s,x)=>s+(parseFloat(x.kg)||0)*(parseInt(x.reps)||0),0);
  const isLastEx=_wmNextPendingIdx(wm.exIdx)===-1; // Phase 63: nothing left once rest-done accessories are excluded
  const effortEmoji={easy:'😌',solid:'💪',tough:'🔥',hard:'🔥',maybe:'🤔'};
  const effortLabel={easy:'easy',solid:'solid',tough:'tough'};
  const subText=carry
    ?`${sets.filter(s=>s.done).length} sets · timed both sides`
    :timed
    ?`${sets.filter(s=>s.done).length} sets${exEffort?' · effort: '+effortLabel[exEffort]:''}`
    :`${sets.filter(s=>s.done).length} sets · ${volume>0?volume.toFixed(0)+'kg total volume':''}`;
  const html=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:32px;">Exercise ${wm.exIdx+1} complete</div>
    <div class="wm-title" style="color:var(--green);margin-top:6px;">✓ ${ex.name}</div>
    <div class="wm-sub">${subText}</div>
    <div class="wm-h" style="margin-top:24px;">Sets</div>
    ${sets.filter(s=>s.done).map((s,i)=>{
      const val=carry?`L ${s.leftSeconds||0}s · R ${s.rightSeconds||0}s`:timed?fmtSec(s.seconds):`${s.kg}kg × ${s.reps}`;
      return `<div class="wm-set-summary"><div>Set ${i+1}</div><div>${val}${s.effort?' '+effortEmoji[s.effort]:''}${s.restAfter?` · ${s.restAfter}s rest`:''}</div></div>`;
    }).join('')}
    <button class="wm-cta" style="margin-top:24px;" onclick="wmNextExercise()">${isLastEx?'FINISH WORKOUT 🎉':'NEXT EXERCISE →'}</button>
  `;
  document.getElementById('wmContent').innerHTML=html;
}

function wmNextExercise(){
  const w=getWorkout(wm.session);
  wm.autoReg=null; // Phase 47: don't carry a set-to-set call across exercises
  wm.postExercise=false; // Phase 83: clear the between-exercise rest flag
  // Phase 63: skip exercises already completed during rest (or skipped).
  const nextIdx=_wmNextPendingIdx(wm.exIdx);
  if(nextIdx===-1){wmFinish();return;}
  wm.exIdx=nextIdx;
  wm.setIdx=_wmFirstUndoneSetIdx(w.exercises[nextIdx].id);
  wm.mode='set';
  wm.setStartedAt=Date.now();
  _wmMarkExerciseStart();
  renderWmSet();
}

// Phase 47: skip an exercise — a deliberate "not today", NOT a failure. No sets
// are logged, so the progression engine carries your last real session forward
// (no deload), and the score/recap exclude it. The coach is told you chose to skip.
function wmSkipExercise(){
  const w=getWorkout(wm.session);
  const ex=w.exercises[wm.exIdx];
  if(!confirm(`Skip ${ex.name}? It won't count against you — your next session won't deload from a skip.`))return;
  const date=todayStr();
  const dayLog=getExLogForDate(date);
  dayLog[ex.id]={done:false,skipped:true,skippedAt:Date.now(),sets:[]};
  saveExLogForDate(date,dayLog);
  wm.autoReg=null;
  showToast(`${ex.name} skipped — no harm done`);
  // Phase 63: advance past anything already completed during rest.
  const nextIdx=_wmNextPendingIdx(wm.exIdx);
  if(nextIdx===-1){wmFinish();return;}
  wm.exIdx=nextIdx;
  wm.setIdx=_wmFirstUndoneSetIdx(w.exercises[nextIdx].id);
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
  const w=getWorkout(wm.session);
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
  // Phase 62: filler (mobility/rehab) adherence — done vs skipped per lift.
  const fillers=(typeof fillerAdherence==='function')?fillerAdherence(date):[];
  const fillDone=fillers.reduce((a,f)=>a+f.done,0), fillSkip=fillers.reduce((a,f)=>a+f.skipped,0);
  const _liftName=(id)=>{const e=(w.exercises||[]).find(x=>x.id===id)||((typeof getAllExercises==='function')?getAllExercises().find(x=>x.id===id):null);return e?e.name:id;};
  const fillerRecap=fillers.length?`<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);">
      <div style="font-size:11px;font-weight:700;color:#a7a2ff;">Filler work: ${fillDone} done${fillSkip?` · ${fillSkip} skipped`:''}</div>
      ${fillers.map(f=>`<div style="font-size:11px;color:var(--text3);margin-top:2px;">${_liftName(f.parentId)} → ${f.fillerName}: ${f.done}/${f.total}${f.skipped?` · ${f.skipped} skipped`:''}</div>`).join('')}
    </div>`:'';
  const recap=`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:14px;margin:8px 0 16px;text-align:left;">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px;">How you got on</div>
      <div style="font-size:13px;color:var(--text);line-height:1.6;">${totalSets} sets${volStr}${durStr}</div>
      ${verdict?`<div style="font-size:12px;color:${vColor};margin-top:6px;line-height:1.5;">${verdict}</div>`:''}
      ${effStr?`<div style="font-size:11px;color:var(--text3);margin-top:6px;">Effort: ${effStr}</div>`:''}
      ${skipped.length?`<div style="font-size:11px;color:var(--text3);margin-top:6px;">Skipped: ${skipped.join(', ')} — carried forward, no deload.</div>`:''}
      ${feel?`<div style="font-size:11px;color:var(--text3);margin-top:6px;">You came in feeling: ${feel}.</div>`:''}
      ${sessNote?`<div style="font-size:11px;color:var(--text2);margin-top:6px;font-style:italic;">"${(typeof _esc==='function'?_esc(sessNote):sessNote)}"</div>`:''}
      ${fillerRecap}
    </div>`;
  let feelVsPerf='';
  if(feel&&score&&typeof score.pct==='number'&&score.sessions4w>=1){
    const feelMap={strong:'💪 Strong',ok:'👍 OK',tired:'😴 Tired'};
    const pct=score.pct;
    let fvpVerdict;
    if(pct>=100) fvpVerdict = feel==='tired' ? 'You outperformed your average — stronger than you felt.' : 'Right on your average.';
    else if(pct>=90) fvpVerdict = 'About on par with your 4-week average.';
    else fvpVerdict = feel==='strong' ? 'A bit below average despite feeling good — worth noting.' : 'A lighter day, below your 4-week average.';
    feelVsPerf=`<div style="text-align:center;color:var(--text2);font-size:13px;line-height:1.6;margin:0 0 16px;padding:12px 14px;background:rgba(200,255,0,.06);border:1px solid rgba(200,255,0,.2);border-radius:12px;">You said <strong style="color:var(--text);">${feelMap[feel]||feel}</strong> — this ${w.name} hit <strong style="color:var(--lime);">${pct}%</strong> of your 4-week average. ${fvpVerdict}</div>`;
  }
  const html=`
    <button class="wm-close" onclick="exitGuidedWorkout()">✕</button>
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:40px;text-align:center;">Workout complete</div>
    <div class="wm-title" style="text-align:center;font-size:32px;color:var(--green);margin-top:8px;">✓ ${w.name} DONE</div>
    <div style="text-align:center;font-size:40px;margin:16px 0;">🔥</div>
    ${recap}
    <div style="text-align:center;margin-bottom:14px;"><span onclick="wmAddSessionNote()" style="font-size:11px;color:var(--text3);text-decoration:underline;cursor:pointer;">+ add a note about today</span></div>
    ${feelVsPerf}
    <button class="wm-cta" onclick="finishGuidedWorkout()">FINISH</button>
  `;
  document.getElementById('wmContent').innerHTML=html;
  showToast('🔥 Session complete! Great work!');
}
