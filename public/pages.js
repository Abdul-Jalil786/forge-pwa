// ============================================================
// TODAY PAGE
// ============================================================

// Format hours decimal → "7h 30m" with .u-styled subscripts
function fmtHrs(h){
  if(h===null||h===undefined||h<=0||isNaN(h))return '—';
  const whole=Math.floor(h);
  const mins=Math.round((h-whole)*60);
  if(mins===0)return `${whole}<span class="u">h</span>`;
  if(mins===60)return `${whole+1}<span class="u">h</span>`;
  return `${whole}<span class="u">h</span> ${mins}<span class="u">m</span>`;
}

// Plain text version (no HTML) for inline use
function fmtHrsPlain(h){
  if(h===null||h===undefined||h<=0||isNaN(h))return '—';
  const whole=Math.floor(h);
  const mins=Math.round((h-whole)*60);
  if(mins===0)return `${whole}h`;
  if(mins===60)return `${whole+1}h`;
  return `${whole}h ${mins}m`;
}

function spark(values,color){
  if(!values||values.length<2)return '<svg width="100" height="32"></svg>';
  const w=100,h=32,p=3;
  const min=Math.min(...values),max=Math.max(...values),range=max-min||1;
  const pts=values.map((v,i)=>{
    const x=p+(i/(values.length-1))*(w-p*2);
    const y=h-p-((v-min)/range)*(h-p*2);
    return {x,y};
  });
  const linePoints=pts.map(pt=>pt.x.toFixed(1)+','+pt.y.toFixed(1)).join(' ');
  const fillPath=`M${pts[0].x.toFixed(1)},${h} L${pts.map(pt=>pt.x.toFixed(1)+','+pt.y.toFixed(1)).join(' L')} L${pts[pts.length-1].x.toFixed(1)},${h} Z`;
  const gradId='spk'+Math.random().toString(36).slice(2,8);
  const last=pts[pts.length-1];
  return `<svg width="${w}" height="${h}" style="display:block;">
    <defs><linearGradient id="${gradId}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.35"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${fillPath}" fill="url(#${gradId})"/>
    <polyline points="${linePoints}" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="2.5" fill="${color}"/>
  </svg>`;
}

function trendDelta(values,days){
  if(!values||values.length<2)return null;
  const recent=values.slice(-Math.min(days,values.length));
  if(recent.length<2)return null;
  const change=recent[recent.length-1]-recent[0];
  const dir=Math.abs(change)<0.1?'flat':change<0?'down':'up';
  const arrow=dir==='down'?'▼':dir==='up'?'▲':'•';
  return { dir, arrow, delta: Math.abs(change).toFixed(1) };
}

