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
  if(!values||values.length<2)return '<svg width="80" height="24"></svg>';
  const w=80,h=24,p=2;
  const min=Math.min(...values),max=Math.max(...values),range=max-min||1;
  const points=values.map((v,i)=>{
    const x=p+(i/(values.length-1))*(w-p*2);
    const y=h-p-((v-min)/range)*(h-p*2);
    return x.toFixed(1)+','+y.toFixed(1);
  }).join(' ');
  return `<svg width="${w}" height="${h}" style="display:block;"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
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
        <div style="flex:1;">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">Weight</div>
          <div style="display:flex;align-items:baseline;gap:8px;">
            <div style="font-family:'Archivo Black',sans-serif;font-size:20px;color:var(--lime);">${cw}<span style="font-size:11px;color:var(--text2);">kg</span></div>
            ${weightTrend?`<div style="font-size:11px;color:${weightTrend.dir==='down'?'var(--green)':weightTrend.dir==='up'?'var(--red)':'var(--text2)'};">${weightTrend.arrow} ${weightTrend.delta}kg/wk</div>`:''}
          </div>
        </div>
        <div>${weightSpark}</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
        <div style="flex:1;">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">Body Fat</div>
          <div style="display:flex;align-items:baseline;gap:8px;">
            <div style="font-family:'Archivo Black',sans-serif;font-size:20px;color:var(--cyan);">${bf?bf+'%':'—'}</div>
            ${bfTrend?`<div style="font-size:11px;color:${bfTrend.dir==='down'?'var(--green)':bfTrend.dir==='up'?'var(--red)':'var(--text2)'};">${bfTrend.arrow} ${bfTrend.delta}%/wk</div>`:''}
          </div>
        </div>
        <div>${bfSpark}</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;">
        <div style="flex:1;">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">Waist</div>
          <div style="display:flex;align-items:baseline;gap:8px;">
            <div style="font-family:'Archivo Black',sans-serif;font-size:20px;color:var(--orange);">${latestWaist?latestWaist.waist+'cm':'—'}</div>
          </div>
        </div>
        <div>${waistSparkSvg}</div>
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
              <div class="food-time">${f.time}</div>
              <div class="food-name">${f.name}</div>
              <div class="food-right"><div class="food-cals">${f.cals} kcal</div><div class="food-p">${f.protein||0}g protein</div></div>
              ${isToday?`<button class="del-btn" onclick="delFood(${idx})">×</button>`:`<button class="del-btn" onclick="delFoodOnDate(${idx},'${viewDate}')" title="Delete from this past day">×</button>`}
            </div>`;
          }
          const g=item.group;
          const tc=g.entries.reduce((s,f)=>s+(f.cals||0),0);
          const tp=g.entries.reduce((s,f)=>s+(f.protein||0),0);
          return`<div class="food-row" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none'" style="cursor:pointer;">
            <div class="food-time">${g.entries[0]?.time||''}</div>
            <div class="food-name" style="font-weight:600;">${g.mealName} <span style="font-size:10px;color:var(--text3);">▸ ${g.entries.length} items</span></div>
            <div class="food-right"><div class="food-cals">${tc} kcal</div><div class="food-p">${tp}g P</div></div>
          </div><div style="display:none;">${g.entries.map((f,j)=>`<div class="food-row" style="padding-left:24px;background:var(--s2);">
              <div class="food-name" style="font-size:12px;color:var(--text2);">${f.name}</div>
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
  if(!plan||!plan.meals||!plan.meals.length)return '';
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
  `;
}

let _mds=null; // meal detail state

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
  let ingChecked,suppChecked;
  if(granular.length>0){
    const ln=new Set(granular.map(f=>f.name));
    ingChecked=ingredients.map(ing=>ln.has(ing.name));
    suppChecked=supplements.map(s=>suppLog[s.id]===true);
  } else if(legacy){
    ingChecked=ingredients.map(()=>true);
    suppChecked=supplements.map(s=>suppLog[s.id]!==false);
  } else {
    ingChecked=ingredients.map(()=>true);
    suppChecked=supplements.map(()=>true);
  }
  _mds={mealId:m.id,meal:m,ingredients,supplements,ingChecked,suppChecked,isStringFormat,
    ingInit:[...ingChecked],suppInit:[...suppChecked]};
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

function toggleMealIngredient(i){_mds.ingChecked[i]=!_mds.ingChecked[i];_renderMealDetail();}
function toggleMealSupplement(i){_mds.suppChecked[i]=!_mds.suppChecked[i];_renderMealDetail();}

function _renderMealDetail(){
  const s=_mds;if(!s)return;
  const m=s.meal;
  let cals=0,protein=0,carbs=0,fat=0;
  s.ingredients.forEach((ing,i)=>{if(s.ingChecked[i]){cals+=ing.cals||0;protein+=ing.protein||0;carbs+=ing.carbs||0;fat+=ing.fat||0;}});
  const logStatus=_getMealLogStatus();
  const changed=s.ingChecked.some((c,i)=>c!==s.ingInit[i])||s.suppChecked.some((c,i)=>c!==s.suppInit[i]);
  let btnText,btnClass;
  if(logStatus==='none'){btnText='LOG SELECTED';btnClass='btn-lime';}
  else if(logStatus==='full'&&!changed){btnText='✓ LOGGED · TAP TO UNLOG';btnClass='btn-ghost';}
  else if(changed){btnText='SAVE CHANGES';btnClass='btn-lime';}
  else{btnText='◐ EDIT LOGGED MEAL';btnClass='btn-lime';}
  const chk='<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="var(--bg)" stroke-width="2" fill="none"/></svg>';
  document.getElementById('md-title').textContent=`${m.time||''} · ${m.name}`;
  document.getElementById('md-body').innerHTML=`
    <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:14px;">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px;">Macros</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center;">
        <div><div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:var(--lime);">${cals}</div><div style="font-size:9px;color:var(--text3);">KCAL</div></div>
        <div><div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:var(--orange);">${protein}g</div><div style="font-size:9px;color:var(--text3);">PROTEIN</div></div>
        <div><div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:var(--blue);">${carbs}g</div><div style="font-size:9px;color:var(--text3);">CARBS</div></div>
        <div><div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:var(--purple);">${fat}g</div><div style="font-size:9px;color:var(--text3);">FAT</div></div>
      </div>
    </div>
    <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px;">Ingredients</div>
    <div style="margin-bottom:16px;">
      ${s.ingredients.map((ing,i)=>{
        const on=s.ingChecked[i];
        return`<div onclick="toggleMealIngredient(${i})" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer;min-height:44px;">
          <div style="width:20px;height:20px;border-radius:4px;border:2px solid ${on?'var(--lime)':'var(--border)'};background:${on?'var(--lime)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${on?chk:''}</div>
          <div style="flex:1;font-size:13px;color:${on?'var(--text)':'var(--text3)'};">${ing.name}</div>
          <div style="font-size:11px;color:var(--text3);flex-shrink:0;">${ing.cals} kcal · ${ing.protein}g P</div>
        </div>`;}).join('')}
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
    ${s.isStringFormat?`<div style="font-size:11px;color:var(--text3);margin-bottom:14px;padding:8px 10px;background:var(--s2);border-radius:8px;">ⓘ Per-ingredient macros are estimated (divided equally). More accurate breakdown after Sunday's plan refresh.</div>`:''}
    <button class="btn ${btnClass} btn-full" onclick="logMealFromModal()">${btnText}</button>
  `;
}

function logMealFromModal(){
  const s=_mds;if(!s)return;
  const m=s.meal;
  const today=todayStr();
  const logStatus=_getMealLogStatus();
  const changed=s.ingChecked.some((c,i)=>c!==s.ingInit[i])||s.suppChecked.some((c,i)=>c!==s.suppInit[i]);
  // Build final foods array for today: existing entries minus this meal's, plus ticked ingredients
  const foods=getFoods();
  const filtered=foods.filter(f=>!(f.mealId===m.id||(f.name===m.name&&!f.mealId)));
  const newEntries=[];
  s.ingredients.forEach((ing,i)=>{
    if(s.ingChecked[i]){
      newEntries.push({
        name:ing.name,cals:ing.cals||0,protein:ing.protein||0,carbs:ing.carbs||0,fat:ing.fat||0,
        time:m.time||fmtNow(),mealId:m.id,mealName:m.name
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

  // If user just unticked everything, treat as full unlog
  if(newEntries.length===0&&logStatus==='full'&&!changed){
    closeModal('modal-meal-detail');
    renderFood();renderToday();
    showToast(`${m.name} unlogged`);
    return;
  }

  closeModal('modal-meal-detail');
  renderFood();renderToday();
  showToast(`${m.name} ${newEntries.length} of ${s.ingredients.length} logged`);
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

  const wPct=p.startWeight&&p.targetWeight?((p.startWeight-cw)/(p.startWeight-p.targetWeight))*100:0;
  const wRate=get14DayAvgRate('weight');
  const wLost=p.startWeight?Math.max(0,p.startWeight-cw).toFixed(1):'—';
  const wToGo=p.targetWeight?Math.max(0,cw-p.targetWeight).toFixed(1):'—';
  const wGoal=getProjectedGoalDate();
  const wGoalStr=wGoal?`Goal date: ${wGoal}`:hasEnoughW?'Stalled — no projection':'Insufficient data — need 14+ days';
  const wSpark=spark(wEntries.slice(-14).map(e=>e.weight),'var(--lime)');

  const bPct=p.startBF&&p.targetBF&&cbf?((p.startBF-cbf)/(p.startBF-p.targetBF))*100:0;
  const bRate=get14DayAvgRate('bf');
  const bCaption=hasEnoughB?(p.startBF&&cbf?`Down ${Math.abs(p.startBF-cbf).toFixed(1)}% from start`:`Tracking from ${startLabel}`):`Tracking from ${startLabel}`;
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

  document.getElementById('page-track').innerHTML=`
    <div class="pg-title" style="margin-bottom:14px;">Progress</div>

    ${_progressCard('Weight',`${_v(p.startWeight)}kg → ${_v(p.targetWeight)}kg`,cw,'kg',wPct,'var(--lime)',hasEnoughW?wRate:null,' kg',`Lost ${wLost}kg · ${wToGo}kg to go · ${wGoalStr}`,wSpark)}
    ${_progressCard('Body Fat',`${_v(p.startBF)}% → ${_v(p.targetBF)}%`,cbf,'%',bPct,'var(--orange)',hasEnoughB?bRate:null,'%',bCaption,bSpark)}
    ${_progressCard('Lean Mass',`current — target: hold ${_v(p.targetLBM)}kg`,clbm,'kg',lPct,'var(--blue)',hasEnoughL?lRate:null,' kg',lCaption,lSpark,lAlert)}
    ${cvf!=null||svf!=null?_progressCard('Visceral Fat',`current → target: ${_v(p.targetVisceralFat)} or less`,cvf,'',vPct,'var(--purple)',hasEnoughV?vRate:null,'',vCaption,vSpark):''}

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
        return `<div style="padding:8px 0;border-bottom:1px solid var(--border);">
          <div style="font-weight:600;font-size:13px;">${ex.name}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px;">${summary||'no sets logged'}</div>
        </div>`;
      }).join('');
      html+=`<div class="card" style="margin-bottom:10px;">
        <div style="font-family:'Archivo Black',sans-serif;font-size:14px;color:var(--lime);margin-bottom:4px;">${w.name}</div>
        <div style="font-size:11px;color:var(--text2);margin-bottom:8px;">${doneEx.length}/${w.exercises.length} exercises · ${totalVolume.toFixed(0)}kg total volume</div>
        ${setRows}
      </div>`;
    }
  }

  // FOOD
  html+=`<div class="sec-label">Food</div>`;
  if(foods.length===0){
    html+=`<div class="card" style="margin-bottom:10px;text-align:center;color:var(--text2);font-size:13px;padding:14px;">Nothing logged on this day</div>`;
  }else{
    html+=`<div class="card" style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border);">
        <div>${foods.length} entries</div>
        <div><strong style="color:var(--lime);">${foodTotals.cals}</strong> kcal · <strong style="color:var(--orange);">${foodTotals.protein}g</strong> P · <strong style="color:var(--blue);">${foodTotals.carbs}g</strong> C · <strong style="color:var(--purple);">${foodTotals.fat}g</strong> F</div>
      </div>
      ${foods.map(f=>`<div class="food-row">
        <div class="food-time">${f.time||''}</div>
        <div class="food-name">${f.name}</div>
        <div class="food-right"><div class="food-cals">${f.cals} kcal</div><div class="food-p">${f.protein||0}g P</div></div>
      </div>`).join('')}
    </div>`;
  }

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

    <div class="sec-label">Coaching from Cowork</div>
    ${(STATE.coachingReports||[]).length===0?`
    <div class="card" style="margin-bottom:10px;text-align:center;color:var(--text3);font-size:13px;padding:20px;">
      No reports yet. Cowork delivers a weekly review every Sunday.
    </div>`:`
    <div class="card" style="margin-bottom:10px;">
      ${STATE.coachingReports.slice(0,1).map((r)=>{
        const dt=new Date(r.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
        return `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
            <div>
              <div style="font-family:'Archivo Black',sans-serif;font-size:15px;letter-spacing:-.3px;">${r.title}</div>
              <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-top:2px;">${r.type} · ${dt}</div>
            </div>
          </div>
          <div class="ai-report" style="font-size:13px;line-height:1.7;color:var(--text2);">${formatCoachingReport(r.content)}</div>
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

function formatCoachingReport(text){
  return (text||'')
    .replace(/^### (.+)$/gm,'<h3 style="font-family:\'Archivo Black\',sans-serif;font-size:14px;color:var(--lime);margin:14px 0 6px;">$1</h3>')
    .replace(/^## (.+)$/gm,'<h3 style="font-family:\'Archivo Black\',sans-serif;font-size:15px;color:var(--lime);margin:14px 0 6px;">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g,'<strong style="color:var(--text);">$1</strong>')
    .replace(/\n\n/g,'<br><br>')
    .replace(/\n/g,'<br>');
}

function showCoachingHistory(){
  const list=(STATE.coachingReports||[]).slice(1);
  if(!list.length){showToast('No older reports');return;}
  const html=list.map(r=>{
    const dt=new Date(r.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
    return `<div class="card" style="margin-bottom:10px;">
      <div style="font-family:'Archivo Black',sans-serif;font-size:14px;margin-bottom:4px;">${r.title}</div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${r.type} · ${dt}</div>
      <div class="ai-report" style="font-size:12px;line-height:1.6;color:var(--text2);">${formatCoachingReport(r.content)}</div>
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
