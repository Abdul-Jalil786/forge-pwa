// ============================================================
// TODAY PAGE
// ============================================================
function renderToday(){
  const p=getActive(); if(!p)return;
  const session=getTodaySession();
  const cw=getCurrentWeight();
  const lost=p.startWeight-cw;
  const toGo=cw-p.targetWeight;
  const pct=Math.max(0,Math.min(100,Math.round((lost/(p.startWeight-p.targetWeight))*100)));
  const totals=getTodayTotals();
  const calTarget=session?p.calsGym:p.calsRest;
  const steps=getTodaySteps();
  const water=getWater();
  const sleepLog=getSleepLog();
  const lastSleep=sleepLog[todayStr()]?.hours||sleepLog[Object.keys(sleepLog).sort().pop()]?.hours||0;
  const dayLog=getTodayExLog();
  const w=session?WORKOUTS[session]:null;
  const exDone=w?w.exercises.filter(e=>dayLog[e.id]?.done).length:0;
  const exTotal=w?w.exercises.length:0;
  const exPct=exTotal?Math.round((exDone/exTotal)*100):0;
  const report=getWeeklyReport();
  const stepStreak=calcStreak('steps');

  document.getElementById('page-today').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
      <div>
        <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:3px;">${dayName()}</div>
        <div class="pg-title">${p.name.split(' ')[0]}'s<br>Dashboard</div>
      </div>
      <button class="btn btn-lime btn-sm" onclick="openModal('modal-weight')" style="margin-top:4px;">+ Weight</button>
    </div>

    <div class="card hi" style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px;">
        <div>
          <div style="font-size:10px;color:var(--text2);margin-bottom:2px;">CURRENT WEIGHT</div>
          <div style="font-family:'Archivo Black',sans-serif;font-size:38px;color:var(--lime);letter-spacing:-2px;">${cw}kg</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:var(--text2);">TARGET</div>
          <div style="font-family:'Archivo Black',sans-serif;font-size:20px;">${p.targetWeight}kg</div>
        </div>
      </div>
      <div class="pb-wrap" style="margin-bottom:0;">
        <div class="pb-head"><span class="pb-lbl">${p.startWeight}kg → ${p.targetWeight}kg</span><span class="pb-pct">${pct}%</span></div>
        <div class="pb"><div class="pb-fill" style="width:${pct}%"></div></div>
      </div>
    </div>

    <div class="sg sg3" style="margin-bottom:10px;">
      <div class="sb green"><div class="l">Lost</div><div class="v">${lost>0?lost.toFixed(1):'0'}<span class="u">kg</span></div></div>
      <div class="sb orange"><div class="l">To Go</div><div class="v">${toGo>0?toGo.toFixed(1):'0'}<span class="u">kg</span></div></div>
      <div class="sb purple"><div class="l">Sleep</div><div class="v">${lastSleep?lastSleep+'<span class="u">hrs</span>':'—'}</div></div>
    </div>

    ${session?`
    <div class="card hi" style="margin-bottom:10px;cursor:pointer;" onclick="nav('workout')">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div>
          <div style="font-size:9px;font-weight:700;color:var(--lime);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">TODAY'S SESSION</div>
          <div style="font-family:'Archivo Black',sans-serif;font-size:18px;letter-spacing:-.5px;">${w.name}</div>
          <div style="font-size:11px;color:var(--text2);">${w.muscles}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:'Archivo Black',sans-serif;font-size:28px;color:var(--lime);">${exDone}/${exTotal}</div>
          <div style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;">done</div>
        </div>
      </div>
      <div class="pb"><div class="pb-fill" style="width:${exPct}%"></div></div>
    </div>`:`
    <div class="rest-hero" style="padding:20px;margin-bottom:10px;">
      <div class="rest-emoji">🔋</div>
      <div class="rest-title" style="font-size:22px;">Rest Day</div>
      <div class="rest-sub">Walk, swim, recover. Come back stronger.</div>
    </div>`}

    <div class="sg sg2">
      <div class="sb${totals.cals>=calTarget?' green':' lime'}">
        <div class="l">Calories</div>
        <div class="v">${totals.cals}<span class="u">/${calTarget}</span></div>
      </div>
      <div class="sb${totals.protein>=p.proteinTarget?' green':' orange'}">
        <div class="l">Protein</div>
        <div class="v">${totals.protein}<span class="u">/${p.proteinTarget}g</span></div>
      </div>
    </div>
    <div class="sg sg2">
      <div class="sb${steps>=10000?' green':' blue'}">
        <div class="l">Steps</div>
        <div class="v">${steps>=1000?(steps/1000).toFixed(1)+'k':steps||'0'}<span class="u">/10k</span></div>
      </div>
      <div class="sb cyan" style="--cyan:var(--cyan)">
        <div class="l">Water</div>
        <div class="v" style="color:var(--cyan)">${water}<span class="u">/8 cups</span></div>
      </div>
    </div>

    ${report?`
    <div class="sec-label">This Week</div>
    <div class="card" onclick="nav('coach')" style="cursor:pointer;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-weight:700;font-size:14px;">Weekly Score</div>
        <div style="font-family:'Archivo Black',sans-serif;font-size:28px;color:${report.overall>=75?'var(--green)':report.overall>=60?'var(--lime)':'var(--orange)'};">${report.overall}<span style="font-size:14px;color:var(--text2);">/100</span></div>
      </div>
      <div class="pb"><div class="pb-fill" style="width:${report.overall}%"></div></div>
      <div style="font-size:11px;color:var(--text2);margin-top:6px;">Steps ${report.stepsHit}/7 · Protein ${report.proteinDays}/7 · Gym ${report.gymDays}/4 · Tap for AI coaching →</div>
    </div>`:''}

    <div style="display:flex;gap:8px;margin-bottom:10px;">
      <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="nav('food')">+ Food</button>
      <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="openModal('modal-sleep')">+ Sleep</button>
      <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="nav('more')">+ Water</button>
    </div>
  `;
}

// ============================================================
// FOOD PAGE
// ============================================================
function renderFood(){
  const p=getActive(); if(!p)return;
  const session=getTodaySession();
  const calTarget=session?p.calsGym:p.calsRest;
  const foods=getFoods().sort((a,b)=>a.time.localeCompare(b.time));
  const totals=getTodayTotals();
  const carbTarget=Math.round((calTarget*0.38)/4);
  const fatTarget=Math.round((calTarget*0.28)/9);
  const templates=getTemplates();

  document.getElementById('page-food').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <div class="pg-title">Food</div>
      <button class="btn btn-lime btn-sm" onclick="openModal('modal-food')">+ Log</button>
    </div>

    ${STATE.mealPlan?renderTodaysPlan():''}

    <div class="card hi">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px;">
        <div>
          <div style="font-size:10px;color:var(--text2);margin-bottom:2px;">CALORIES TODAY</div>
          <div style="font-family:'Archivo Black',sans-serif;font-size:42px;color:var(--lime);letter-spacing:-2px;">${totals.cals}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:var(--text2);">TARGET</div>
          <div style="font-family:'Archivo Black',sans-serif;font-size:20px;">${calTarget}</div>
          <div style="font-size:11px;color:${totals.cals>calTarget?'var(--red)':'var(--text2)'};">${Math.abs(calTarget-totals.cals)} ${totals.cals>calTarget?'over':'left'}</div>
        </div>
      </div>
      <div class="pb"><div class="pb-fill" style="width:${Math.min(100,(totals.cals/calTarget)*100)}%"></div></div>
    </div>

    <div class="sg sg3">
      <div class="sb orange"><div class="l">Protein</div><div class="v">${totals.protein}<span class="u">g</span></div></div>
      <div class="sb blue"><div class="l">Carbs</div><div class="v">${totals.carbs}<span class="u">g</span></div></div>
      <div class="sb purple"><div class="l">Fat</div><div class="v">${totals.fat}<span class="u">g</span></div></div>
    </div>

    <div class="card" style="margin-bottom:10px;">
      <div class="macro-row"><div class="macro-hdr"><span class="macro-name" style="color:var(--orange);">Protein</span><span class="macro-amt">${totals.protein}g / ${p.proteinTarget}g</span></div><div class="macro-bar"><div class="macro-fill mf-p" style="width:${Math.min(100,(totals.protein/p.proteinTarget)*100)}%"></div></div></div>
      <div class="macro-row"><div class="macro-hdr"><span class="macro-name" style="color:var(--blue);">Carbs</span><span class="macro-amt">${totals.carbs}g / ${carbTarget}g</span></div><div class="macro-bar"><div class="macro-fill mf-c" style="width:${Math.min(100,(totals.carbs/carbTarget)*100)}%"></div></div></div>
      <div class="macro-row" style="margin-bottom:0;"><div class="macro-hdr"><span class="macro-name" style="color:var(--purple);">Fat</span><span class="macro-amt">${totals.fat}g / ${fatTarget}g</span></div><div class="macro-bar"><div class="macro-fill mf-f" style="width:${Math.min(100,(totals.fat/fatTarget)*100)}%"></div></div></div>
    </div>

    <div class="sec-label">Today's Log</div>
    <div class="card">
      ${foods.length===0?'<div style="text-align:center;color:var(--text3);padding:20px 0;font-size:13px;">Nothing logged yet</div>':
        foods.map((f,i)=>`
          <div class="food-row">
            <div class="food-time">${f.time}</div>
            <div class="food-name">${f.name}</div>
            <div class="food-right"><div class="food-cals">${f.cals} kcal</div><div class="food-p">${f.protein||0}g protein</div></div>
            <button class="del-btn" onclick="delFood(${i})">×</button>
          </div>`).join('')}
    </div>

    ${templates.length>0?`
    <div class="sec-label">Quick Templates</div>
    <div class="card">
      ${templates.map((t,i)=>`
        <div class="food-row">
          <div class="food-name" style="font-size:12px;">${t.name}</div>
          <div class="food-right"><div class="food-cals">${t.cals} kcal</div><div class="food-p">${t.protein||0}g P</div></div>
          <button class="btn btn-lime btn-sm" style="font-size:11px;padding:6px 10px;" onclick="addFromTemplate(${i})">+Add</button>
          <button class="del-btn" onclick="delTemplate(${i})">×</button>
        </div>`).join('')}
    </div>`:''}

    <div class="sec-label">Eating Window</div>
    <div class="card">
      <div style="font-size:10px;color:var(--text2);margin-bottom:4px;">6-HOUR WINDOW · LOW GI</div>
      <div style="font-family:'Archivo Black',sans-serif;font-size:24px;color:var(--lime);">12:00 PM — 6:00 PM</div>
      <div style="font-size:12px;color:var(--text2);margin-top:4px;">18 hours fasting</div>
    </div>
  `;

  renderFoodTemplatesModal();
}