function renderToday(){
  const p=getActive(); if(!p)return;
  const session=getTodaySession();
  const cw=getCurrentWeight();
  const bf=getCurrentBf();
  const lost=Math.max(0,p.startWeight-cw);
  const toGo=Math.max(0,cw-p.targetWeight);
  const pct=Math.max(0,Math.min(100,Math.round((lost/(p.startWeight-p.targetWeight))*100)));
  const totals=getTodayTotals();
  const calTarget=session?p.calsGym:p.calsRest;
  const steps=getTodaySteps();
  const sleepLog=getSleepLog();
  const lastSleep=sleepLog[todayStr()]?.hours||sleepLog[Object.keys(sleepLog).sort().pop()]?.hours||0;
  const recovery=pGet('recovery',{});
  const recoveryToday=recovery[todayStr()]||recovery[Object.keys(recovery).sort().pop()]||{};
  const reports=pGet('coachingReports',[]);
  const latestReport=reports[0];
  const measLog=getMeasLog();
  const latestWaist=measLog.length?[...measLog].reverse().find(m=>m.waist):null;
  const stepStreak=calcStreak('steps');
  const gymStreak=calcStreak('gym');
  const foodStreak=calcStreak('food');

  const planStart=STATE.planStartDate||todayStr();
  const startDate=new Date(planStart+'T00:00:00');
  const dayOfCut=Math.floor((Date.now()-startDate.getTime())/86400000)+1;

  const readiness=recoveryToday.readiness||0;
  let recRec='—', recColor='var(--text2)';
  if(readiness>=75){recRec='Push hard today'; recColor='var(--green)';}
  else if(readiness>=60){recRec='Train as planned'; recColor='var(--lime)';}
  else if(readiness>=45){recRec='Take it easier'; recColor='var(--orange)';}
  else if(readiness>0){recRec='Consider full rest'; recColor='var(--red)';}

  const plan=STATE.mealPlan;
  let nextMealStr='No meal plan set';
  if(plan&&plan.meals?.length){
    const now=new Date();
    const nowHHMM=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    const next=plan.meals.find(m=>m.time>nowHHMM);
    if(next){
      const [h,m]=next.time.split(':').map(Number);
      const target=new Date();target.setHours(h,m,0,0);
      const diff=target.getTime()-now.getTime();
      const hrs=Math.floor(diff/3600000);
      const mins=Math.floor((diff%3600000)/60000);
      nextMealStr=`Next: ${next.name} in ${hrs>0?hrs+'h ':''}${mins}m`;
    } else {
      nextMealStr='Window closed · next meal 12:00 tomorrow';
    }
  }

  const weightSpark=spark((getWeightLog()||[]).slice(-14).map(e=>e.weight),'var(--lime)');
  const bfSpark=spark((getBfLog()||[]).slice(-14).map(e=>e.bf),'var(--cyan)');
  const waistSpark=measLog.filter(m=>m.waist).slice(-14).map(m=>m.waist);
  const waistSparkSvg=waistSpark.length?spark(waistSpark,'var(--orange)'):'';

  const weightTrend=trendDelta(getWeightLog().map(e=>e.weight),7);
  const bfTrend=trendDelta(getBfLog().map(e=>e.bf),7);

  // Phase 30a: derived fat mass + LBM (kg + %)
  const fatMassNow = (cw != null && bf != null) ? Math.round(cw * (bf/100) * 10) / 10 : null;
  const lbmNow     = (cw != null && bf != null) ? Math.round(cw * (1 - bf/100) * 10) / 10 : null;
  const lbmPctNow  = (bf != null) ? Math.round((100 - bf) * 10) / 10 : null;
  const lbmEntries = (typeof getJourneyEntries === 'function' ? getJourneyEntries('lbm') : []);
  const lbmSparkArr = lbmEntries.slice(-14).map(e => e.lbm);
  const lbmSpark = lbmSparkArr.length >= 2 ? spark(lbmSparkArr, 'var(--blue)') : '';
  const lbmTrend = trendDelta(lbmEntries.map(e => e.lbm), 7);
  const fatMassEntries = lbmEntries.map(e => {
    const wLog = getWeightLog().find(w => w.date === e.date);
    return wLog ? { date: e.date, fat: Math.round(wLog.weight * (1 - e.lbm/wLog.weight) * 10) / 10 } : null;
  }).filter(Boolean);
  const fatMassSparkArr = fatMassEntries.slice(-14).map(e => e.fat);
  const fatMassSpark = fatMassSparkArr.length >= 2 ? spark(fatMassSparkArr, 'var(--orange)') : '';

  document.getElementById('page-today').innerHTML=`
    <div style="margin-bottom:14px;">
      <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:3px;">${dayName()} ${new Date().getDate()} ${new Date().toLocaleDateString('en-GB',{month:'short'})}</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div class="pg-title">Day ${dayOfCut}</div>
        <div style="font-size:11px;color:var(--text3);">of your cut</div>
      </div>
    </div>

    <div class="card hi" style="margin-bottom:10px;">
      <div style="font-size:9px;font-weight:700;color:var(--lime);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">TODAY</div>
      ${session?`
        <div style="font-family:'Archivo Black',sans-serif;font-size:18px;letter-spacing:-.5px;margin-bottom:4px;">${WORKOUTS[session].name} — 16:00</div>
      `:`
        <div style="font-family:'Archivo Black',sans-serif;font-size:18px;letter-spacing:-.5px;margin-bottom:4px;">Rest Day</div>
      `}
      <div style="font-size:12px;color:var(--text2);margin-bottom:4px;">${nextMealStr}</div>
      ${readiness?`<div style="font-size:12px;color:${recColor};font-weight:600;">${recRec} · Readiness ${readiness}</div>`:''}
    </div>

    <div class="sec-label">Progress to Goal</div>
    <div class="card" style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px;">
        <div>
          <div style="font-size:10px;color:var(--text2);">CURRENT</div>
          <div style="font-family:'Archivo Black',sans-serif;font-size:34px;color:var(--lime);letter-spacing:-2px;line-height:1;">${cw}<span style="font-size:16px;">kg</span></div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:var(--text2);">TARGET</div>
          <div style="font-family:'Archivo Black',sans-serif;font-size:18px;">${p.targetWeight}kg @ ${p.targetBF||15}%</div>
        </div>
      </div>
      <div class="pb-wrap" style="margin-bottom:0;">
        <div class="pb-head"><span class="pb-lbl">${lost.toFixed(1)}kg lost · ${toGo.toFixed(1)}kg to go</span><span class="pb-pct">${pct}%</span></div>
        <div class="pb"><div class="pb-fill" style="width:${pct}%"></div></div>
      </div>
    </div>

    <div class="sec-label">Key Metrics</div>
    <div class="card" style="margin-bottom:10px;padding:10px 12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
        <div style="flex:1;min-width:0;">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">Weight</div>
          <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
            <div style="font-family:'Archivo Black',sans-serif;font-size:20px;color:var(--lime);">${cw}<span style="font-size:11px;color:var(--text2);">kg</span></div>
            ${weightTrend?`<div style="font-size:11px;color:${weightTrend.dir==='down'?'var(--green)':weightTrend.dir==='up'?'var(--red)':'var(--text2)'};">${weightTrend.arrow} ${weightTrend.delta}kg/wk</div>`:''}
          </div>
        </div>
        <div style="flex-shrink:0;">${weightSpark}</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
        <div style="flex:1;min-width:0;">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">Body Fat</div>
          <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
            <div style="font-family:'Archivo Black',sans-serif;font-size:20px;color:var(--cyan);">${bf?bf+'%':'—'}</div>
            ${fatMassNow!=null?`<div style="font-size:11px;color:var(--text2);">${fatMassNow}kg fat</div>`:''}
            ${bfTrend?`<div style="font-size:11px;color:${bfTrend.dir==='down'?'var(--green)':bfTrend.dir==='up'?'var(--red)':'var(--text2)'};">${bfTrend.arrow} ${bfTrend.delta}%/wk</div>`:''}
          </div>
        </div>
        <div style="flex-shrink:0;">${bfSpark}</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
        <div style="flex:1;min-width:0;">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">Lean Mass</div>
          <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
            <div style="font-family:'Archivo Black',sans-serif;font-size:20px;color:var(--blue);">${lbmPctNow!=null?lbmPctNow+'%':'—'}</div>
            ${lbmNow!=null?`<div style="font-size:11px;color:var(--text2);">${lbmNow}kg lean</div>`:''}
            ${lbmTrend?`<div style="font-size:11px;color:${lbmTrend.dir==='flat'?'var(--green)':lbmTrend.dir==='up'?'var(--green)':Math.abs(parseFloat(lbmTrend.delta))<0.3?'#ffc107':'var(--red)'};">${lbmTrend.arrow} ${lbmTrend.delta}kg/wk</div>`:''}
            ${p.targetLBM?`<div style="font-size:10px;color:var(--text3);">target hold ${p.targetLBM}kg</div>`:''}
          </div>
        </div>
        <div style="flex-shrink:0;">${lbmSpark}</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">Waist</div>
          <div style="display:flex;align-items:baseline;gap:8px;">
            <div style="font-family:'Archivo Black',sans-serif;font-size:20px;color:var(--orange);">${latestWaist?latestWaist.waist+'cm':'—'}</div>
          </div>
        </div>
        <div style="flex-shrink:0;">${waistSparkSvg}</div>
      </div>
    </div>

    ${readiness?`
    <div class="sec-label">Recovery</div>
    <div class="card" style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:6px;">
        <div>
          <div style="font-size:10px;color:var(--text2);">READINESS</div>
          <div style="font-family:'Archivo Black',sans-serif;font-size:30px;color:${readiness>=75?'var(--green)':readiness>=60?'var(--lime)':readiness>=45?'var(--orange)':'var(--red)'};">${readiness}</div>
        </div>
        <div style="text-align:right;font-size:11px;color:var(--text2);">
          ${lastSleep?`Sleep ${fmtHrsPlain(lastSleep)}<br>`:''}
          ${recoveryToday.hrv?`HRV ${recoveryToday.hrv}<br>`:''}
          ${recoveryToday.restingHR?`RHR ${recoveryToday.restingHR}`:''}
        </div>
      </div>
      <div style="font-size:11px;color:${recColor};font-weight:600;">${recRec}</div>
    </div>
    `:''}

    <div class="sec-label">Today's Targets</div>
    <div class="sg sg2" style="margin-bottom:6px;">
      <div class="sb${totals.cals>=calTarget?' green':' lime'}">
        <div class="l">Calories</div>
        <div class="v">${totals.cals}<span class="u">/${calTarget}</span></div>
      </div>
      <div class="sb${totals.protein>=p.proteinTarget?' green':' orange'}">
        <div class="l">Protein</div>
        <div class="v">${totals.protein}<span class="u">/${p.proteinTarget}g</span></div>
      </div>
    </div>
    <div class="sg sg2" style="margin-bottom:10px;">
      <div class="sb${steps>=10000?' green':' blue'}">
        <div class="l">Steps</div>
        <div class="v">${steps>=1000?(steps/1000).toFixed(1)+'k':steps||'0'}<span class="u">/10k</span></div>
      </div>
      <div class="sb purple">
        <div class="l">Sleep</div>
        <div class="v">${fmtHrs(lastSleep)}</div>
      </div>
    </div>

    ${latestReport?`
    <div class="sec-label">Coach</div>
    <div class="card" style="margin-bottom:10px;border-color:var(--blue);background:linear-gradient(135deg,rgba(61,155,255,.04),transparent);cursor:pointer;" onclick="nav('coach')">
      <div style="font-family:'Archivo Black',sans-serif;font-size:13px;margin-bottom:4px;">${latestReport.title}</div>
      <div style="font-size:11px;color:var(--text2);line-height:1.5;">${(latestReport.content||'').slice(0,140).replace(/[#*]/g,'').trim()}…</div>
      <div style="font-size:10px;color:var(--blue);margin-top:6px;">Tap to read full →</div>
    </div>
    `:''}

    ${renderSupplementsToday()}

    <div class="sec-label">Streaks</div>
    <div class="sg sg3">
      <div class="sb lime"><div class="l">Gym</div><div class="v">${gymStreak}<span class="u">days</span></div></div>
      <div class="sb green"><div class="l">Food</div><div class="v">${foodStreak}<span class="u">days</span></div></div>
      <div class="sb orange"><div class="l">Steps 10k</div><div class="v">${stepStreak}<span class="u">days</span></div></div>
    </div>
  `;

  if(window._todayTimer)clearTimeout(window._todayTimer);
  window._todayTimer=setTimeout(()=>{ if(document.getElementById('page-today').classList.contains('active'))renderToday(); },60000);
}

function renderSupplementsToday(){
  const supps=getSupplements();
  if(!supps.length)return '';
  const today=todayStr();
  const log=getSupplementLog(today);
  const taken=supps.filter(s=>log[s.id]===true).length;
  const adh=getSupplementAdherence(7);
  const chk='<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="var(--bg)" stroke-width="2" fill="none"/></svg>';
  return `
    <div class="sec-label" style="display:flex;justify-content:space-between;align-items:center;">
      <span>Supplements Today</span>
      <span style="font-size:11px;color:var(--text2);font-weight:400;text-transform:none;letter-spacing:0;">${taken}/${supps.length} taken</span>
    </div>
    <div class="card" style="margin-bottom:10px;border-color:var(--orange);background:linear-gradient(135deg,rgba(255,85,0,.03),transparent);">
      ${supps.map(s=>{
        const on=log[s.id]===true;
        return `<div onclick="toggleSuppToday('${s.id}')" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer;min-height:44px;">
          <div style="width:20px;height:20px;border-radius:4px;border:2px solid ${on?'var(--lime)':'var(--border)'};background:${on?'var(--lime)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${on?chk:''}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:${on?'var(--text)':'var(--text2)'};">${s.name}</div>
            <div style="font-size:11px;color:var(--text3);">${s.dose}</div>
          </div>
          ${s.time?`<div style="font-size:11px;font-family:monospace;color:var(--text3);flex-shrink:0;">${s.time}</div>`:''}
        </div>`;
      }).join('')}
      <div onclick="nav('coach')" style="padding:8px 0 2px;cursor:pointer;font-size:11px;color:var(--text3);">Adherence this week: ${adh.pct}% · <span style="color:var(--orange);">view details</span></div>
    </div>`;
}

function toggleSuppToday(suppId){
  const today=todayStr();
  const log=getSupplementLog(today);
  setSupplementTaken(today,suppId,!log[suppId]);
  renderToday();
}

// ============================================================
// FOOD PAGE
// ============================================================
let foodViewDate=null; // null = today
function getFoodViewDate(){return foodViewDate||todayStr();}
function isFoodViewingToday(){return getFoodViewDate()===todayStr();}
function setFoodViewDate(d){foodViewDate=(d===todayStr())?null:d;renderFood();}
function shiftFoodDate(days){
  const cur=new Date(getFoodViewDate()+'T12:00:00');
  cur.setDate(cur.getDate()+days);
  const newDate=_ukDate(cur);
  if(newDate>todayStr())return; // no future dates
  setFoodViewDate(newDate);
}

function renderFood(){
  const p=getActive(); if(!p)return;
  const viewDate=getFoodViewDate();
  const isToday=isFoodViewingToday();
  const dateObj=new Date(viewDate+'T12:00:00');
  const dateLabel=dateObj.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'});

  // Determine if this view date was a gym day
  const session=getSessionTypeForDate(viewDate);
  const calTarget=session?p.calsGym:p.calsRest;

  const foods=getFoods(viewDate).sort((a,b)=>a.time.localeCompare(b.time));
  const totals={
    cals:foods.reduce((s,f)=>s+(f.cals||0),0),
    protein:foods.reduce((s,f)=>s+(f.protein||0),0),
    carbs:foods.reduce((s,f)=>s+(f.carbs||0),0),
    fat:foods.reduce((s,f)=>s+(f.fat||0),0),
  };
  const carbTarget=p.carbsTarget||Math.round((calTarget*0.38)/4);
  const fatTarget=p.fatTarget||Math.round((calTarget*0.28)/9);
  const templates=getTemplates();

  // Group foods by mealId for display
  const foodGroups=[];
  const seenMeals={};
  foods.forEach((f,i)=>{
    if(f.mealId){
      if(!seenMeals[f.mealId]){seenMeals[f.mealId]={mealName:f.mealName||f.name,entries:[],indices:[]};foodGroups.push({type:'meal',group:seenMeals[f.mealId]});}
      seenMeals[f.mealId].entries.push(f);
      seenMeals[f.mealId].indices.push(i);
    } else {
      foodGroups.push({type:'single',food:f,index:i});
    }
  });

  document.getElementById('page-food').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <div class="pg-title">Food</div>
      ${isToday?`<button class="btn btn-lime btn-sm" onclick="openModal('modal-food')">+ Log</button>`:`<button class="btn btn-ghost btn-sm" onclick="setFoodViewDate(todayStr())">← Today</button>`}
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:14px;background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:8px 12px;">
      <button onclick="shiftFoodDate(-1)" style="background:none;border:none;color:var(--text);font-size:18px;cursor:pointer;padding:4px 8px;">‹</button>
      <div style="text-align:center;flex:1;">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">${isToday?'Today':'Viewing'}</div>
        <div style="font-family:'Archivo Black',sans-serif;font-size:14px;letter-spacing:-.3px;">${dateLabel}</div>
      </div>
      <button onclick="shiftFoodDate(1)" style="background:none;border:none;color:${isToday?'var(--text3)':'var(--text)'};font-size:18px;cursor:pointer;padding:4px 8px;" ${isToday?'disabled':''}>›</button>
    </div>

    ${isToday && STATE.mealPlan?renderTodaysPlan():''}

    <div class="card hi">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px;">
        <div>
          <div style="font-size:10px;color:var(--text2);margin-bottom:2px;">${isToday?'CALORIES TODAY':'CALORIES'}</div>
          <div style="font-family:'Archivo Black',sans-serif;font-size:42px;color:var(--lime);letter-spacing:-2px;">${totals.cals}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:var(--text2);">TARGET</div>
          <div style="font-family:'Archivo Black',sans-serif;font-size:20px;">${calTarget}</div>
          <div style="font-size:11px;color:${totals.cals>calTarget?'var(--red)':'var(--text2)'};">${Math.abs(calTarget-totals.cals)} ${totals.cals>calTarget?'over':isToday?'left':'short'}</div>
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

    <div class="sec-label">${isToday?"Today's Log":"Food Log"}</div>
    <div class="card">
      ${foods.length===0?`<div style="text-align:center;color:var(--text3);padding:20px 0;font-size:13px;">Nothing logged ${isToday?'yet':'on this day'}</div>`:
        foodGroups.map(item=>{
          if(item.type==='single'){
            const f=item.food,idx=item.index;
            return`<div class="food-row">
              <div class="food-time">${_foodDisplayTime(f)}</div>
              <div class="food-name">${f.name}${_qtyBadge(f)}</div>
              <div class="food-right"><div class="food-cals">${f.cals} kcal</div><div class="food-p">${f.protein||0}g protein</div></div>
              ${isToday?`<button class="del-btn" onclick="delFood(${idx})">×</button>`:`<button class="del-btn" onclick="delFoodOnDate(${idx},'${viewDate}')" title="Delete from this past day">×</button>`}
            </div>`;
          }
          const g=item.group;
          const tc=g.entries.reduce((s,f)=>s+(f.cals||0),0);
          const tp=g.entries.reduce((s,f)=>s+(f.protein||0),0);
          return`<div class="food-row" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none'" style="cursor:pointer;">
            <div class="food-time">${_foodDisplayTime(g.entries[0])}</div>
            <div class="food-name" style="font-weight:600;">${g.mealName} <span style="font-size:10px;color:var(--text3);">▸ ${g.entries.length} items</span></div>
            <div class="food-right"><div class="food-cals">${tc} kcal</div><div class="food-p">${tp}g P</div></div>
          </div><div style="display:none;">${g.entries.map((f,j)=>`<div class="food-row" style="padding-left:24px;background:var(--s2);">
              <div class="food-name" style="font-size:12px;color:var(--text2);">${f.name}${_qtyBadge(f)}</div>
              <div class="food-right"><div class="food-cals" style="font-size:11px;">${f.cals} kcal</div><div class="food-p" style="font-size:10px;">${f.protein||0}g P</div></div>
              ${isToday?`<button class="del-btn" onclick="event.stopPropagation();delFood(${g.indices[j]})">×</button>`:''}
            </div>`).join('')}</div>`;
        }).join('')}
    </div>

    ${isToday && templates.length>0?`
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

    ${isToday?`
    <div class="sec-label">Eating Window</div>
    <div class="card">
      <div style="font-size:10px;color:var(--text2);margin-bottom:4px;">6-HOUR WINDOW · LOW GI</div>
      <div style="font-family:'Archivo Black',sans-serif;font-size:24px;color:var(--lime);">12:00 PM — 6:00 PM</div>
      <div style="font-size:12px;color:var(--text2);margin-top:4px;">18 hours fasting</div>
    </div>`:''}
  `;

  renderFoodTemplatesModal();
}

function delFoodOnDate(idx,date){
  if(!confirm('Delete this entry from '+date+'?'))return;
  deleteFoodEntry(idx,date);
  renderFood();
  showToast('Removed');
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
  if(!plan||!plan.meals||!plan.meals.length){
    return `<div class="sec-label">Today's Plan</div>
      <div class="card" style="margin-bottom:10px;text-align:center;color:var(--text3);font-size:13px;padding:20px;">
        No meal plan yet.
        <button class="btn btn-lime btn-sm" style="display:block;width:100%;margin-top:12px;" onclick="regeneratePlanNow()">Generate plan with AI Coach</button>
      </div>`;
  }
  const todayFoods=getFoods();
  const totalCals=plan.meals.reduce((s,m)=>s+(m.cals||0),0);
  const totalP=plan.meals.reduce((s,m)=>s+(m.protein||0),0);
  const suppLog=getSupplementLog(todayStr());
  return `
    <div class="sec-label">Today's Plan${plan.name?' — '+plan.name:''}</div>
    <div class="card" style="margin-bottom:10px;border-color:var(--lime);background:linear-gradient(135deg,rgba(200,255,0,.04),transparent);">
      <div style="font-size:11px;color:var(--text2);margin-bottom:6px;">${plan.meals.length} meals · ${totalCals} kcal · ${totalP}g protein · tap a meal for details</div>
      ${plan.meals.map(m=>{
        const ings=getMealIngredients(m);
        const supps=getMealSupplements(m);
        const granular=todayFoods.filter(f=>f.mealId===m.id);
        const legacy=todayFoods.find(f=>f.name===m.name&&!f.mealId);
        let logStatus,loggedCount;
        const total=ings.length;
        if(granular.length>0){
          const ln=new Set(granular.map(f=>f.name));
          loggedCount=ings.filter(ing=>ln.has(ing.name)).length;
          logStatus=loggedCount===total?'full':loggedCount>0?'partial':'none';
        } else if(legacy){logStatus='full';loggedCount=total;} else {logStatus='none';loggedCount=0;}
        const suppTotal=supps.length;
        const suppDone=supps.filter(s=>suppLog[s.id]===true).length;
        const suppBadge=suppTotal>0&&suppDone>0?` <span style="font-size:10px;color:var(--orange);">💊 ${suppDone}/${suppTotal}</span>`:'';
        const isLogged=logStatus==='full';
        const isPartial=logStatus==='partial';
        return `<div style="display:flex;align-items:center;gap:10px;padding:12px 0;border-top:1px solid var(--border);">
          <div onclick="openMealDetail('${m.id}')" style="flex:1;min-width:0;cursor:pointer;">
            <div style="display:flex;align-items:baseline;gap:8px;">
              <div style="font-size:11px;color:var(--text3);font-weight:700;">${m.time||''}</div>
              <div style="font-weight:600;font-size:14px;${isLogged?'color:var(--text3);text-decoration:line-through;':''}">${m.name}${suppBadge}</div>
            </div>
            <div style="font-size:11px;color:var(--text2);margin-top:3px;">${m.cals||0} kcal · ${m.protein||0}g P · ${m.carbs||0}g C · ${m.fat||0}g F${isPartial?` · <span style="color:var(--orange);">${loggedCount} of ${total} logged</span>`:''}</div>
          </div>
          <button class="btn ${isLogged?'btn-ghost':isPartial?'btn-ghost':'btn-lime'} btn-sm" style="font-size:11px;padding:8px 14px;flex-shrink:0;${isPartial?'color:var(--orange);border-color:var(--orange);':''}" onclick="openMealDetail('${m.id}')">${isLogged?'✓':isPartial?'◐':'+ Log'}</button>
        </div>`;
      }).join('')}
    </div>
    <button class="btn btn-ghost btn-sm" style="width:100%;margin-bottom:6px;font-size:12px;" onclick="recomputeMacrosNow()">↻ Compute exact macros (keep items)</button>
    <button class="btn btn-ghost btn-sm" style="width:100%;margin-bottom:14px;font-size:11px;color:var(--text3);border-style:dashed;" onclick="regeneratePlanNow()">⚠️ Regenerate plan with AI (replaces items — set Food Preferences first)</button>
  `;
}

let _mds=null; // meal detail state

// Phase 25: time formatting + quantity badge helpers
function _foodDisplayTime(f){
  if(f && f.loggedAt){
    try{
      const d=new Date(f.loggedAt);
      const hh=String(d.getHours()).padStart(2,'0');
      const mm=String(d.getMinutes()).padStart(2,'0');
      return `${hh}:${mm}`;
    }catch{}
  }
  return f?.time||'';
}
function _qtyBadge(f){
  if(!f||f.quantity==null||Math.abs(f.quantity-1)<0.01)return '';
  return ` <span style="font-size:10px;color:var(--orange);font-weight:600;">(${_fmtQty(f.quantity)})</span>`;
}

// Phase 25: portion-based meal detail (replaces checkbox model)
const PORTION_OPTIONS = [
  {qty:0,    label:'✕'},
  {qty:0.5,  label:'½'},
  {qty:1,    label:'1×'},
  {qty:1.5,  label:'1½'},
  {qty:2,    label:'2×'},
];
function _fmtQty(q){
  if(q===0)return'skipped';
  if(q===0.5)return'½';
  if(q===0.25)return'¼';
  if(q===0.75)return'¾';
  if(q===1)return '1×';
  if(q===1.5)return'1½';
  if(q===2)return '2×';
  return q+'×';
}

function openMealDetail(mealId){
  const plan=STATE.mealPlan;
  if(!plan)return;
  const m=plan.meals.find(x=>x.id===mealId);
  if(!m)return;
  const ingredients=getMealIngredients(m);
  const supplements=getMealSupplements(m);
  const todayFoods=getFoods();
  const isStringFormat=!Array.isArray(m.ingredients);
  const granular=todayFoods.filter(f=>f.mealId===m.id);
  const legacy=todayFoods.find(f=>f.name===m.name&&!f.mealId);
  const suppLog=getSupplementLog(todayStr());
  let ingQty,suppChecked;
  if(granular.length>0){
    const byName=new Map(granular.map(f=>[f.name,f]));
    ingQty=ingredients.map(ing=>{
      const entry=byName.get(ing.name);
      return entry ? (typeof entry.quantity==='number'?entry.quantity:1) : 0;
    });
    suppChecked=supplements.map(s=>suppLog[s.id]===true);
  } else if(legacy){
    ingQty=ingredients.map(()=>1);
    suppChecked=supplements.map(s=>suppLog[s.id]!==false);
  } else {
    ingQty=ingredients.map(()=>1);
    suppChecked=supplements.map(()=>true);
  }
  _mds={mealId:m.id,meal:m,ingredients,supplements,ingQty,suppChecked,isStringFormat,
    ingInit:[...ingQty],suppInit:[...suppChecked]};
  _renderMealDetail();
  openModal('modal-meal-detail');
}

function _getMealLogStatus(){
  if(!_mds)return'none';
  const foods=getFoods();
  const g=foods.filter(f=>f.mealId===_mds.mealId);
  const l=foods.find(f=>f.name===_mds.meal.name&&!f.mealId);
  if(g.length>0){
    const ln=new Set(g.map(f=>f.name));
    const c=_mds.ingredients.filter(ing=>ln.has(ing.name)).length;
    return c===_mds.ingredients.length?'full':c>0?'partial':'none';
  }
  return l?'full':'none';
}

function setMealIngQty(i,q){_mds.ingQty[i]=q;_renderMealDetail();}
function toggleMealSupplement(i){_mds.suppChecked[i]=!_mds.suppChecked[i];_renderMealDetail();}

function _renderMealDetail(){
  const s=_mds;if(!s)return;
  const m=s.meal;
  let cals=0,protein=0,carbs=0,fat=0;
  s.ingredients.forEach((ing,i)=>{
    const q=s.ingQty[i]||0;
    if(q>0){
      cals   += (ing.cals   ||0)*q;
      protein+= (ing.protein||0)*q;
      carbs  += (ing.carbs  ||0)*q;
      fat    += (ing.fat    ||0)*q;
    }
  });
  cals=Math.round(cals);protein=Math.round(protein);carbs=Math.round(carbs);fat=Math.round(fat);
  const logStatus=_getMealLogStatus();
  const changed=s.ingQty.some((q,i)=>q!==s.ingInit[i])||s.suppChecked.some((c,i)=>c!==s.suppInit[i]);
  const anyEaten=s.ingQty.some(q=>q>0);
  let btnText,btnClass;
  if(logStatus==='none'){btnText=anyEaten?'LOG MEAL':'NOTHING SELECTED';btnClass=anyEaten?'btn-lime':'btn-ghost';}
  else if(!anyEaten){btnText='UNLOG MEAL';btnClass='btn-ghost';}
  else if(changed){btnText='SAVE CHANGES';btnClass='btn-lime';}
  else{btnText='✓ LOGGED · TAP INGREDIENTS TO EDIT';btnClass='btn-ghost';}
  const chk='<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="var(--bg)" stroke-width="2" fill="none"/></svg>';
  document.getElementById('md-title').textContent=`${m.time||''} · ${m.name}`;
  document.getElementById('md-body').innerHTML=`
    <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:14px;">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px;">Macros (as selected)</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center;">
        <div><div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:var(--lime);">${cals}</div><div style="font-size:9px;color:var(--text3);">KCAL</div></div>
        <div><div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:var(--orange);">${protein}g</div><div style="font-size:9px;color:var(--text3);">PROTEIN</div></div>
        <div><div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:var(--blue);">${carbs}g</div><div style="font-size:9px;color:var(--text3);">CARBS</div></div>
        <div><div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:var(--purple);">${fat}g</div><div style="font-size:9px;color:var(--text3);">FAT</div></div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Ingredients — tap portion · tap name to edit</div>
    </div>
    <div style="margin-bottom:12px;">
      ${s.ingredients.map((ing,i)=>{
        const q=s.ingQty[i]||0;
        const dim=q===0;
        const ingCals=Math.round((ing.cals||0)*q);
        const ingP=Math.round((ing.protein||0)*q);
        const ingC=Math.round((ing.carbs||0)*q);
        const ingF=Math.round((ing.fat||0)*q);
        return`<div style="padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:4px;">
            <div onclick="openIngredientEdit(${i})" style="flex:1;font-size:13px;color:${dim?'var(--text3)':'var(--text)'};${dim?'text-decoration:line-through;':''}cursor:pointer;">${ing.name}${ing.edited?' <span style="font-size:10px;color:var(--orange);">✏️</span>':''}</div>
            <div style="font-size:11px;color:var(--text3);flex-shrink:0;text-align:right;">${dim?'—':`${ingCals} kcal`}</div>
          </div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:8px;">${dim?'skipped':`${ingP}g P · ${ingC}g C · ${ingF}g F`}</div>
          <div style="display:flex;gap:4px;">
            ${PORTION_OPTIONS.map(opt=>{
              const active=Math.abs((q||0)-opt.qty)<0.01;
              return `<button onclick="setMealIngQty(${i},${opt.qty})" style="flex:1;padding:8px 0;border-radius:6px;border:1px solid ${active?'var(--lime)':'var(--border)'};background:${active?'var(--lime)':'transparent'};color:${active?'var(--bg)':'var(--text2)'};font-weight:${active?'700':'500'};font-size:13px;cursor:pointer;">${opt.label}</button>`;
            }).join('')}
          </div>
        </div>`;}).join('')}
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px;font-size:12px;" onclick="openIngredientEdit(null)">+ Add ingredient</button>
    </div>
    ${s.supplements.length?`
    <div style="background:rgba(255,85,0,.08);border:1px solid rgba(255,85,0,.25);border-radius:10px;padding:10px 12px;margin-bottom:16px;">
      <div style="font-size:10px;color:var(--orange);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px;">💊 Take with</div>
      ${s.supplements.map((supp,i)=>{
        const on=s.suppChecked[i];
        return`<div onclick="toggleMealSupplement(${i})" style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer;min-height:44px;${i<s.supplements.length-1?'border-bottom:1px solid rgba(255,85,0,.15);':''}">
          <div style="width:20px;height:20px;border-radius:4px;border:2px solid ${on?'var(--orange)':'var(--border)'};background:${on?'var(--orange)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${on?chk:''}</div>
          <div style="flex:1;font-size:13px;color:${on?'var(--text)':'var(--text3)'};">${supp.name}${supp.dose?' · '+supp.dose:''}</div>
        </div>`;}).join('')}
    </div>`:''}
    ${s.isStringFormat?`<div style="font-size:11px;color:var(--text3);margin-bottom:14px;padding:8px 10px;background:var(--s2);border-radius:8px;">ⓘ Per-ingredient macros are estimated (divided equally). Tap <strong>Compute exact macros</strong> on the Food page to get accurate values.</div>`:''}
    <button class="btn ${btnClass} btn-full" onclick="logMealFromModal()">${btnText}</button>
  `;
}

function logMealFromModal(){
  const s=_mds;if(!s)return;
  const m=s.meal;
  const today=todayStr();
  const nowIso=new Date().toISOString();
  // Build final foods array for today: existing entries minus this meal's, plus entries for ingredients with qty > 0
  const foods=getFoods();
  const filtered=foods.filter(f=>!(f.mealId===m.id||(f.name===m.name&&!f.mealId)));
  const newEntries=[];
  s.ingredients.forEach((ing,i)=>{
    const q=s.ingQty[i]||0;
    if(q>0){
      newEntries.push({
        name:ing.name,
        cals   :Math.round((ing.cals   ||0)*q),
        protein:Math.round((ing.protein||0)*q),
        carbs  :Math.round((ing.carbs  ||0)*q),
        fat    :Math.round((ing.fat    ||0)*q),
        time:m.time||fmtNow(),
        mealId:m.id,
        mealName:m.name,
        quantity:q,
        loggedAt:nowIso,
      });
    }
  });
  const finalFoods=[...filtered,...newEntries];

  // Single atomic write — local + server
  const all=pGet('foods',{});
  all[today]=finalFoods;
  STATE.foods=all;
  updateLocalCache();
  saveFieldToServer(`/api/state/foods/${today}`,{value:finalFoods});

  // Supplements (separate endpoint, no race)
  s.supplements.forEach((supp,i)=>setSupplementTaken(today,supp.id,s.suppChecked[i]));

  closeModal('modal-meal-detail');
  renderFood();renderToday();
  if(newEntries.length===0){
    showToast(`${m.name} unlogged`);
  } else if(newEntries.length<s.ingredients.length){
    showToast(`${m.name} · ${newEntries.length}/${s.ingredients.length} logged`);
  } else {
    showToast(`${m.name} logged ✓`);
  }
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
function _progressCard(label,subtitle,current,unit,pct,color,rate,rateUnit,caption,sparkSvg,extra){
  pct=Math.max(0,Math.min(100,Math.round(pct)));
  return `<div class="card" style="margin-bottom:10px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
      <div>
        <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:1px;">${label}</div>
        ${subtitle?`<div style="font-size:10px;color:var(--text2);">${subtitle}</div>`:''}
      </div>
      <div>${sparkSvg}</div>
    </div>
    <div style="font-family:'Archivo Black',sans-serif;font-size:34px;color:${color};letter-spacing:-2px;line-height:1;margin-bottom:8px;">${current!=null?current:'—'}<span style="font-size:16px;">${unit}</span></div>
    <div class="pb-wrap" style="margin-bottom:6px;">
      <div class="pb-head"><span class="pb-lbl"></span><span class="pb-pct">${pct}%</span></div>
      <div class="pb" style="height:8px;"><div class="pb-fill" style="width:${pct}%;background:${color};"></div></div>
    </div>
    <div style="font-size:11px;color:var(--text2);line-height:1.5;">${rate!=null?`14-day avg: ${rate>0?'+':''}${rate}${rateUnit}/wk · `:''}${caption}</div>
    ${extra||''}
  </div>`;
}

function renderTrack(){
  const p=getActive(); if(!p)return;
  const wl=getWeightLog();
  const cw=getCurrentWeight();
  const cbf=getCurrentBf();
  const clbm=getCurrentLBM();
  const cvf=getCurrentVisceralFat();
  const svf=getStartVisceralFat();
  const stepsLog=getStepsLog();
  const last7=getLast7();
  const weekSteps=last7.map(d=>({date:d,steps:stepsLog[d]||0}));
  const stepsStreak=calcStreak('steps');
  const gymStreak=calcStreak('gym');
  const foodStreak=calcStreak('food');

  // Progress dashboard
  const _v=v=>v!=null?v:'—';
  const wEntries=getJourneyEntries('weight');
  const bEntries=getJourneyEntries('bf');
  const lEntries=getJourneyEntries('lbm');
  const vEntries=getJourneyEntries('visceral');
  const hasEnoughW=wEntries.length>=14;
  const hasEnoughB=bEntries.length>=14;
  const hasEnoughL=lEntries.length>=14;
  const hasEnoughV=vEntries.length>=14;
  const startLabel=p.startDate?fmtDate(p.startDate):'start';

  const proj=getProjections();
  const _fmtGoalD=d=>d?d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—';

  const wPct=p.startWeight&&p.targetWeight?((p.startWeight-cw)/(p.startWeight-p.targetWeight))*100:0;
  const wRate=get14DayAvgRate('weight');
  const wLost=p.startWeight?Math.max(0,p.startWeight-cw).toFixed(1):'—';
  const wToGo=p.targetWeight?Math.max(0,cw-p.targetWeight).toFixed(1):'—';
  const wGoalStr=proj&&proj.wDate?`Goal: ~${_fmtGoalD(proj.wDate)}`:(wEntries.length>=2?'Goal: Pending — need consistent loss trend':'Goal: Pending — need more entries');
  const wSpark=spark(wEntries.slice(-14).map(e=>e.weight),'var(--lime)');

  const bPct=p.startBF&&p.targetBF&&cbf?((p.startBF-cbf)/(p.startBF-p.targetBF))*100:0;
  const bRate=get14DayAvgRate('bf');
  const bGoalStr=proj&&proj.bDate?`Goal: ~${_fmtGoalD(proj.bDate)}`:(bEntries.length>=2?'Goal: Pending — need consistent loss trend':'Goal: Pending — need more entries');
  const bCaption=hasEnoughB?(p.startBF&&cbf?`Down ${Math.abs(p.startBF-cbf).toFixed(1)}% from start · ${bGoalStr}`:`Tracking from ${startLabel} · ${bGoalStr}`):`Tracking from ${startLabel} · ${bGoalStr}`;
  const bSpark=spark(bEntries.slice(-14).map(e=>e.bf),'var(--orange)');

  const lPct=p.startLBM&&clbm?(clbm/p.startLBM)*100:100;
  const lRate=get14DayAvgRate('lbm');
  const lCaption=hasEnoughL?(p.startLBM&&clbm?`Change: ${(clbm-p.startLBM)>0?'+':''}${(clbm-p.startLBM).toFixed(1)}kg from start`:`Tracking from ${startLabel}`):`Tracking from ${startLabel}`;
  const lSpark=spark(lEntries.slice(-14).map(e=>e.lbm),'var(--blue)');
  const lAlert=getLBMDropAlert()?`<div style="background:rgba(255,85,0,.08);border:1px solid rgba(255,85,0,.2);border-radius:8px;padding:8px 10px;margin-top:8px;font-size:11px;color:var(--orange);font-weight:600;">⚠ Lean dropping faster than target — review protein and training intensity</div>`:'';

  const vPct=svf!=null&&p.targetVisceralFat!=null&&cvf!=null?((svf-cvf)/(svf-p.targetVisceralFat))*100:0;
  const vRate=get14DayAvgRate('visceral');
  const vCaption=hasEnoughV?(svf!=null&&cvf!=null?`Down ${Math.abs(svf-cvf).toFixed(1)} from start`:`Tracking from ${startLabel}`):`Tracking from ${startLabel}`;
  const vSpark=spark(vEntries.slice(-14).map(e=>e.visceralFat),'var(--purple)');

  // Phase 29: compute 7d/14d deltas for the trend card
  const _atOrBefore = (entries, date) => {
    const e = entries.filter(x => x.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0];
    return e || null;
  };
  const _fmt = (v, unit, dp) => v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(dp ?? 1)}${unit || ''}` : '—';
  const _colorForLBMDelta = d => d == null ? 'var(--text3)' : d >= -0.1 ? 'var(--green)' : d >= -0.3 ? '#ffc107' : 'var(--red)';
  const _colorForFatDelta = d => d == null ? 'var(--text3)' : d < 0 ? 'var(--green)' : d > 0 ? 'var(--red)' : 'var(--text2)';
  const _trendRow = (label, cur, deltas, color) => {
    const d7 = deltas[0], d14 = deltas[1];
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
      <div style="flex:0 0 78px;font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;font-weight:700;">${label}</div>
      <div style="flex:1;font-family:'Archivo Black',sans-serif;font-size:15px;color:var(--text);">${cur ?? '—'}</div>
      <div style="text-align:right;font-size:11px;line-height:1.3;">
        <div style="color:${color(d7)};font-weight:700;">${_fmt(d7, ' kg')} <span style="opacity:.6;font-weight:400;">7d</span></div>
        <div style="color:${color(d14)};">${_fmt(d14, ' kg')} <span style="opacity:.6;">14d</span></div>
      </div>
    </div>`;
  };
  const wEntriesAll = getJourneyEntries('weight');
  const bEntriesAll = getJourneyEntries('bf');
  const lEntriesAll = getJourneyEntries('lbm');
  const today = todayStr();
  const d7 = (() => { const x = new Date(); x.setDate(x.getDate() - 7); return x.toISOString().slice(0,10); })();
  const d14 = (() => { const x = new Date(); x.setDate(x.getDate() - 14); return x.toISOString().slice(0,10); })();
  const cwNow = cw, cbfNow = cbf, clbmNow = clbm;
  const cFatNow = (cwNow && cbfNow) ? Math.round(cwNow * (cbfNow / 100) * 100) / 100 : null;
  const w7 = _atOrBefore(wEntriesAll, d7)?.weight, w14 = _atOrBefore(wEntriesAll, d14)?.weight;
  const l7 = _atOrBefore(lEntriesAll, d7)?.lbm,    l14 = _atOrBefore(lEntriesAll, d14)?.lbm;
  const wlogAt7 = _atOrBefore(wEntriesAll, d7);    const blogAt7  = _atOrBefore(bEntriesAll, d7);
  const wlogAt14= _atOrBefore(wEntriesAll, d14);   const blogAt14 = _atOrBefore(bEntriesAll, d14);
  const fat7  = (wlogAt7  && blogAt7)  ? Math.round(wlogAt7.weight  * (blogAt7.bf  / 100) * 100) / 100 : null;
  const fat14 = (wlogAt14 && blogAt14) ? Math.round(wlogAt14.weight * (blogAt14.bf / 100) * 100) / 100 : null;
  const wDelta7  = (cwNow != null && w7  != null) ? cwNow  - w7  : null;
  const wDelta14 = (cwNow != null && w14 != null) ? cwNow  - w14 : null;
  const fatDelta7  = (cFatNow != null && fat7  != null) ? cFatNow - fat7  : null;
  const fatDelta14 = (cFatNow != null && fat14 != null) ? cFatNow - fat14 : null;
  const lbmDelta7  = (clbmNow != null && l7  != null) ? clbmNow - l7  : null;
  const lbmDelta14 = (clbmNow != null && l14 != null) ? clbmNow - l14 : null;
  const trendCard = `<div class="card" style="margin-bottom:14px;border-color:var(--border2);">
    <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Body Composition · This Week vs Last</div>
    ${_trendRow('Weight',    cwNow != null ? cwNow + ' kg' : '—',    [wDelta7,   wDelta14],   _colorForFatDelta)}
    ${_trendRow('Fat mass',  cFatNow != null ? cFatNow + ' kg' : '—',[fatDelta7, fatDelta14], _colorForFatDelta)}
    ${_trendRow('Lean mass', clbmNow != null ? clbmNow + ' kg' : '—',[lbmDelta7, lbmDelta14], _colorForLBMDelta)}
    <div style="font-size:10px;color:var(--text3);line-height:1.5;padding-top:10px;">Goal is fat loss with lean preserved. Green LBM = holding · amber = small drop · red = losing muscle (review protein / deficit / training).</div>
  </div>`;

  // Phase 30: Compare two dates card
  const compareCard = `<div class="card" style="margin-bottom:14px;">
    <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Compare Any Two Dates</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
      <div>
        <div style="font-size:10px;color:var(--text3);margin-bottom:4px;">From</div>
        <input id="cmp-date-a" type="date" value="${p.startDate || todayStr()}" onchange="renderCompareSnapshot()" style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;" />
      </div>
      <div>
        <div style="font-size:10px;color:var(--text3);margin-bottom:4px;">To</div>
        <input id="cmp-date-b" type="date" value="${todayStr()}" onchange="renderCompareSnapshot()" style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;" />
      </div>
    </div>
    <div id="cmp-result"></div>
  </div>`;

  document.getElementById('page-track').innerHTML=`
    <div class="pg-title" style="margin-bottom:14px;">Progress</div>

    ${trendCard}

    ${compareCard}

    ${_progressCard('Weight',`${_v(p.startWeight)}kg → ${_v(p.targetWeight)}kg`,cw,'kg',wPct,'var(--lime)',hasEnoughW?wRate:null,' kg',`Lost ${wLost}kg · ${wToGo}kg to go · ${wGoalStr}`,wSpark)}
    ${_progressCard('Body Fat',`${_v(p.startBF)}% → ${_v(p.targetBF)}%`,cbf,'%',bPct,'var(--orange)',hasEnoughB?bRate:null,'%',bCaption,bSpark)}
    ${_progressCard('Lean Mass',`current — target: hold ${_v(p.targetLBM)}kg`,clbm,'kg',lPct,'var(--blue)',hasEnoughL?lRate:null,' kg',lCaption,lSpark,lAlert)}
    ${cvf!=null||svf!=null?_progressCard('Visceral Fat',`current → target: ${_v(p.targetVisceralFat)} or less`,cvf,'',vPct,'var(--purple)',hasEnoughV?vRate:null,'',vCaption,vSpark):''}

    ${(()=>{
      if(!proj)return'<div class="card" style="margin-bottom:10px;"><div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:1px;">GOAL DATE</div><div style="font-size:12px;color:var(--text2);padding:12px 0;">Pending — need profile targets set</div></div>';
      if(!proj.goalDate){
        const reason=(wEntries.length<2||bEntries.length<2)?'Pending — need more entries':'Pending — need consistent loss trend';
        return'<div class="card" style="margin-bottom:10px;"><div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:1px;">GOAL DATE</div><div style="font-size:12px;color:var(--text2);padding:12px 0;">'+reason+'</div></div>';
      }
      const confColor=proj.confidence==='high'?'#4caf50':proj.confidence==='medium'?'#ff9800':'#f44336';
      const confLabel=proj.confidence.charAt(0).toUpperCase()+proj.confidence.slice(1);
      const goalStr=_fmtGoalD(proj.goalDate);
      const rangeStr=proj.range?`${_fmtGoalD(proj.range.early)} — ${_fmtGoalD(proj.range.late)}`:'';
      const wLine=proj.wDate?`Weight target by: ~${_fmtGoalD(proj.wDate)}${proj.bindingMetric==='weight'?' (binding)':''}`:'Weight: pending';
      const bLine=proj.bDate?`BF target by: ~${_fmtGoalD(proj.bDate)}${proj.bindingMetric==='bf'?' (binding)':''}`:'BF: pending';
      const elapsed=p.startDate?Math.max(0,Math.round((new Date()-new Date(p.startDate+'T12:00:00'))/(7*86400000))):0;
      const totalW=proj.goalDate?Math.max(1,Math.round((proj.goalDate-new Date(p.startDate+'T12:00:00'))/(7*86400000))):1;
      const progPct=Math.min(100,Math.round((elapsed/totalW)*100));
      return`<div class="card" style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:1px;">GOAL DATE</div>
          <div style="font-size:10px;color:var(--text2);">${_v(p.targetWeight)}kg + ${_v(p.targetBF)}% body fat</div>
        </div>
        <div style="font-family:'Archivo Black',sans-serif;font-size:28px;color:var(--lime);letter-spacing:-1px;line-height:1;margin-bottom:6px;">${goalStr}</div>
        <div class="pb-wrap" style="margin-bottom:6px;">
          <div class="pb-head"><span class="pb-lbl">Elapsed</span><span class="pb-pct">${progPct}%</span></div>
          <div class="pb" style="height:8px;"><div class="pb-fill" style="width:${progPct}%;background:var(--lime);"></div></div>
        </div>
        <div style="font-size:11px;color:var(--text2);line-height:1.8;">
          Range: ${rangeStr} <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${confColor};vertical-align:middle;margin-left:4px;"></span> <span style="font-size:10px;color:var(--text3);">${confLabel} confidence</span><br>
          ${wLine}<br>
          ${bLine}
        </div>
      </div>`;
    })()}

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div class="sec-label" style="margin-bottom:0;">Weight History</div>
      <button class="btn btn-lime btn-sm" onclick="openModal('modal-weight')">+ Log</button>
    </div>
    <div class="card">
      ${wl.length===0?'<div style="text-align:center;color:var(--text3);padding:20px;font-size:13px;">No entries yet</div>':
        [...wl].reverse().slice(0,12).map((e,i,arr)=>{
          const prev=arr[i+1];
          const diff=prev?(e.weight-prev.weight):null;
          const cls=diff===null?'':diff<0?'dn':'up';
          const txt=diff===null?'—':diff<0?`▼ ${Math.abs(diff).toFixed(1)}kg`:`▲ ${diff.toFixed(1)}kg`;
          const srcBadge=e.source==='manual'?'<span style="font-size:9px;color:var(--text3);background:var(--card);border:1px solid var(--border);border-radius:3px;padding:0 3px;margin-left:4px;vertical-align:middle;">M</span>'
            :e.source==='withings'?'<span style="font-size:9px;color:var(--text3);background:var(--card);border:1px solid var(--border);border-radius:3px;padding:0 3px;margin-left:4px;vertical-align:middle;">W</span>':'';
          return `<div class="list-row">
            <div class="row-left"><div class="row-label">${fmtDate(e.date)}${srcBadge}</div><div class="row-val">${e.weight}kg</div></div>
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

    <div class="sec-label">Strength Standards</div>
    ${renderStrengthStandards()}

    <div class="sec-label">Training Calendar</div>
    ${renderCalendar()}
  `;

  // Phase 30: render the date-compare snapshot after innerHTML
  renderCompareSnapshot();
}

// Phase 30: compute a snapshot of key metrics on a given date (or nearest before)
function _snapshotAtDate(date){
  const wl = (STATE.weightLog || []).filter(e => e.date <= date).sort((a,b) => b.date.localeCompare(a.date));
  const bl = (STATE.bfLog     || []).filter(e => e.date <= date).sort((a,b) => b.date.localeCompare(a.date));
  const bc = STATE.bodyComp   || {};
  const sleep = STATE.sleepLog || {};
  const steps = STATE.stepsLog || {};
  const cals  = STATE.calorieLog || {};
  const w  = wl[0]?.weight ?? null;
  const bf = bl[0]?.bf ?? null;
  const lbm = (w != null && bf != null) ? Math.round(w * (1 - bf/100) * 100) / 100 : null;
  const fat = (w != null && bf != null) ? Math.round(w * (bf/100) * 100) / 100 : null;
  // bodyComp on this date (or closest before)
  const bcDates = Object.keys(bc).filter(d => d <= date).sort().reverse();
  let muscle = null, visceral = null;
  for (const d of bcDates) {
    if (muscle == null && bc[d]?.muscleMass != null) muscle = bc[d].muscleMass;
    if (visceral == null && bc[d]?.visceralFat != null) visceral = bc[d].visceralFat;
    if (muscle != null && visceral != null) break;
  }
  return {
    weight: w, bf, lbm, fat, muscle, visceral,
    sleep: sleep[date]?.hours ?? null,
    steps: steps[date] ?? null,
    activeCal: cals[date]?.active ?? null,
    totalCal: cals[date]?.total ?? null,
    weightDate: wl[0]?.date ?? null,
    bfDate: bl[0]?.date ?? null,
  };
}

function renderCompareSnapshot(){
  const a = document.getElementById('cmp-date-a')?.value;
  const b = document.getElementById('cmp-date-b')?.value;
  const out = document.getElementById('cmp-result');
  if(!a || !b || !out) return;
  const A = _snapshotAtDate(a);
  const B = _snapshotAtDate(b);
  const _fmt = (v, dp=1, unit='') => v != null ? `${v.toFixed(dp)}${unit}` : '—';
  const _delta = (vA, vB, dp=1, unit='', invert=false) => {
    if (vA == null || vB == null) return '<span style="color:var(--text3);">—</span>';
    const d = vB - vA;
    if (Math.abs(d) < 0.01) return '<span style="color:var(--text3);">no change</span>';
    const good = invert ? d > 0 : d < 0;
    const color = good ? 'var(--green)' : 'var(--red)';
    const sign = d > 0 ? '+' : '';
    return `<span style="color:${color};font-weight:700;">${sign}${d.toFixed(dp)}${unit}</span>`;
  };
  const _row = (label, vA, vB, dp=1, unit='', invertGood=false) => `
    <div style="display:grid;grid-template-columns:80px 1fr 1fr 1fr;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;">
      <div style="color:var(--text3);">${label}</div>
      <div style="font-family:'Archivo Black',sans-serif;color:var(--text);">${_fmt(vA, dp, unit)}</div>
      <div style="font-family:'Archivo Black',sans-serif;color:var(--text);">${_fmt(vB, dp, unit)}</div>
      <div style="text-align:right;">${_delta(vA, vB, dp, unit, invertGood)}</div>
    </div>`;
  out.innerHTML = `
    <div style="display:grid;grid-template-columns:80px 1fr 1fr 1fr;gap:8px;padding-bottom:6px;border-bottom:1px solid var(--border2);font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">
      <div></div><div>${a}</div><div>${b}</div><div style="text-align:right;">Δ</div>
    </div>
    ${_row('Weight',     A.weight,    B.weight,    1, 'kg')}
    ${_row('Body fat',   A.bf,        B.bf,        1, '%')}
    ${_row('Lean mass',  A.lbm,       B.lbm,       1, 'kg', true)}
    ${_row('Fat mass',   A.fat,       B.fat,       1, 'kg')}
    ${_row('Muscle',     A.muscle,    B.muscle,    1, 'kg', true)}
    ${_row('Visceral',   A.visceral,  B.visceral,  1, '')}
    ${_row('Sleep',      A.sleep,     B.sleep,     1, 'h', true)}
    ${_row('Steps',      A.steps,     B.steps,     0, '',  true)}
    ${_row('TDEE',       A.totalCal,  B.totalCal,  0, ' kcal', true)}
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

// ============================================================
// PHASE 31a: Strength Standards — tier classification per lift
// ============================================================
// Standards = est. 1RM × bodyweight multipliers for an age-30 male baseline.
// Adjusted down by 0.5%/yr past 30 (accounts for sarcopenia).
// Sources: ExRx machine standards averaged with StrengthLevel community data.
// All values are approximate — machines vary, 1RM is estimated.
const STRENGTH_STD = {
  // [novice, intermediate, advanced, elite] × bodyweight
  u1: { name:'Chest Press',          male:[0.50, 0.85, 1.20, 1.50] },
  u2: { name:'Incline DB Press',     male:[0.30, 0.55, 0.80, 1.05] },
  u3: { name:'Seated Row',           male:[0.50, 0.85, 1.20, 1.50] },
  u4: { name:'Shoulder Press',       male:[0.35, 0.55, 0.80, 1.05] },
  u5: { name:'Lat Pulldown',         male:[0.60, 0.95, 1.30, 1.60] },
  u6: { name:'Bicep Curl',           male:[0.25, 0.40, 0.60, 0.80] },
  u7: { name:'Tricep Pushdown',      male:[0.30, 0.50, 0.70, 0.90] },
  u8: { name:'Face Pull',            male:[0.30, 0.50, 0.70, 0.90] },
  l1: { name:'Leg Press',            male:[1.20, 1.75, 2.50, 3.50] },
  l2: { name:'Romanian Deadlift',    male:[0.85, 1.50, 2.00, 2.50] },
  l3: { name:'Leg Extension',        male:[0.50, 0.80, 1.10, 1.40] },
  l4: { name:'Leg Curl',             male:[0.40, 0.70, 0.95, 1.20] },
  l5: { name:'Hip Thrust',           male:[1.00, 1.50, 2.25, 3.00] },
  l6: { name:'Calf Raise',           male:[1.00, 1.50, 2.00, 2.75] },
  l7: { name:'Back Extension',       male:[0.30, 0.50, 0.75, 1.00] },
};

const STRENGTH_TIERS = [
  {label:'Untrained',    color:'var(--text3)'},
  {label:'Novice',       color:'var(--orange)'},
  {label:'Intermediate', color:'var(--blue)'},
  {label:'Advanced',     color:'var(--lime)'},
  {label:'Elite',        color:'var(--green)'},
];

function _ageAdjustFactor(age){
  if(!age || age <= 30) return 1;
  // 0.5%/yr decay past 30 — generous, accounts for trained populations
  return Math.max(0.6, 1 - 0.005 * (age - 30));
}

function _brzycki1RM(weight, reps){
  const w = parseFloat(weight) || 0;
  const r = Math.min(parseInt(reps, 10) || 0, 10);
  if(!w || !r) return 0;
  return Math.round(w * (36 / (37 - r)));
}

function _bestEstimated1RM(exId){
  const exLog = STATE.exLog || {};
  let best = 0;
  for(const date of Object.keys(exLog)){
    const sets = exLog[date]?.[exId]?.sets || [];
    for(const s of sets){
      const r = _brzycki1RM(s.kg, s.reps);
      if(r > best) best = r;
    }
  }
  return best;
}

function _classifyLift(estimated1RM, bw, lbm, ageFactor, multipliers){
  if(!estimated1RM || !multipliers || !bw) return null;
  // Tier thresholds (kg) for THIS user
  const thresholds = multipliers.map(m => m * bw * ageFactor);
  let tier = 0;
  for(let i = 0; i < thresholds.length; i++){
    if(estimated1RM >= thresholds[i]) tier = i + 1;
  }
  return {
    tier,                                  // 0-4
    label: STRENGTH_TIERS[tier].label,
    color: STRENGTH_TIERS[tier].color,
    bwRatio: Math.round((estimated1RM / bw) * 100) / 100,
    lbmRatio: lbm ? Math.round((estimated1RM / lbm) * 100) / 100 : null,
    thresholds,
  };
}

function renderStrengthStandards(){
  const profile = STATE.profile || {};
  const personal = profile.personal || {};
  const age = personal.age;
  const sex = personal.sex || 'male';
  if(sex !== 'male') {
    return `<div class="card" style="margin-bottom:10px;padding:14px;text-align:center;color:var(--text3);font-size:12px;">Female strength standards coming soon — bodyweight standards differ meaningfully by sex.</div>`;
  }
  const wl = STATE.weightLog || [];
  const bl = STATE.bfLog || [];
  const cw = wl.length ? wl[wl.length-1].weight : null;
  const cbf = bl.length ? bl[bl.length-1].bf : null;
  const lbm = (cw && cbf) ? Math.round(cw * (1 - cbf/100) * 10) / 10 : null;
  if(!cw){
    return `<div class="card" style="margin-bottom:10px;padding:14px;text-align:center;color:var(--text3);font-size:12px;">Log your weight to see strength standards.</div>`;
  }
  if(!age){
    return `<div class="card" style="margin-bottom:10px;padding:14px;text-align:center;color:var(--text3);font-size:12px;">Add your age in More → Personal Profile to see age-adjusted strength standards.</div>`;
  }
  const ageFactor = _ageAdjustFactor(age);
  const rows = Object.keys(STRENGTH_STD).map(exId => {
    const exDef = STRENGTH_STD[exId];
    const est1RM = _bestEstimated1RM(exId);
    if(est1RM === 0) return null;
    const cls = _classifyLift(est1RM, cw, lbm, ageFactor, exDef.male);
    if(!cls) return null;
    return { exId, name: exDef.name, est1RM, ...cls };
  }).filter(Boolean);
  rows.sort((a, b) => b.tier - a.tier);

  if(rows.length === 0){
    return `<div class="card" style="margin-bottom:10px;padding:14px;text-align:center;color:var(--text3);font-size:12px;">Log a few workouts to see your strength standards.</div>`;
  }

  // Overall summary
  const avgTier = rows.reduce((s, r) => s + r.tier, 0) / rows.length;
  const overallLabel = STRENGTH_TIERS[Math.round(avgTier)].label;
  const overallColor = STRENGTH_TIERS[Math.round(avgTier)].color;

  return `<div class="card" style="margin-bottom:10px;padding:12px 14px;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Overall</div>
      <div style="font-family:'Archivo Black',sans-serif;font-size:20px;color:${overallColor};">${overallLabel}</div>
    </div>
    <div style="font-size:10px;color:var(--text3);margin-bottom:10px;line-height:1.5;">Bodyweight ${cw}kg · age ${age}${lbm?` · LBM ${lbm}kg`:''}. Age factor: ${(ageFactor*100).toFixed(0)}%. Standards adjusted for ${age}yo ${sex}.</div>
    <div style="display:grid;grid-template-columns:1fr 60px 60px 90px;gap:6px;padding:6px 0;border-bottom:1px solid var(--border2);font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">
      <div>Lift</div><div style="text-align:right;">1RM</div><div style="text-align:right;">×BW</div><div style="text-align:right;">Tier</div>
    </div>
    ${rows.map(r => `<div style="display:grid;grid-template-columns:1fr 60px 60px 90px;gap:6px;padding:7px 0;border-bottom:1px solid var(--border);align-items:center;font-size:12px;">
      <div style="color:var(--text);">${r.name}</div>
      <div style="text-align:right;font-family:'Archivo Black',sans-serif;color:var(--text);">${r.est1RM}<span style="font-size:9px;color:var(--text3);">kg</span></div>
      <div style="text-align:right;color:var(--text2);">${r.bwRatio}×</div>
      <div style="text-align:right;font-size:10px;color:${r.color};text-transform:uppercase;letter-spacing:1px;font-weight:700;">${r.label}</div>
    </div>`).join('')}
    <div style="font-size:10px;color:var(--text3);margin-top:10px;line-height:1.5;">1RMs estimated from working sets (Brzycki formula). Standards from ExRx + StrengthLevel data, age-adjusted ~0.5%/yr past 30. Machines vary — treat tiers as rough guidance, not gospel.</div>
  </div>`;
}

function renderLiftingRecords(){
  const allEx=[...WORKOUTS.upper.exercises,...WORKOUTS.lower.exercises];
  const records=allEx.map(ex=>{const b=getBestLift(ex.id);return{ex,best:b};}).filter(r=>r.best);
  if(records.length===0)return'<div style="text-align:center;color:var(--text3);padding:20px;font-size:13px;">Log sets in workouts to see personal bests</div>';
  return records.map(r=>{
    const timed=isTimeBased(r.ex);
    const val=timed?fmtSec(r.best.seconds):`${r.best.kg}kg`;
    return `<div class="list-row">
      <div class="row-left"><div class="row-label">${r.ex.muscle}</div><div style="font-size:13px;font-weight:600;">${r.ex.name}</div></div>
      <div style="text-align:right;"><div style="font-family:'Archivo Black',sans-serif;font-size:20px;color:var(--lime);">${val}</div><div style="font-size:10px;color:var(--text2);">${fmtDate(r.best.date)}</div></div>
    </div>`;
  }).join('');
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
    const key=_ukDate(d);
    const isToday=key===todayStr();
    const isFuture=d>today;
    const el=exLog[key]||{};
    const hasGym=Object.values(el).some(e=>e.done);
    const hitSteps=(stepsLog[key]||0)>=10000;
    const wasScheduledTraining=getSessionTypeForDate(key)!==null;
    let cls='cal-dot';
    if(isFuture)cls+=' future';
    else if(hasGym)cls+=' gym';
    else if(hitSteps)cls+=' rest-active';
    else if(wasScheduledTraining && key<todayStr())cls+=' missed';
    if(isToday)cls+=' today';
    html+=`<div class="${cls}" style="cursor:pointer;" title="${key}" onclick="openPastDay('${key}')">${d.getDate()}</div>`;
  });

  html+='</div>';
  html+=`<div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;">
    <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text2);"><div style="width:10px;height:10px;border-radius:3px;background:rgba(200,255,0,.15);"></div>Gym</div>
    <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text2);"><div style="width:10px;height:10px;border-radius:3px;background:rgba(61,155,255,.1);"></div>Steps hit</div>
    <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text2);"><div style="width:10px;height:10px;border-radius:3px;background:rgba(255,59,59,.08);"></div>Missed</div>
  </div></div>`;
  return html;
}

function openPastDay(dateKey){
  openDayDetail(dateKey);
}

function openDayDetail(date){
  const el=document.getElementById('dayDetail');
  if(!el)return;
  el.classList.add('open');
  renderDayDetail(date);
  window.scrollTo(0,0);
}

function closeDayDetail(){
  const el=document.getElementById('dayDetail');
  if(el)el.classList.remove('open');
}

function renderDayDetail(date){
  const dateObj=new Date(date+'T12:00:00');
  const dateLabel=dateObj.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const isToday=date===todayStr();
  const isFuture=date>todayStr();

  // Pull all data for this date
  const weight=getWeightLog().find(e=>e.date===date)?.weight;
  const bf=getBfLog().find(e=>e.date===date)?.bf;
  const sleep=getSleepLog()[date];
  const recovery=pGet('recovery',{})[date];
  const steps=getStepsLog()[date];
  const cals=pGet('calorieLog',{})[date];
  const sessionLog=getExLog()[date]||{};
  const sessionType=getSessionTypeForDate(date);
  const foods=(pGet('foods',{})[date]||[]).slice().sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));
  const meas=getMeasLog().find(e=>e.date===date);
  const swims=getSwimLog()[date]||[];
  const supps=getSupps();
  const suppDoneAll=getSuppDone();
  const bodyComp=pGet('bodyComp',{})[date];

  const foodTotals={
    cals:foods.reduce((s,f)=>s+(f.cals||0),0),
    protein:foods.reduce((s,f)=>s+(f.protein||0),0),
    carbs:foods.reduce((s,f)=>s+(f.carbs||0),0),
    fat:foods.reduce((s,f)=>s+(f.fat||0),0),
  };

  let html=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <button class="dd-back" onclick="closeDayDetail()">←</button>
      <div style="text-align:center;flex:1;padding:0 12px;">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">${isToday?'Today':isFuture?'Upcoming':'Day Detail'}</div>
        <div style="font-family:'Archivo Black',sans-serif;font-size:16px;letter-spacing:-.3px;line-height:1.2;">${dateLabel}</div>
      </div>
      <div style="width:36px;"></div>
    </div>
  `;

  // OVERVIEW
  if(weight||bf||sleep){
    html+=`<div class="sec-label">Overview</div><div class="sg sg3" style="margin-bottom:10px;">`;
    if(weight!==undefined)html+=`<div class="sb lime"><div class="l">Weight</div><div class="v">${weight}<span class="u">kg</span></div></div>`;
    else html+=`<div class="sb"><div class="l">Weight</div><div class="v" style="color:var(--text3);">—</div></div>`;
    if(bf!==undefined)html+=`<div class="sb cyan"><div class="l">Body Fat</div><div class="v">${bf}<span class="u">%</span></div></div>`;
    else html+=`<div class="sb"><div class="l">Body Fat</div><div class="v" style="color:var(--text3);">—</div></div>`;
    if(sleep)html+=`<div class="sb purple"><div class="l">Sleep</div><div class="v">${fmtHrs(sleep.hours)}</div></div>`;
    else html+=`<div class="sb"><div class="l">Sleep</div><div class="v" style="color:var(--text3);">—</div></div>`;
    html+=`</div>`;
  }

  // RECOVERY (Oura)
  if(recovery&&(recovery.readiness||recovery.hrv||recovery.restingHR)){
    html+=`<div class="sec-label">Recovery</div>
      <div class="card" style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          ${recovery.readiness?`<div><div style="font-size:10px;color:var(--text2);">READINESS</div><div style="font-family:'Archivo Black',sans-serif;font-size:24px;color:${recovery.readiness>=75?'var(--green)':recovery.readiness>=60?'var(--lime)':recovery.readiness>=45?'var(--orange)':'var(--red)'};">${recovery.readiness}</div></div>`:''}
          ${recovery.hrv?`<div><div style="font-size:10px;color:var(--text2);">HRV</div><div style="font-family:'Archivo Black',sans-serif;font-size:20px;">${recovery.hrv}</div></div>`:''}
          ${recovery.restingHR?`<div><div style="font-size:10px;color:var(--text2);">RHR</div><div style="font-family:'Archivo Black',sans-serif;font-size:20px;">${recovery.restingHR}</div></div>`:''}
        </div>
      </div>`;
  }

  // TRAINING
  html+=`<div class="sec-label">Training</div>`;
  if(!sessionType){
    html+=`<div class="card" style="margin-bottom:10px;text-align:center;color:var(--text2);font-size:13px;padding:14px;">😴 Scheduled rest day</div>`;
  }else{
    const w=WORKOUTS[sessionType];
    const doneEx=w.exercises.filter(e=>sessionLog[e.id]?.done);
    if(doneEx.length===0){
      html+=`<div class="card" style="margin-bottom:10px;text-align:center;color:var(--orange);font-size:13px;padding:14px;">⚠️ ${w.name} scheduled but no session logged</div>`;
    }else{
      let totalVolume=0;
      const efMap={easy:' 😌',solid:' 💪',tough:' 🔥',hard:' 🔥',maybe:' 🤔'};
      const setRows=doneEx.map(ex=>{
        const timed=isTimeBased(ex);
        const sets=(sessionLog[ex.id].sets||[]).filter(s=>timed?s.seconds:(s.kg||s.reps));
        const exVol=timed?0:sets.reduce((s,x)=>s+(parseFloat(x.kg)||0)*(parseInt(x.reps)||0),0);
        totalVolume+=exVol;
        const exEffort=sessionLog[ex.id].effort;
        const summary=timed
          ?sets.map(s=>fmtSec(s.seconds)).join(', ')+(exEffort?efMap[exEffort]||'':'')
          :sets.map(s=>`${s.kg||'-'}×${s.reps||'-'}${s.effort?(efMap[s.effort]||''):''}`).join(', ');
        return `<div onclick="openSetEdit('${date}','${ex.id}')" style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;">
          <div style="display:flex;justify-content:space-between;align-items:baseline;">
            <div style="font-weight:600;font-size:13px;">${ex.name}</div>
            <div style="font-size:10px;color:var(--text3);">✏️ tap to edit</div>
          </div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px;">${summary||'no sets logged'}</div>
        </div>`;
      }).join('');
      // Exercises in the workout that were NOT done — let user add them retroactively
      const notDoneEx = w.exercises.filter(e => !sessionLog[e.id]?.done);
      const notDoneRows = notDoneEx.map(ex => `<div onclick="openSetEdit('${date}','${ex.id}')" style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;opacity:.55;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <div style="font-weight:600;font-size:13px;color:var(--text3);">${ex.name}</div>
          <div style="font-size:10px;color:var(--text3);">+ add</div>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;font-style:italic;">not logged — tap to backfill</div>
      </div>`).join('');
      html+=`<div class="card" style="margin-bottom:10px;">
        <div style="font-family:'Archivo Black',sans-serif;font-size:14px;color:var(--lime);margin-bottom:4px;">${w.name}</div>
        <div style="font-size:11px;color:var(--text2);margin-bottom:8px;">${doneEx.length}/${w.exercises.length} exercises · ${totalVolume.toFixed(0)}kg total volume</div>
        ${setRows}
        ${notDoneRows}
      </div>`;
    }
  }

  // FOOD
  html+=`<div class="sec-label">Food</div>`;
  html+=`<div class="card" style="margin-bottom:10px;">`;
  if(foods.length===0){
    html+=`<div style="text-align:center;color:var(--text2);font-size:13px;padding:8px 0 14px;">Nothing logged on this day</div>`;
  }else{
    html+=`
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border);">
        <div>${foods.length} entries</div>
        <div><strong style="color:var(--lime);">${foodTotals.cals}</strong> kcal · <strong style="color:var(--orange);">${foodTotals.protein}g</strong> P · <strong style="color:var(--blue);">${foodTotals.carbs}g</strong> C · <strong style="color:var(--purple);">${foodTotals.fat}g</strong> F</div>
      </div>
      ${foods.map((f,i)=>`<div class="food-row">
        <div class="food-time">${_foodDisplayTime(f)}</div>
        <div class="food-name">${f.name}${_qtyBadge(f)}</div>
        <div class="food-right"><div class="food-cals">${f.cals} kcal</div><div class="food-p">${f.protein||0}g P</div></div>
        <button class="del-btn" onclick="delFoodFromDayDetail(${i},'${date}')" title="Delete this entry">×</button>
      </div>`).join('')}
    `;
  }
  html+=`<button class="btn btn-lime btn-sm" style="width:100%;margin-top:10px;font-size:12px;" onclick="openAddFoodForDate('${date}')">+ Add forgotten food to this day</button>`;
  html+=`</div>`;

  // ACTIVITY
  if(steps||cals){
    html+=`<div class="sec-label">Activity</div><div class="sg sg3" style="margin-bottom:10px;">`;
    html+=`<div class="sb blue"><div class="l">Steps</div><div class="v">${steps?(steps>=1000?(steps/1000).toFixed(1)+'k':steps):'—'}<span class="u">/10k</span></div></div>`;
    if(cals?.active)html+=`<div class="sb orange"><div class="l">Active cal</div><div class="v">${cals.active}</div></div>`;
    if(cals?.total)html+=`<div class="sb lime"><div class="l">TDEE</div><div class="v">${cals.total}<span class="u">kcal</span></div></div>`;
    html+=`</div>`;
  }

  // MEASUREMENTS
  if(meas&&(meas.waist||meas.chest||meas.larm||meas.rarm||meas.lthigh||meas.rthigh||meas.neck)){
    const items=[];
    if(meas.waist)items.push(['Waist',meas.waist]);
    if(meas.chest)items.push(['Chest',meas.chest]);
    if(meas.larm)items.push(['L.Arm',meas.larm]);
    if(meas.rarm)items.push(['R.Arm',meas.rarm]);
    if(meas.lthigh)items.push(['L.Thigh',meas.lthigh]);
    if(meas.rthigh)items.push(['R.Thigh',meas.rthigh]);
    if(meas.neck)items.push(['Neck',meas.neck]);
    html+=`<div class="sec-label">Measurements</div>
      <div class="card" style="margin-bottom:10px;">
        ${items.map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);"><div style="font-size:12px;color:var(--text2);">${l}</div><div style="font-weight:600;font-size:13px;">${v}<span style="color:var(--text2);font-weight:400;font-size:11px;">cm</span></div></div>`).join('')}
      </div>`;
  }

  // BODY COMPOSITION (Withings)
  if(bodyComp&&(bodyComp.muscleMass||bodyComp.fatMass||bodyComp.visceralFat||bodyComp.hydration)){
    html+=`<div class="sec-label">Body Composition</div>
      <div class="card" style="margin-bottom:10px;font-size:12px;">
        ${bodyComp.fatMass?`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text2);">Fat mass</span><strong>${bodyComp.fatMass} kg</strong></div>`:''}
        ${bodyComp.muscleMass?`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text2);">Muscle mass</span><strong>${bodyComp.muscleMass} kg</strong></div>`:''}
        ${bodyComp.fatFreeMass?`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text2);">Fat-free mass</span><strong>${bodyComp.fatFreeMass} kg</strong></div>`:''}
        ${bodyComp.visceralFat?`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text2);">Visceral fat</span><strong>${bodyComp.visceralFat}</strong></div>`:''}
        ${bodyComp.hydration?`<div style="display:flex;justify-content:space-between;padding:5px 0;"><span style="color:var(--text2);">Hydration</span><strong>${bodyComp.hydration} kg</strong></div>`:''}
      </div>`;
  }

  // SUPPLEMENTS
  if(supps.length>0){
    const taken=supps.map((s,i)=>({...s,done:!!suppDoneAll[`${date}_${i}`]}));
    const someTaken=taken.some(s=>s.done);
    if(someTaken||isToday){
      html+=`<div class="sec-label">Supplements & Meds</div>
        <div class="card" style="margin-bottom:10px;">
          ${taken.map(s=>`<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);">
            <div style="font-size:14px;">${s.done?'✅':'⬜'}</div>
            <div style="flex:1;font-size:13px;font-weight:${s.done?'600':'400'};color:${s.done?'var(--text)':'var(--text3)'};">${s.name}</div>
            <div style="font-size:11px;color:var(--text2);">${s.dose||''}</div>
          </div>`).join('')}
        </div>`;
    }
  }

  // SWIM
  if(swims.length>0){
    html+=`<div class="sec-label">Swim</div>
      <div class="card" style="margin-bottom:10px;">
        ${swims.map(s=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">
          <div style="font-size:13px;font-weight:600;">${s.mins} mins${s.laps?` · ${s.laps} laps`:''}</div>
          <div style="font-size:11px;color:var(--cyan);">${s.feel||''}</div>
        </div>`).join('')}
      </div>`;
  }

  // Bottom padding so last card isn't hugged by safe-area
  html+=`<div style="height:20px;"></div>`;

  document.getElementById('ddContent').innerHTML=html;
}

// ============================================================
// PHASE 31: "Where You Stand" — peer comparison to age/sex-matched norms
// ============================================================

// Reference bands by metric, age, sex. Each band = {label, max, color}.
// User falls in the FIRST band where value < max (last band catches everything else).
const WYS = {
  bf: {
    male: function(age){
      if(age == null) return null;
      if(age <= 39) return [
        {label:'Athletic',  max:11, color:'var(--green)'},
        {label:'Fitness',   max:17, color:'var(--lime)'},
        {label:'Average',   max:22, color:'var(--blue)'},
        {label:'Above avg', max:27, color:'var(--orange)'},
        {label:'Obese',     max:Infinity, color:'var(--red)'},
      ];
      if(age <= 59) return [
        {label:'Athletic',  max:13, color:'var(--green)'},
        {label:'Fitness',   max:18, color:'var(--lime)'},
        {label:'Average',   max:23, color:'var(--blue)'},
        {label:'Above avg', max:28, color:'var(--orange)'},
        {label:'Obese',     max:Infinity, color:'var(--red)'},
      ];
      return [
        {label:'Athletic',  max:14, color:'var(--green)'},
        {label:'Fitness',   max:19, color:'var(--lime)'},
        {label:'Average',   max:24, color:'var(--blue)'},
        {label:'Above avg', max:29, color:'var(--orange)'},
        {label:'Obese',     max:Infinity, color:'var(--red)'},
      ];
    },
    female: function(age){
      if(age == null) return null;
      if(age <= 39) return [
        {label:'Athletic',  max:17, color:'var(--green)'},
        {label:'Fitness',   max:23, color:'var(--lime)'},
        {label:'Average',   max:28, color:'var(--blue)'},
        {label:'Above avg', max:32, color:'var(--orange)'},
        {label:'Obese',     max:Infinity, color:'var(--red)'},
      ];
      if(age <= 59) return [
        {label:'Athletic',  max:18, color:'var(--green)'},
        {label:'Fitness',   max:24, color:'var(--lime)'},
        {label:'Average',   max:29, color:'var(--blue)'},
        {label:'Above avg', max:33, color:'var(--orange)'},
        {label:'Obese',     max:Infinity, color:'var(--red)'},
      ];
      return [
        {label:'Athletic',  max:19, color:'var(--green)'},
        {label:'Fitness',   max:25, color:'var(--lime)'},
        {label:'Average',   max:30, color:'var(--blue)'},
        {label:'Above avg', max:34, color:'var(--orange)'},
        {label:'Obese',     max:Infinity, color:'var(--red)'},
      ];
    },
  },
  bmi: [
    {label:'Underweight', max:18.5, color:'var(--orange)'},
    {label:'Normal',      max:25,   color:'var(--green)'},
    {label:'Overweight',  max:30,   color:'var(--orange)'},
    {label:'Obese I',     max:35,   color:'#ff7043'},
    {label:'Obese II',    max:40,   color:'var(--red)'},
    {label:'Obese III',   max:Infinity, color:'#d32f2f'},
  ],
  lbmi: { // Lean Body Mass Index = LBM / height_m². Men.
    male: [
      {label:'Low',         max:17, color:'var(--orange)'},
      {label:'Average',     max:19, color:'var(--blue)'},
      {label:'Above avg',   max:22, color:'var(--lime)'},
      {label:'Excellent',   max:25, color:'var(--green)'},
      {label:'Very high',   max:Infinity, color:'#4caf50'},
    ],
    female: [
      {label:'Low',         max:14, color:'var(--orange)'},
      {label:'Average',     max:16, color:'var(--blue)'},
      {label:'Above avg',   max:18, color:'var(--lime)'},
      {label:'Excellent',   max:21, color:'var(--green)'},
      {label:'Very high',   max:Infinity, color:'#4caf50'},
    ],
  },
  rhr: { // Resting heart rate by age 50-65 (Mayo Clinic adult bands, men)
    bands: [
      {label:'Athletic',    max:56, color:'var(--green)'},
      {label:'Excellent',   max:62, color:'var(--lime)'},
      {label:'Good',        max:66, color:'var(--blue)'},
      {label:'Above avg',   max:70, color:'#8bc34a'},
      {label:'Average',     max:74, color:'var(--orange)'},
      {label:'Below avg',   max:78, color:'#ff7043'},
      {label:'Poor',        max:Infinity, color:'var(--red)'},
    ],
  },
  sleep: [
    {label:'Short',        max:6,  color:'var(--red)'},
    {label:'Borderline',   max:7,  color:'var(--orange)'},
    {label:'Recommended',  max:9,  color:'var(--green)'},
    {label:'Long',         max:Infinity, color:'var(--orange)'},
  ],
  visceral: { // Withings scale 1-30 range. South Asian threshold lower.
    standard: [
      {label:'Healthy',     max:10, color:'var(--green)'},
      {label:'Elevated',    max:15, color:'var(--orange)'},
      {label:'High risk',   max:Infinity, color:'var(--red)'},
    ],
    southAsian: [
      {label:'Healthy',     max:7,  color:'var(--green)'},
      {label:'Elevated',    max:10, color:'var(--orange)'},
      {label:'High risk',   max:Infinity, color:'var(--red)'},
    ],
  },
};