function renderFoodTemplatesModal(){
  const templates=getTemplates();
  const el=document.getElementById('food-templates');
  if(!el)return;
  el.innerHTML=templates.length===0?'<div style="font-size:12px;color:var(--text3);padding:8px 0;">Save a meal as template to re-add it in one tap.</div>':
    templates.map((t,i)=>`
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);">
        <div style="flex:1;font-size:12px;font-weight:600;">${t.name} <span style="color:var(--text2);font-weight:400;">${t.cals}kcal</span></div>
        <button class="btn btn-lime btn-sm" style="font-size:11px;" onclick="addFromTemplate(${i});closeModal('modal-food');">Use</button>
      </div>`).join('');
}

function renderTodaysPlan(){
  const plan=STATE.mealPlan;
  if(!plan||!plan.meals||!plan.meals.length)return '';
  const todayFoods=getFoods();
  const loggedNames=new Set(todayFoods.map(f=>f.name));
  const totalCals=plan.meals.reduce((s,m)=>s+(m.cals||0),0);
  const totalP=plan.meals.reduce((s,m)=>s+(m.protein||0),0);
  return `
    <div class="sec-label">Today's Plan${plan.name?' — '+plan.name:''}</div>
    <div class="card" style="margin-bottom:10px;border-color:var(--lime);background:linear-gradient(135deg,rgba(200,255,0,.04),transparent);">
      <div style="font-size:11px;color:var(--text2);margin-bottom:6px;">${plan.meals.length} meals · ${totalCals} kcal · ${totalP}g protein</div>
      ${plan.meals.map(m=>{
        const logged=loggedNames.has(m.name);
        return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-top:1px solid var(--border);">
          <div style="font-size:11px;color:var(--text3);font-weight:700;width:46px;flex-shrink:0;padding-top:3px;">${m.time||''}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:13px;${logged?'color:var(--text3);text-decoration:line-through;':''}">${m.name}</div>
            <div style="font-size:11px;color:var(--text2);margin-top:2px;">${m.cals||0} kcal · ${m.protein||0}g P · ${m.carbs||0}g C · ${m.fat||0}g F</div>
            ${m.ingredients?`<div style="font-size:10px;color:var(--text3);margin-top:4px;line-height:1.55;">${m.ingredients}</div>`:''}
          </div>
          <button class="btn ${logged?'btn-ghost':'btn-lime'} btn-sm" style="font-size:11px;padding:6px 10px;flex-shrink:0;" onclick="logPlannedMeal('${m.id}')">${logged?'✓':'+ Log'}</button>
        </div>`;
      }).join('')}
    </div>
  `;
}

function delFood(i){deleteFoodEntry(i);renderFood();renderToday();showToast('Removed');}
function delTemplate(i){deleteTemplate(i);renderFood();}
function addFromTemplate(i){
  const t=getTemplates()[i];
  if(!t)return;
  saveFoodEntry({...t,time:fmtNow()});
  renderFood();renderToday();
  showToast(`${t.name} added ✓`);
}

// ============================================================
// TRACK PAGE (Weight + Steps + Streaks + Calendar)
// ============================================================
function renderTrack(){
  const p=getActive(); if(!p)return;
  const wl=getWeightLog();
  const cw=getCurrentWeight();
  const lost=p.startWidth-cw;
  const pct=Math.max(0,Math.min(100,Math.round(((p.startWeight-cw)/(p.startWeight-p.targetWeight))*100)));
  const stepsLog=getStepsLog();
  const last7=getLast7();
  const weekSteps=last7.map(d=>({date:d,steps:stepsLog[d]||0}));
  const stepsStreak=calcStreak('steps');
  const gymStreak=calcStreak('gym');
  const foodStreak=calcStreak('food');

  document.getElementById('page-track').innerHTML=`
    <div class="pg-title" style="margin-bottom:14px;">Progress</div>

    <div class="card hi">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <div>
          <div style="font-size:10px;color:var(--text2);">CURRENT</div>
          <div style="font-family:'Archivo Black',sans-serif;font-size:44px;color:var(--lime);letter-spacing:-3px;">${cw}<span style="font-size:20px;">kg</span></div>
        </div>
        <div style="text-align:right;">
          <button class="btn btn-lime btn-sm" onclick="openModal('modal-weight')">+ Log</button>
          <div style="font-size:10px;color:var(--text2);margin-top:8px;">Started ${p.startWeight}kg</div>
          <div style="font-size:10px;color:var(--text2);">Target ${p.targetWeight}kg</div>
        </div>
      </div>
      <div class="pb-wrap" style="margin-bottom:0;">
        <div class="pb-head"><span class="pb-lbl">Journey Progress</span><span class="pb-pct">${pct}%</span></div>
        <div class="pb"><div class="pb-fill" style="width:${pct}%"></div></div>
      </div>
    </div>

    <div class="sg sg3">
      <div class="sb green"><div class="l">Lost</div><div class="v">${Math.max(0,p.startWeight-cw).toFixed(1)}<span class="u">kg</span></div></div>
      <div class="sb orange"><div class="l">To Go</div><div class="v">${Math.max(0,cw-p.targetWeight).toFixed(1)}<span class="u">kg</span></div></div>
      <div class="sb blue"><div class="l">Entries</div><div class="v">${wl.length}</div></div>
    </div>

    <div class="sec-label">Weight History</div>
    <div class="card">
      ${wl.length===0?'<div style="text-align:center;color:var(--text3);padding:20px;font-size:13px;">No entries yet</div>':
        [...wl].reverse().slice(0,12).map((e,i,arr)=>{
          const prev=arr[i+1];
          const diff=prev?(e.weight-prev.weight):null;
          const cls=diff===null?'':diff<0?'dn':'up';
          const txt=diff===null?'—':diff<0?`▼ ${Math.abs(diff).toFixed(1)}kg`:`▲ ${diff.toFixed(1)}kg`;
          return `<div class="list-row">
            <div class="row-left"><div class="row-label">${fmtDate(e.date)}</div><div class="row-val">${e.weight}kg</div></div>
            <div class="row-diff ${cls}">${txt}</div>
          </div>`;
        }).join('')}
    </div>

    <div class="sec-label">Body Fat</div>
    <div class="card" style="margin-bottom:10px;">
      ${(()=>{
        const bfl=getBfLog();
        if(bfl.length===0)return '<div style="text-align:center;color:var(--text3);padding:20px;font-size:13px;">Log body fat % with your weight entries to see trends</div>';
        const cur=bfl[bfl.length-1];
        const prev=bfl.length>=2?bfl[bfl.length-2]:null;
        const diff=prev?(cur.bf-prev.bf):null;
        const diffHtml=diff!==null?`<div style="font-size:11px;color:${diff<=0?'var(--green)':'var(--red)'};">${diff>0?'+':''}${diff.toFixed(1)}%</div>`:'';
        const rows=[...bfl].reverse().slice(0,6).map(e=>`<div class="list-row"><div class="row-left"><div class="row-label">${fmtDate(e.date)}</div><div class="row-val">${e.bf}%</div></div></div>`).join('');
        return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div><div style="font-size:10px;color:var(--text2);">CURRENT</div><div style="font-family:'Archivo Black',sans-serif;font-size:36px;color:var(--lime);letter-spacing:-2px;">${cur.bf}<span style="font-size:18px;">%</span></div></div>
          <div style="text-align:right;"><div style="font-size:10px;color:var(--text2);">TARGET</div><div style="font-family:'Archivo Black',sans-serif;font-size:20px;">${p.targetBF||15}%</div>${diffHtml}</div>
        </div>
        <div style="font-size:11px;color:var(--text2);margin-bottom:8px;">${bfl.length} entries</div>
        ${rows}`;
      })()}
    </div>

    <div class="sec-label">Steps</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div></div>
      <button class="btn btn-ghost btn-sm" onclick="promptSteps()">Log Today</button>
    </div>
    <div class="sg sg3">
      <div class="sb blue"><div class="l">Today</div><div class="v">${(getTodaySteps()/1000).toFixed(1)}<span class="u">k</span></div></div>
      <div class="sb lime"><div class="l">Wk Avg</div><div class="v">${(weekSteps.reduce((s,d)=>s+d.steps,0)/7/1000).toFixed(1)}<span class="u">k</span></div></div>
      <div class="sb green"><div class="l">Days Hit</div><div class="v">${weekSteps.filter(d=>d.steps>=10000).length}<span class="u">/7</span></div></div>
    </div>
    <div class="card">
      ${weekSteps.map(d=>{
        const pct=Math.min(100,(d.steps/10000)*100);
        const lbl=d.date===todayStr()?'Today':new Date(d.date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric'});
        return `<div class="step-row">
          <div class="step-date">${lbl}</div>
          <div class="step-bar-wrap"><div class="step-bar"><div class="step-fill" style="width:${pct}%"></div></div></div>
          <div class="step-count${d.steps>=10000?' hit':''}">${d.steps>=1000?(d.steps/1000).toFixed(1)+'k':d.steps||'—'}</div>
        </div>`;
      }).join('')}
    </div>

    <div class="sec-label">Streaks 🔥</div>
    <div class="sg sg3">
      <div class="sb lime"><div class="l">Steps</div><div class="v">${stepsStreak}<span class="u">days</span></div></div>
      <div class="sb orange"><div class="l">Gym</div><div class="v">${gymStreak}<span class="u">days</span></div></div>
      <div class="sb green"><div class="l">Food Log</div><div class="v">${foodStreak}<span class="u">days</span></div></div>
    </div>

    <div class="sec-label">Lifting Records</div>
    <div class="card">
      ${renderLiftingRecords()}
    </div>

    <div class="sec-label">Training Calendar</div>
    ${renderCalendar()}
  `;
}

function promptSteps(){
  const val=prompt('Enter today\'s steps:');
  if(val&&!isNaN(val)&&parseInt(val)>0){
    saveSteps(parseInt(val));
    renderTrack();
    renderToday();
    showToast(`${parseInt(val).toLocaleString()} steps saved ✓`);
  }
}

function renderLiftingRecords(){
  const allEx=[...WORKOUTS.upper.exercises,...WORKOUTS.lower.exercises];
  const records=allEx.map(ex=>{const b=getBestLift(ex.id);return{ex,best:b};}).filter(r=>r.best);
  if(records.length===0)return'<div style="text-align:center;color:var(--text3);padding:20px;font-size:13px;">Log sets in workouts to see personal bests</div>';
  return records.map(r=>`
    <div class="list-row">
      <div class="row-left"><div class="row-label">${r.ex.muscle}</div><div style="font-size:13px;font-weight:600;">${r.ex.name}</div></div>
      <div style="text-align:right;"><div style="font-family:'Archivo Black',sans-serif;font-size:20px;color:var(--lime);">${r.best.kg}kg</div><div style="font-size:10px;color:var(--text2);">${fmtDate(r.best.date)}</div></div>
    </div>`).join('');
}

function renderCalendar(){
  const exLog=getExLog();
  const stepsLog=getStepsLog();
  const today=new Date();
  const days=[];
  for(let i=41;i>=0;i--){const d=new Date(today);d.setDate(d.getDate()-i);days.push(d);}

  const headers=['M','T','W','T','F','S','S'];
  let html=`<div class="card"><div class="cal-grid">${headers.map(h=>`<div class="cal-day-hdr">${h}</div>`).join('')}`;

  // Pad start
  const firstDay=days[0].getDay();
  const pad=firstDay===0?6:firstDay-1;
  for(let i=0;i<pad;i++)html+='<div></div>';

  days.forEach(d=>{
    const key=d.toISOString().split('T')[0];
    const isToday=key===todayStr();
    const isFuture=d>today;
    const el=exLog[key]||{};
    const hasGym=Object.values(el).some(e=>e.done);
    const hitSteps=(stepsLog[key]||0)>=10000;
    let cls='cal-dot';
    if(isFuture)cls+=' future';
    else if(hasGym)cls+=' gym';
    else if(hitSteps)cls+=' rest-active';
    else if(key<todayStr())cls+=' missed';
    if(isToday)cls+=' today';
    html+=`<div class="${cls}" title="${key}">${d.getDate()}</div>`;
  });

  html+='</div>';
  html+=`<div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;">
    <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text2);"><div style="width:10px;height:10px;border-radius:3px;background:rgba(200,255,0,.15);"></div>Gym</div>
    <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text2);"><div style="width:10px;height:10px;border-radius:3px;background:rgba(61,155,255,.1);"></div>Steps hit</div>
    <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text2);"><div style="width:10px;height:10px;border-radius:3px;background:rgba(255,59,59,.08);"></div>Missed</div>
  </div></div>`;
  return html;
}

// ============================================================
// BODY PAGE (Measurements + Photos + Sleep)
// ============================================================
function renderBody(){
  const measLog=getMeasLog();
  const latest=getLatestMeas();
  const prev=measLog.length>=2?measLog[measLog.length-2]:null;
  const photos=getPhotos();
  const sleepLog=getSleepLog();
  const last7=getLast7();
  const swimLog=getSwimLog();
  const allSwims=Object.entries(swimLog).flatMap(([date,entries])=>entries.map(e=>({...e,date}))).sort((a,b)=>b.date.localeCompare(a.date));

  document.getElementById('page-body').innerHTML=`
    <div class="pg-title" style="margin-bottom:14px;">Body & Health</div>

    <div class="sec-label">Measurements</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-size:11px;color:var(--text2);">${latest?`Last logged ${fmtDate(latest.date)}`:'Not logged yet'}</div>
      <button class="btn btn-ghost btn-sm" onclick="openModal('modal-meas')">+ Log</button>
    </div>
    ${latest?`
    <div class="meas-grid" style="margin-bottom:10px;">
      ${[
        {key:'waist',label:'Waist',unit:'cm'},
        {key:'chest',label:'Chest',unit:'cm'},
        {key:'larm',label:'Left Arm',unit:'cm'},
        {key:'rarm',label:'Right Arm',unit:'cm'},
        {key:'lthigh',label:'Left Thigh',unit:'cm'},
        {key:'rthigh',label:'Right Thigh',unit:'cm'},
      ].filter(m=>latest[m.key]).map(m=>{
        const diff=prev&&prev[m.key]?(latest[m.key]-prev[m.key]):null;
        const isGood=m.key==='waist'||m.key==='chest'?diff<0:diff>0;
        return `<div class="meas-item">
          <div class="mi-label">${m.label}</div>
          <div class="mi-val">${latest[m.key]}<span class="mi-unit">cm</span></div>
          ${diff!==null?`<div class="mi-diff ${isGood?'dn':'up'}">${diff>0?'+':''}${diff.toFixed(1)}cm</div>`:''}
        </div>`;
      }).join('')}
    </div>`:`<div class="card" style="margin-bottom:10px;text-align:center;color:var(--text3);font-size:13px;padding:20px;">Log measurements to track body changes alongside weight</div>`}

    <div class="sec-label">Sleep</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div></div>
      <button class="btn btn-ghost btn-sm" onclick="openModal('modal-sleep')">+ Log</button>
    </div>
    <div class="sg sg3" style="margin-bottom:8px;">
      <div class="sb purple"><div class="l">Last Night</div><div class="v">${sleepLog[todayStr()]?.hours||sleepLog[Object.keys(sleepLog).sort().pop()]?.hours||'—'}<span class="u">hrs</span></div></div>
      <div class="sb blue"><div class="l">7-Day Avg</div><div class="v">${getAvgSleep(7)||'—'}<span class="u">hrs</span></div></div>
      <div class="sb${getAvgSleep(7)>=7?' green':' orange'}"><div class="l">Status</div><div class="v" style="font-size:14px;">${getAvgSleep(7)>=7?'Good':'Low'}</div></div>
    </div>
    <div class="card" style="margin-bottom:10px;">
      ${last7.map(d=>{
        const s=sleepLog[d];
        if(!s)return`<div class="step-row"><div class="step-date">${d===todayStr()?'Today':new Date(d+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric'})}</div><div class="step-bar-wrap"><div class="step-bar"></div></div><div class="step-count">—</div></div>`;
        const pct=Math.min(100,(s.hours/9)*100);
        const qualEmoji=['','😴','😐','😊','🌟'][s.quality||0]||'';
        return`<div class="step-row">
          <div class="step-date">${d===todayStr()?'Today':new Date(d+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric'})}</div>
          <div class="step-bar-wrap"><div class="step-bar"><div class="step-fill" style="width:${pct}%;background:linear-gradient(90deg,var(--purple),var(--blue));"></div></div></div>
          <div class="step-count${s.hours>=7?' hit':''}" style="${s.hours>=7?'':'color:var(--orange);'}">${s.hours}h${qualEmoji}</div>
        </div>`;
      }).join('')}
    </div>

    <div class="sec-label">Swim Log</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-size:11px;color:var(--text2);">${allSwims.length} sessions logged</div>
      <button class="btn btn-ghost btn-sm" onclick="openModal('modal-swim')">+ Log Swim</button>
    </div>
    <div class="card" style="margin-bottom:10px;">
      ${allSwims.length===0?'<div style="text-align:center;color:var(--text3);padding:20px;font-size:13px;">No swims logged yet</div>':
        allSwims.slice(0,6).map(s=>`
          <div class="swim-item">
            <div><div style="font-size:11px;color:var(--text2);">${fmtDate(s.date)}</div><div style="font-weight:600;font-size:13px;">${s.mins} minutes${s.laps?` · ${s.laps} laps`:''}</div></div>
            <div style="text-align:right;"><div style="font-size:11px;color:var(--cyan);">~${Math.round(s.mins*7)} kcal</div><div style="font-size:10px;color:var(--text2);">${s.feel||''}</div></div>
          </div>`).join('')}
    </div>

    <div class="sec-label">Progress Photos</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-size:11px;color:var(--text2);">${photos.length} photos</div>
      <label class="btn btn-ghost btn-sm" style="cursor:pointer;">+ Photo<input type="file" accept="image/*" capture="environment" onchange="handlePhoto(event)" style="display:none;"></label>
    </div>
    <div class="photo-grid">
      ${photos.slice(-9).reverse().map(ph=>`
        <div class="photo-thumb">
          <img src="${ph.data}" alt="">
          <div class="pt-date">${fmtDate(ph.date)}</div>
        </div>`).join('')}
      ${photos.length===0?'<div class="photo-thumb photo-add"><div style="font-size:28px;">📷</div><div>Add photo</div></div>':''}
    </div>
  `;
}

// ============================================================
// COACH PAGE (AI Analysis + Report Card + Supplements)
// ============================================================
function renderCoach(){
  const p=getActive(); if(!p)return;
  const report=getWeeklyReport();
  const supps=getSupps();

  document.getElementById('page-coach').innerHTML=`
    <div class="pg-title" style="margin-bottom:14px;">Coach</div>

    <div class="sec-label">Weekly Report Card</div>
    ${report?`
    <div class="card hi" style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div style="font-family:'Archivo Black',sans-serif;font-size:14px;">This Week's Score</div>
        <div style="font-family:'Archivo Black',sans-serif;font-size:36px;color:${report.overall>=75?'var(--green)':report.overall>=60?'var(--lime)':'var(--orange)'};">${report.overall}</div>
      </div>
      <div class="rc-item"><div class="rc-icon">👟</div><div class="rc-info"><div class="rc-label">Steps</div><div class="rc-detail">${report.stepsHit}/7 days hit 10,000 target</div></div><div class="rc-score ${gradeClass(report.scores.steps)}">${grade(report.scores.steps)}</div></div>
      <div class="rc-item"><div class="rc-icon">🥩</div><div class="rc-info"><div class="rc-label">Protein</div><div class="rc-detail">${report.proteinDays}/7 days hit target</div></div><div class="rc-score ${gradeClass(report.scores.protein)}">${grade(report.scores.protein)}</div></div>
      <div class="rc-item"><div class="rc-icon">🏋️</div><div class="rc-info"><div class="rc-label">Training</div><div class="rc-detail">${report.gymDays} gym sessions this week</div></div><div class="rc-score ${gradeClass(report.scores.gym)}">${grade(report.scores.gym)}</div></div>
      <div class="rc-item" style="border:none;"><div class="rc-icon">😴</div><div class="rc-info"><div class="rc-label">Sleep</div><div class="rc-detail">Average ${report.avgSleep||'—'} hours per night</div></div><div class="rc-score ${gradeClass(report.scores.sleep)}">${grade(report.scores.sleep)}</div></div>
      ${report.weightChange!==null?`<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:12px;color:var(--text2);">Weight change this week: <strong style="color:${report.weightChange<=0?'var(--green)':'var(--red)'};">${report.weightChange>0?'+':''}${report.weightChange.toFixed(1)}kg</strong></div>`:''}
    </div>`:'<div class="card" style="text-align:center;color:var(--text3);font-size:13px;padding:20px;">Log data throughout the week to generate your report card</div>'}

    <div class="sec-label">Reminders</div>
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:12px;">
        Push notifications for each meal at the scheduled time. Works on devices where Forge is installed to the home screen.
      </div>
      <div id="reminder-controls" style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-lime btn-sm" style="flex:1;min-width:140px;" onclick="enableReminders()">Enable Reminders</button>
        <button class="btn btn-ghost btn-sm" style="flex:1;min-width:80px;" onclick="testReminder()">Test</button>
      </div>
    </div>

    <div class="sec-label">Supplements & Reminders</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-size:11px;color:var(--text2);">${supps.filter((_,i)=>isSuppDone(i)).length}/${supps.length} taken today</div>
      <button class="btn btn-ghost btn-sm" onclick="openModal('modal-supp')">+ Add</button>
    </div>
    <div class="card">
      ${supps.length===0?'<div style="text-align:center;color:var(--text3);padding:20px;font-size:13px;">Add supplements or medications to track daily</div>':
        supps.map((s,i)=>`
          <div class="supp-item">
            <div class="supp-check${isSuppDone(i)?' done':''}" onclick="toggleSupp(${i})">
              ${isSuppDone(i)?'<svg width="11" height="11" fill="none" stroke="#000" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>':''}
            </div>
            <div class="supp-info">
              <div class="supp-name">${s.name}</div>
              <div class="supp-time">${s.dose} · ${s.time}</div>
            </div>
            <button class="supp-del" onclick="deleteSupp(${i})">×</button>
          </div>`).join('')}
    </div>
  `;

  isReminderEnabled().then(on=>{
    const el=document.getElementById("reminder-controls");
    if(!el)return;
    if(on){
      el.innerHTML=`
        <button class="btn btn-ghost btn-sm" style="flex:1;min-width:140px;" onclick="disableReminders()">Disable Reminders</button>
        <button class="btn btn-ghost btn-sm" style="flex:1;min-width:80px;" onclick="testReminder()">Test</button>
      `;
    }
  });
}

// ============================================================
// MORE PAGE (Water + Swim shortcut + Settings)
// ============================================================
function renderMore(){
  const p=getActive(); if(!p)return;
  const water=getWater();
  const waterTarget=8;

  document.getElementById('page-more').innerHTML=`
    <div class="pg-title" style="margin-bottom:14px;">More</div>

    <div class="sec-label">Water Intake</div>
    <div class="card" style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div>
          <div style="font-family:'Archivo Black',sans-serif;font-size:36px;color:var(--cyan);letter-spacing:-2px;">${water}<span style="font-size:18px;color:var(--text2);">/${waterTarget}</span></div>
          <div style="font-size:11px;color:var(--text2);">cups today · Target 8 cups (2L)</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="resetWater()">Reset</button>
      </div>
      <div class="water-cups">
        ${Array(waterTarget).fill(0).map((_,i)=>`<div class="wcup${i<water?' filled':''}" onclick="setWater(${i+1})">💧</div>`).join('')}
      </div>
      <div class="pb" style="margin-top:10px;"><div class="pb-fill" style="width:${Math.min(100,(water/waterTarget)*100)}%;background:linear-gradient(90deg,var(--blue),var(--cyan));"></div></div>
    </div>

    <div class="sec-label">Quick Actions</div>
    <div class="sg sg2" style="margin-bottom:10px;">
      <button class="btn btn-ghost" style="padding:16px;border-radius:12px;flex-direction:column;gap:6px;display:flex;align-items:center;" onclick="openModal('modal-swim')">
        <div style="font-size:24px;">🏊</div>
        <div style="font-size:12px;font-weight:700;">Log Swim</div>
      </button>
      <button class="btn btn-ghost" style="padding:16px;border-radius:12px;flex-direction:column;gap:6px;display:flex;align-items:center;" onclick="openModal('modal-sleep')">
        <div style="font-size:24px;">😴</div>
        <div style="font-size:12px;font-weight:700;">Log Sleep</div>
      </button>
      <button class="btn btn-ghost" style="padding:16px;border-radius:12px;flex-direction:column;gap:6px;display:flex;align-items:center;" onclick="openModal('modal-meas')">
        <div style="font-size:24px;">📏</div>
        <div style="font-size:12px;font-weight:700;">Measurements</div>
      </button>
      <button class="btn btn-ghost" style="padding:16px;border-radius:12px;flex-direction:column;gap:6px;display:flex;align-items:center;" onclick="promptSteps()">
        <div style="font-size:24px;">👟</div>
        <div style="font-size:12px;font-weight:700;">Log Steps</div>
      </button>
    </div>

    <div class="sec-label">Cowork Connection</div>
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px;">
        Generate a read-only access token to let Cowork fetch your data for AI coaching.
      </div>
      <button class="btn btn-lime btn-sm" style="width:100%;margin-bottom:10px;" onclick="generateAccessToken()">+ Generate Access Token</button>
      <div id="token-list" style="font-size:12px;"></div>
    </div>

    <div class="sec-label">Oura Ring</div>
    <div class="card" style="margin-bottom:10px;">
      <div id="oura-status" style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px;">Loading...</div>
      <div id="oura-controls" style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-lime btn-sm" style="flex:1;min-width:140px;" onclick="connectOura()">Connect Oura</button>
      </div>
    </div>

    <div class="sec-label">Calorie Stage Guide</div>
    <div class="card" style="margin-bottom:10px;">
      ${[{w:114,c:'2,300–2,400'},{w:108,c:'2,200'},{w:102,c:'2,100'},{w:96,c:'2,050'},{w:90,c:'1,950'},{w:87,c:'Maintenance'}].map(s=>`
        <div class="list-row">
          <div style="font-weight:600;font-size:13px;">${s.w}kg</div>
          <div style="font-size:12px;color:var(--lime);font-weight:700;">${s.c} kcal</div>
        </div>`).join('')}
    </div>

    <div class="sec-label">Profile Settings</div>
    <div class="card">
      <div style="font-size:13px;font-weight:600;margin-bottom:4px;">${p.name}</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:12px;">Start: ${p.startWeight}kg · Target: ${p.targetWeight}kg · Protein: ${p.proteinTarget}g</div>
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-bottom:8px;" onclick="editProfile()">Edit Targets</button>
      <button class="btn btn-red btn-sm" style="width:100%;margin-bottom:8px;" onclick="confirmReset()">Reset All Data</button>
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-bottom:8px;" onclick="logOut()">Log Out</button>
      <button class="btn btn-red btn-sm" style="width:100%;background:rgba(255,59,59,.2);" onclick="deleteAccount()">Delete Account</button>
    </div>
  `;

  loadOuraStatus();

  loadAccessTokens().then(tokens=>{
    const el=document.getElementById('token-list');
    if(!el)return;
    if(tokens.length===0){el.innerHTML='<div style="color:var(--text3);">No tokens yet</div>';return;}
    el.innerHTML=tokens.map(t=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
        <div><strong>${t.name||'Token'}</strong><br><span style="color:var(--text3);font-size:10px;">Created ${new Date(t.createdAt).toLocaleDateString()}${t.lastUsedAt?' · Last used '+new Date(t.lastUsedAt).toLocaleDateString():''}</span></div>
        <button class="btn btn-red btn-sm" style="font-size:10px;padding:4px 8px;" onclick="revokeAccessToken('${t.id}')">Revoke</button>
      </div>`).join('');
  });
}