function _classify(value, bands){
  if(!Array.isArray(bands)) return null;
  for(let i=0;i<bands.length;i++){ if(value < bands[i].max) return {...bands[i], index:i, total:bands.length}; }
  const last = bands[bands.length-1]; return {...last, index:bands.length-1, total:bands.length};
}

function _wysRow(label, value, unit, bands, hint){
  if(value == null || !bands) return '';
  const cat = _classify(value, bands);
  if(!cat) return '';
  const segWidth = 100 / bands.length;
  const segs = bands.map((b, i) => {
    const active = i === cat.index;
    return `<div style="flex:1;height:8px;background:${active ? b.color : 'var(--bg2)'};border-right:${i < bands.length-1 ? '1px solid var(--bg)' : 'none'};"></div>`;
  }).join('');
  return `<div style="padding:10px 0;border-bottom:1px solid var(--border);">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
      <div style="font-size:13px;color:var(--text);">${label}</div>
      <div style="text-align:right;">
        <div style="font-family:'Archivo Black',sans-serif;font-size:16px;color:${cat.color};">${value}${unit}</div>
        <div style="font-size:10px;color:${cat.color};text-transform:uppercase;letter-spacing:1px;font-weight:700;">${cat.label}</div>
      </div>
    </div>
    <div style="display:flex;border-radius:4px;overflow:hidden;margin-bottom:4px;">${segs}</div>
    <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text3);">${bands.map(b=>`<div style="flex:1;text-align:center;${b.label===cat.label?'color:var(--text2);font-weight:600;':''}">${b.label}</div>`).join('')}</div>
    ${hint?`<div style="font-size:10px;color:var(--text3);margin-top:6px;line-height:1.4;">${hint}</div>`:''}
  </div>`;
}

function renderWhereYouStand(){
  const profile = STATE.profile || {};
  const personal = profile.personal || {};
  const age = personal.age;
  const heightCm = personal.heightCm;
  const sex = personal.sex || 'male';
  const ethnicity = personal.ethnicity;

  if(!age || !heightCm || !sex){
    return `<div class="sec-label">Where You Stand</div>
      <div class="card" style="margin-bottom:14px;padding:16px;">
        <div style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:10px;">Fill in your <strong>Personal Profile</strong> (age, height, sex) on the More page to see how you compare against peers of your demographic.</div>
        <button class="btn btn-ghost btn-sm" style="width:100%;" onclick="nav('more')">Go to More</button>
      </div>`;
  }

  const wl = STATE.weightLog || [];
  const bl = STATE.bfLog || [];
  const bc = STATE.bodyComp || {};
  const cw = wl.length ? wl[wl.length-1].weight : null;
  const cbf = bl.length ? bl[bl.length-1].bf : null;
  const clbm = (cw && cbf) ? Math.round(cw * (1 - cbf/100) * 10) / 10 : null;
  const heightM = heightCm / 100;
  const bmi = cw ? Math.round((cw / (heightM*heightM)) * 10) / 10 : null;
  const lbmi = clbm ? Math.round((clbm / (heightM*heightM)) * 10) / 10 : null;

  // Visceral fat — latest reading
  let visceral = null;
  const bcDates = Object.keys(bc).sort();
  for(let i=bcDates.length-1;i>=0;i--){ if(bc[bcDates[i]]?.visceralFat != null){ visceral = bc[bcDates[i]].visceralFat; break; } }

  // RHR — 7-day average from Oura recovery
  const recovery = STATE.recovery || {};
  const rhrValues = [];
  for(let i=0;i<7;i++){
    const d = new Date(); d.setDate(d.getDate()-i);
    const key = d.toISOString().slice(0,10);
    const r = recovery[key];
    if(r && typeof r.restingHR === 'number') rhrValues.push(r.restingHR);
  }
  const avgRHR = rhrValues.length ? Math.round(rhrValues.reduce((s,x)=>s+x,0)/rhrValues.length) : null;

  // Sleep — 7-day average
  const sleepLog = STATE.sleepLog || {};
  const sleepValues = [];
  for(let i=0;i<7;i++){
    const d = new Date(); d.setDate(d.getDate()-i);
    const key = d.toISOString().slice(0,10);
    const s = sleepLog[key];
    if(s && typeof s.hours === 'number') sleepValues.push(s.hours);
  }
  const avgSleep = sleepValues.length ? Math.round((sleepValues.reduce((s,x)=>s+x,0)/sleepValues.length) * 10) / 10 : null;

  const bfBands = WYS.bf[sex] ? WYS.bf[sex](age) : null;
  const lbmiBands = WYS.lbmi[sex];
  const visceralBands = ethnicity === 'south-asian' ? WYS.visceral.southAsian : WYS.visceral.standard;

  return `<div class="sec-label">Where You Stand</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:8px;">Compared to ${age}-year-old ${sex==='female'?'women':'men'}${ethnicity==='south-asian'?' (South Asian thresholds for visceral)':''}, height ${heightCm}cm.</div>
    <div class="card" style="margin-bottom:14px;padding:12px 14px;">
      ${_wysRow('Body Fat',  cbf,      '%',  bfBands, 'Lower body-fat ranges by age. BF measurements from scales are noisy — track the trend, not the daily.')}
      ${_wysRow('BMI',       bmi,      '',   WYS.bmi, 'BMI is unreliable for muscular people. Use LBMI below for a better muscle signal.')}
      ${_wysRow('Lean Mass Index', lbmi, '', lbmiBands, 'LBM / height² — a height-normalized muscularity score. >22 is excellent for a man.')}
      ${_wysRow('Visceral Fat',  visceral, '',   visceralBands, ethnicity==='south-asian' ? 'South Asian threshold for elevated risk is ≥ 7 (vs ≥ 10 for European baseline).' : null)}
      ${_wysRow('Resting HR (7d avg)', avgRHR, ' bpm', WYS.rhr.bands, 'Lower RHR generally indicates better cardiovascular fitness.')}
      ${_wysRow('Sleep (7d avg)', avgSleep, ' h', WYS.sleep, 'NIH recommends 7-9 hours for adults.')}
    </div>`;
}

// ============================================================
// BODY PAGE (Measurements + Sleep)
// ============================================================
function renderBody(){
  const measLog=getMeasLog();
  const latest=getLatestMeas();
  const prev=measLog.length>=2?measLog[measLog.length-2]:null;
  const sleepLog=getSleepLog();
  const last7=getLast7();
  const swimLog=getSwimLog();
  const allSwims=Object.entries(swimLog).flatMap(([date,entries])=>entries.map(e=>({...e,date}))).sort((a,b)=>b.date.localeCompare(a.date));

  document.getElementById('page-body').innerHTML=`
    <div class="pg-title" style="margin-bottom:14px;">Body & Health</div>

    ${renderWhereYouStand()}

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
      <div class="sb purple"><div class="l">Last Night</div><div class="v">${fmtHrs(sleepLog[todayStr()]?.hours||sleepLog[Object.keys(sleepLog).sort().pop()]?.hours)}</div></div>
      <div class="sb blue"><div class="l">7-Day Avg</div><div class="v">${fmtHrs(getAvgSleep(7))}</div></div>
      <div class="sb${getAvgSleep(7)>=7?' green':' orange'}"><div class="l">Status</div><div class="v" style="font-size:14px;">${getAvgSleep(7)>=7?'Good':'Low'}</div></div>
    </div>
    <div class="card" style="margin-bottom:10px;">
      ${last7.map(d=>{
        const s=sleepLog[d];
        if(!s)return`<div class="step-row"><div class="step-date">${d===todayStr()?'Today':new Date(d+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric'})}</div><div class="step-bar-wrap"><div class="step-bar"></div></div><div class="step-count">—</div></div>`;
        const pct=Math.min(100,(s.hours/9)*100);
        const qualEmoji=['','😴','😐','😊','🌟'][s.quality||0]||'';
        const sleepSrc=s.source==='manual'?'<span style="font-size:8px;color:var(--text3);margin-left:2px;">M</span>'
          :s.source==='oura'?'<span style="font-size:8px;color:var(--text3);margin-left:2px;">O</span>':'';
        return`<div class="step-row">
          <div class="step-date">${d===todayStr()?'Today':new Date(d+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric'})}</div>
          <div class="step-bar-wrap"><div class="step-bar"><div class="step-fill" style="width:${pct}%;background:linear-gradient(90deg,var(--purple),var(--blue));"></div></div></div>
          <div class="step-count${s.hours>=7?' hit':''}" style="${s.hours>=7?'':'color:var(--orange);'}">${fmtHrsPlain(s.hours)}${qualEmoji}${sleepSrc}</div>
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

  `;
}

function renderSupplementsCoach(){
  const supps=getSupplements();
  if(!supps.length)return '';
  const log=pGet('supplementLog',{});
  // 7-day heatmap
  const last7=[];
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);last7.push(_ukDate(d));}
  const dayLabels=last7.map(d=>{const dt=new Date(d+'T12:00:00');return dt.toLocaleDateString('en-GB',{weekday:'narrow'});});
  const heatmap=supps.map(s=>{
    const cells=last7.map(d=>{
      const dayLog=log[d]||{};
      return dayLog[s.id]===true?'taken':'missed';
    });
    return {name:s.name,cells};
  });
  // 30-day adherence
  const adh30=getSupplementAdherence(30);
  return `
    <div class="sec-label">Supplements · 7 Day</div>
    <div class="card" style="margin-bottom:10px;overflow-x:auto;">
      <div style="display:grid;grid-template-columns:100px repeat(7,24px);gap:2px;align-items:center;min-width:280px;">
        <div></div>${dayLabels.map(d=>`<div style="text-align:center;font-size:9px;color:var(--text3);font-weight:700;">${d}</div>`).join('')}
        ${heatmap.map(row=>`
          <div style="font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${row.name}</div>
          ${row.cells.map(c=>`<div style="width:24px;height:24px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;background:${c==='taken'?'var(--lime)':'var(--s2)'};color:${c==='taken'?'var(--bg)':'var(--text3)'};">${c==='taken'?'&#10003;':'·'}</div>`).join('')}
        `).join('')}
      </div>
    </div>
    <div class="sec-label">Supplements · 30 Day</div>
    <div class="card" style="margin-bottom:10px;">
      ${supps.map(s=>{
        const sid=adh30.byId[s.id];
        const pct=sid?sid.pct:0;
        return `<div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
            <span style="color:var(--text2);">${s.name}</span>
            <span style="color:${pct>=80?'var(--lime)':pct>=50?'var(--orange)':'var(--red)'};font-weight:700;">${pct}%</span>
          </div>
          <div class="macro-bar"><div class="macro-fill" style="width:${pct}%;background:${pct>=80?'var(--lime)':pct>=50?'var(--orange)':'var(--red)'};"></div></div>
        </div>`;
      }).join('')}
      <div style="font-size:11px;color:var(--text3);margin-top:4px;">Overall: ${adh30.pct}% · ${adh30.taken} taken · ${adh30.missed} missed</div>
    </div>`;
}

// ============================================================
// COACH PAGE (AI Analysis + Report Card + Supplements)
// ============================================================
function renderCoach(){
  const p=getActive(); if(!p)return;
  const report=getWeeklyReport();

  document.getElementById('page-coach').innerHTML=`
    <div class="pg-title" style="margin-bottom:14px;">Coach</div>

    <div class="sec-label">Weekly Report Card</div>
    ${report?(report.isBaseline?`
    <div class="card" style="margin-bottom:10px;border-color:var(--blue);background:linear-gradient(135deg,rgba(61,155,255,.04),transparent);">
      <div style="font-family:'Archivo Black',sans-serif;font-size:15px;letter-spacing:-.3px;margin-bottom:6px;">Week 1 — Baseline</div>
      <div style="font-size:12px;color:var(--text2);line-height:1.6;">
        You're in your first week. Grades and weekly scores activate from Week 2 onwards once we have meaningful data to compare against.
      </div>
      <div style="margin-top:14px;font-size:11px;color:var(--text3);">
        Tracking so far · Steps ${report.stepsHit}/7 · Protein ${report.proteinDays}/7 · Gym ${report.gymDays} · Sleep ${report.avgSleep||'—'}h avg
      </div>
    </div>
    `:`
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
    </div>
    `):'<div class="card" style="text-align:center;color:var(--text3);font-size:13px;padding:20px;">Log data throughout the week to generate your report card</div>'}

    ${renderSupplementsCoach()}

    <div class="sec-label">AI Coach</div>
    ${(STATE.coachingReports||[]).length===0?`
    <div class="card" style="margin-bottom:10px;text-align:center;color:var(--text3);font-size:13px;padding:20px;">
      No reports yet. Set your Anthropic API key on More page to receive a weekly review every Sunday 9am.
    </div>`:`
    <div class="card" style="margin-bottom:10px;">
      ${STATE.coachingReports.slice(0,1).map((r)=>{
        const dt=new Date(r.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
        return `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
            <div>
              <div style="font-family:'Archivo Black',sans-serif;font-size:15px;letter-spacing:-.3px;">${escapeHtml(r.title)}</div>
              <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-top:2px;">${escapeHtml(r.type||'')} · ${dt}</div>
            </div>
          </div>
          <div class="ai-report" style="font-size:13px;line-height:1.7;color:var(--text2);">${formatCoachingReport(r.content)}</div>
          ${renderSuggestions(r)}
        `;
      }).join('')}
    </div>
    ${STATE.coachingReports.length>1?`<button class="btn btn-ghost btn-sm" style="width:100%;margin-bottom:10px;" onclick="showCoachingHistory()">View ${STATE.coachingReports.length-1} older report${STATE.coachingReports.length>2?'s':''}</button>`:''}
    `}

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

function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function formatCoachingReport(text){
  return escapeHtml(text)
    .replace(/^### (.+)$/gm,'<h3 style="font-family:\'Archivo Black\',sans-serif;font-size:14px;color:var(--lime);margin:14px 0 6px;">$1</h3>')
    .replace(/^## (.+)$/gm,'<h3 style="font-family:\'Archivo Black\',sans-serif;font-size:15px;color:var(--lime);margin:14px 0 6px;">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g,'<strong style="color:var(--text);">$1</strong>')
    .replace(/\n\n/g,'<br><br>')
    .replace(/\n/g,'<br>');
}

function renderSuggestions(report){
  const sugs=(report.suggestions||[]).filter(s=>!s.dismissed);
  if(!sugs.length)return '';
  return `
    <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);">
      <div class="sec-label" style="margin-bottom:8px;">Suggestions</div>
      ${sugs.map(s=>{
        const typeLabel={macros:'MACROS',reminders:'REMINDER',note:'NOTE'}[s.type]||s.type.toUpperCase();
        const typeColor=s.type==='note'?'var(--text3)':'var(--lime)';
        return `
          <div style="padding:12px;background:var(--bg2);border-radius:10px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <div style="font-size:10px;letter-spacing:1px;color:${typeColor};font-weight:700;">${typeLabel}</div>
              ${s.applied?'<div style="font-size:10px;color:var(--lime);">✓ APPLIED</div>':''}
            </div>
            <div style="font-size:13px;color:var(--text);font-weight:600;margin-bottom:4px;">${escapeHtml(s.label)}</div>
            <div style="font-size:11px;color:var(--text3);line-height:1.5;margin-bottom:${s.applied?'0':'10px'};">${escapeHtml(s.rationale)}</div>
            ${!s.applied?`
              <div style="display:flex;gap:8px;">
                ${s.type!=='note'?`<button class="btn btn-lime btn-sm" style="flex:1;" onclick="applyCoachSuggestion('${report.id}','${s.id}')">Apply</button>`:''}
                <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="dismissCoachSuggestion('${report.id}','${s.id}')">${s.type==='note'?'Got it':'Dismiss'}</button>
              </div>`:''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function showCoachingHistory(){
  const list=(STATE.coachingReports||[]).slice(1);
  if(!list.length){showToast('No older reports');return;}
  const html=list.map(r=>{
    const dt=new Date(r.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
    return `<div class="card" style="margin-bottom:10px;">
      <div style="font-family:'Archivo Black',sans-serif;font-size:14px;margin-bottom:4px;">${escapeHtml(r.title)}</div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${escapeHtml(r.type||'')} · ${dt}</div>
      <div class="ai-report" style="font-size:12px;line-height:1.6;color:var(--text2);">${formatCoachingReport(r.content)}</div>
      ${renderSuggestions(r)}
    </div>`;
  }).join('');
  document.getElementById('page-coach').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <div class="pg-title">Past Reports</div>
      <button class="btn btn-ghost btn-sm" onclick="renderCoach()">Back</button>
    </div>
    ${html}
  `;
}

// ============================================================
// MORE PAGE (Water + Swim shortcut + Settings)
// ============================================================
function renderMore(){
  const p=getActive(); if(!p)return;
  const water=getWater();
  const waterTarget=8;

  const params=new URLSearchParams(window.location.search);
  const wResult=params.get('withings');
  if(wResult==='connected'){
    showToast('Withings connected');
    history.replaceState({},'','/');
  } else if(wResult==='error'||wResult==='invalid_state'||wResult==='missing_params'){
    showToast('Withings connection failed');
    history.replaceState({},'','/');
  }

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

    <div class="sec-label">AI Coach (Anthropic key)</div>
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px;">
        Paste your own Anthropic API key. Forge generates a weekly review every Sunday 9am using your key (Opus 4.7). Costs ~$0.25–$0.75 per report. Key is encrypted at rest.
      </div>
      <div id="coach-status" style="font-size:12px;color:var(--text3);margin-bottom:10px;">Loading…</div>
      <div id="coach-controls"></div>
    </div>

    <div class="sec-label">Personal Profile (for the AI Coach)</div>
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px;">
        The AI Coach uses this to compute your actual TDEE and tailor advice. Especially important if you're on medications that affect appetite or weight (e.g. GLP-1).
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px;">Age</div>
          <input id="pp-age" type="number" min="10" max="120" inputmode="numeric" style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;" />
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px;">Height (cm)</div>
          <input id="pp-height" type="number" min="100" max="250" inputmode="numeric" style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;" />
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px;">Sex (for BMR)</div>
          <select id="pp-sex" style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;">
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px;">Activity (outside gym)</div>
          <select id="pp-activity" style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;">
            <option value="">—</option>
            <option value="sedentary">Sedentary (desk job)</option>
            <option value="light">Light (some walking)</option>
            <option value="moderate">Moderate (active job)</option>
            <option value="very-active">Very active (manual)</option>
          </select>
        </div>
      </div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px;">Ethnicity (optional, for visceral fat threshold context)</div>
      <select id="pp-ethnicity" style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;margin-bottom:14px;">
        <option value="">—</option>
        <option value="south-asian">South Asian</option>
        <option value="white">White</option>
        <option value="black">Black</option>
        <option value="east-asian">East Asian</option>
        <option value="mixed">Mixed</option>
        <option value="other">Other</option>
        <option value="prefer-not-to-say">Prefer not to say</option>
      </select>
      <button class="btn btn-lime btn-sm" style="width:100%;" onclick="savePersonalProfile()">Save Personal Profile</button>
    </div>

    <div class="sec-label">Medications</div>
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px;">
        Tell the AI Coach what you're on. GLP-1 meds (Mounjaro, Ozempic, Wegovy) change weight-loss interpretation significantly. Statins, metformin, insulin etc. also relevant.
      </div>
      <div id="meds-list" style="margin-bottom:10px;"></div>
      <button class="btn btn-lime btn-sm" style="width:100%;" onclick="openMedEdit(null)">+ Add Medication</button>
    </div>

    <div class="sec-label">Blood Markers</div>
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px;">
        Latest blood panel results. The AI Coach uses out-of-range markers to ground its advice (e.g. HbA1c diabetic-range = low-GI is non-negotiable).
        <span id="blm-panel-date" style="display:block;font-size:11px;color:var(--text3);margin-top:6px;"></span>
      </div>
      <div id="blm-list" style="margin-bottom:10px;"></div>
      <button class="btn btn-lime btn-sm" style="width:100%;" onclick="openBloodMarkerEdit(null)">+ Add Marker</button>
    </div>

    <div class="sec-label">Food Preferences</div>
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px;">
        Tell the AI Coach what you don't eat. Used when generating your weekly meal plan and suggesting swaps.
      </div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px;">Excluded foods</div>
      <div id="food-prefs-excluded" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;min-height:32px;"></div>
      <div style="display:flex;gap:6px;margin-bottom:14px;">
        <input id="food-prefs-add-input" type="text" placeholder="e.g. beef, mushrooms" maxlength="60" style="flex:1;padding:8px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:12px;" onkeydown="if(event.key==='Enter'){event.preventDefault();addFoodPrefExcluded();}" />
        <button class="btn btn-lime btn-sm" style="padding:8px 14px;" onclick="addFoodPrefExcluded()">Add</button>
      </div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px;">Notes for the AI</div>
      <textarea id="food-prefs-notes" maxlength="2000" rows="3" placeholder="e.g. low-GI carbs only, chicken yes, eggs yes, prefer stable items for personal chef" style="width:100%;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:12px;font-family:inherit;resize:vertical;margin-bottom:14px;"></textarea>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px;">Plan refresh</div>
      <select id="food-prefs-cadence" style="width:100%;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:12px;margin-bottom:14px;">
        <option value="weekly-sunday">Every Sunday morning</option>
        <option value="biweekly">Every other Sunday</option>
        <option value="manual">Only when I tap regenerate</option>
      </select>
      <button class="btn btn-lime btn-sm" style="width:100%;" onclick="saveFoodPrefs()">Save Preferences</button>
    </div>

    <div class="sec-label">Cowork Access Token (legacy)</div>
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px;">
        Old integration — used to let Cowork push reports. Superseded by the AI Coach above. Revoke any unused tokens.
      </div>
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-bottom:10px;" onclick="generateAccessToken()">+ Generate Access Token</button>
      <div id="token-list" style="font-size:12px;"></div>
    </div>

    <div class="sec-label">Oura Ring</div>
    <div class="card" style="margin-bottom:10px;">
      <div id="oura-status" style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px;">Loading...</div>
      <div id="oura-controls" style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-lime btn-sm" style="flex:1;min-width:140px;" onclick="connectOura()">Connect Oura</button>
      </div>
    </div>

    <div class="sec-label">Withings Scale</div>
    <div class="card" style="margin-bottom:10px;">
      <div id="withings-status" style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px;">Loading...</div>
      <div id="withings-controls" style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-lime btn-sm" style="flex:1;min-width:140px;" onclick="connectWithings()">Connect Withings</button>
      </div>
    </div>

    <div class="sec-label">Manage Supplements</div>
    <div class="card" style="margin-bottom:10px;">
      ${(()=>{
        const supps=getSupplements();
        if(!supps.length) return '<div style="text-align:center;color:var(--text3);padding:16px 0;font-size:13px;">No supplements configured yet</div>';
        return supps.map(s=>`
          <div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--border);">
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;">${s.name} <span style="font-size:11px;color:var(--text3);font-weight:400;">${s.dose}</span></div>
              <div style="font-size:10px;color:var(--text3);">${s.time?s.time+' · ':''}${s.mealId?'Linked: '+s.mealId:'No meal link'}${s.notes?' · '+s.notes:''}</div>
            </div>
            <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:4px 8px;" onclick="openEditSupplement('${s.id}')">Edit</button>
            <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:4px 8px;color:var(--red);border-color:var(--red);" onclick="confirmDeleteSupplement('${s.id}','${s.name.replace(/'/g,"\\'")}')">Del</button>
          </div>`).join('');
      })()}
      <button class="btn btn-lime btn-sm" style="width:100%;margin-top:10px;" onclick="openAddSupplement()">+ Add Supplement</button>
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
      <div style="font-size:11px;color:var(--text2);margin-bottom:4px;">Start: ${p.startWeight}kg · Target: ${p.targetWeight}kg @ ${p.targetBF||15}% BF</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:6px;">Protein: ${p.proteinTarget}g · Fat: ${p.fatTarget||'auto'}g · Carbs: ${p.carbsTarget||'auto'}g</div>
      ${p.updatedBy==='cowork'?`<div style="font-size:10px;color:var(--lime);margin-bottom:12px;">Auto-managed by Cowork · last update ${p.updatedAt?new Date(p.updatedAt).toLocaleDateString('en-GB'):'—'}</div>`:`<div style="font-size:10px;color:var(--text3);margin-bottom:12px;">Manually set</div>`}
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-bottom:8px;" onclick="editProfile()">Edit Targets (override)</button>
      <button class="btn btn-red btn-sm" style="width:100%;margin-bottom:8px;background:rgba(255,59,59,.2);" onclick="confirmReset()">Reset All Data</button>
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-bottom:8px;" onclick="logOut()">Log Out</button>
      <button class="btn btn-red btn-sm" style="width:100%;" onclick="deleteAccount()">Delete Account</button>
    </div>
  `;

  loadOuraStatus();
  loadWithingsStatus();
  loadCoachKeyStatus();
  loadFoodPrefsUI();
  loadPersonalProfileUI();
  renderMedsList();
  renderBloodMarkersList();

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
