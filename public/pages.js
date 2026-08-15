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

// Phase 54: active-phase banner — reads profile.activePhase (the single source of
// truth). Shown on Today/Train/Body so it's always clear the current programming is
// a Cut (not recomp/bulk). showToday=true also flags today's logged calories/protein
// against the phase floors.
function renderPhaseBanner(showToday){
  const ap=(STATE.profile||{}).activePhase;
  if(!ap||!ap.phase)return '';
  const ph=String(ap.phase).toLowerCase();
  const color=ph==='cut'?'var(--blue)':ph.includes('bulk')?'var(--orange)':ph.includes('recomp')?'var(--lime)':'var(--text2)';
  const icon=ph==='cut'?'🔻':ph.includes('bulk')?'🔺':'⚖️';
  let daysIn=null;
  if(ap.startDate){daysIn=Math.floor((new Date(todayStr()+'T12:00:00')-new Date(ap.startDate+'T12:00:00'))/86400000)+1;if(daysIn<1)daysIn=1;}
  const bf=(ap.targetBFLow!=null&&ap.targetBFHigh!=null)?` · ${ap.targetBFLow}–${ap.targetBFHigh}% BF`:'';
  const sub=`${ap.calorieTarget} kcal · ${ap.proteinFloor}g+ protein · ${ap.startWeight||'?'}→${ap.goalWeight}kg${bf}`;
  let flags='';
  if(showToday&&typeof getTodayTotals==='function'){
    const t=getTodayTotals();
    const kcal=Math.round(t.cals||0),prot=Math.round(t.protein||0);
    const warns=[];
    if(kcal>0&&ap.calorieFloor&&kcal<ap.calorieFloor)warns.push(`⚠️ ${kcal} kcal today — under your ${ap.calorieFloor} floor (protect lean mass)`);
    if(prot>0&&ap.proteinFloor&&prot<ap.proteinFloor)warns.push(`⚠️ protein ${prot}g today — under your ${ap.proteinFloor}g floor`);
    if(warns.length)flags=`<div style="font-size:10px;color:var(--orange);margin-top:5px;line-height:1.5;">${warns.join('<br>')}</div>`;
  }
  return `<div style="background:var(--s2);border:1px solid ${color};border-radius:10px;padding:9px 12px;margin-bottom:12px;display:flex;align-items:flex-start;gap:10px;">
    <div style="font-size:18px;line-height:1.1;">${icon}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:12px;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:.5px;">${ap.phase}${daysIn?` · day ${daysIn}`:''}</div>
      <div style="font-size:10px;color:var(--text2);line-height:1.45;">${sub}</div>
      ${flags}
    </div>
  </div>`;
}

// Phase 54: More-page "Programming Phase" card + Edit button → openPhaseEdit().
function renderPhaseSection(){
  const ap=(STATE.profile||{}).activePhase;
  const has=!!(ap&&ap.phase);
  const cur=has?ap.phase:'Not set';
  const sub=has
    ?`${ap.calorieTarget} kcal · ${ap.proteinFloor}g+ protein · floor ${ap.calorieFloor} · ${ap.startWeight||'?'}→${ap.goalWeight}kg · ${ap.targetBFLow}–${ap.targetBFHigh}% BF · since ${ap.startDate}`
    :'Set your current programming phase (cut / recomp / maintenance / lean-bulk).';
  return `<div class="sec-label" style="display:flex;justify-content:space-between;align-items:center;">
      <span>Programming Phase</span>
      <button class="btn btn-ghost btn-sm" onclick="openPhaseEdit()">${has?'Edit':'Set phase'}</button>
    </div>
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:15px;font-weight:800;font-family:'Archivo Black',sans-serif;">${cur}</div>
      <div style="font-size:10px;color:var(--text2);margin-top:4px;line-height:1.5;">${sub}</div>
    </div>`;
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
  const _dynT=(typeof getDynamicTargetForDate==='function')?getDynamicTargetForDate(todayStr()):null;
  const calTarget=_dynT?_dynT.calories:(session?p.calsGym:p.calsRest);
  const proteinTarget=_dynT?_dynT.protein:p.proteinTarget;
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
    ${renderPhaseBanner(true)}
    <div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:3px;">${dayName()} ${new Date().getDate()} ${new Date().toLocaleDateString('en-GB',{month:'short'})}</div>
          <div style="display:flex;align-items:flex-end;gap:8px;">
            <div class="pg-title">Day ${dayOfCut}</div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">of your cut</div>
          </div>
        </div>
        ${renderNotificationBell()}
      </div>
    </div>

    <div class="card hi" style="margin-bottom:10px;">
      <div style="font-size:9px;font-weight:700;color:var(--lime);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">TODAY</div>
      ${session?`
        <div style="font-family:'Archivo Black',sans-serif;font-size:18px;letter-spacing:-.5px;margin-bottom:4px;">${WORKOUTS[session].name}${(()=>{const t=(typeof getSessionTimeForDate==='function')?getSessionTimeForDate(todayStr()):null;return t?' — '+t:'';})()}</div>
      `:`
        <div style="font-family:'Archivo Black',sans-serif;font-size:18px;letter-spacing:-.5px;margin-bottom:4px;">Rest Day</div>
      `}
      <div style="font-size:12px;color:var(--text2);margin-bottom:4px;">${nextMealStr}</div>
      ${readiness?`<div style="font-size:12px;color:${recColor};font-weight:600;">${recRec} · Readiness ${readiness}</div>`:''}
      ${(()=>{const fs=(typeof getFastingStreak==='function')?getFastingStreak():0;return fs>0?`<div style="font-size:12px;color:var(--cyan);font-weight:600;margin-top:2px;">🔥 ${fs} day fasting streak</div>`:'';})()}
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
            ${(() => {
              const phase = (STATE.profile?.personal?.phase) || 'cut';
              const t = smoothedBodyCompTrend('lbm', phase);
              const color = _statusColor(t.status);
              if (t.status === 'insufficient') {
                return `<div style="font-size:11px;color:${color};">• not enough data yet</div>`;
              }
              const arrow = t.delta > 0.05 ? '▲' : t.delta < -0.05 ? '▼' : '•';
              const tag = t.provisional ? ' <span style="opacity:.6;">(provisional)</span>' : '';
              return `<div style="font-size:11px;color:${color};">${arrow} ${Math.abs(t.delta).toFixed(2)}kg vs 2 weeks ago${tag}</div>`;
            })()}
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

    <div class="sec-label" style="display:flex;justify-content:space-between;align-items:center;">
      <span>Today's Targets</span>
      ${_dynT?`<span style="font-size:10px;color:var(--text3);font-weight:400;text-transform:none;letter-spacing:0;">↻ ${(STATE.profile.dynamicTargets&&STATE.profile.dynamicTargets.calculatedFrom)||cw}kg · ${session?({upper:'Upper',lower:'Lower',full:'Full body',home:'Home'}[session]||'Training')+' day':'Rest day'}</span>`:''}
    </div>
    <div class="sg sg2" style="margin-bottom:6px;">
      <div class="sb${totals.cals>=calTarget?' green':' lime'}">
        <div class="l">Calories</div>
        <div class="v">${totals.cals}<span class="u">/${calTarget}</span></div>
      </div>
      <div class="sb${totals.protein>=proteinTarget?' green':' orange'}">
        <div class="l">Protein</div>
        <div class="v">${totals.protein}<span class="u">/${proteinTarget}g</span></div>
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

    ${renderMounjaroToday()}

    ${renderSupplementsToday()}

    ${renderWaterToday()}

    ${renderSkinSection()}

    ${renderTapeToday()}

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

// Phase 47: tape-measurement card on Today (owner) — like supplements/skin care,
// so the weekly tape habit doesn't get forgotten. Feeds the adaptive report.
function renderTapeToday(){
  if(typeof isOwner!=='function'||!isOwner())return '';
  const log=(typeof getMeasLog==='function')?getMeasLog():[];
  const last=log.length?log[log.length-1]:null;
  const daysSince=last?Math.floor((Date.now()-new Date(last.date+'T12:00:00').getTime())/86400000):null;
  const due=daysSince==null||daysSince>=7;
  const waist=(last&&last.waist)?last.waist+'cm waist':'';
  const color=due?'#ffc107':'var(--green)';
  const status=last
    ?(due?`Last logged ${daysSince}d ago${waist?' · '+waist:''} — due again`:`Logged ${daysSince===0?'today':daysSince+'d ago'} ✓${waist?' · '+waist:''}`)
    :'Never logged — your most hydration-proof trend signal';
  return `<div class="sec-label">Tape · Measurements</div>
  <div class="card" style="margin-bottom:10px;border-left:3px solid ${color};border-radius:0 12px 12px 0;">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
      <div>
        <div style="font-size:13px;font-weight:600;">📏 Body measurements</div>
        <div style="font-size:11px;color:var(--text2);margin-top:2px;line-height:1.4;">${status}</div>
      </div>
      <button class="btn ${due?'btn-lime':'btn-ghost'} btn-sm" style="white-space:nowrap;" onclick="openModal('modal-meas')">${due?'Log now':'Update'}</button>
    </div>
  </div>`;
}

function renderSupplementsToday(){
  const supps=getSupplements();
  if(!supps.length)return '';
  const today=todayStr();
  const log=getSupplementLog(today);
  const dow=new Date().getDay();
  // hide the weekly GLP-1 supplement except on the configured injection day
  const due=supps.filter(s=>!(s.frequency==='weekly-wednesday'&&dow!==_injectionDow()));
  const taken=due.filter(s=>log[s.id]===true).length;
  const adh=getSupplementAdherence(7);
  const chk='<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="var(--bg)" stroke-width="2" fill="none"/></svg>';
  // group by timing
  const groups=(typeof SUPP_TIMING_GROUPS!=='undefined'?SUPP_TIMING_GROUPS:[]).map(g=>({
    label:g.label,items:due.filter(s=>getSupplementTiming(s)===g.key)
  })).filter(g=>g.items.length);
  const groupedIds=new Set(groups.flatMap(g=>g.items.map(s=>s.id)));
  const ungrouped=due.filter(s=>!groupedIds.has(s.id));
  if(ungrouped.length)groups.push({label:'Other',items:ungrouped});
  const missedCrit=(typeof getMissedCriticalSupplements==='function')?getMissedCriticalSupplements(today):[];
  const row=s=>{
    const on=log[s.id]===true;
    const crit=s.critical&&!on;
    return `<div onclick="toggleSuppToday('${s.id}')" style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer;min-height:42px;">
      <div style="width:20px;height:20px;border-radius:4px;border:2px solid ${on?'var(--lime)':crit?'var(--orange)':'var(--border)'};background:${on?'var(--lime)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${on?chk:''}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:${on?'var(--text)':'var(--text2)'};">${s.name}${crit?' <span style="color:var(--orange);font-size:11px;">⚠️</span>':''}</div>
        <div style="font-size:11px;color:var(--text3);">${s.dose}${s.withFood?' · with food':''}</div>
      </div>
      ${s.time?`<div style="font-size:11px;font-family:monospace;color:var(--text3);flex-shrink:0;">${s.time}</div>`:''}
    </div>`;
  };
  return `
    <div class="sec-label" style="display:flex;justify-content:space-between;align-items:center;">
      <span>Supplements Today</span>
      <span style="font-size:11px;color:var(--text2);font-weight:400;text-transform:none;letter-spacing:0;">${taken}/${due.length} taken</span>
    </div>
    <div class="card" style="margin-bottom:10px;border-color:var(--orange);background:linear-gradient(135deg,rgba(255,85,0,.03),transparent);">
      ${groups.map(g=>`<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:6px 0 0;">${g.label}</div>${g.items.map(row).join('')}`).join('')}
      ${missedCrit.length?`<div style="font-size:11px;color:var(--orange);margin-top:8px;line-height:1.5;">⚠️ ${missedCrit.length} critical ${missedCrit.length>1?'supplements':'supplement'} still due: ${missedCrit.map(s=>s.name).join(', ')}</div>`:''}
      <div onclick="nav('coach')" style="padding:8px 0 2px;cursor:pointer;font-size:11px;color:var(--text3);">Adherence this week: ${adh.pct}% · <span style="color:var(--orange);">view details</span></div>
    </div>`;
}

// Phase 39: water tracker card (Today page)
function renderWaterToday(){
  const total=getWaterTotal();
  const target=getWaterTarget();
  const pct=Math.min(100,Math.round((total/target)*100));
  const isGym=!!getSessionTypeForDate(todayStr());
  const color=pct>=75?'var(--green)':pct>=40?'var(--orange)':'var(--red)';
  const remaining=Math.max(0,target-total);
  const circ=2*Math.PI*42;
  const dash=circ*(pct/100);
  const now=new Date().getHours();
  const eodWarn=now>=17&&pct<50;
  return `
    <div class="sec-label">Water</div>
    <div class="card" style="margin-bottom:10px;">
      ${isGym?`<div style="font-size:11px;color:var(--cyan);margin-bottom:8px;">Training day — target raised to 3.5L</div>`:''}
      <div style="display:flex;align-items:center;gap:16px;">
        <svg width="100" height="100" viewBox="0 0 100 100" style="flex-shrink:0;">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" stroke-width="8"/>
          <circle cx="50" cy="50" r="42" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"
            stroke-dasharray="${dash} ${circ}" transform="rotate(-90 50 50)"/>
          <text x="50" y="48" text-anchor="middle" font-size="20" font-weight="700" fill="var(--text)" font-family="'Archivo Black',sans-serif">${pct}%</text>
          <text x="50" y="64" text-anchor="middle" font-size="9" fill="var(--text3)">${(total/1000).toFixed(2)}L</text>
        </svg>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;">${total}ml <span style="color:var(--text3);font-weight:400;">of ${target}ml</span></div>
          <div style="font-size:11px;color:var(--text3);margin-bottom:8px;">${remaining}ml to go</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:6px 8px;" onclick="addWater(250,'glass')">+250</button>
            <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:6px 8px;" onclick="addWater(500,'bottle')">+500</button>
            <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:6px 8px;" onclick="addWater(750,'large')">+750</button>
            <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:6px 8px;" onclick="addWaterCustom()">+</button>
            <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:6px 8px;color:var(--text3);" onclick="undoWater()">↩</button>
          </div>
        </div>
      </div>
      ${eodWarn?`<div style="font-size:11px;color:var(--orange);margin-top:10px;line-height:1.5;">Only ${total}ml today — drink ${remaining}ml more before your eating window closes at ${String((typeof getEatingWindow==='function'?getEatingWindow():{end:20}).end).padStart(2,'0')}:00.</div>`:''}
    </div>`;
}

// Phase 39: Mounjaro injection tick (Today page, Wednesdays only)
function renderMounjaroToday(){
  if(!isMounjaroDay())return '';
  const today=todayStr();
  const mlog=getMounjaroLog(today)||{};
  const injected=!!mlog.injected;
  const effects=['Nausea','Acid reflux','Fatigue','Headache','Vomiting'];
  const sel=new Set(mlog.sideEffects||[]);
  const chk='<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="var(--bg)" stroke-width="2" fill="none"/></svg>';
  return `
    <div class="sec-label">Mounjaro</div>
    <div class="card" style="margin-bottom:10px;border-color:#ffc107;background:linear-gradient(135deg,rgba(255,193,7,.05),transparent);">
      <div onclick="toggleMounjaroInjected()" style="display:flex;align-items:center;gap:10px;cursor:pointer;min-height:44px;">
        <div style="width:22px;height:22px;border-radius:5px;border:2px solid ${injected?'var(--lime)':'#ffc107'};background:${injected?'var(--lime)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${injected?chk:''}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;">💉 Mounjaro injected today</div>
          <div style="font-size:11px;color:var(--text3);">${injected&&mlog.injectionTime?'Logged at '+mlog.injectionTime:'5mg after meal 2 (~3pm)'}</div>
        </div>
      </div>
      ${injected?`
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:12px 0 6px;">Side effects (tap all that apply)</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${effects.map(e=>`<button onclick="toggleMounjaroSideEffect('${e}')" style="font-size:11px;padding:6px 12px;border-radius:14px;cursor:pointer;border:1px solid ${sel.has(e)?'var(--orange)':'var(--border)'};background:${sel.has(e)?'rgba(255,85,0,.15)':'transparent'};color:${sel.has(e)?'var(--orange)':'var(--text2)'};">${e}</button>`).join('')}
      </div>`:''}
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

// ===================== Phase 85: maintenance calories (TDEE) =====================
// A Food-page readout of the user's real maintenance. The measured number comes
// from the server engine (GET /api/coach/maintenance = analyzeNutrition: avg logged
// intake − weight-trend energy over a rolling 14 days). The Mifflin formula estimate
// is computed here client-side as a cross-check + a cold-start fallback shown
// instantly before enough days are logged (or when offline).
let _maintData; // undefined = not fetched · 'loading' · null = fetch failed · object = result
function _formulaTDEE(){
  try{
    const p=getActive(); const pe=p&&p.personal; if(!pe)return null;
    const weight=(typeof getCurrentWeight==='function')?getCurrentWeight():(p.startWeight||0);
    if(!weight||!pe.age||!pe.heightCm||!pe.sex)return null;
    const phase=pe.phase||p.phase||(p.activePhase&&p.activePhase.phase)||'maintenance';
    const t=(typeof computeTargets==='function')?computeTargets({weight,age:pe.age,heightCm:pe.heightCm,sex:pe.sex,activityLevel:pe.activityLevel,phase}):null;
    return t?t.tdee:null;
  }catch(e){ return null; }
}
function loadMaintenance(){
  if(_maintData!==undefined)return; // fetched once per session (or failed); reload to refresh
  _maintData='loading';
  const jwt=localStorage.getItem('forge_token'); if(!jwt){_maintData=null;return;}
  fetch('/api/coach/maintenance',{headers:{Authorization:'Bearer '+jwt}})
    .then(r=>r.ok?r.json():null)
    .then(d=>{ _maintData=d||null; _refreshMaintCard(); })
    .catch(()=>{ _maintData=null; _refreshMaintCard(); });
}
function _refreshMaintCard(){
  const el=document.getElementById('maint-card');
  if(el)el.outerHTML=renderMaintenanceCard();
  const rv=document.getElementById('eating-review-card'); // Phase 87 Layer 1
  if(rv)rv.outerHTML=renderEatingReviewCard();
}
// Phase 87 (Layer 1, all users): deterministic Eating Review — this week vs last
// week of what you actually logged (calories/protein/carbs/fat + weight), plus the
// muscle-governed carb recommendation (read-only; it's formally applied from the
// weekly coach report). Reads _maintData (fetched by loadMaintenance).
function renderEatingReviewCard(){
  const m=(_maintData&&typeof _maintData==='object')?_maintData:null;
  const cmp=m&&m.comparison?m.comparison:null;
  const cur=cmp?cmp.current:null, prev=cmp?cmp.previous:null;
  const loading=(_maintData===undefined||_maintData==='loading');
  if(!cur||cur.days===0){
    const msg=loading?'Comparing this week to last…':'Log your food to compare this week vs last.';
    return `<div id="eating-review-card" class="card" style="margin-bottom:10px;">
        <div style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px;">Eating review</div>
        <div style="font-size:12px;color:var(--text3);">${msg}</div>
      </div>`;
  }
  const delta=(now,pv,unit)=>{
    if(now==null||pv==null)return '<span style="color:var(--text3);">—</span>';
    const d=Math.round((now-pv)*10)/10;
    if(Math.abs(d)<(unit==='kg'?0.1:1))return '<span style="color:var(--text3);">→ 0</span>';
    return `<span style="color:var(--text2);">${d>0?'▲':'▼'} ${Math.abs(d)}${unit}</span>`;
  };
  const row=(label,now,pv,unit)=>`<div style="display:flex;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px;">
      <div style="flex:1;color:var(--text2);">${label}</div>
      <div style="width:62px;text-align:right;font-weight:700;color:var(--text);">${now!=null?now+unit:'—'}</div>
      <div style="width:62px;text-align:right;color:var(--text3);">${pv!=null?pv+unit:'—'}</div>
      <div style="width:66px;text-align:right;">${delta(now,pv,unit)}</div>
    </div>`;
  const rec=m&&m.recommendation?m.recommendation:null;
  const recBlock=(rec&&rec.direction&&rec.direction!=='hold'&&Array.isArray(rec.reasons))
    ? `<div style="background:rgba(200,255,0,.06);border:1px solid rgba(200,255,0,.25);border-radius:10px;padding:11px 13px;margin-top:12px;">
        <div style="font-size:10px;color:var(--lime);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:5px;">Recommendation</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.5;">${rec.reasons.join(' ')}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:7px;">Apply this from your weekly Coach report.</div>
      </div>`
    : (rec&&rec.direction==='hold'&&Array.isArray(rec.reasons)
      ? `<div style="font-size:12px;color:var(--text2);line-height:1.5;margin-top:12px;">${rec.reasons.join(' ')}</div>`
      : '');
  return `<div id="eating-review-card" class="card" style="margin-bottom:10px;">
      <div style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px;">Eating review · this week vs last</div>
      <div style="display:flex;align-items:center;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;padding-bottom:4px;">
        <div style="flex:1;">Per day</div><div style="width:62px;text-align:right;">Now</div><div style="width:62px;text-align:right;">Prev</div><div style="width:66px;text-align:right;">Δ</div>
      </div>
      ${row('Calories',cur.avgCals,prev?prev.avgCals:null,'')}
      ${row('Protein',cur.avgProtein,prev?prev.avgProtein:null,'g')}
      ${row('Carbs',cur.avgCarbs,prev?prev.avgCarbs:null,'g')}
      ${row('Fat',cur.avgFat,prev?prev.avgFat:null,'g')}
      ${row('Weight',cur.avgWeight,prev?prev.avgWeight:null,'kg')}
      <div style="font-size:10px;color:var(--text3);margin-top:8px;">${cur.days} day${cur.days===1?'':'s'} logged this week · ${prev?prev.days:0} last week</div>
      ${recBlock}
    </div>`;
}
function renderMaintenanceCard(){
  const formula=_formulaTDEE();
  const m=(_maintData&&typeof _maintData==='object')?_maintData:null;
  const loading=(_maintData===undefined||_maintData==='loading');
  const measured=(m&&m.observedTDEE!=null)?m.observedTDEE:null;
  const high=!!(m&&m.confidence==='high'&&measured!=null);
  const headline=high?measured:(formula!=null?formula:measured);
  const rate=m?m.rateKgPerWk:null;
  const rateStr=rate==null?'':(Math.abs(rate)<0.05?'holding steady':(rate>0?`losing ${rate.toFixed(2)} kg/wk`:`gaining ${Math.abs(rate).toFixed(2)} kg/wk`));
  // measured reasoning line: eating X, moving Y → maintenance Z
  const reason=high?`You're averaging ${m.avgIntake} kcal/day and ${rateStr} → maintenance ≈ <b style="color:var(--lime);">${measured}</b>.`:'';
  const badge=high
    ? `<span style="font-size:10px;font-weight:700;color:var(--green);background:rgba(0,200,120,.12);border:1px solid var(--green);border-radius:6px;padding:2px 7px;">✓ MEASURED FROM YOUR DATA</span>`
    : `<span style="font-size:10px;font-weight:700;color:#ffc107;background:rgba(255,193,7,.1);border:1px solid #ffc107;border-radius:6px;padding:2px 7px;">${loading?'CALCULATING…':'FORMULA ESTIMATE'}</span>`;
  const cell=(lbl,val)=>`<div style="flex:1;text-align:center;"><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;">${lbl}</div><div style="font-family:'Archivo Black',sans-serif;font-size:15px;color:var(--text);">${val!=null?val:'—'}</div></div>`;
  const note=high
    ? m.confidenceReason
    : (m&&m.confidenceReason?m.confidenceReason:(loading?'Reading your logged food + weigh-ins…':'Log your food (tap “Everything logged today”) and weigh in for ~2 weeks and this becomes measured from your own data.'));
  const headStr=headline!=null?headline:'—';
  return `<div id="maint-card" class="card" style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Maintenance calories</div>
        ${badge}
      </div>
      <div style="display:flex;align-items:baseline;gap:8px;">
        <div style="font-family:'Archivo Black',sans-serif;font-size:38px;color:var(--lime);letter-spacing:-2px;line-height:1;">${headStr}</div>
        <div style="font-size:12px;color:var(--text2);">kcal/day</div>
      </div>
      ${reason?`<div style="font-size:12px;color:var(--text2);margin-top:8px;line-height:1.5;">${reason}</div>`:''}
      <div style="display:flex;gap:6px;margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">
        ${cell('Measured',measured)}
        ${cell('Oura',m?m.ouraTDEE:null)}
        ${cell('Formula',formula)}
      </div>
      <div style="font-size:11px;color:var(--text3);margin-top:10px;line-height:1.45;">${note}</div>
    </div>`;
}

// ===================== Phase 88: daily energy check-in =====================
// Evening "how was your day" — a 1-5 level + optional "why" tags. Shown on the
// Food page for the VIEWED date (today for the evening log; step back with the
// date arrows to backfill) and in the calendar day-detail (backfill from any day).
const ENERGY_LEVELS=[
  {v:1,emoji:'🪫',label:'Drained'},
  {v:2,emoji:'😴',label:'Low'},
  {v:3,emoji:'😐',label:'OK'},
  {v:4,emoji:'🙂',label:'Good'},
  {v:5,emoji:'⚡',label:'Great'},
];
function renderEnergyCard(date,domId){
  domId=domId||'energy-card';
  const e=(typeof getEnergy==='function')?getEnergy(date):null;
  const lvl=(e&&e.level!=null)?e.level:null;
  const tags=(e&&Array.isArray(e.tags))?e.tags:[];
  const isToday=date===todayStr();
  const title=isToday?'How was your day?':'Energy · that day';
  const levelBtns=ENERGY_LEVELS.map(l=>{
    const on=lvl===l.v;
    return `<button onclick="_setEnergyLevel('${date}',${l.v},'${domId}')" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 2px;border-radius:10px;border:1px solid ${on?'var(--lime)':'var(--border2)'};background:${on?'rgba(200,255,0,.12)':'var(--bg2)'};cursor:pointer;">
        <span style="font-size:22px;filter:${on?'none':'grayscale(.45)'};opacity:${on||lvl==null?1:.6};">${l.emoji}</span>
        <span style="font-size:9px;color:${on?'var(--lime)':'var(--text3)'};font-weight:700;">${l.label}</span>
      </button>`;
  }).join('');
  const chips=(typeof ENERGY_TAGS!=='undefined'?ENERGY_TAGS:[]).map(t=>{
    const on=tags.includes(t);
    return `<button onclick="_toggleEnergyTag('${date}','${t}','${domId}')" style="padding:5px 11px;border-radius:20px;border:1px solid ${on?'var(--lime)':'var(--border2)'};background:${on?'rgba(200,255,0,.12)':'transparent'};color:${on?'var(--lime)':'var(--text2)'};font-size:11px;font-weight:600;cursor:pointer;">${t}</button>`;
  }).join('');
  return `<div id="${domId}" class="card" style="margin-bottom:10px;">
      <div style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px;">${title}${lvl!=null?' <span style="color:var(--lime);">✓</span>':''}</div>
      <div style="display:flex;gap:6px;">${levelBtns}</div>
      <div style="font-size:10px;color:var(--text3);margin:12px 0 6px;">Why? <span style="color:var(--text3);">(optional)</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">${chips}</div>
    </div>`;
}
function _setEnergyLevel(date,level,domId){
  if(typeof setEnergyLevel==='function')setEnergyLevel(date,level);
  const el=document.getElementById(domId); if(el)el.outerHTML=renderEnergyCard(date,domId);
  if(typeof showToast==='function'&&date===todayStr())showToast('Energy logged ✓');
}
function _toggleEnergyTag(date,tag,domId){
  if(typeof toggleEnergyTag==='function')toggleEnergyTag(date,tag);
  const el=document.getElementById(domId); if(el)el.outerHTML=renderEnergyCard(date,domId);
}

function renderFood(){
  const p=getActive(); if(!p)return;
  const viewDate=getFoodViewDate();
  const isToday=isFoodViewingToday();
  const dateObj=new Date(viewDate+'T12:00:00');
  const dateLabel=dateObj.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'});

  // Determine if this view date was a gym day
  const session=getSessionTypeForDate(viewDate);
  const _dt=(typeof getDynamicTargetForDate==='function')?getDynamicTargetForDate(viewDate):null;
  const calTarget=_dt?_dt.calories:(session?p.calsGym:p.calsRest);
  const proteinTgt=(_dt&&_dt.protein)||p.proteinTarget||180;

  const foods=getFoods(viewDate).sort((a,b)=>a.time.localeCompare(b.time));
  const totals={
    cals:foods.reduce((s,f)=>s+(f.cals||0),0),
    protein:foods.reduce((s,f)=>s+(f.protein||0),0),
    carbs:foods.reduce((s,f)=>s+(f.carbs||0),0),
    fat:foods.reduce((s,f)=>s+(f.fat||0),0),
  };
  const carbTarget=(_dt&&_dt.carbs)||p.carbsTarget||Math.round((calTarget*0.38)/4);
  const fatTarget=(_dt&&_dt.fat)||p.fatTarget||Math.round((calTarget*0.28)/9);
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

    ${isToday?renderFastingCard():''}
    ${isToday?renderMounjaroBanner():''}
    ${isToday?renderTrainingNutritionBanners():''}
    ${isToday?renderProteinDistribution():''}
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
      <div class="macro-row"><div class="macro-hdr"><span class="macro-name" style="color:var(--orange);">Protein</span><span class="macro-amt">${totals.protein}g / ${proteinTgt}g</span></div><div class="macro-bar"><div class="macro-fill mf-p" style="width:${Math.min(100,(totals.protein/proteinTgt)*100)}%"></div></div></div>
      <div class="macro-row"><div class="macro-hdr"><span class="macro-name" style="color:var(--blue);">Carbs</span><span class="macro-amt">${totals.carbs}g / ${carbTarget}g</span></div><div class="macro-bar"><div class="macro-fill mf-c" style="width:${Math.min(100,(totals.carbs/carbTarget)*100)}%"></div></div></div>
      <div class="macro-row" style="margin-bottom:0;"><div class="macro-hdr"><span class="macro-name" style="color:var(--purple);">Fat</span><span class="macro-amt">${totals.fat}g / ${fatTarget}g</span></div><div class="macro-bar"><div class="macro-fill mf-f" style="width:${Math.min(100,(totals.fat/fatTarget)*100)}%"></div></div></div>
    </div>

    ${renderEnergyCard(viewDate,'energy-card-food')}
    ${isToday?renderMaintenanceCard():''}
    ${isToday?renderEatingReviewCard():''}
    ${isToday && typeof isOwner==='function' && isOwner()?`
    <div class="card" style="margin-bottom:10px;">
      <button class="btn btn-lime btn-sm" style="width:100%;" id="eating-advice-btn" onclick="runEatingAdvice()">🍽️ What should I eat? (AI)</button>
      <div id="eating-advice-result" style="margin-top:12px;">${STATE._eatingAdvice?`<div style="font-size:13px;line-height:1.6;color:var(--text);">${typeof formatCoachingReport==='function'?formatCoachingReport(STATE._eatingAdvice):STATE._eatingAdvice}</div>`:''}</div>
    </div>`:''}

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
      <div style="font-size:10px;color:var(--text2);margin-bottom:4px;">8-HOUR WINDOW · LOW GI · RECOMP</div>
      <div style="font-family:'Archivo Black',sans-serif;font-size:24px;color:var(--lime);">12:00 PM — 8:00 PM</div>
      <div style="font-size:12px;color:var(--text2);margin-top:4px;">16 hours fasting</div>
    </div>`:''}
  `;

  renderFoodTemplatesModal();
  if(isToday)loadMaintenance(); // Phase 85: fetch measured maintenance once, then re-render the card
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
      <div style="font-size:11px;color:var(--text2);margin-bottom:6px;">${plan.meals.length} meals · ${totalCals} kcal · ${totalP}g protein${(()=>{const ap=(STATE.profile||{}).activePhase;if(!ap||!ap.calorieTarget)return '';const d=totalCals-ap.calorieTarget;const big=Math.abs(d)>100;return ` · <span style="color:${big?'var(--orange)':'var(--text3)'};">${d>=0?'+':''}${d} vs ${ap.phase} target ${ap.calorieTarget}${big?' ⚠️':''}</span>`;})()} · tap a meal for details</div>
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
            ${(()=>{const ps=getMealProteinStatus(m.protein||0);return `<div style="font-size:10px;color:${ps.color};margin-top:3px;font-weight:600;">${ps.label}</div>`;})()}
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

function openMealDetail(mealId,date){
  const targetDate=date||todayStr();
  const plan=STATE.mealPlan;
  if(!plan)return;
  const m=plan.meals.find(x=>x.id===mealId);
  if(!m)return;
  const ingredients=getMealIngredients(m);
  const supplements=getMealSupplements(m);
  const dayFoods=getFoods(targetDate);
  const isStringFormat=!Array.isArray(m.ingredients);
  const granular=dayFoods.filter(f=>f.mealId===m.id);
  const legacy=dayFoods.find(f=>f.name===m.name&&!f.mealId);
  const suppLog=getSupplementLog(targetDate);
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
  _mds={mealId:m.id,meal:m,date:targetDate,ingredients,supplements,ingQty,suppChecked,isStringFormat,
    ingInit:[...ingQty],suppInit:[...suppChecked]};
  _renderMealDetail();
  openModal('modal-meal-detail');
}

function _getMealLogStatus(){
  if(!_mds)return'none';
  const foods=getFoods(_mds.date);
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
          <div style="font-size:10px;color:var(--text3);margin-bottom:8px;">${dim?'skipped':`${ingP}g P · ${ingC}g C · ${ingF}g F`}${(()=>{let gi=null;if(ing.gi){const b=ing.gi;gi={band:b,label:b==='high'?'🔴 Higher GI':b==='moderate'?'🟡 Moderate GI':'🟢 Low GI'};}else if(typeof estimateGI==='function')gi=estimateGI(ing.name);return (gi&&gi.label)?` · <span style="color:${gi.band==='high'?'var(--red)':gi.band==='moderate'?'var(--orange)':'var(--green)'};">${gi.label}</span>`:'';})()}</div>
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
  const targetDate=s.date||todayStr();
  const isToday=targetDate===todayStr();
  // For today, timestamp = now. For a backfilled past meal, use the meal's planned time on that date.
  const loggedAtIso=isToday
    ? new Date().toISOString()
    : new Date(`${targetDate}T${(m.time||'12:00')}:00`).toISOString();
  // Build final foods array for that date: existing entries minus this meal's, plus entries for ingredients with qty > 0
  const foods=getFoods(targetDate);
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
        loggedAt:loggedAtIso,
      });
    }
  });
  const finalFoods=[...filtered,...newEntries];

  // Single atomic write — local + server
  const all=pGet('foods',{});
  all[targetDate]=finalFoods;
  STATE.foods=all;
  updateLocalCache();
  saveFieldToServer(`/api/state/foods/${targetDate}`,{value:finalFoods});
  if(typeof recomputeFastingLog==='function')recomputeFastingLog(targetDate);

  // Supplements (separate endpoint, no race)
  s.supplements.forEach((supp,i)=>setSupplementTaken(targetDate,supp.id,s.suppChecked[i]));

  closeModal('modal-meal-detail');
  if(isToday){ renderFood();renderToday(); }
  else if(typeof renderDayDetail==='function'){ renderDayDetail(targetDate); }
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

// Collapsible Track-page sections. Each header toggles its own body; the
// open/closed state persists in localStorage so the user's choices stick across
// visits. Keeps the long history lists tucked away so the page isn't one endless
// scroll. Toggling flips display + chevron in place — no full re-render.
const _TRACK_DEFAULT_OPEN = { bodycomp:true, progress:true };
function _trackSectionState(){ try{ return JSON.parse(localStorage.getItem('forge_track_sections')||'{}'); }catch(e){ return {}; } }
function _trackSectionOpen(key){ const s=_trackSectionState(); return key in s ? !!s[key] : !!_TRACK_DEFAULT_OPEN[key]; }
function toggleTrackSection(key){
  const s=_trackSectionState();
  s[key]=!_trackSectionOpen(key);
  try{ localStorage.setItem('forge_track_sections',JSON.stringify(s)); }catch(e){}
  const bd=document.getElementById('tsec-bd-'+key), ch=document.getElementById('tsec-chev-'+key);
  if(bd)bd.style.display=s[key]?'':'none';
  if(ch)ch.textContent=s[key]?'▾':'▸';
}
// Wrap existing markup in a collapsible: _collapsibleOpen(...) + content + _collapsibleClose().
function _collapsibleOpen(key,title,headerExtra){
  const open=_trackSectionOpen(key);
  return `<div style="margin-bottom:6px;">
    <div onclick="toggleTrackSection('${key}')" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:13px 2px;cursor:pointer;border-bottom:1px solid var(--border);">
      <div style="font-size:12px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--text);">${title}</div>
      <div style="display:flex;align-items:center;gap:12px;">${headerExtra||''}<span id="tsec-chev-${key}" style="color:var(--lime);font-size:12px;line-height:1;">${open?'▾':'▸'}</span></div>
    </div>
    <div id="tsec-bd-${key}" style="${open?'':'display:none;'}padding-top:12px;">`;
}
function _collapsibleClose(){ return `</div></div>`; }

// Phase 68: same collapsible-dropdown pattern for the More page, with its own
// storage bucket + id prefix so its open/closed state is independent of Track.
const _MORE_DEFAULT_OPEN = {}; // all sections collapsed by default
function _moreSectionState(){ try{ return JSON.parse(localStorage.getItem('forge_more_sections')||'{}'); }catch(e){ return {}; } }
function _moreSectionOpen(key){ const s=_moreSectionState(); return key in s ? !!s[key] : !!_MORE_DEFAULT_OPEN[key]; }
function toggleMoreSection(key){
  const s=_moreSectionState();
  s[key]=!_moreSectionOpen(key);
  try{ localStorage.setItem('forge_more_sections',JSON.stringify(s)); }catch(e){}
  const bd=document.getElementById('msec-bd-'+key), ch=document.getElementById('msec-chev-'+key);
  if(bd)bd.style.display=s[key]?'':'none';
  if(ch)ch.textContent=s[key]?'▾':'▸';
}
function _mOpen(key,title,headerExtra){
  const open=_moreSectionOpen(key);
  return `<div style="margin-bottom:6px;">
    <div onclick="toggleMoreSection('${key}')" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:13px 2px;cursor:pointer;border-bottom:1px solid var(--border);">
      <div style="font-size:12px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--text);">${title}</div>
      <div style="display:flex;align-items:center;gap:12px;">${headerExtra||''}<span id="msec-chev-${key}" style="color:var(--lime);font-size:12px;line-height:1;">${open?'▾':'▸'}</span></div>
    </div>
    <div id="msec-bd-${key}" style="${open?'':'display:none;'}padding-top:12px;">`;
}
function _mClose(){ return `</div></div>`; }

// ============================================================
// TRACK CHARTS (Phase 66) — hand-drawn SVG line charts w/ hover
// Chart series colours are dataviz-validated literals (NOT the app
// --blue/--orange, which fail CVD/lightness checks): Lean #2f7fd6,
// Fat #e0680f, Weight = brand lime #c8ff00.
// ============================================================
const _TCHART_LEAN = '#2f7fd6';
const _TCHART_FAT  = '#e0680f';
const _TCHART_W    = '#c8ff00';
let _tchartReg = {};
function _tchartScaler(dom,range){ const m=(range[1]-range[0])/((dom[1]-dom[0])||1); return v=>range[0]+(v-dom[0])*m; }
function _tchartPts(arr,X,Y){ return arr.map(p=>X(p.x)+','+Y(p.y)).join(' '); }
function _niceTicks(min,max,approx){
  if(!(max>min)){ max=min+1; }
  const range=max-min, raw=range/Math.max(1,approx);
  const mag=Math.pow(10,Math.floor(Math.log10(raw)||0));
  const norm=raw/mag, step=(norm<1.5?1:norm<3?2:norm<7?5:10)*mag;
  const t0=Math.floor(min/step)*step, t1=Math.ceil(max/step)*step, ticks=[];
  for(let t=t0;t<=t1+1e-9;t+=step)ticks.push(Math.round(t*100)/100);
  return {ticks,min:t0,max:t1};
}
function _monthTicks(startDate,maxDay){
  const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const s=new Date(startDate+'T12:00:00');
  const ticks=[{d:0,l:MON[s.getMonth()]}];
  let d=new Date(s.getFullYear(),s.getMonth()+1,1);
  for(let i=0;i<48;i++){
    const day=Math.round((d-s)/86400000);
    if(day>maxDay)break;
    ticks.push({d:day,l:MON[d.getMonth()]});
    d=new Date(d.getFullYear(),d.getMonth()+1,1);
  }
  return ticks;
}
// Bucket date-keyed entries into weekly averages from startDate → clean, de-noised line.
function _weeklyBuckets(entries,valKeys,startDate){
  const keys=Array.isArray(valKeys)?valKeys:[valKeys];
  const s=new Date(startDate+'T12:00:00'), buckets={};
  entries.forEach(e=>{
    const day=Math.round((new Date(e.date+'T12:00:00')-s)/86400000);
    if(day<0)return;
    const wk=Math.floor(day/7);
    (buckets[wk]=buckets[wk]||[]).push({day,e});
  });
  return Object.keys(buckets).map(Number).sort((a,b)=>a-b).map(wk=>{
    const arr=buckets[wk];
    const out={day:Math.round(arr.reduce((a,x)=>a+x.day,0)/arr.length), date:arr[arr.length-1].e.date};
    keys.forEach(k=>{ out[k]=Math.round(arr.reduce((a,x)=>a+x.e[k],0)/arr.length*10)/10; });
    return out;
  });
}
function _tchartHTML(cfg){
  const W=430,H=210,padL=34,padR=14,padT=14,padB=24;
  const X=_tchartScaler(cfg.xDom,[padL,W-padR]), Y=_tchartScaler(cfg.yDom,[H-padB,padT]);
  let s='<svg class="tchart" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+(cfg.aria||'')+'">';
  s+='<g class="grid">'; cfg.yTicks.forEach(t=>{ const y=Y(t); s+='<line x1="'+padL+'" y1="'+y+'" x2="'+(W-padR)+'" y2="'+y+'"/>'; }); s+='</g>';
  s+='<g class="axis">';
  cfg.yTicks.forEach(t=>{ s+='<text x="'+(padL-6)+'" y="'+(Y(t)+3)+'" text-anchor="end">'+t+'</text>'; });
  (cfg.xTicks||[]).forEach(t=>{ s+='<text x="'+X(t.d)+'" y="'+(H-7)+'" text-anchor="middle">'+t.l+'</text>'; });
  s+='</g>';
  if(cfg.band){ const top=cfg.band.hi.map(p=>X(p.x)+','+Y(p.y)).join(' '); const bot=cfg.band.lo.slice().reverse().map(p=>X(p.x)+','+Y(p.y)).join(' '); s+='<polygon points="'+top+' '+bot+'" fill="rgba(200,255,0,.10)"/>'; }
  if(cfg.target!=null){ const ty=Y(cfg.target); s+='<g class="target"><line x1="'+padL+'" y1="'+ty+'" x2="'+(W-padR)+'" y2="'+ty+'"/><text x="'+(padL+4)+'" y="'+(ty-5)+'" text-anchor="start">TARGET '+cfg.target+(cfg.targetUnit||'')+'</text></g>'; }
  if(cfg.area){ const s0=cfg.series[0].data; const line=_tchartPts(s0,X,Y); const a='M '+X(s0[0].x)+' '+(H-padB)+' L '+line.split(' ').join(' L ')+' L '+X(s0[s0.length-1].x)+' '+(H-padB)+' Z'; const gid='tag-'+cfg.wrap; s+='<defs><linearGradient id="'+gid+'" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="'+cfg.series[0].color+'" stop-opacity=".15"/><stop offset="1" stop-color="'+cfg.series[0].color+'" stop-opacity="0"/></linearGradient></defs><path d="'+a.replace(/,/g,' ')+'" fill="url(#'+gid+')"/>'; }
  if(cfg.proj&&cfg.proj.length){ s+='<polyline points="'+_tchartPts(cfg.proj,X,Y)+'" fill="none" stroke="'+(cfg.projColor||_TCHART_W)+'" stroke-width="2" stroke-dasharray="1 5" stroke-linecap="round" opacity=".85"/>'; }
  cfg.series.forEach(se=>{
    s+='<polyline points="'+_tchartPts(se.data,X,Y)+'" fill="none" stroke="'+se.color+'" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
    const e=se.data[se.data.length-1];
    s+='<circle cx="'+X(e.x)+'" cy="'+Y(e.y)+'" r="4" fill="'+se.color+'" stroke="var(--bg)" stroke-width="2"/>';
    if(se.label){ s+='<text class="serieslabel" x="'+(X(e.x)-7)+'" y="'+(Y(e.y)-8)+'" text-anchor="end" fill="'+se.color+'">'+se.label+'</text>'; }
  });
  s+='<g class="cross" id="cr-'+cfg.wrap+'"><line x1="0" y1="'+padT+'" x2="0" y2="'+(H-padB)+'"/>';
  cfg.series.forEach(se=>{ s+='<circle r="4.5" fill="var(--bg)" stroke="'+se.color+'" stroke-width="2.4"/>'; });
  s+='</g></svg>';
  _tchartReg[cfg.wrap]={W,H,padL,padR,padB,padT,xDom:cfg.xDom,yDom:cfg.yDom,hover:cfg.hover||[]};
  return '<div class="tchart-wrap" id="'+cfg.wrap+'"><div class="tchart-tip" id="'+cfg.wrap+'-tip"></div>'+s+'</div>';
}
function _initTrackCharts(){
  Object.keys(_tchartReg).forEach(id=>{
    const wrap=document.getElementById(id); if(!wrap)return;
    const R=_tchartReg[id], svgEl=wrap.querySelector('svg'), cross=wrap.querySelector('#cr-'+id), tip=document.getElementById(id+'-tip');
    if(!svgEl||!cross||!tip)return;
    const crossDots=cross.querySelectorAll('circle'), ln=cross.querySelector('line');
    const X=_tchartScaler(R.xDom,[R.padL,R.W-R.padR]), Y=_tchartScaler(R.yDom,[R.H-R.padB,R.padT]);
    function move(clientX){
      const r=svgEl.getBoundingClientRect(), px=(clientX-r.left)/r.width*R.W, hp=R.hover;
      if(!hp.length)return; let best=0,bd=1e9;
      for(let q=0;q<hp.length;q++){ const dx=Math.abs(X(hp[q].x)-px); if(dx<bd){bd=dx;best=q;} }
      const p=hp[best], cx=X(p.x);
      cross.style.opacity=1; ln.setAttribute('x1',cx); ln.setAttribute('x2',cx);
      p.rows.forEach((row,ri)=>{ if(crossDots[ri]){ crossDots[ri].setAttribute('cx',cx); crossDots[ri].setAttribute('cy',Y(row.y)); } });
      let html='<div class="d">'+p.label+'</div>';
      p.rows.forEach(row=>{ html+='<div class="row"><span class="dot" style="background:'+row.color+'"></span>'+row.name+' '+row.y+row.unit+'</div>'; });
      tip.innerHTML=html; tip.style.opacity=1;
      const tx=cx/R.W*r.width, ty=Y(p.rows[0].y)/R.H*r.height;
      tip.style.left=Math.max(46,Math.min(r.width-46,tx))+'px'; tip.style.top=ty+'px';
    }
    function end(){ cross.style.opacity=0; tip.style.opacity=0; }
    svgEl.addEventListener('pointermove',e=>move(e.clientX));
    svgEl.addEventListener('pointerdown',e=>move(e.clientX));
    svgEl.addEventListener('pointerleave',end);
    svgEl.addEventListener('touchmove',e=>{ if(e.touches[0])move(e.touches[0].clientX); },{passive:true});
    svgEl.addEventListener('touchend',end);
  });
}
// Weight trajectory-to-goal chart (line + weekly buckets + dashed projection + confidence band + target line)
function _trackWeightChart(){
  const p=getActive(); if(!p||!p.startDate)return '';
  const raw=getJourneyEntries('weight'); if(raw.length<3)return '';
  const start=p.startDate, s=new Date(start+'T12:00:00');
  const pts=_weeklyBuckets(raw,'weight',start); if(pts.length<2)return '';
  const proj=getProjections();
  const target=(p.targetWeight!=null)?p.targetWeight:null;
  const lastPt=pts[pts.length-1];
  let projLine=null, band=null, maxDay=lastPt.day;
  if(proj&&proj.wDate&&target!=null&&proj.weightRate>0&&lastPt.weight>target){
    const goalDay=Math.round((proj.wDate-s)/86400000);
    if(goalDay>lastPt.day){
      const steps=Math.max(1,Math.round((goalDay-lastPt.day)/7));
      projLine=[]; const hi=[],lo=[];
      for(let k=0;k<=steps;k++){
        const day=lastPt.day+(goalDay-lastPt.day)*(k/steps);
        const y=Math.round((lastPt.weight+(target-lastPt.weight)*(k/steps))*10)/10;
        const sp=k*0.18;
        projLine.push({x:day,y}); hi.push({x:day,y:y+sp}); lo.push({x:day,y:y-sp});
      }
      band={hi,lo}; maxDay=goalDay;
    }
  }
  const ys=pts.map(x=>x.weight).concat(target!=null?[target]:[]);
  const yt=_niceTicks(Math.min(...ys)-1,Math.max(...ys)+1,5);
  const cfg={
    wrap:'tchart-weight', aria:'Weight over time trending toward target',
    xDom:[0,Math.max(maxDay,1)], yDom:[yt.min,yt.max], yTicks:yt.ticks,
    xTicks:_monthTicks(start,Math.max(maxDay,1)),
    target:target, targetUnit:'kg', area:true, proj:projLine, projColor:_TCHART_W, band,
    series:[{color:_TCHART_W, data:pts.map(x=>({x:x.day,y:x.weight}))}],
    hover:pts.map(x=>({x:x.day,label:fmtDate(x.date),rows:[{name:'Weight',color:_TCHART_W,y:x.weight,unit:'kg'}]}))
  };
  let readout='';
  if(proj&&proj.goalDate&&target!=null){
    const fd=d=>d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
    const wks=proj.weeksToWeight;
    const rangeStr=proj.range?`${fd(proj.range.early)} – ${fd(proj.range.late)} · ${proj.confidence} confidence`:'';
    readout=`<div style="margin-top:12px;padding:11px 12px;border-radius:12px;background:var(--s2);border:1px solid var(--border);">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.1px;color:var(--text3);font-weight:800;">Projected goal (${target}kg)</div>
      <div style="font-family:'Archivo Black',sans-serif;font-size:19px;color:var(--lime);margin:3px 0;letter-spacing:-.3px;">≈ ${fd(proj.wDate)}</div>
      ${wks?`<div style="font-size:11.5px;color:var(--text2);">At your recent rate you reach target in about ${wks} weeks.</div>`:''}
      ${rangeStr?`<div style="font-size:10px;color:var(--text3);margin-top:3px;">range ${rangeStr}</div>`:''}
    </div>`;
  }
  return _tchartHTML(cfg)+readout;
}
// Body composition chart (lean mass vs fat mass, both from aligned weight×bf so lean+fat=weight)
function _trackCompChart(){
  const p=getActive(); if(!p||!p.startDate)return '';
  const start=p.startDate;
  const wl=getJourneyEntries('weight'), bl=getBfLog();
  const aligned=wl.map(we=>{
    const bfe=bl.filter(b=>b.date<=we.date).pop(); if(!bfe)return null;
    const lean=Math.round(we.weight*(1-bfe.bf/100)*10)/10;
    const fat=Math.round((we.weight-lean)*10)/10;
    return {date:we.date, lean, fat};
  }).filter(Boolean);
  if(aligned.length<3)return '';
  const pts=_weeklyBuckets(aligned,['lean','fat'],start); if(pts.length<2)return '';
  const vals=pts.flatMap(x=>[x.lean,x.fat]);
  const yt=_niceTicks(Math.min(...vals)-2,Math.max(...vals)+2,3);
  const maxDay=pts[pts.length-1].day;
  const cfg={
    wrap:'tchart-comp', aria:'Lean mass holding while fat mass falls',
    xDom:[0,Math.max(maxDay,1)], yDom:[yt.min,yt.max], yTicks:yt.ticks,
    xTicks:_monthTicks(start,Math.max(maxDay,1)),
    series:[
      {color:_TCHART_LEAN, label:'Lean', data:pts.map(x=>({x:x.day,y:x.lean}))},
      {color:_TCHART_FAT,  label:'Fat',  data:pts.map(x=>({x:x.day,y:x.fat}))}
    ],
    hover:pts.map(x=>({x:x.day,label:fmtDate(x.date),rows:[
      {name:'Lean',color:_TCHART_LEAN,y:x.lean,unit:'kg'},
      {name:'Fat', color:_TCHART_FAT, y:x.fat, unit:'kg'}
    ]}))
  };
  // Anchor the "since start" note to the profile's true start values when set
  // (matches the Progress cards); else fall back to the first charted bucket.
  const first=pts[0], last=pts[pts.length-1];
  let baseLean=first.lean, baseFat=first.fat, baseDate=first.date;
  if(p.startWeight!=null&&p.startBF!=null){
    baseLean=Math.round(p.startWeight*(1-p.startBF/100)*10)/10;
    baseFat=Math.round((p.startWeight-baseLean)*10)/10;
    baseDate=start;
  }
  const wDrop=Math.round(((baseLean+baseFat)-(last.lean+last.fat))*10)/10;
  const fatDrop=Math.round((baseFat-last.fat)*10)/10;
  const leanDrop=Math.round((baseLean-last.lean)*10)/10;
  let note='';
  if(wDrop>0.3){
    const fatPct=Math.round((fatDrop/wDrop)*100);
    note=`<div style="font-size:11.5px;color:var(--text2);margin-top:11px;line-height:1.5;">Down <b style="color:var(--text);">${wDrop}kg</b> since ${fmtDate(baseDate)} — <b style="color:var(--text);">${Math.max(0,Math.min(100,fatPct))}% of it was fat</b> (${fatDrop>=0?'−':'+'}${Math.abs(fatDrop)}kg fat, ${leanDrop>=0?'−':'+'}${Math.abs(leanDrop)}kg lean).</div>`;
  }
  const legend=`<div class="tchart-legend"><div class="item"><span class="sw" style="background:${_TCHART_LEAN}"></span>Lean mass</div><div class="item"><span class="sw" style="background:${_TCHART_FAT}"></span>Fat mass</div></div>`;
  return legend+_tchartHTML(cfg)+note;
}

// ===================== Phase 89: Engine Trend + vitals (Oura walk analysis) =====================
function _ouraReconnectBanner(){
  return ouraNeedsReconnect()
    ? `<div style="background:rgba(255,85,0,.08);border:1px solid rgba(255,85,0,.25);border-radius:8px;padding:8px 11px;margin-bottom:10px;font-size:11px;color:var(--orange);font-weight:600;line-height:1.4;">⚠ Oura connection expired — paste a fresh token in <b>More → Oura</b> to resume syncing.</div>`
    : '';
}
// "Engine Trend" — avg HR on same-pace (~3.0mph) walks over time. Falling = fitter.
function renderEngineTrend(){
  const recon=_ouraReconnectBanner();
  const walks=Object.values(getWalkAnalysis()||{})
    .filter(w=>w&&w.paceMph!=null&&w.paceMph>=2.8&&w.paceMph<=3.2&&w.avgHR!=null&&w.day)
    .sort((a,b)=>String(a.day).localeCompare(String(b.day)));
  if(walks.length<2){
    return `<div class="card">${recon}
      <div style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px;">Engine Trend · avg HR @ ~3.0mph</div>
      <div style="font-size:12px;color:var(--text3);line-height:1.5;">Tracks your average heart rate on steady ~3.0mph walks (pace 2.8–3.2) — a <b>falling line means a fitter engine</b> at the same effort. Needs ≥2 same-pace walks with heart-rate + distance. ${walks.length?'1 so far.':'None yet.'}<br><span style="color:var(--text3);">Walks come from Oura (activity “walking”) or your manual logs; pace needs distance (GPS-tracked walks).</span></div>
    </div>`;
  }
  const first=walks[0].day;
  const dx=d=>Math.round((Date.parse(d+'T12:00:00')-Date.parse(first+'T12:00:00'))/86400000);
  const pts=walks.map(w=>({x:dx(w.day),y:w.avgHR,date:w.day,pace:w.paceMph}));
  const maxDay=Math.max(pts[pts.length-1].x,1);
  const ys=pts.map(p=>p.y), yt=_niceTicks(Math.min(...ys),Math.max(...ys),4);
  const cfg={ wrap:'engine-chart', aria:'Average HR at 3mph walks over time',
    xDom:[0,maxDay], yDom:[yt.min,yt.max], yTicks:yt.ticks, xTicks:_monthTicks(first,maxDay),
    series:[{color:_TCHART_W,data:pts.map(p=>({x:p.x,y:p.y})),label:'bpm'}],
    hover:pts.map(p=>({x:p.x,label:fmtDate(p.date)+' · '+p.pace+'mph',rows:[{name:'Avg HR',color:_TCHART_W,y:p.y,unit:' bpm'}]})) };
  const delta=pts[pts.length-1].y-pts[0].y;
  const col=delta<-1?'var(--green)':delta>1?'#ffc107':'var(--text2)';
  const note=delta<-1?`▼ ${Math.abs(delta)} bpm since your first walk — fitter engine at the same pace.`:delta>1?`▲ ${delta} bpm since first — check sleep/recovery.`:'Holding steady at the same pace.';
  return `<div class="card">${recon}
    <div style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Engine Trend · avg HR @ ~3.0mph</div>
    <div style="font-size:11px;color:var(--text3);margin:2px 0 8px;">Same-pace walks only (2.8–3.2mph). Falling line = fitter engine.</div>
    ${_tchartHTML(cfg)}
    <div style="font-size:12px;color:${col};font-weight:600;margin-top:8px;">${note}</div>
    <div style="font-size:10px;color:var(--text3);margin-top:4px;">${walks.length} qualifying walks</div>
  </div>`;
}
// Resting HR (bpm) + HRV (ms) — real values from the sleep endpoint, last 30 days.
function renderVitalsTrend(){
  const v=getOuraVitals()||{};
  const recent=Object.keys(v).filter(d=>v[d]).sort().slice(-30);
  if(!recent.length)return '';
  const first=recent[0];
  const dx=d=>Math.round((Date.parse(d+'T12:00:00')-Date.parse(first+'T12:00:00'))/86400000);
  const maxDay=Math.max(dx(recent[recent.length-1]),1);
  const rhrPts=[],hrvPts=[];
  recent.forEach(d=>{ const x=dx(d); if(v[d].rhr!=null)rhrPts.push({x,y:v[d].rhr,date:d}); if(v[d].hrv!=null)hrvPts.push({x,y:v[d].hrv,date:d}); });
  const mini=(id,pts,color,unit,label,goodDown)=>{
    if(pts.length<2)return '';
    const ys=pts.map(p=>p.y), yt=_niceTicks(Math.min(...ys),Math.max(...ys),4);
    const cfg={wrap:id,aria:label,xDom:[0,maxDay],yDom:[yt.min,yt.max],yTicks:yt.ticks,xTicks:_monthTicks(first,maxDay),
      series:[{color,data:pts.map(p=>({x:p.x,y:p.y})),label:unit.trim()}],
      hover:pts.map(p=>({x:p.x,label:fmtDate(p.date),rows:[{name:label,color,y:p.y,unit}]}))};
    const delta=Math.round((pts[pts.length-1].y-pts[0].y)*10)/10;
    const good=goodDown?delta<0:delta>0;
    const col=Math.abs(delta)<0.5?'var(--text2)':(good?'var(--green)':'#ffc107');
    return `<div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;margin-bottom:4px;"><span style="color:${color};">${label}</span><span style="color:${col};">${delta<0?'▼':delta>0?'▲':'→'} ${Math.abs(delta)}${unit} / 30d</span></div>
        ${_tchartHTML(cfg)}
      </div>`;
  };
  const rhr=mini('rhr-chart',rhrPts,'#e0680f',' bpm','Resting HR',true);
  const hrv=mini('hrv-chart',hrvPts,'#2f7fd6',' ms','HRV',false);
  if(!rhr&&!hrv)return '';
  return `<div class="card">
    <div style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px;">Resting HR & HRV · 30 days</div>
    ${rhr}${hrv}
    <div style="font-size:10px;color:var(--text3);">Resting HR ↓ and HRV ↑ = recovering / getting fitter.</div>
  </div>`;
}

function renderTrack(){
  _tchartReg={};
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
  const phase = (STATE.profile?.personal?.phase) || 'cut';
  const _lbmTrend = smoothedBodyCompTrend('lbm', phase);
  const _fatTrend = smoothedBodyCompTrend('fat', phase);
  const _lbmColor = _statusColor(_lbmTrend.status);
  const _fatColor = _statusColor(_fatTrend.status);
  const _colorForLBMDelta = () => _lbmColor;
  const _colorForFatDelta = () => _fatColor;
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
    ${_trendRow('Weight',    cwNow != null ? cwNow + ' kg' : '—',    [wDelta7,   wDelta14],   _colorForFatDelta)}
    ${_trendRow('Fat mass',  cFatNow != null ? cFatNow + ' kg' : '—',[fatDelta7, fatDelta14], _colorForFatDelta)}
    ${_trendRow('Lean mass', clbmNow != null ? clbmNow + ' kg' : '—',[lbmDelta7, lbmDelta14], _colorForLBMDelta)}
    <div style="font-size:10px;color:var(--text3);line-height:1.5;padding-top:10px;">Colour reflects your recent average vs ~2 weeks ago — a single-day swing won't flip it, and the colour follows the direction of the number (lean up = green). Daily numbers shown as-is.</div>
  </div>`;

  // Phase 30: Compare two dates card
  const compareCard = `<div class="card" style="margin-bottom:14px;">
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

  const _weightLogBtn=`<button class="btn btn-lime btn-sm" onclick="event.stopPropagation();openModal('modal-weight')">+ Log</button>`;
  const _stepsLogBtn=`<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();promptSteps()">Log Today</button>`;
  const _goalCard=(()=>{
      if(!proj)return'<div class="card" style="margin-bottom:10px;"><div style="font-size:12px;color:var(--text2);padding:12px 0;">Pending — need profile targets set</div></div>';
      if(!proj.goalDate){
        const reason=(wEntries.length<2||bEntries.length<2)?'Pending — need more entries':'Pending — need consistent loss trend';
        return'<div class="card" style="margin-bottom:10px;"><div style="font-size:12px;color:var(--text2);padding:12px 0;">'+reason+'</div></div>';
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
        <div style="display:flex;justify-content:flex-end;align-items:flex-start;margin-bottom:8px;">
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
    })();
  const _weightHistCard=`<div class="card">
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
    </div>`;
  const _bfHistCard=`<div class="card" style="margin-bottom:10px;">
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
    </div>`;
  const _stepsCard=`<div class="sg sg3">
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
    </div>`;
  const _streaksCard=`<div class="sg sg3">
      <div class="sb lime"><div class="l">Steps</div><div class="v">${stepsStreak}<span class="u">days</span></div></div>
      <div class="sb orange"><div class="l">Gym</div><div class="v">${gymStreak}<span class="u">days</span></div></div>
      <div class="sb green"><div class="l">Food Log</div><div class="v">${foodStreak}<span class="u">days</span></div></div>
    </div>`;

  const _progressBody=
    _progressCard('Weight',`${_v(p.startWeight)}kg → ${_v(p.targetWeight)}kg`,cw,'kg',wPct,'var(--lime)',hasEnoughW?wRate:null,' kg',`Lost ${wLost}kg · ${wToGo}kg to go · ${wGoalStr}`,wSpark)
    +_progressCard('Body Fat',`${_v(p.startBF)}% → ${_v(p.targetBF)}%`,cbf,'%',bPct,'var(--orange)',hasEnoughB?bRate:null,'%',bCaption,bSpark)
    +_progressCard('Lean Mass',`current — target: hold ${_v(p.targetLBM)}kg`,clbm,'kg',lPct,'var(--blue)',hasEnoughL?lRate:null,' kg',lCaption,lSpark,lAlert)
    +(cvf!=null||svf!=null?_progressCard('Visceral Fat',`current → target: ${_v(p.targetVisceralFat)} or less`,cvf,'',vPct,'var(--purple)',hasEnoughV?vRate:null,'',vCaption,vSpark):'');

  document.getElementById('page-track').innerHTML=`
    <div class="pg-title" style="margin-bottom:14px;">Progress</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:12px;line-height:1.5;">Tap a section to open or close it — the app remembers what you keep open.</div>

    ${_collapsibleOpen('bodycomp','Body Composition · Lean vs Fat')}${_trackCompChart()}${trendCard}${_collapsibleClose()}
    ${_collapsibleOpen('progress','Progress · Weight · BF · Lean · Visceral')}${_trackWeightChart()}${_progressBody}${_collapsibleClose()}
    ${_collapsibleOpen('goal','Goal Date')}${_goalCard}${_collapsibleClose()}
    ${_collapsibleOpen('compare','Compare Any Two Dates')}${compareCard}${_collapsibleClose()}
    ${_collapsibleOpen('health','VO2 Max · Blood Pressure · DEXA')}${renderVO2MaxCard()}${renderBPCard()}${renderDexaCard()}${_collapsibleClose()}
    ${_collapsibleOpen('engine','Engine Trend · Walks','<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openWalkModal()">+ Walk</button>')}${renderEngineTrend()}${renderVitalsTrend()}${_collapsibleClose()}
    ${_collapsibleOpen('weighthist','Weight History',_weightLogBtn)}${_weightHistCard}${_collapsibleClose()}
    ${_collapsibleOpen('bfhist','Body Fat History')}${_bfHistCard}${_collapsibleClose()}
    ${_collapsibleOpen('bphist','Blood Pressure History')}${renderBPHistory()}${_collapsibleClose()}
    ${_collapsibleOpen('steps','Steps',_stepsLogBtn)}${_stepsCard}${_collapsibleClose()}
    ${_collapsibleOpen('streaks','Streaks 🔥')}${_streaksCard}${_collapsibleClose()}
    ${_collapsibleOpen('strength','Strength · Records · Standards')}${renderStrengthTrend()}${renderLegPressSledDiag()}<div class="card">${renderLiftingRecords()}</div>${renderStrengthStandards()}${_collapsibleClose()}
    ${_collapsibleOpen('calendar','Training Calendar')}${renderCalendar()}${_collapsibleClose()}
  `;

  // Phase 30: render the date-compare snapshot after innerHTML
  renderCompareSnapshot();
  // Phase 66: wire up the interactive charts' hover/touch
  _initTrackCharts();
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

// Phase 71: aggregate the "activity" metrics across a From→To range instead of
// snapshotting two single days (which is noise for sleep/steps/food). Pure — reads
// STATE only. Averages are over days-WITH-data (count returned) so sparse logging
// is visible, not hidden. Strength sessions exclude rehab/cardio/mobility-only days.
function _rangeActivityStats(fromDate, toDate){
  let from = fromDate, to = toDate;
  if(from && to && from > to){ const t = from; from = to; to = t; } // tolerate reversed pickers
  const empty = { spanDays:0,
    sleep:{avg:null,total:0,days:0}, steps:{avg:null,total:0,days:0},
    eaten:{avg:null,total:0,days:0}, tdee:{avg:null,total:0,days:0},
    balance:{avg:null,days:0},
    training:{sessions:0,volumeTotal:0,volumeAvg:null,timeTotalSec:0,timeAvgSec:null,timeDays:0} };
  if(!from || !to) return empty;
  const sleep = STATE.sleepLog || {}, steps = STATE.stepsLog || {},
        cals = STATE.calorieLog || {}, foods = STATE.foods || {}, exLog = STATE.exLog || {};
  let slSum=0, slDays=0, stSum=0, stDays=0, eSum=0, eDays=0, tdSum=0, tdDays=0,
      balSum=0, balDays=0, sessions=0, volTot=0, timeTot=0, timeDays=0;
  let cur = new Date(from + 'T12:00:00');
  const end = new Date(to + 'T12:00:00');
  let span = 0, guard = 0;
  while(cur <= end && guard++ < 2000){
    span++;
    // Local date components (cur is local noon, stepped by calendar days) — TZ-safe,
    // matches the app's YYYY-MM-DD keys without a UTC round-trip.
    const d = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
    // Sleep hours (object with .hours) / Steps (bare number)
    const sh = sleep[d] && sleep[d].hours; if(sh > 0){ slSum += sh; slDays++; }
    const st = steps[d]; if(typeof st === 'number' && st > 0){ stSum += st; stDays++; }
    // Calories eaten (sum of foods[d][].cals) / TDEE burned (calorieLog[d].total)
    const eaten = (foods[d] || []).reduce((s,f)=>s + (parseFloat(f.cals) || 0), 0);
    if(eaten > 0){ eSum += eaten; eDays++; }
    const tdee = cals[d] && cals[d].total; if(tdee > 0){ tdSum += tdee; tdDays++; }
    if(eaten > 0 && tdee > 0){ balSum += (eaten - tdee); balDays++; }
    // Strength session: a logged non-`_` lift with values that isn't rehab/cardio/mobility
    const el = exLog[d] || {};
    let isStrength = false;
    for(const k of Object.keys(el)){
      if(k.startsWith('_')) continue;
      const ex = el[k];
      if(!ex || !Array.isArray(ex.sets) || !ex.sets.some(s=>s.kg||s.reps||s.seconds)) continue;
      const exObj = (typeof getAllExercises==='function') ? getAllExercises().find(e=>e.id===k) : null;
      if(exObj && ((typeof _isRehabOrCardio==='function' && _isRehabOrCardio(exObj)) || exObj.mobility)) continue;
      isStrength = true; break;
    }
    if(isStrength){
      sessions++;
      if(typeof computeSessionVolume==='function') volTot += computeSessionVolume(el);
      const dur = el._session && el._session.totalDuration;
      if(dur > 0){ timeTot += dur; timeDays++; }
    }
    cur.setDate(cur.getDate() + 1);
  }
  const _avg = (sum, n, dp) => n ? Math.round((sum / n) * Math.pow(10,dp)) / Math.pow(10,dp) : null;
  return {
    spanDays: span,
    sleep: { avg:_avg(slSum,slDays,1), total:Math.round(slSum), days:slDays },
    steps: { avg:_avg(stSum,stDays,0), total:Math.round(stSum), days:stDays },
    eaten: { avg:_avg(eSum,eDays,0),  total:Math.round(eSum),  days:eDays },
    tdee:  { avg:_avg(tdSum,tdDays,0), total:Math.round(tdSum), days:tdDays },
    balance: { avg:_avg(balSum,balDays,0), days:balDays },
    training: { sessions, volumeTotal:Math.round(volTot), volumeAvg:_avg(volTot,sessions,0),
      timeTotalSec:Math.round(timeTot), timeAvgSec:_avg(timeTot,timeDays,0), timeDays },
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
  // Phase 71: activity metrics (sleep/steps/food/training) aggregated across the
  // whole From→To range — a single day is meaningless for these, so we don't
  // snapshot the endpoints. Body-comp rows above stay as the true A/B comparison.
  const R = _rangeActivityStats(a, b);
  const _n = v => (v == null ? '—' : v.toLocaleString());
  const _rng = (label, headline, sub, color) => `
    <div style="display:grid;grid-template-columns:88px 1fr;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;align-items:baseline;">
      <div style="color:var(--text3);">${label}</div>
      <div>
        <span style="font-family:'Archivo Black',sans-serif;color:${color || 'var(--text)'};">${headline}</span>
        ${sub ? `<span style="color:var(--text3);font-size:11px;margin-left:8px;">${sub}</span>` : ''}
      </div>
    </div>`;
  const _hm = sec => { const m = Math.round(sec/60), h = Math.floor(m/60), mm = m%60; return h ? `${h}h ${mm}m` : `${mm}m`; };
  const sleepRow = R.sleep.days ? _rng('Sleep', `${R.sleep.avg}h/night`, `${R.sleep.total}h total · ${R.sleep.days} nights`) : _rng('Sleep', '—', 'no data in range');
  const stepsRow = R.steps.days ? _rng('Steps', `${_n(R.steps.avg)}/day`, `${_n(R.steps.total)} total · ${R.steps.days} days`) : _rng('Steps', '—', 'no data in range');
  const eatenRow = R.eaten.days ? _rng('Eaten', `${_n(R.eaten.avg)} kcal/day`, `${_n(R.eaten.total)} total · ${R.eaten.days} days`) : _rng('Eaten', '—', 'no food logged');
  const tdeeRow  = R.tdee.days  ? _rng('Burned', `${_n(R.tdee.avg)} kcal/day`, `TDEE · ${R.tdee.days} days`) : _rng('Burned', '—', 'no Oura data');
  let balanceRow;
  if(R.balance.days && R.balance.avg != null){
    const deficit = R.balance.avg < 0;
    balanceRow = _rng('Balance', `${deficit ? '−' : '+'}${_n(Math.abs(R.balance.avg))} kcal/day`, `${deficit ? 'deficit' : 'surplus'} · ${R.balance.days} days`, deficit ? 'var(--green)' : 'var(--orange)');
  } else {
    balanceRow = _rng('Balance', '—', 'needs food + Oura');
  }
  const sessRow = _rng('Sessions', `${R.training.sessions}`, `strength workouts · ${R.spanDays} days`);
  const volRow  = R.training.sessions ? _rng('Volume', `${_n(R.training.volumeTotal)} kg·reps`, `${_n(R.training.volumeAvg)}/session`) : _rng('Volume', '—', 'no sessions');
  const timeRow = R.training.timeDays ? _rng('Time', `${_hm(R.training.timeTotalSec)} total`, `${Math.round(R.training.timeAvgSec/60)} min/session · ${R.training.timeDays} timed`) : _rng('Time', '—', 'not recorded');
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
    <div style="padding:12px 0 6px;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Over this range · ${R.spanDays} day${R.spanDays===1?'':'s'}</div>
    ${sleepRow}${stepsRow}${eatenRow}${tdeeRow}${balanceRow}${sessRow}${volRow}${timeRow}
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
// Strength-standard multipliers only. Exercise NAMES are NOT stored here — they
// derive from the shared source (FORGE_PROGRAMME.exerciseName) at render time, so
// there is exactly one place names live (fixes prior "Incline DB Press" drift).
const STRENGTH_STD = {
  // [novice, intermediate, advanced, elite] × bodyweight
  // Phase 42d: female multipliers from StrengthLevel female/male ratios
  // (~55-65% upper body, ~70-80% lower body)
  u1: { male:[0.50, 0.85, 1.20, 1.50], female:[0.30, 0.50, 0.70, 0.90] },
  u2: { male:[0.30, 0.55, 0.80, 1.05], female:[0.20, 0.35, 0.50, 0.65] },
  u3: { male:[0.50, 0.85, 1.20, 1.50], female:[0.30, 0.55, 0.75, 0.95] },
  u4: { male:[0.35, 0.55, 0.80, 1.05], female:[0.20, 0.35, 0.50, 0.65] },
  u5: { male:[0.60, 0.95, 1.30, 1.60], female:[0.40, 0.60, 0.80, 1.00] },
  u6: { male:[0.25, 0.40, 0.60, 0.80], female:[0.15, 0.25, 0.35, 0.50] },
  u7: { male:[0.30, 0.50, 0.70, 0.90], female:[0.20, 0.30, 0.45, 0.60] },
  u8: { male:[0.30, 0.50, 0.70, 0.90], female:[0.20, 0.30, 0.45, 0.60] },
  l1: { male:[1.20, 1.75, 2.50, 3.50], female:[0.85, 1.25, 1.80, 2.50] },
  l2: { male:[0.85, 1.50, 2.00, 2.50], female:[0.60, 1.05, 1.45, 1.80] },
  l3: { male:[0.50, 0.80, 1.10, 1.40], female:[0.35, 0.60, 0.80, 1.00] },
  l4: { male:[0.40, 0.70, 0.95, 1.20], female:[0.30, 0.50, 0.70, 0.90] },
  l5: { male:[1.00, 1.50, 2.25, 3.00], female:[0.80, 1.20, 1.80, 2.40] },
  l6: { male:[1.00, 1.50, 2.00, 2.75], female:[0.75, 1.10, 1.50, 2.05] },
};
// Resolve an exercise display name from the shared single source (falls back to id).
function _exDisplayName(exId){
  return (typeof FORGE_PROGRAMME !== 'undefined' && FORGE_PROGRAMME.exerciseName(exId)) || exId;
}

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
  // Phase 42d: female multipliers shipped; 'other' uses male tables (noted in footer)
  const sexKey = sex === 'female' ? 'female' : 'male';
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
    const cls = _classifyLift(est1RM, cw, lbm, ageFactor, exDef[sexKey] || exDef.male);
    if(!cls) return null;
    return { exId, name: _exDisplayName(exId), est1RM, ...cls };
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

// Phase 55: "Am I going up?" — the simplest possible strength-progress read.
// For each lift, compares your two most recent sessions. The score for a session
// is your best set's estimated 1RM (weight×reps, Brzycki) for weighted lifts, or
// your longest hold in seconds for timed holds — so adding weight OR reps both
// count as going up. Pure arithmetic, no AI.
function _liftScoreForSession(ex, dayLog){
  const sets=(dayLog&&dayLog[ex.id]&&dayLog[ex.id].sets)||[];
  const timed=isTimeBased(ex);
  let best=0, bestSet=null;
  for(const s of sets){
    if(timed){
      const sec=parseInt(s.seconds)||0;
      if(sec>best){best=sec;bestSet=s;}
    } else {
      const e=_brzycki1RM(s.kg,s.reps);
      if(e>best){best=e;bestSet=s;}
    }
  }
  if(!best)return null;
  return {score:best, set:bestSet, timed};
}

function _liftTrend(ex){
  const log=STATE.exLog||{};
  const dates=Object.keys(log).sort(); // oldest → newest (date keys, never _-prefixed)
  const sessions=[];
  for(const d of dates){
    const sc=_liftScoreForSession(ex,log[d]);
    if(sc)sessions.push({date:d,...sc});
  }
  if(sessions.length<2)return null;
  const latest=sessions[sessions.length-1];
  const prev=sessions[sessions.length-2];
  const pct=prev.score>0?Math.round(((latest.score-prev.score)/prev.score)*1000)/10:0;
  const dir=pct>1?'up':pct<-1?'down':'same';
  const label=latest.timed?fmtSec(latest.set.seconds):`${latest.set.kg}×${latest.set.reps}`;
  return {name:ex.name, dir, pct, label, latestDate:latest.date, prevDate:prev.date, n:sessions.length};
}

function renderStrengthTrend(){
  const trends=getAllExercises().filter(e=>!e.mobility).map(_liftTrend).filter(Boolean); // Phase 69: mobility drills aren't strength
  if(trends.length===0){
    return `<div class="card"><div style="text-align:center;color:var(--text3);padding:20px;font-size:13px;">Do the same lift twice and I'll show you whether you're going up.</div></div>`;
  }
  const order={up:0,same:1,down:2};
  trends.sort((a,b)=>order[a.dir]-order[b.dir]||b.pct-a.pct);
  const up=trends.filter(t=>t.dir==='up').length;
  const same=trends.filter(t=>t.dir==='same').length;
  const down=trends.filter(t=>t.dir==='down').length;
  const headline = up>0&&up>=down ? "You're going up 💪"
                 : down>up ? "Some lifts are slipping ⚠️"
                 : "Holding steady";
  const badge=(t)=>{
    if(t.dir==='up')  return `<span style="color:var(--green);font-weight:700;">▲ Up +${t.pct}%</span>`;
    if(t.dir==='down')return `<span style="color:var(--red);font-weight:700;">▼ Down ${Math.abs(t.pct)}%</span>`;
    return `<span style="color:var(--text3);font-weight:700;">— Same</span>`;
  };
  const rows=trends.map(t=>`<div class="list-row">
    <div class="row-left"><div class="row-label">${t.name}</div><div class="row-val">now ${t.label}</div></div>
    <div style="text-align:right;font-size:13px;">${badge(t)}</div>
  </div>`).join('');
  return `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
      <div style="font-family:'Archivo Black',sans-serif;font-size:16px;color:var(--text);">${headline}</div>
    </div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:12px;">${up} up · ${same} same · ${down} down — vs your last session of each lift</div>
    ${rows}
    <div style="font-size:10px;color:var(--text3);margin-top:10px;line-height:1.5;">"Up" counts heavier weight <em>and</em> more reps (via estimated 1-rep max). Compares your two most recent sessions of each lift.</div>
  </div>`;
}

// Owner-only diagnostic: surfaces the Leg Press +53kg sled migration result
// (written server-side to STATE.legPressSledFixV1 / legPressSledReport), so the
// outcome + exact counts are visible in-app instead of only in server logs.
function renderLegPressSledDiag(){
  if(typeof isOwner==='function' && !isOwner()) return '';
  const applied=STATE.legPressSledFixV1, report=STATE.legPressSledReport;
  if(applied && applied.applied){
    return `<div class="card" style="margin-bottom:10px;border-color:rgba(76,175,80,.4);background:rgba(76,175,80,.06);">
      <div style="font-size:11px;color:var(--green);font-weight:700;">✓ Leg Press sled fix applied (+${applied.sledKg}kg)</div>
      <div style="font-size:11px;color:var(--text2);margin-top:4px;line-height:1.6;">
        ${applied.setsChanged} set${applied.setsChanged===1?'':'s'} across ${applied.datesChanged} date${applied.datesChanged===1?'':'s'} ·
        max ${applied.maxBefore}→${applied.maxAfter}kg · min ${applied.minBefore}→${applied.minAfter}kg<br>
        <span style="color:var(--text3);">applied ${applied.appliedAt?String(applied.appliedAt).slice(0,10):''}</span>
      </div>
    </div>`;
  }
  if(report && report.applied===false){
    return `<div class="card" style="margin-bottom:10px;border-color:rgba(255,193,7,.4);background:rgba(255,193,7,.08);">
      <div style="font-size:11px;color:#ffc107;font-weight:700;">⚠️ Leg Press sled fix NOT applied</div>
      <div style="font-size:11px;color:var(--text2);margin-top:4px;line-height:1.6;">
        Reason: ${report.reason||'—'}<br>
        Found max ${report.maxBefore==null?'none':report.maxBefore+'kg'} (expected ${report.expectedMaxBefore}kg) across ${report.candidateSets} set${report.candidateSets===1?'':'s'}, ${report.candidateDates} date${report.candidateDates===1?'':'s'}.
      </div>
    </div>`;
  }
  return '';
}

function renderLiftingRecords(){
  const allEx=getAllExercises().filter(e=>!e.mobility); // Phase 69: mobility drills excluded from strength records
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

// Phase 59: unified backfill inside Day Detail — tap any past day and log the
// supplements / Mounjaro injection / skin-care / water you forgot, the same way
// meals already backfill. Rows write through the date-aware setters and re-render
// the day. Nothing renders for future dates.
function _ddBackfill(date,isFuture,isToday){
  if(isFuture)return '';
  const chk='<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="var(--bg)" stroke-width="2" fill="none"/></svg>';
  const suffix=isToday?'':' — backfill';
  const row=(on,label,sub,onclick,warn)=>`<div onclick="${onclick}" style="display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--border);cursor:pointer;min-height:42px;">
    <div style="width:20px;height:20px;border-radius:4px;border:2px solid ${on?'var(--lime)':(warn?'var(--orange)':'var(--border)')};background:${on?'var(--lime)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${on?chk:''}</div>
    <div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;color:${on?'var(--text)':'var(--text2)'};">${label}</div>${sub?`<div style="font-size:11px;color:var(--text3);">${sub}</div>`:''}</div>
  </div>`;
  let h='';

  // Supplements (modern state.supplements / supplementLog)
  const supps=(typeof getSupplements==='function')?getSupplements():[];
  if(supps.length){
    const slog=getSupplementLog(date);
    const dow=new Date(date+'T12:00:00').getDay();
    const due=supps.filter(s=>!(s.frequency==='weekly-wednesday'&&dow!==_injectionDow()));
    if(due.length){
      h+=`<div class="sec-label">Supplements${suffix}</div><div class="card" style="margin-bottom:10px;">
        <div style="font-size:11px;color:var(--text2);">Tap what you took on this day.</div>`;
      h+=due.map(s=>{const on=slog[s.id]===true;return row(on,`${_esc(s.name)}${s.critical&&!on?' <span style="color:var(--orange);font-size:11px;">⚠️</span>':''}`,_esc(s.dose||''),`ddToggleSupp('${date}','${_esc(s.id)}',${!on})`,s.critical);}).join('');
      h+=`</div>`;
    }
  }

  // Mounjaro — shown on the configured injection day for this date, or if already logged
  if(typeof _userOnMounjaro==='function'&&_userOnMounjaro()){
    const dow=new Date(date+'T12:00:00').getDay();
    const mlog=getMounjaroLog(date)||{};
    if(dow===_injectionDow()||mlog.injected){
      const injected=!!mlog.injected;
      const sel=new Set(mlog.sideEffects||[]);
      h+=`<div class="sec-label">Mounjaro${suffix}</div><div class="card" style="margin-bottom:10px;border-color:#ffc107;">`;
      h+=row(injected,'💉 Mounjaro injected',injected?(mlog.injectionTime?`Logged at ${mlog.injectionTime}`:'injected'):'tap to mark injected this day',`ddToggleMounjaro('${date}')`);
      if(injected){
        h+=`<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:10px 0 6px;">Side effects (tap all that apply)</div><div style="display:flex;flex-wrap:wrap;gap:6px;">`;
        h+=['Nausea','Acid reflux','Fatigue','Headache','Vomiting'].map(e=>`<button onclick="ddToggleMjSideEffect('${date}','${e}')" style="font-size:11px;padding:6px 12px;border-radius:14px;cursor:pointer;border:1px solid ${sel.has(e)?'var(--orange)':'var(--border)'};background:${sel.has(e)?'rgba(255,85,0,.15)':'transparent'};color:${sel.has(e)?'var(--orange)':'var(--text2)'};">${e}</button>`).join('');
        h+=`</div>`;
      }
      h+=`</div>`;
    }
  }

  // Skin care (owner-only) — the visible AM/PM items due that day
  if(typeof isOwner==='function'&&isOwner()&&typeof getSkinVisibleItems==='function'){
    const v=getSkinVisibleItems(date);const items=[...(v.am||[]),...(v.pm||[])];
    if(items.length){
      const klog=getSkinCareLog(date);
      h+=`<div class="sec-label">Skin care${suffix}</div><div class="card" style="margin-bottom:10px;">`;
      h+=items.map(it=>{const on=klog[it.itemId]===true;return row(on,`${_esc(it.product.name)} <span style="font-size:10px;color:var(--text3);text-transform:uppercase;">${_esc(it.slot)}</span>`,'',`ddToggleSkin('${date}','${_esc(it.itemId)}',${!on})`);}).join('');
      h+=`</div>`;
    }
  }

  // Water — additive backfill with quick amounts + undo
  if(typeof getWaterTotal==='function'){
    const total=getWaterTotal(date);
    h+=`<div class="sec-label">Water${suffix}</div><div class="card" style="margin-bottom:10px;">
      <div style="font-size:15px;font-weight:700;margin-bottom:8px;">${total} <span style="font-size:11px;color:var(--text3);">ml logged</span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${[250,500,750].map(ml=>`<button onclick="ddAddWater('${date}',${ml})" class="btn btn-ghost btn-sm" style="font-size:12px;">+${ml}</button>`).join('')}
        <button onclick="ddAddWaterCustom('${date}')" class="btn btn-ghost btn-sm" style="font-size:12px;">+ Custom</button>
        ${total>0?`<button onclick="ddUndoWater('${date}')" class="btn btn-ghost btn-sm" style="font-size:12px;color:var(--red);">Undo last</button>`:''}
      </div>
    </div>`;
  }

  return h;
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

  // Phase 88: energy check-in (backfill from the calendar) — not for future days.
  if(!isFuture)html+=renderEnergyCard(date,'energy-card-dd');

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
  // Phase 90: Oura HR overlaid on the logged session's own time window.
  const _shr=(typeof getSessionHR==='function')?getSessionHR(date):null;
  if(_shr&&_shr.avgHR!=null){
    const _drift=_shr.hrDrift!=null?` · drift ${_shr.hrDrift>0?'+':''}${_shr.hrDrift}`:'';
    const _kcal=_shr.calories!=null?` · ${_shr.calories} kcal`:'';
    html+=`<div class="card" style="margin-bottom:10px;">
      <div style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px;">Session heart rate <span style="color:var(--text3);">· Oura</span></div>
      <div style="display:flex;gap:14px;align-items:baseline;flex-wrap:wrap;">
        <div><span style="font-family:'Archivo Black',sans-serif;font-size:26px;color:var(--orange);">${_shr.avgHR}</span><span style="font-size:11px;color:var(--text2);"> avg bpm</span></div>
        <div style="font-size:13px;color:var(--text2);">max ${_shr.maxHR}${_shr.minHR!=null?` · low ${_shr.minHR}`:''}${_drift}${_kcal}</div>
      </div>
    </div>`;
  }
  // Phase 56: a made-up session logged on a calendar rest day still shows here.
  const _isMakeupDay=!sessionType&&!!(sessionLog._session&&(sessionLog._session.makeup||sessionLog._session.forDate));
  const _trainType=sessionType||(_isMakeupDay&&typeof _classifyLoggedSession==='function'?_classifyLoggedSession(sessionLog):null);
  if(!_trainType){
    const _sk=(typeof isSessionSkipped==='function')&&isSessionSkipped(date);
    html+=`<div class="card" style="margin-bottom:10px;text-align:center;color:var(--text2);font-size:13px;padding:14px;">${_sk?'↩️ Session skipped — calendar unchanged':'😴 Scheduled rest day'}</div>`;
  }else{
    const w=WORKOUTS[_trainType];
    const doneEx=w.exercises.filter(e=>sessionLog[e.id]?.done);
    if(doneEx.length===0){
      html+=`<div class="card" style="margin-bottom:10px;text-align:center;color:var(--orange);font-size:13px;padding:14px;">⚠️ ${w.name} scheduled but no session logged</div>`;
    }else{
      let totalVolume=0;
      const efMap={easy:' 😌',solid:' 💪',tough:' 🔥',hard:' 🔥',maybe:' 🤔'};
      const setRows=doneEx.map(ex=>{
        const timed=isTimeBased(ex);
        // Phase 90a: carries (Suitcase Carry) log per-side L/R seconds, not kg×reps
        // or a single `seconds` — handle them so they don't read "no sets logged".
        const carry=(typeof isCarry==='function')&&isCarry(ex);
        // Phase 92: KB Swing EMOM sets store rounds/roundsTarget/reps/load, not kg×reps.
        const emom=(sessionLog[ex.id].sets||[]).some(s=>s&&s.emom);
        const sets=(sessionLog[ex.id].sets||[]).filter(s=>emom?s.emom:carry?(s.leftSeconds!=null||s.rightSeconds!=null):timed?s.seconds:(s.kg||s.reps));
        const exVol=(timed||carry||emom)?0:sets.reduce((s,x)=>s+(parseFloat(x.kg)||0)*(parseInt(x.reps)||0),0);
        totalVolume+=exVol;
        const exEffort=sessionLog[ex.id].effort;
        const summary=emom
          ?sets.map(s=>`EMOM ${s.rounds||0}/${s.roundsTarget||0} · ${s.repsPerMin||12}×/min @ ${s.load||'?'}kg${s.outcome?' ('+s.outcome+')':''}`).join(', ')
          :carry
          ?sets.map(s=>`L ${s.leftSeconds||0}s · R ${s.rightSeconds||0}s`).join(', ')+(exEffort?efMap[exEffort]||'':'')
          :timed
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
        <div style="font-family:'Archivo Black',sans-serif;font-size:14px;color:var(--lime);margin-bottom:4px;">${w.name}${_isMakeupDay?` <span style="font-size:10px;color:var(--text2);">· MAKE-UP${sessionLog._session.forDate?` (was due ${fmtDate(sessionLog._session.forDate)})`:''}</span>`:''}</div>
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
  html+=`</div>`;

  // PLANNED MEALS — log/backfill from the meal plan on this date (same modal as Today)
  const plan=STATE.mealPlan;
  if(plan&&Array.isArray(plan.meals)&&plan.meals.length){
    html+=`<div class="sec-label">Plan — log / backfill</div>`;
    html+=`<div class="card" style="margin-bottom:10px;">`;
    html+=`<div style="font-size:11px;color:var(--text2);margin-bottom:8px;">Tap a meal to log it (or individual items) for this day.</div>`;
    plan.meals.forEach(m=>{
      const ings=getMealIngredients(m);
      const total=ings.length;
      const granular=foods.filter(f=>f.mealId===m.id);
      const legacy=foods.find(f=>f.name===m.name&&!f.mealId);
      let loggedCount=0,status='none';
      if(granular.length>0){
        const ln=new Set(granular.map(f=>f.name));
        loggedCount=ings.filter(ing=>ln.has(ing.name)).length;
        status=loggedCount===total?'full':loggedCount>0?'partial':'none';
      } else if(legacy){ status='full'; loggedCount=total; }
      const statusIcon=status==='full'?'✓':status==='partial'?'◐':'+ Log';
      const statusColor=status==='full'?'var(--text3)':status==='partial'?'var(--orange)':'var(--lime)';
      const dim=status==='full';
      html+=`<div onclick="openMealDetail('${m.id}','${date}')" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--border);cursor:pointer;${dim?'opacity:.6;':''}">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:baseline;gap:8px;">
            <div style="font-size:11px;color:var(--text3);font-weight:700;">${m.time||''}</div>
            <div style="font-weight:600;font-size:13px;${dim?'text-decoration:line-through;color:var(--text3);':''}">${m.name}</div>
          </div>
          <div style="font-size:11px;color:var(--text2);margin-top:3px;">${m.cals||0} kcal · ${m.protein||0}g P${status==='partial'?` · <span style="color:var(--orange);">${loggedCount}/${total} items logged</span>`:''}</div>
        </div>
        <div class="btn ${status==='none'?'btn-lime':'btn-ghost'} btn-sm" style="font-size:11px;padding:8px 14px;flex-shrink:0;${status==='partial'?'color:var(--orange);border-color:var(--orange);':''}">${statusIcon}</div>
      </div>`;
    });
    html+=`</div>`;
  }

  html+=`<button class="btn btn-ghost btn-sm" style="width:100%;margin-bottom:10px;font-size:12px;" onclick="openAddFoodForDate('${date}')">+ Add a one-off food (not on plan)</button>`;

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

  // SUPPLEMENTS · MOUNJARO · SKIN CARE · WATER — tap to log/backfill for this day
  html+=_ddBackfill(date,isFuture,isToday);

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
  // Phase 42b: band data lives in targets.js (BF_BANDS/BMI_BANDS/LBMI_BANDS),
  // shared with the onboarding recommendation engine. WYS keeps the same shape.
  bf: {
    male: function(age){ return BF_BANDS('male', age); },
    female: function(age){ return BF_BANDS('female', age); },
  },
  bmi: BMI_BANDS,
  lbmi: LBMI_BANDS, // Lean Body Mass Index = LBM / height_m²
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

// Phase 35: Skin Care — More page management + Today page checklist (owner-only)
const _SKIN_TYPE_LABEL={cleanser:'Cleanser',vitaminC:'Vitamin C','vitamin-c':'Vitamin C',retinol:'Retinol',serum:'Serum',moisturizer:'Moisturiser',spf:'SPF',exfoliant:'Exfoliant',other:'Other'};
const _SKIN_FREQ_LABEL={daily:'every day','every-2-days':'every 2 days','every-3-days':'every 3 days','every-4-days':'every 4 days',weekly:'weekly','5x-week':'5 nights/week'};
const _SKIN_DOW_ABBR=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
// Human label for a product's schedule — dynamic for specific-days (e.g. "Mon, Thu"),
// static map otherwise (now incl. 5x-week, which previously rendered its raw key).
function _skinFreqLabel(p){
  if(p&&p.frequency==='specific-days'){
    const days=Array.isArray(p.days)?p.days.slice().sort((a,b)=>((a+6)%7)-((b+6)%7)):[]; // Mon-first
    return days.length?days.map(d=>_SKIN_DOW_ABBR[d]).join(', '):'specific days';
  }
  return _SKIN_FREQ_LABEL[p&&p.frequency]||(p&&p.frequency)||'every day';
}

function renderSkinProductsList(){
  const products=getSkinProducts();
  if(products.length===0)return '<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px 0;">No products yet</div>';
  const phase=getSkinCare().phase||1;
  return products.map(p=>{
    const lastUsed=getSkinProductLastUsed(p.id);
    const comp=getSkinProductCompliance(p.id,30);
    const hist=getSkinProduct7Day(p.id);
    const compColor=comp==null?'var(--text3)':comp>=80?'var(--green)':comp>=50?'var(--orange)':'var(--red)';
    const phaseBadge=p.type==='retinol'?`<span style="font-size:9px;color:var(--lime);background:rgba(200,255,0,.12);border-radius:4px;padding:1px 6px;font-weight:700;letter-spacing:.5px;margin-left:6px;">PHASE ${phase}</span>`:'';
    const histSquares=hist.map(s=>{
      const bg=s==='done'?'var(--lime)':s==='missed'?'transparent':'transparent';
      const bd=s==='na'?'1px dashed var(--border)':'1px solid var(--border2)';
      return `<div style="width:11px;height:11px;border-radius:2px;background:${bg};border:${bd};"></div>`;
    }).join('');
    const lastStr=lastUsed?`last used ${new Date(lastUsed).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}`:'not used yet';
    return `<div onclick="openSkinProductEdit('${p.id}')" style="padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer;">
      <div style="display:flex;align-items:flex-start;gap:8px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--text);">${escapeHtml(p.name)}${p.concentration?` <span style="font-size:11px;color:var(--text3);font-weight:400;">${escapeHtml(p.concentration)}</span>`:''}${phaseBadge}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;">${_SKIN_TYPE_LABEL[p.type]||p.type} · ${p.slot==='both'?'AM+PM':p.slot.toUpperCase()} · ${_skinFreqLabel(p)}</div>
        </div>
        <div style="font-size:11px;color:var(--text3);">✏️</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">
        <div style="font-size:10px;color:var(--text3);">${lastStr}</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="display:flex;gap:3px;">${histSquares}</div>
          ${comp!=null?`<div style="font-size:10px;color:${compColor};font-weight:700;">${comp}%</div>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderSkinRoutineRules(){
  return `<div class="card" style="margin-bottom:10px;">
    <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px;">Routine Rules</div>
    <div style="font-size:11px;color:var(--text2);line-height:1.7;">
      <div style="margin-bottom:8px;"><strong style="color:var(--lime);">☀️ Morning</strong><br>Cleanser → CE Ferulic → Moisturiser → SPF</div>
      <div style="margin-bottom:8px;"><strong style="color:var(--lime);">🌙 Retinol nights</strong><br>Cleanser → Moisturiser → Retinol → Moisturiser → Cicaplast</div>
      <div style="margin-bottom:8px;"><strong style="color:var(--lime);">🌙 Non-retinol nights</strong><br>Cleanser → Alpha Arbutin → Niacinamide → Moisturiser</div>
      <div style="padding-top:6px;border-top:1px solid var(--border);"><strong style="color:var(--orange);">Never</strong><br>· Niacinamide + CE Ferulic same session<br>· Alpha Arbutin or Niacinamide on retinol nights<br>· Retinol or CE Ferulic without SPF next morning</div>
    </div>
  </div>`;
}

const _SKIN_IRRITATION_OPTS=[
  {v:'none',         emoji:'😊',label:'No reaction'},
  {v:'mild-dryness', emoji:'😐',label:'Mild dryness'},
  {v:'peeling',      emoji:'🟡',label:'Peeling'},
  {v:'redness',      emoji:'🟠',label:'Redness'},
  {v:'burning',      emoji:'🔴',label:'Burning'},
];

function renderSkinChecklist(){
  if(!isOwner())return '';
  const products=getSkinProducts();
  if(products.length===0)return '';
  const today=todayStr();
  const log=getSkinCareLog(today);
  const {am,pm,retinolNight}=getSkinVisibleItems(today);
  if(am.length===0&&pm.length===0)return '';
  const comp=getTodaySkinCompliance();
  const compColor=comp.pct>=100?'var(--green)':comp.pct>=75?'var(--orange)':'var(--red)';
  const chk='<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="var(--bg)" stroke-width="2" fill="none"/></svg>';
  // Label the retinoid night by the ACTUAL product (tretinoin/adapalene/retinol/…),
  // not a hardcoded "Retinol" — the type stays 'retinol' internally for all retinoids.
  const _retLabel=(()=>{
    const it=(pm||[]).find(x=>x.product&&x.product.type==='retinol');
    const nm=(it&&it.product&&it.product.name)||'';
    const m=nm.match(/tretinoin|adapalene|retinaldehyde|retinal|retinol|retinoid/i);
    return m?(m[0][0].toUpperCase()+m[0].slice(1).toLowerCase()):'Retinoid';
  })();

  const row=(it)=>{
    const p=it.product, on=log[it.itemId]===true;
    const spfTag=p.type==='spf'?'<span style="font-size:9px;color:var(--lime);font-weight:700;letter-spacing:1px;margin-left:6px;">LAST STEP</span>':'';
    return `<div onclick="toggleSkinItem('${it.itemId}')" style="display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--border);cursor:pointer;min-height:42px;">
      <div style="width:20px;height:20px;border-radius:4px;border:2px solid ${on?'var(--lime)':'var(--border)'};background:${on?'var(--lime)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${on?chk:''}</div>
      <div style="flex:1;font-size:13px;color:${on?'var(--text3)':'var(--text)'};${on?'text-decoration:line-through;':''}">${escapeHtml(p.name)}${p.concentration?` <span style="font-size:10px;color:var(--text3);">${escapeHtml(p.concentration)}</span>`:''}${spfTag}</div>
    </div>`;
  };

  // Rule 4 — Mounjaro Wednesday banner
  const mjBanner=isMounjaroDay()?`<div style="background:rgba(255,193,7,.12);border:1px solid rgba(255,193,7,.4);border-radius:8px;padding:9px 11px;margin-bottom:10px;font-size:11px;color:#ffc107;line-height:1.5;">💉 <strong>Mounjaro injection day</strong> — skin may be more sensitive. Use the sandwich method for ${_retLabel.toLowerCase()} if it's due tonight.</div>`:'';
  // Rule 1 — retinol night banner
  const retBanner=retinolNight?`<div style="background:rgba(200,255,0,.06);border:1px solid rgba(200,255,0,.25);border-radius:8px;padding:9px 11px;margin-bottom:10px;font-size:11px;color:var(--lime);line-height:1.5;">🌙 <strong>${_retLabel} night</strong> — Alpha Arbutin and Niacinamide skipped automatically.</div>`:'';
  // Rule 5 — CE Ferulic ticked, SPF not yet → reminder
  const ce=am.find(it=>it.product.type==='vitamin-c');
  const spf=am.find(it=>it.product.type==='spf');
  const spfReminder=(ce&&log[ce.itemId]===true&&spf&&log[spf.itemId]!==true)
    ?`<div style="font-size:11px;color:var(--orange);padding:6px 0 0;">⤷ Remember: SPF is your next and final morning step.</div>`:'';

  // Irritation selector (retinol nights) — 5-level
  const irrit=log._irritation;
  const retDone=retinolNight&&pm.some(it=>it.product.type==='retinol'&&log[it.itemId]===true);
  let irritBlock='';
  if(retinolNight){
    irritBlock=`<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px;">How does your skin feel after ${_retLabel.toLowerCase()}?</div>
      ${retDone&&!irrit?`<div style="font-size:11px;color:var(--orange);margin-bottom:6px;">👆 Please log this — it's what lets the coach ramp retinol safely.</div>`:''}
      ${_SKIN_IRRITATION_OPTS.map(o=>{
        const sel=irrit===o.v;
        return `<div onclick="setTodaySkinIrritation('${o.v}')" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;margin-bottom:5px;cursor:pointer;border:1px solid ${sel?'var(--lime)':'var(--border)'};background:${sel?'rgba(200,255,0,.08)':'var(--bg2)'};">
          <span style="font-size:16px;">${o.emoji}</span>
          <span style="flex:1;font-size:13px;color:${sel?'var(--text)':'var(--text2)'};font-weight:${sel?'600':'400'};">${o.label}</span>
          ${sel?'<span style="font-size:11px;color:var(--lime);">✓</span>':''}
        </div>`;
      }).join('')}
    </div>`;
  }

  return `
    <div class="sec-label">Skin Care</div>
    <div class="card" style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-size:11px;color:var(--text2);">Today's routine</div>
        <div style="font-size:12px;color:${compColor};font-weight:700;">${comp.done}/${comp.total} · ${comp.pct}%</div>
      </div>
      ${mjBanner}
      ${retBanner}
      ${am.length?`<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">☀️ AM</div>${am.map(row).join('')}${spfReminder}`:''}
      ${pm.length?`<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-top:${am.length?'14px':'0'};">🌙 PM</div>${pm.map(row).join('')}`:''}
      ${irritBlock}
    </div>`;
}

// Phase 37: Sunday weekly skin journal prompt
function renderSkinJournalPrompt(){
  if(new Date().getDay()!==0)return ''; // Sunday only
  if(getSkinWeeklyCheckIn(todayStr()))return ''; // already done this week
  return `<div class="card" style="margin-bottom:10px;border-color:var(--lime);background:linear-gradient(135deg,rgba(200,255,0,.05),transparent);cursor:pointer;" onclick="openSkinJournal()">
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="font-size:20px;">📝</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:600;color:var(--text);">Weekly skin check-in</div>
        <div style="font-size:11px;color:var(--text2);margin-top:2px;">Rate how your skin feels this week — takes 20 seconds.</div>
      </div>
      <div style="font-size:11px;color:var(--lime);">→</div>
    </div>
  </div>`;
}

// Phase 62: Tretinoin frequency ladder (was the retinol build-up journey).
const SKIN_PHASE_ROADMAP=[
  {n:1,label:'Every other night'},
  {n:2,label:'5 nights per week'},
  {n:3,label:'Every night'},
];
function renderRetinolJourney(){
  const sc=getSkinCare();
  const cur=sc.phase||1;
  const readiness=getSkinPhaseReadiness();
  const ret=getSkinProducts().find(p=>p.type==='retinol');
  const label=(ret&&ret.name)||'Tretinoin 0.025%';
  const weeksAt=readiness.weeksAtPhase!=null?readiness.weeksAtPhase:0;
  const curLabel=(SKIN_PHASE_ROADMAP.find(p=>p.n===cur)||{}).label||'';
  const steps=SKIN_PHASE_ROADMAP.map(ph=>{
    const done=ph.n<cur, isCur=ph.n===cur;
    const marker=done?'✓':isCur?'●':'○';
    const mColor=isCur?'var(--lime)':done?'var(--green)':'var(--text3)';
    const tag=isCur?' · current':ph.n===cur+1?' · next':'';
    return `<div style="display:flex;gap:10px;padding:7px 0;${isCur?'':done?'opacity:.7;':'opacity:.45;'}">
      <div style="color:${mColor};font-size:13px;width:18px;text-align:center;flex-shrink:0;">${marker}</div>
      <div style="flex:1;">
        <div style="font-size:12px;color:${isCur?'var(--lime)':'var(--text2)'};font-weight:${isCur?'700':'400'};">Step ${ph.n} — ${ph.label}${tag}</div>
      </div>
    </div>`;
  }).join('');
  let advance='';
  if(readiness.atMax){
    advance=`<div style="font-size:11px;color:var(--text3);margin-top:8px;line-height:1.5;">You're at nightly — the top of the ladder. Maintain and watch for irritation.</div>`;
  }else if(readiness.nextPhase){
    const nextLabel=(SKIN_PHASE_ROADMAP.find(p=>p.n===readiness.nextPhase)||{}).label||('Step '+readiness.nextPhase);
    if(readiness.ready){
      advance=`<div style="background:rgba(0,232,122,.1);border:1px solid var(--green);border-radius:8px;padding:10px;margin-top:10px;">
        <div style="font-size:12px;color:var(--green);font-weight:600;margin-bottom:8px;">✅ Ready to step up to ${nextLabel}</div>
        <button class="btn btn-lime btn-sm" style="width:100%;" onclick="advanceSkinPhase(${readiness.nextPhase})">Step up to ${nextLabel}</button>
      </div>`;
    }else{
      // Advisory gate — tretinoin is strong, so 4 weeks/step + a calm stretch is the
      // guidance, but you know your own skin: a manual step-up is always offered.
      advance=`<div style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-top:10px;">
        <div style="font-size:10px;color:var(--text3);line-height:1.5;margin-bottom:8px;">App suggests waiting until: ${escapeHtml(readiness.reason)}.<br>Tretinoin is stronger than retinol — 4 weeks per step with calm skin. If your skin's settled and you want to step up, you can do it manually.</div>
        <button class="btn btn-ghost btn-sm" style="width:100%;" onclick="advanceSkinPhase(${readiness.nextPhase})">Step up to ${nextLabel} anyway</button>
      </div>`;
    }
  }
  return `<div class="sec-label">${escapeHtml(label)}</div>
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:8px;">Prescription tretinoin · currently <strong style="color:var(--lime);">${curLabel.toLowerCase()}</strong> · ${weeksAt.toFixed(1)} weeks at this frequency</div>
      ${steps}
      ${advance}
    </div>`;
}

// Phase 73: read-only skincare WEEK VIEW — mirrors the training week strip
// (workout.js:renderWeekStrip) but with its OWN view-date state (must NOT reuse
// workout's viewDate, which drives the Train page). Pure display: every day's
// products come from getSkinVisibleItems(key), so retinol-night branching, mask
// suppression, and specific-day scheduling all come for free. No logging, no server.
let _skinViewDate=null;      // null = today
let _skinExpandedDay=null;   // date key of the expanded cell, or null
function getSkinViewDate(){return _skinViewDate||todayStr();}
function shiftSkinWeek(delta){
  const cur=new Date(getSkinViewDate()+'T12:00:00');
  cur.setDate(cur.getDate()+delta*7);
  const k=_ukDate(cur);
  _skinViewDate=(k===todayStr())?null:k;
  refreshSkinWeek();
}
function goToSkinToday(){_skinViewDate=null;refreshSkinWeek();}
function toggleSkinDayExpand(key){_skinExpandedDay=(_skinExpandedDay===key)?null:key;refreshSkinWeek();}
function refreshSkinWeek(){const el=document.getElementById('skin-week');if(el)el.innerHTML=renderSkinWeekStrip();}
function renderSkinWeekStrip(){
  if(!isOwner())return '';
  const products=getSkinProducts();
  if(!products.length)return '';
  // Monday–Sunday of the VIEWED week (anchor math copied verbatim from renderWeekStrip)
  const anchor=new Date(getSkinViewDate()+'T12:00:00');
  const aDow=anchor.getDay();
  const monOffset=aDow===0?-6:1-aDow;
  const monday=new Date(anchor);monday.setDate(anchor.getDate()+monOffset);
  const days=[];for(let i=0;i<7;i++){const d=new Date(monday);d.setDate(monday.getDate()+i);days.push(d);}
  const initials=['M','T','W','T','F','S','S'];
  const today=todayStr();
  const mondayKey=_ukDate(monday);
  const todayMon=(()=>{const t=new Date(today+'T12:00:00');const dow=t.getDay();t.setDate(t.getDate()+(dow===0?-6:1-dow));return _ukDate(t);})();
  const weekDelta=Math.round((new Date(mondayKey+'T12:00:00')-new Date(todayMon+'T12:00:00'))/(7*86400000));
  const weekLabel=weekDelta===0?'This week':weekDelta===1?'Next week':weekDelta===-1?'Last week':(weekDelta>0?`In ${weekDelta} weeks`:`${-weekDelta} weeks ago`);
  const rangeLabel=`${monday.toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – ${days[6].toLocaleDateString('en-GB',{day:'numeric',month:'short'})}`;
  const navBtn='background:var(--s2);border:1px solid var(--border);border-radius:8px;color:var(--text2);width:34px;height:34px;cursor:pointer;font-size:16px;';
  let html=`<div class="card" style="margin-bottom:10px;">
    <div class="sec-label" style="margin-bottom:8px;">Skin Care Week</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <button onclick="shiftSkinWeek(-1)" aria-label="Previous week" style="${navBtn}">‹</button>
      <div style="text-align:center;cursor:pointer;" onclick="goToSkinToday()">
        <div style="font-size:12px;font-weight:700;color:${weekDelta===0?'var(--lime)':'var(--text)'};">${weekLabel}</div>
        <div style="font-size:10px;color:var(--text3);">${rangeLabel}${weekDelta!==0?' · tap for today':''}</div>
      </div>
      <button onclick="shiftSkinWeek(1)" aria-label="Next week" style="${navBtn}">›</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;">`;
  days.forEach((d,i)=>{
    const key=_ukDate(d);
    const isToday=key===today;
    const isExpanded=key===_skinExpandedDay;
    const v=getSkinVisibleItems(key);
    const amN=(v.am||[]).length,pmN=(v.pm||[]).length;
    let bg='var(--s2)',color='var(--text2)',border='1px solid var(--border)';
    if(isToday){bg='rgba(200,255,0,.15)';color='var(--lime)';}
    if(isExpanded){border='1px solid var(--lime)';}
    const moon=v.retinolNight?'🌙':'';
    const load=(amN||pmN)?`${amN?`AM·${amN}`:''}${amN&&pmN?' ':''}${pmN?`PM·${pmN}`:''}`:'—';
    html+=`<button onclick="toggleSkinDayExpand('${key}')" style="background:${bg};border:${border};border-radius:10px;padding:6px 2px;color:${color};cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;font-family:'Archivo',sans-serif;">
      <div style="font-size:10px;font-weight:700;letter-spacing:.5px;">${initials[i]}</div>
      <div style="font-size:12px;font-weight:700;line-height:1;">${d.getDate()}</div>
      <div style="font-size:9px;height:11px;">${moon}</div>
      <div style="font-size:8px;color:${color};opacity:.85;line-height:1.2;text-align:center;">${load}</div>
    </button>`;
  });
  html+='</div>';
  // Expanded day detail (read-only) — reuses the exact conflict-engine output.
  if(_skinExpandedDay){
    const v=getSkinVisibleItems(_skinExpandedDay);
    const dObj=new Date(_skinExpandedDay+'T12:00:00');
    const dLabel=dObj.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'});
    const listOf=(items)=>items&&items.length
      ? items.map(it=>`<div style="font-size:12px;color:var(--text);padding:3px 0;">• ${escapeHtml(it.product.name||'')}${it.product.concentration?` <span style="font-size:10px;color:var(--text3);">${escapeHtml(it.product.concentration)}</span>`:''}</div>`).join('')
      : '<div style="font-size:11px;color:var(--text3);padding:3px 0;">Nothing scheduled</div>';
    html+=`<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">
      <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px;">${dLabel}${v.retinolNight?' · 🌙 retinoid night':''}</div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:2px;">☀️ AM</div>
      ${listOf(v.am)}
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:8px 0 2px;">🌙 PM</div>
      ${listOf(v.pm)}
      <div style="font-size:9px;color:var(--text3);margin-top:8px;">Read-only overview · tick products off on today's checklist below.</div>
    </div>`;
  }else{
    html+=`<div style="font-size:10px;color:var(--text3);text-align:center;margin-top:8px;">Tap a day to see its products</div>`;
  }
  html+='</div>';
  return html;
}

// Phase 37: full skin section on Today page (owner-only) — journal + checklist + journey
function renderSkinSection(){
  if(!isOwner())return '';
  if(getSkinProducts().length===0)return '';
  return `<div id="skin-week">${renderSkinWeekStrip()}</div>`+renderSkinJournalPrompt()+renderSkinChecklist()+renderRetinolJourney();
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
// Phase 55: Health Records timeline — DEXA scans + blood panels as one connected
// list (the coach reads the underlying numbers). Built from dexaScans + bloodMarkers
// (grouped by date) + healthRecords metadata.
function renderHealthRecords(){
  if(typeof isOwner==='function'&&!isOwner())return ''; // Phase 55: owner-only (admin)
  const dexa=(typeof getDexaScans==='function')?getDexaScans():[];
  const bm=(STATE.profile&&Array.isArray(STATE.profile.bloodMarkers))?STATE.profile.bloodMarkers:[];
  const recs=(typeof getHealthRecords==='function')?getHealthRecords():[];
  const rows=[];
  dexa.forEach(s=>{
    const meta=recs.find(r=>r.type==='dexa'&&r.date===s.date);
    rows.push({type:'dexa',date:s.date,title:'DEXA scan',
      summary:[s.bodyFatPct!=null?`${s.bodyFatPct}% BF`:'',s.leanMass!=null?`${s.leanMass}kg lean`:'',s.vatCm2!=null?`VAT ${s.vatCm2}cm²`:''].filter(Boolean).join(' · ')||'body composition',
      provider:(meta&&meta.provider)||s.provider||''});
  });
  Array.from(new Set(bm.map(m=>m.date).filter(Boolean))).forEach(d=>{
    const panel=bm.filter(m=>m.date===d);
    const flagged=panel.filter(m=>m.value!=null&&((m.refLow!=null&&Number(m.value)<m.refLow)||(m.refHigh!=null&&Number(m.value)>m.refHigh))).length;
    const meta=recs.find(r=>r.type==='bloods'&&r.date===d);
    rows.push({type:'bloods',date:d,title:'Blood test',summary:`${panel.length} markers${flagged?` · ${flagged} flagged`:''}`,provider:(meta&&meta.provider)||''});
  });
  rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const list=rows.length?rows.map(r=>{
    const icon=r.type==='dexa'?'🦴':'🩸';
    const dl=r.date?new Date(r.date+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—';
    return `<div class="card" style="margin-bottom:6px;padding:10px 12px;display:flex;align-items:center;gap:10px;">
      <div style="font-size:18px;">${icon}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;">${r.title} · ${dl}</div>
        <div style="font-size:10px;color:var(--text2);">${r.summary}${r.provider?` · ${r.provider}`:''}</div>
      </div>
    </div>`;
  }).join(''):`<div class="card" style="padding:14px;text-align:center;color:var(--text3);font-size:12px;">No records yet. Add a blood test or DEXA scan — the coach factors them into its advice.</div>`;
  return `<div class="sec-label" style="display:flex;justify-content:space-between;align-items:center;">
      <span>Health Records</span>
      <button class="btn btn-ghost btn-sm" onclick="openHealthAdd()">+ Add record</button>
    </div>
    <div style="font-size:10px;color:var(--text3);margin-bottom:8px;line-height:1.5;">Blood tests + DEXA scans as one connected picture the AI coach reads — bloods &amp; body composition are metabolically linked (HbA1c · ALT · visceral fat · lean mass).</div>
    ${list}`;
}

function renderBody(){
  const measLog=getMeasLog();
  const latest=getLatestMeas();
  const prev=measLog.length>=2?measLog[measLog.length-2]:null;
  const sleepLog=getSleepLog();
  const last7=getLast7();
  const swimLog=getSwimLog();
  const allSwims=Object.entries(swimLog).flatMap(([date,entries])=>entries.map(e=>({...e,date}))).sort((a,b)=>b.date.localeCompare(a.date));

  document.getElementById('page-body').innerHTML=`
    ${renderPhaseBanner(false)}
    <div class="pg-title" style="margin-bottom:14px;">Body & Health</div>

    ${renderWhereYouStand()}

    ${renderHealthRecords()}

    ${renderBoditraxCard()}

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
  const today=todayStr();
  const heatmap=supps.map(s=>{
    const cells=last7.map(d=>{
      if(typeof isSupplementDue==='function'&&!isSupplementDue(s,d))return 'na'; // not due that day
      const taken=(log[d]||{})[s.id]===true;
      if(taken)return 'taken';
      if(d===today)return 'pending';   // today, not yet ticked — neutral, not a miss
      return 'missed';
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
          ${row.cells.map(c=>{
            const st=c==='taken'?{bg:'var(--lime)',fg:'var(--bg)',ch:'&#10003;'}
              :c==='pending'?{bg:'transparent',fg:'var(--text3)',ch:'○',bd:'1px dashed var(--border2)'}
              :c==='na'?{bg:'transparent',fg:'var(--text3)',ch:'–',op:'.35'}
              :{bg:'rgba(255,59,59,.12)',fg:'var(--red)',ch:'·'}; // missed
            return `<div title="${c}" style="width:24px;height:24px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;background:${st.bg};color:${st.fg};${st.bd?`border:${st.bd};`:''}${st.op?`opacity:${st.op};`:''}">${st.ch}</div>`;
          }).join('')}
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
function renderCoachTransformationCard(){
  const p=getActive(); if(!p)return '';
  const start=STATE.trainingStartDate||p.startDate||STATE.planStartDate;
  if(!start)return '';
  const days=Math.max(1,Math.floor((Date.now()-new Date(start+'T12:00:00').getTime())/86400000));
  const cw=getCurrentWeight(),sw=p.startWeight||cw;
  const lost=Math.max(0,sw-cw);
  const lostPct=sw?((lost/sw)*100):0;
  const cbf=getCurrentBf(),sbf=p.startBF;
  const clbm=(typeof getCurrentLBM==='function')?getCurrentLBM():null;
  const slbm=p.startLBM;
  const fatLost=(sbf!=null&&cbf!=null)?(sw*(sbf/100)-cw*(cbf/100)):null;
  const gymStreak=(typeof calcStreak==='function')?calcStreak('gym'):0;
  const sessions=Object.keys(STATE.exLog||{}).filter(d=>{const l=STATE.exLog[d]||{};return Object.values(l).filter(e=>e&&e.done).length>=4;}).length;
  const phase=(typeof getSkinPhase==='function'&&isOwner())?getSkinPhase().n:null;
  const now=new Date();
  let daysToSun=(7-now.getDay())%7; if(daysToSun===0&&now.getHours()>=9)daysToSun=7;
  return `<div class="sec-label">Transformation</div>
  <div class="card hi" style="margin-bottom:10px;">
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px;">Day ${days} · since ${fmtDate(start)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
      <div><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">Weight lost</div><div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:var(--lime);">${lost.toFixed(1)}<span style="font-size:11px;">kg</span></div><div style="font-size:9px;color:var(--text3);">${lostPct.toFixed(1)}%</div></div>
      <div><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">Fat lost</div><div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:var(--orange);">${fatLost!=null?fatLost.toFixed(1):'—'}<span style="font-size:11px;">kg</span></div></div>
      <div><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">Lean mass</div><div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:var(--cyan);">${clbm!=null?clbm.toFixed(1):'—'}<span style="font-size:11px;">kg</span></div>${(slbm!=null&&clbm!=null)?`<div style="font-size:9px;color:${clbm>=slbm-0.5?'var(--green)':'var(--orange)'};">${clbm>=slbm?'+':''}${(clbm-slbm).toFixed(1)}kg</div>`:''}</div>
    </div>
    <div style="display:flex;gap:14px;margin-top:10px;font-size:11px;color:var(--text2);flex-wrap:wrap;">
      <div>🏋️ ${sessions} sessions</div>
      <div>🔥 ${gymStreak} day streak</div>
      ${phase?`<div>🧴 Tretinoin step ${phase}/3</div>`:''}
    </div>
    <div style="font-size:11px;color:var(--text3);margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">
      Next report in ${daysToSun===0?'today':daysToSun+' day'+(daysToSun===1?'':'s')} (Sunday 09:00) · <span onclick="generateCoachReportNow().then(()=>renderCoach())" style="color:var(--lime);cursor:pointer;font-weight:600;">Generate now</span>
    </div>
  </div>`;
}

// Phase 61: render the Weekly Report Card from the shared-engine result. Grades
// are the engine's letters (A/B/C/D/F); details self-explain each number.
function _rcClass(g){ const c=(g||'').toLowerCase(); return ['a','b','c','d','f'].includes(c)?c:''; }
function _renderReportCard(r){
  if(r.isBaseline){
    const bed=r.sleep.hasTiming?` · bed ${r.sleep.avgBedtimeClock}`:'';
    return `<div class="card" style="margin-bottom:10px;border-color:var(--blue);background:linear-gradient(135deg,rgba(61,155,255,.04),transparent);">
      <div style="font-family:'Archivo Black',sans-serif;font-size:15px;letter-spacing:-.3px;margin-bottom:6px;">Week 1 — Baseline</div>
      <div style="font-size:12px;color:var(--text2);line-height:1.6;">You're in your first week. Grades and weekly scores activate from Week 2 onwards once we have meaningful data to compare against.</div>
      <div style="margin-top:14px;font-size:11px;color:var(--text3);">Tracking so far · Steps ${r.steps.hit}/${r.steps.total} · Protein ${r.protein.hasTarget?r.protein.hit+'/'+r.protein.total:'no target'} · Training ${r.training.completed}/${r.training.scheduled} · Sleep ${r.sleep.avgHours!=null?r.sleep.avgHours+'h':'—'}${bed}</div>
    </div>`;
  }
  const oc=r.overall==null?'var(--text3)':(r.overall>=75?'var(--green)':r.overall>=60?'var(--lime)':'var(--orange)');
  const w=r.weights;
  const item=(icon,label,detail,g)=>`<div class="rc-item"><div class="rc-icon">${icon}</div><div class="rc-info"><div class="rc-label">${label}</div><div class="rc-detail">${detail}</div></div><div class="rc-score ${_rcClass(g)}">${g||'—'}</div></div>`;
  const stepsDetail=r.steps.hasTarget?`${r.steps.hit}/${r.steps.total} days hit ${r.steps.target.toLocaleString()} · ${r.steps.score}/100`:`No step target set`;
  const proteinDetail=r.protein.hasTarget?`${r.protein.hit}/${r.protein.total} full days ≥ ${r.protein.floor}g · ${r.protein.score}/100`:`No protein floor set — add one in Coach Settings`;
  const trainingDetail=r.training.scheduled?`${r.training.completed}/${r.training.scheduled} scheduled sessions completed`:`No sessions scheduled this week`;
  let sleepDetail;
  if(r.sleep.avgHours==null){sleepDetail=`No sleep logged`;}
  else{
    const bedPart=r.sleep.hasTiming?` · bedtime avg ${r.sleep.avgBedtimeClock}`:` · bedtime not tracked`;
    sleepDetail=`${r.sleep.avgHours}h avg${bedPart} · ${r.sleep.nightsLogged}/${r.sleep.total} nights logged`;
  }
  const wLine=r.weight.hasTrend
    ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:12px;color:var(--text2);">Weight trend this week: <strong style="color:${r.weight.perWeek<=0?'var(--green)':'var(--red)'};">≈ ${r.weight.perWeek>0?'+':''}${r.weight.perWeek.toFixed(1)}kg/wk</strong> <span style="color:var(--text3);">(7-day slope · ${r.weight.n} readings)</span></div>`
    : `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:12px;color:var(--text3);">Weight trend: need ≥2 weigh-ins this week</div>`;
  return `<div class="card hi" style="margin-bottom:10px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
      <div style="font-family:'Archivo Black',sans-serif;font-size:14px;">This Week's Score</div>
      <div style="font-family:'Archivo Black',sans-serif;font-size:36px;color:${oc};">${r.overall==null?'—':r.overall}</div>
    </div>
    <div style="font-size:10px;color:var(--text3);margin-bottom:12px;line-height:1.4;">Weighted: protein ${Math.round(w.protein*100)}% · training ${Math.round(w.training*100)}% · steps ${Math.round(w.steps*100)}% · sleep ${Math.round(w.sleep*100)}% · rolling 7 days (${r.window.from} → ${r.window.to})</div>
    ${item('👟','Steps',stepsDetail,r.grades.steps)}
    ${item('🥩','Protein',proteinDetail,r.grades.protein)}
    ${item('🏋️','Training',trainingDetail,r.grades.training)}
    <div class="rc-item" style="border:none;"><div class="rc-icon">😴</div><div class="rc-info"><div class="rc-label">Sleep</div><div class="rc-detail">${sleepDetail}</div></div><div class="rc-score ${_rcClass(r.grades.sleep)}">${r.grades.sleep||'—'}</div></div>
    ${wLine}
  </div>`;
}

function renderCoach(){
  const p=getActive(); if(!p)return;
  const report=getWeeklyReport();

  document.getElementById('page-coach').innerHTML=`
    <div class="pg-title" style="margin-bottom:14px;">Coach</div>

    ${renderCoachTransformationCard()}

    ${(typeof isOwner==='function'&&isOwner())?`
    <div class="sec-label">Chat with Forge</div>
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:11px;color:var(--text3);line-height:1.5;margin-bottom:10px;">Talk to your coach about your own data — training, food, sleep, recovery. It answers only from what Forge has logged, and remembers the conversation. Advice only; changes still come through your weekly report.</div>
      <div id="coach-chat-thread" style="max-height:360px;overflow-y:auto;margin-bottom:10px;">${typeof _coachChatThreadHTML==='function'?_coachChatThreadHTML():''}</div>
      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <input id="chat-input" type="text" maxlength="500" placeholder="e.g. How's my lean mass trending?" style="flex:1;padding:10px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px;" onkeydown="if(event.key==='Enter')sendCoachChat()">
        <button class="btn btn-lime btn-sm" style="padding:10px 16px;" onclick="sendCoachChat()">Send</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
        ${["How much of my loss was fat vs muscle?","Is my waist moving even when the scale isn't?","Am I getting stronger for my size?"].map(q=>`<button onclick="sendCoachChat('${q.replace(/'/g,"\\'")}')" style="font-size:10px;padding:6px 10px;background:transparent;border:1px solid var(--border);border-radius:12px;color:var(--text2);cursor:pointer;">${q}</button>`).join('')}
        ${((STATE.coachChat||[]).length)?`<span onclick="clearCoachChat()" style="margin-left:auto;font-size:10px;color:var(--text3);text-decoration:underline;cursor:pointer;">Clear chat</span>`:''}
      </div>
    </div>
    <div class="sec-label">🔬 Deep Analysis</div>
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:11px;color:var(--text3);line-height:1.5;margin-bottom:10px;">A one-off step-back review of everything Forge has on you — your <strong>3 biggest levers right now</strong> and <strong>one 2-week experiment</strong> to run. Uses your AI key (one Opus pass).</div>
      <button class="btn btn-lime btn-sm" style="width:100%;" id="deep-analysis-btn" onclick="runDeepAnalysis()">🔬 Run Deep Analysis</button>
      <div id="deep-analysis-result" style="margin-top:12px;">${STATE._deepAnalysis?`<div style="font-size:13px;line-height:1.6;color:var(--text);">${typeof formatCoachingReport==='function'?formatCoachingReport(STATE._deepAnalysis):STATE._deepAnalysis}</div>`:''}</div>
    </div>`:''}

    <div class="sec-label">Weekly Report Card</div>
    ${report?_renderReportCard(report):'<div class="card" style="text-align:center;color:var(--text3);font-size:13px;padding:20px;">Log data throughout the week to generate your report card</div>'}

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
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">${r.type==='monthly'?'<span style="color:var(--lime);font-weight:700;">🔭 Monthly Deep Dive</span>':'<span style="color:var(--text3);">'+escapeHtml(r.type||'')+'</span>'}<span style="color:var(--text3);"> · ${dt}</span></div>
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

const SUGGESTION_TYPE_META={
  macros:{label:'MACROS',color:'var(--purple)'},
  reminders:{label:'REMINDER',color:'var(--lime)'},
  note:{label:'NOTE',color:'var(--text3)'},
  skincare:{label:'SKIN CARE',color:'var(--cyan)'},
  'skincare-phase':{label:'RETINOL PHASE',color:'var(--cyan)'},
  'training-swap':{label:'TRAINING SWAP',color:'var(--blue)'},
  'injury-flag':{label:'INJURY',color:'var(--orange)'},
  'fasting-note':{label:'FASTING',color:'#ffc107'},
  'supplement-reminder':{label:'SUPPLEMENT',color:'var(--red)'},
  'nutrition-adjust':{label:'CALORIES · CARBS',color:'var(--lime)'},
};
function _suggestionDetail(s){
  const p=s.payload||{};
  if(s.type==='training-swap'&&(p.currentExercise||p.suggestedExercise)){
    return `<div style="font-size:11px;color:var(--blue);margin-bottom:6px;">${escapeHtml(p.currentExercise||'?')} → ${escapeHtml(p.suggestedExercise||'?')}</div>`;
  }
  if(s.type==='injury-flag'){
    const sev=(p.severity||'mild').toUpperCase();
    const col=p.severity==='severe'?'var(--red)':p.severity==='moderate'?'var(--orange)':'#ffc107';
    return `<div style="font-size:10px;margin-bottom:6px;"><span style="background:${col};color:#000;border-radius:4px;padding:2px 6px;font-weight:700;">${sev}</span> <span style="color:var(--text3);">${escapeHtml(p.action==='resolve'?'resolve':'flag')} · ${escapeHtml(p.exerciseId||'')}</span></div>`;
  }
  if(s.type==='supplement-reminder'&&p.missedDays!=null){
    return `<div style="font-size:11px;color:var(--red);margin-bottom:6px;">${escapeHtml(p.supplementName||'Supplement')} · missed ${p.missedDays} day${p.missedDays===1?'':'s'}</div>`;
  }
  if(s.type==='fasting-note'&&p.message){
    return `<div style="font-size:11px;color:#ffc107;margin-bottom:6px;">${escapeHtml(p.message)}</div>`;
  }
  return '';
}
function renderSuggestions(report){
  const sugs=(report.suggestions||[]).filter(s=>!s.dismissed);
  if(!sugs.length)return '';
  return `
    <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);">
      <div class="sec-label" style="margin-bottom:8px;">Suggestions</div>
      ${sugs.map(s=>{
        const meta=SUGGESTION_TYPE_META[s.type]||{label:String(s.type).toUpperCase(),color:'var(--text3)'};
        return `
          <div style="padding:12px;background:var(--bg2);border-radius:10px;margin-bottom:8px;border-left:3px solid ${meta.color};">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <div style="font-size:10px;letter-spacing:1px;color:${meta.color};font-weight:700;">${meta.label}</div>
              ${s.applied?'<div style="font-size:10px;color:var(--lime);">✓ APPLIED</div>':''}
            </div>
            <div style="font-size:13px;color:var(--text);font-weight:600;margin-bottom:4px;">${escapeHtml(s.label)}</div>
            ${_suggestionDetail(s)}
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
  } else if(wResult==='expired'){
    showToast('Withings sign-in expired — please reconnect');
    history.replaceState({},'','/');
  } else if(wResult==='error'||wResult==='invalid_state'||wResult==='missing_params'){
    showToast('Withings connection failed');
    history.replaceState({},'','/');
  }

  document.getElementById('page-more').innerHTML=`
    <div class="pg-title" style="margin-bottom:14px;">More</div>

    ${renderPhaseSection()}
    ${renderWaterToday()}

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

    ${_mOpen('coachkey','AI Coach (Anthropic key)')}
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px;">
        Paste your own Anthropic API key. Forge generates a weekly review every Sunday 9am using your key (Opus 4.7). Costs ~$0.25–$0.75 per report. Key is encrypted at rest.
      </div>
      <div id="coach-status" style="font-size:12px;color:var(--text3);margin-bottom:10px;">Loading…</div>
      <div id="coach-controls"></div>
    </div>${_mClose()}

    ${_mOpen('personal','Personal Profile (for the AI Coach)')}
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
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        <div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px;">Current Phase</div>
          <select id="pp-phase" style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;">
            <option value="">—</option>
            <option value="cut">Cut (lose fat)</option>
            <option value="recomp">Recomp (lose fat + maintain LBM)</option>
            <option value="lean-bulk">Lean bulk (gain LBM)</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px;">Stretch LBM (kg)</div>
          <input id="pp-stretchlbm" type="number" min="30" max="150" step="0.5" inputmode="decimal" placeholder="optional" style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;" />
        </div>
      </div>
      <button class="btn btn-lime btn-sm" style="width:100%;margin-bottom:8px;" onclick="savePersonalProfile()">Save Personal Profile</button>
      <button class="btn btn-ghost btn-sm" style="width:100%;font-size:11px;" onclick="askCoachMaxLBM()">🧠 Compute my realistic max LBM (AI)</button>
    </div>${_mClose()}

    ${isOwner()?`
    ${_mOpen('coachset','Coach Settings')}
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:6px;">
        The facts the AI Coach uses to tailor advice. Changes take effect on your <strong>next generated report or Ask Forge answer</strong>.
      </div>

      <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:10px 0;border-bottom:1px solid var(--border);">
        <input id="cs-proactive" type="checkbox" onchange="saveProactiveToggle()" style="width:18px;height:18px;margin-top:1px;" />
        <span style="flex:1;"><span style="font-size:13px;font-weight:600;">Proactive coach</span><br><span style="font-size:11px;color:var(--text3);line-height:1.5;">Pings you only when a pattern needs attention (low steps, poor sleep, a stall, muscle loss). Silent otherwise — at most one nudge a day.</span></span>
      </label>

      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:16px 0 4px;">Health Conditions</div>
      <div style="font-size:11px;color:var(--text3);line-height:1.5;margin-bottom:8px;">The coach applies a condition's rules only while it's listed here (cardiac → tighter BP target; fatty liver → no alcohol; smoker → slower skin recovery). Remove one and that rule stops next report.</div>
      <div id="hc-list" style="margin-bottom:8px;"></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
        <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:5px 10px;" onclick="addHealthConditionQuick('lvh','Left ventricular hypertrophy (LVH)','Cardiac — BP target &lt;130/80')">+ LVH</button>
        <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:5px 10px;" onclick="addHealthConditionQuick('fatty-liver','Fatty liver (elevated ALT)','Keep alcohol minimal')">+ Fatty liver</button>
        <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:5px 10px;" onclick="addHealthConditionQuick('smoker','Smoker','Skin more sensitive / slower recovery')">+ Smoker</button>
      </div>
      <div style="display:flex;gap:8px;">
        <input id="hc-free" type="text" maxlength="120" placeholder="Add another condition…" style="flex:1;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;" />
        <button class="btn btn-lime btn-sm" onclick="addHealthConditionFree()">Add</button>
      </div>

      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:18px 0 6px;border-top:1px solid var(--border);padding-top:14px;">Coach Targets</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:4px;">Protein floor (g/day)</div>
          <input id="ct-protfloor" type="number" min="100" max="350" inputmode="numeric" style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;" />
          <div style="font-size:10px;color:var(--text3);margin-top:3px;line-height:1.4;">Coach flags days below this.</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:4px;">Per-meal protein (g)</div>
          <input id="ct-permeal" type="number" min="20" max="80" inputmode="numeric" style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;" />
          <div style="font-size:10px;color:var(--text3);margin-top:3px;line-height:1.4;">Meals under this get an "add protein" nudge.</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:4px;">Daily step target</div>
          <input id="ct-steps" type="number" min="3000" max="40000" step="500" inputmode="numeric" style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;" />
          <div style="font-size:10px;color:var(--text3);margin-top:3px;line-height:1.4;">Report card counts days that hit this.</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:4px;">Water — rest day (L)</div>
          <input id="ct-water-rest" type="number" min="1" max="6" step="0.1" inputmode="decimal" style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;" />
          <div style="font-size:10px;color:var(--text3);margin-top:3px;line-height:1.4;">Flagged if 7-day avg is well under.</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:4px;">Water — gym day (L)</div>
          <input id="ct-water-gym" type="number" min="1" max="6" step="0.1" inputmode="decimal" style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;" />
          <div style="font-size:10px;color:var(--text3);margin-top:3px;line-height:1.4;">Target on training days.</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:4px;">Calorie deficit</div>
          <input id="ct-deficit" type="number" min="0" max="1200" inputmode="numeric" style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;" />
          <div style="font-size:10px;color:var(--text3);margin-top:3px;line-height:1.4;">Daily kcal below maintenance the targets aim for.</div>
        </div>
      </div>
      <button class="btn btn-lime btn-sm" style="width:100%;margin-top:10px;" onclick="saveCoachTargets()">Save Targets</button>

      ${(STATE.profile&&Array.isArray(STATE.profile.medications)&&STATE.profile.medications.some(m=>/mounjaro|tirzepatide|ozempic|wegovy|semaglutide|glp-?1/i.test((m&&m.name)||'')))?`
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:18px 0 6px;border-top:1px solid var(--border);padding-top:14px;">Medication Schedule</div>
      <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:4px;">GLP-1 injection day</div>
      <div style="display:flex;gap:8px;">
        <select id="cs-injday" style="flex:1;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;">
          ${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((d,i)=>`<option value="${i}">${d}</option>`).join('')}
        </select>
        <button class="btn btn-lime btn-sm" onclick="saveInjectionDay()">Save</button>
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:3px;line-height:1.4;">Coach expects lower appetite that day + the day after; injection reminder fires this day.</div>
      `:''}

      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:18px 0 6px;border-top:1px solid var(--border);padding-top:14px;">Eating Window</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <label style="font-size:12px;color:var(--text2);display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input id="cs-ew-enabled" type="checkbox" onchange="_toggleEwInputs()" style="width:16px;height:16px;" /> Fasting window on
        </label>
      </div>
      <div id="cs-ew-times" style="display:flex;gap:8px;align-items:center;">
        <select id="cs-ew-start" style="flex:1;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;">${[...Array(24)].map((_,h)=>`<option value="${h}">${String(h).padStart(2,'0')}:00</option>`).join('')}</select>
        <span style="color:var(--text3);font-size:12px;">to</span>
        <select id="cs-ew-end" style="flex:1;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;">${[...Array(25)].slice(1).map((_,i)=>{const h=i+1;return `<option value="${h}">${String(h).padStart(2,'0')}:00</option>`;}).join('')}</select>
        <button class="btn btn-lime btn-sm" onclick="saveEatingWindow()">Save</button>
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:3px;line-height:1.4;">Coach judges fasting compliance against this window.</div>

      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:18px 0 6px;border-top:1px solid var(--border);padding-top:14px;">Personal</div>
      <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:4px;">Date of birth</div>
      <div style="display:flex;gap:8px;">
        <input id="cs-dob" type="date" style="flex:1;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;" />
        <button class="btn btn-lime btn-sm" onclick="saveCoachDob()">Save</button>
      </div>
      <div id="cs-dob-note" style="font-size:10px;color:var(--orange);margin-top:3px;line-height:1.4;"></div>
      <div style="font-size:10px;color:var(--text3);margin-top:6px;line-height:1.4;">Ethnicity (used for the visceral-fat threshold — South Asian ≥7 vs ≥10) is set in <strong>Personal Profile</strong> above.</div>
    </div>${_mClose()}
    `:''}

    ${_mOpen('meds','Medications')}
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px;">
        Tell the AI Coach what you're on. GLP-1 meds (Mounjaro, Ozempic, Wegovy) change weight-loss interpretation significantly. Statins, metformin, insulin etc. also relevant.
      </div>
      <div id="meds-list" style="margin-bottom:10px;"></div>
      <button class="btn btn-lime btn-sm" style="width:100%;" onclick="openMedEdit(null)">+ Add Medication</button>
    </div>${_mClose()}

    ${_mOpen('bloodmarkers','Blood Markers')}
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px;">
        Latest blood panel results. The AI Coach uses out-of-range markers to ground its advice (e.g. HbA1c diabetic-range = low-GI is non-negotiable).
        <span id="blm-panel-date" style="display:block;font-size:11px;color:var(--text3);margin-top:6px;"></span>
      </div>
      <div id="blm-list" style="margin-bottom:10px;"></div>
      <button class="btn btn-lime btn-sm" style="width:100%;" onclick="openBloodMarkerEdit(null)">+ Add Marker</button>
    </div>${_mClose()}

    ${isOwner()?`
    ${_mOpen('skincare','Skin Care Routine')}
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px;">
        Your AM/PM products. The checklist on the Today page shows what's due each day. The AI Coach reviews your routine weekly — ramps retinol frequency as your skin builds tolerance. Each product shows its last-7-days history and 30-day compliance.
      </div>
      <div id="skin-products-list" style="margin-bottom:10px;">${renderSkinProductsList()}</div>
      <button class="btn btn-lime btn-sm" style="width:100%;" onclick="openSkinProductEdit(null)">+ Add Product</button>
    </div>
    ${renderSkinRoutineRules()}${_mClose()}
    `:''}

    ${renderStretchHistory()}

    ${_mOpen('aboutme','Tell Your Coach About You')}
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px;">
        Anything you want the AI Coach to always keep in mind — your goals in your own words, how you like to be coached, life circumstances, injuries or conditions, what "doing well" means to you. This is read on every chat and weekly review.
      </div>
      <textarea id="am-text" maxlength="2000" rows="5" oninput="var c=document.getElementById('am-count');if(c)c.textContent=this.value.length+' / 2000';" placeholder="e.g. I'm a 52yo South Asian male in a fat-loss cut, sleep 3–4am so my Oura recovery reads low — judge me on training feel not just readiness. Keep advice direct and numbers-first. Diabetic (HbA1c watch) so low-GI is non-negotiable." style="width:100%;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:12px;font-family:inherit;resize:vertical;margin-bottom:6px;">${_esc((STATE.profile&&STATE.profile.aboutMe&&STATE.profile.aboutMe.text)||'')}</textarea>
      <div style="display:flex;justify-content:flex-end;align-items:center;margin-bottom:12px;">
        <span id="am-count" style="font-size:10px;color:var(--text3);">${(((STATE.profile&&STATE.profile.aboutMe&&STATE.profile.aboutMe.text)||'').length)} / 2000</span>
      </div>
      <button class="btn btn-lime btn-sm" style="width:100%;" onclick="saveAboutMe()">Save</button>
    </div>${_mClose()}

    ${_mOpen('foodprefs','Food Preferences')}
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
    </div>${_mClose()}

    ${_mOpen('oura','Oura Ring')}
    <div class="card" style="margin-bottom:10px;">
      <div id="oura-status" style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px;">Loading...</div>
      <div id="oura-controls" style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-lime btn-sm" style="flex:1;min-width:140px;" onclick="connectOura()">Connect Oura</button>
      </div>
    </div>${_mClose()}

    ${_mOpen('withings','Withings Scale')}
    <div class="card" style="margin-bottom:10px;">
      <div id="withings-status" style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px;">Loading...</div>
      <div id="withings-controls" style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-lime btn-sm" style="flex:1;min-width:140px;" onclick="connectWithings()">Connect Withings</button>
      </div>
    </div>${_mClose()}

    ${_mOpen('supplements','Manage Supplements')}
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
    </div>${_mClose()}

    ${_mOpen('trainsched','Training Schedule')}
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px;">
        Your training start time for each day. Shown on the Today card. Leave a day blank if you don't normally train then.
      </div>
      <div id="session-times-grid"></div>
      <button class="btn btn-lime btn-sm" style="width:100%;margin-top:12px;" onclick="saveSessionTimesFromUI()">Save Schedule</button>
    </div>
    <div class="card" style="margin-bottom:10px;">
      <div style="font-weight:700;font-size:14px;margin-bottom:6px;">Deload weeks</div>
      <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px;">
        A deload is a planned lighter week (~60% load, 2 sets) to recover and come back stronger. Turn this on to auto-schedule one every few weeks — Forge drops the loads that week and keeps it out of your progress stats so it never reads as going backwards.
      </div>
      <div id="deload-config-ui"></div>
      <button class="btn btn-lime btn-sm" style="width:100%;margin-top:12px;" onclick="saveDeloadConfigFromUI()">Save Deload Cadence</button>
    </div>${_mClose()}

    ${_mOpen('injuries','Injury Management')}
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px;">
        Flag an injury and pick the lifts it affects. Forge automatically reduces those loads (mild −20%, moderate −35%, severe = hold &amp; see a doctor) and the AI Coach factors active injuries into its weekly review.
      </div>
      <div id="injury-list" style="margin-bottom:10px;"></div>
      <button class="btn btn-lime btn-sm" style="width:100%;" onclick="openInjuryEdit(null)">+ Flag an Injury</button>
    </div>${_mClose()}

    ${renderStageGuide()}

    ${_mOpen('profileset','Profile Settings')}
    <div class="card">
      <div style="font-size:13px;font-weight:600;margin-bottom:4px;">${p.name}</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:4px;">Start: ${p.startWeight}kg · Target: ${p.targetWeight}kg @ ${p.targetBF||15}% BF</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:6px;">Protein: ${p.proteinTarget}g · Fat: ${p.fatTarget||'auto'}g · Carbs: ${p.carbsTarget||'auto'}g</div>
      ${p.updatedBy==='cowork'?`<div style="font-size:10px;color:var(--lime);margin-bottom:12px;">Auto-managed by Cowork · last update ${p.updatedAt?new Date(p.updatedAt).toLocaleDateString('en-GB'):'—'}</div>`:`<div style="font-size:10px;color:var(--text3);margin-bottom:12px;">Manually set</div>`}
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-bottom:8px;" onclick="editProfile()">Edit Targets (override)</button>
      <button class="btn btn-red btn-sm" style="width:100%;margin-bottom:8px;background:rgba(255,59,59,.2);" onclick="confirmReset()">Reset All Data</button>
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-bottom:8px;" onclick="logOut()">Log Out</button>
      <button class="btn btn-red btn-sm" style="width:100%;" onclick="deleteAccount()">Delete Account</button>
    </div>${_mClose()}

    ${(typeof isOwner==='function'&&isOwner())?`
    ${_mOpen('admin','Forge Admin · Stats')}
    <div class="card" style="margin-bottom:10px;">
      <div id="admin-stats-body" style="font-size:12px;color:var(--text2);">Loading…</div>
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px;font-size:11px;" onclick="loadAdminStats()">↻ Refresh</button>
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px;font-size:11px;" onclick="adminResetPassword()">🔑 Reset a user's password</button>
      <button class="btn btn-lime btn-sm" style="width:100%;margin-top:8px;font-size:11px;" onclick="generateInviteLink()">✉️ Generate invite link</button>
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px;font-size:11px;" onclick="openContextPreview()">🔍 What my coach sees</button>
      <div id="invite-list" style="margin-top:10px;"></div>
    </div>${_mClose()}`:''}
  `;

  loadOuraStatus();
  loadWithingsStatus();
  loadCoachKeyStatus();
  loadFoodPrefsUI();
  loadPersonalProfileUI();
  if(typeof loadCoachSettingsUI==='function')loadCoachSettingsUI();
  renderMedsList();
  renderBloodMarkersList();
  loadSessionTimesUI();
  if(typeof loadDeloadConfigUI==='function')loadDeloadConfigUI();
  renderInjuryList();
  if(typeof isOwner==='function'&&isOwner()&&typeof loadAdminStats==='function')loadAdminStats();
  if(typeof isOwner==='function'&&isOwner()&&typeof loadInviteList==='function')loadInviteList();
}

// Phase 42e: Calorie Stage Guide computed from the user's own profile + the
// targets engine (replaces the hardcoded 114->87kg table). Cut phase only.
function renderStageGuide(){
  const p=STATE.profile||{};
  const personal=p.personal||{};
  if((personal.phase||'')!=='cut')return '';
  const start=p.startWeight,target=p.targetWeight;
  if(!start||!target||start<=target)return '';
  const lean=(typeof getCurrentLeanMass==='function')?getCurrentLeanMass():null;
  const step=Math.max(3,Math.round((start-target)/5));
  const rows=[];
  for(let w=start;w>target;w-=step){
    const t=calculateDynamicTargets(Math.round(w*10)/10,lean,'rest');
    if(t)rows.push({w:Math.round(w),c:t.calories.toLocaleString()+' kcal'});
  }
  rows.push({w:Math.round(target),c:'Maintenance'});
  if(rows.length<2)return '';
  return `<div class="sec-label">Calorie Stage Guide</div>
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;line-height:1.4;">Rest-day calorie target at each stage of your cut — computed from your profile, updates as targets change.</div>
      ${rows.map(s=>`
        <div class="list-row">
          <div style="font-weight:600;font-size:13px;">${s.w}kg</div>
          <div style="font-size:12px;color:var(--lime);font-weight:700;">${s.c}</div>
        </div>`).join('')}
    </div>`;
}

// ============================================================
// PHASE 39 — FOOD PAGE NUTRITION CARDS
// ============================================================
function _fmtHM(mins){
  mins=Math.max(0,Math.round(mins));
  const h=Math.floor(mins/60),m=mins%60;
  return h>0?`${h}h ${m}m`:`${m}m`;
}

function renderFastingCard(){
  if(typeof getWindowCountdown!=='function')return '';
  const c=getWindowCountdown();
  if(!c)return ''; // Phase 42e: eating window disabled for this user
  const ew=getEatingWindow();
  const _hh=h=>String(h).padStart(2,'0')+':00';
  const winLabel=_hh(ew.start)+'–'+_hh(ew.end);
  const winHours=ew.end-ew.start;
  const fastMins=(24-winHours)*60;
  let title,sub,detail,color,bg,pct;
  if(c.phase==='before'){
    title='Fasting Window Active';
    sub=`Window opens in ${_fmtHM(c.minsToOpen)}`;
    detail=`You have fasted for ${_fmtHM(c.fastedMins)}`;
    color='var(--blue)';bg='rgba(61,155,255,.06)';
    pct=Math.round((c.fastedMins/fastMins)*100);
  }else if(c.phase==='open'){
    title='Eating Window Open';
    sub=`Window closes in ${_fmtHM(c.minsToClose)}`;
    detail=`${_fmtHM(c.elapsedMins)} into your ${winHours}-hour window`;
    color='var(--green)';bg='rgba(0,232,122,.06)';
    pct=Math.round((c.elapsedMins/c.windowMins)*100);
  }else{
    title='Eating Window Closed';
    sub=`Fast resumed · next window opens ${_hh(ew.start)}`;
    detail=`${_fmtHM(c.fastedMins)} into tonight's fast`;
    color='var(--blue)';bg='rgba(61,155,255,.06)';
    pct=Math.round((c.fastedMins/fastMins)*100);
  }
  pct=Math.max(0,Math.min(100,pct));
  const log=getFastingLog(todayStr());
  const broken=log&&log.windowBroken;
  return `
    <div class="card" style="margin-bottom:10px;border-color:${color};background:linear-gradient(135deg,${bg},transparent);">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <div style="font-family:'Archivo Black',sans-serif;font-size:14px;color:${color};">${title}</div>
        <div style="font-size:11px;color:var(--text3);">${winLabel}</div>
      </div>
      <div style="font-size:13px;color:var(--text);margin:6px 0 2px;font-weight:600;">${sub}</div>
      <div style="font-size:11px;color:var(--text2);">${detail}</div>
      <div class="pb" style="margin-top:8px;"><div class="pb-fill" style="width:${pct}%;background:${color};"></div></div>
      ${broken?`<div style="font-size:11px;color:var(--orange);margin-top:8px;line-height:1.5;">⚠️ Food logged outside your window (${winLabel}). Fasting streak affected.</div>`:''}
    </div>`;
}

function renderMounjaroBanner(){
  if(typeof isMounjaroDay!=='function')return '';
  if(isMounjaroDay()){
    return `<div class="card" style="margin-bottom:10px;border-color:#ffc107;background:rgba(255,193,7,.06);">
      <div style="font-size:13px;color:#ffc107;font-weight:700;margin-bottom:4px;">💉 Mounjaro injection day</div>
      <div style="font-size:12px;color:var(--text2);line-height:1.6;">Minimum targets active — protein is the priority. Inject after meal 2 (~3pm). Calories 1,600–1,900 · protein 150g floor. Calories are secondary today.</div>
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px;font-size:11px;" onclick="openNauseaMode()">🤢 Nausea Mode — priority foods</button>
    </div>`;
  }
  if(isPostInjectionDay()){
    return `<div class="card" style="margin-bottom:10px;border-color:var(--orange);background:rgba(255,85,0,.05);">
      <div style="font-size:13px;color:var(--orange);font-weight:700;margin-bottom:4px;">Post-injection day</div>
      <div style="font-size:12px;color:var(--text2);line-height:1.6;">Appetite likely suppressed — eat by the clock, not by hunger. Minimum 150g protein today regardless of appetite. Calories 1,600–1,900.</div>
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px;font-size:11px;" onclick="openNauseaMode()">🤢 Nausea Mode — priority foods</button>
    </div>`;
  }
  return '';
}

function renderProteinDistribution(){
  if(typeof getProteinDistribution!=='function')return '';
  const rows=getProteinDistribution().slice(0,3);
  if(!rows.length)return '';
  const score=getProteinDistributionScore();
  return `<div class="card" style="margin-bottom:10px;">
    <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px;">Protein Distribution Today</div>
    <div style="display:flex;gap:8px;margin-bottom:8px;">
      ${rows.map(r=>{
        const st=getMealProteinStatus(r.protein);
        const thr=(typeof PROTEIN_THRESHOLD!=='undefined')?PROTEIN_THRESHOLD:40;
        const pct=Math.max(0,Math.min(100,Math.round((r.protein/thr)*100)));
        const shortName=((r.name||'').split(':')[0].split('—')[0].split('(')[0].trim())||r.name;
        return `<div style="flex:1;min-width:0;text-align:center;">
          <div style="height:8px;border-radius:4px;background:var(--bg2);overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${st.color};border-radius:4px;"></div>
          </div>
          <div style="font-size:10px;color:var(--text3);margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.name}">${shortName}</div>
          <div style="font-size:12px;font-weight:700;color:${st.color};">${r.protein}g</div>
        </div>`;
      }).join('')}
    </div>
    ${score?`<div style="font-size:11px;color:var(--text2);">${score.label} · ${score.hits}/${score.total} meals ≥40g</div>`:''}
  </div>`;
}

// ============================================================
// PHASE 41i — CARDIO CARD on Train page (rest days only)
// ============================================================
function renderCardioCard(date){
  date=date||todayStr();
  if(typeof isRestDay==='function'&&!isRestDay(date))return ''; // only on rest days
  const entry=getCardioLog(date);
  const comp=getCardioCompliance(7);
  const target=CARDIO_TARGET_PER_WEEK;
  const weeklyChip=`<span style="font-size:11px;color:${comp.sessions>=target?'var(--green)':comp.sessions>=2?'var(--lime)':'var(--text2)'};font-weight:600;">${comp.sessions}/${target} this week</span>`;
  if(entry&&entry.duration){
    const effortEmoji={easy:'😌',moderate:'💪',hard:'🔥'}[entry.perceivedEffort]||'';
    return `<div class="sec-label" style="margin-top:18px;display:flex;justify-content:space-between;align-items:center;"><span>Zone-2 Cardio</span>${weeklyChip}</div>
      <div class="card" style="margin-bottom:10px;border-color:var(--green);background:linear-gradient(135deg,rgba(0,232,122,.05),transparent);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div style="flex:1;min-width:0;">
            <div style="font-family:'Archivo Black',sans-serif;font-size:14px;color:var(--green);">✅ Logged · ${entry.duration} min ${effortEmoji}</div>
            <div style="font-size:11px;color:var(--text2);margin-top:3px;">
              ${entry.avgHr?`Avg HR ${entry.avgHr} bpm · `:''}${entry.type||'zone-2'}${entry.notes?` · ${_esc(entry.notes)}`:''}
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" style="font-size:11px;flex-shrink:0;" onclick="openCardioLog('${date}')">Edit</button>
        </div>
      </div>`;
  }
  return `<div class="sec-label" style="margin-top:18px;display:flex;justify-content:space-between;align-items:center;"><span>Zone-2 Cardio</span>${weeklyChip}</div>
    <div class="card" style="margin-bottom:10px;border-color:var(--cyan);background:linear-gradient(135deg,rgba(0,210,255,.05),transparent);">
      <div style="font-family:'Archivo Black',sans-serif;font-size:14px;color:var(--cyan);">🚶 Rest-day cardio</div>
      <div style="font-size:12px;color:var(--text2);margin:4px 0 10px;line-height:1.5;">30 min incline treadmill (5 km/h · 6–8% incline · HR 110–125 bpm). Builds VO₂ max + protective for LVH, ALT, CRP.</div>
      <button class="btn btn-lime btn-sm" style="width:100%;" onclick="openCardioLog('${date}')">Log session</button>
    </div>`;
}

// ============================================================
// PHASE 41o — DEXA SCAN CARD (Track page)
// ============================================================
// ============================================================
// PHASE 58 — BODITRAX CARD (Body page). Trusted BIA; source:'boditrax'.
// ============================================================
function renderBoditraxCard(){
  const scans=(typeof getBoditraxLog==='function')?getBoditraxLog():[];
  const latest=(typeof getLatestBoditrax==='function')?getLatestBoditrax():null;
  if(!latest){
    return `<div class="card" style="margin-bottom:10px;">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px;">Boditrax</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:10px;line-height:1.5;">Log a Boditrax scan — your most trusted BIA. It ranks above Withings (and below DEXA) so it anchors your lean-mass trend instead of noisy daily readings.</div>
      <button class="btn btn-lime btn-sm" style="width:100%;" onclick="openBoditraxEdit()">+ Add first scan</button>
    </div>`;
  }
  const dateStr=fmtDate(latest.date)+(latest.time?` · ${_esc(latest.time)}`:'');
  // Reliability-weighted lean trend across Boditrax scans (fat-free mass).
  const leanOf=s=>s.ffm!=null?s.ffm:(s.weight!=null&&s.fat!=null?Math.round((s.weight-s.fat)*100)/100:null);
  const sorted=[...scans].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const withLean=sorted.filter(s=>leanOf(s)!=null);
  let trendLine='';
  if(withLean.length>=2){
    const f=withLean[0],l=withLean[withLean.length-1];
    const d=(leanOf(l)-leanOf(f));
    const days=Math.max(1,Math.round((new Date(l.date+'T12:00:00')-new Date(f.date+'T12:00:00'))/86400000));
    const perWk=Math.round((d/(days/7))*100)/100;
    const col=d>=-0.1?'var(--green)':d>-0.7?'#ffc107':'var(--orange)';
    trendLine=`<div style="font-size:11px;color:var(--text2);padding-top:8px;margin-top:8px;border-top:1px solid var(--border);">
      Lean (fat-free mass): <strong style="color:var(--text);">${leanOf(f)}kg</strong> → <strong style="color:${col};">${leanOf(l)}kg</strong>
      <span style="color:${col};font-weight:600;">(${d>=0?'+':''}${Math.round(d*10)/10}kg · ${perWk>=0?'+':''}${perWk}kg/wk)</span>
      <span style="color:var(--text3);"> over ${withLean.length} scans</span>
    </div>`;
  }
  const cell=(label,val,unit,color)=>`<div><div style="font-size:9px;color:${color||'var(--text3)'};text-transform:uppercase;letter-spacing:.5px;font-weight:700;">${label}</div><div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:var(--text);">${val!=null?val:'—'}${val!=null&&unit?`<span style="font-size:10px;color:var(--text3);">${unit}</span>`:''}</div></div>`;
  return `<div class="card" style="margin-bottom:10px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
      <div>
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Boditrax · Body composition</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">${dateStr}</div>
      </div>
      ${latest.boditraxScore!=null?`<div style="text-align:right;"><div style="font-size:10px;color:var(--text3);">SCORE</div><div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:var(--lime);">${latest.boditraxScore}</div></div>`:''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:8px;">
      ${cell('Weight',latest.weight,'kg')}
      ${cell('Muscle',latest.muscle,'kg','var(--cyan)')}
      ${cell('Fat',latest.fat,'kg','var(--orange)')}
      ${cell('Visceral',latest.visceral,'','var(--red)')}
    </div>
    ${(latest.ffm!=null||latest.water!=null||latest.bmr!=null||latest.metabolicAge!=null||latest.proteinPct!=null)?`<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:var(--text2);padding:4px 0;">
      ${latest.ffm!=null?`<span><strong style="color:var(--text);">FFM</strong> ${latest.ffm}kg</span>`:''}
      ${latest.water!=null?`<span><strong style="color:var(--text);">Water</strong> ${latest.water}kg</span>`:''}
      ${latest.bone!=null?`<span><strong style="color:var(--text);">Bone</strong> ${latest.bone}kg</span>`:''}
      ${latest.bmr!=null?`<span><strong style="color:var(--text);">BMR</strong> ${latest.bmr}</span>`:''}
      ${latest.metabolicAge!=null?`<span><strong style="color:var(--text);">Met age</strong> ${latest.metabolicAge}</span>`:''}
      ${latest.proteinPct!=null?`<span><strong style="color:var(--text);">Protein</strong> ${latest.proteinPct}%</span>`:''}
    </div>`:''}
    ${trendLine}
    <div style="display:flex;gap:8px;margin-top:10px;">
      <button class="btn btn-lime btn-sm" style="flex:1;" onclick="openBoditraxEdit()">+ Add scan</button>
      <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="openBoditraxEdit('${_esc(latest.id)}')">Edit latest</button>
      ${scans.length>1?`<button class="btn btn-ghost btn-sm" style="flex:1;" onclick="showBoditraxHistory()">History (${scans.length})</button>`:''}
    </div>
  </div>`;
}

function renderDexaCard(){
  const latest=(typeof getLatestDexaScan==='function')?getLatestDexaScan():null;
  if(!latest){
    return `<div class="card" style="margin-bottom:10px;">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px;">DEXA Scan</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:10px;line-height:1.5;">Gold-standard body composition — measures fat %, lean mass, visceral fat in cm², bone density. Re-scan every 3 months for true recomp tracking.</div>
      <button class="btn btn-lime btn-sm" style="width:100%;" onclick="openDexaEdit()">+ Add first scan</button>
    </div>`;
  }
  const vatBand=getDexaVATBand(latest.vatCm2);
  const tBand=getDexaTScoreBand(latest.tScore);
  const dateStr=fmtDate(latest.date);
  // Next-scan target (3 months out)
  const nextDate=new Date(latest.date+'T12:00:00');
  nextDate.setMonth(nextDate.getMonth()+3);
  const nextStr=nextDate.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  return `<div class="card" style="margin-bottom:10px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
      <div>
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">DEXA · Body composition</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">${dateStr}${latest.provider?` · ${_esc(latest.provider)}`:''}</div>
      </div>
      ${latest.longevityIndex!=null?`<div style="text-align:right;"><div style="font-size:10px;color:var(--text3);">LONGEVITY</div><div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:#ffc107;">${latest.longevityIndex}</div></div>`:''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;">
      <div><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;font-weight:700;">Body fat</div><div style="font-family:'Archivo Black',sans-serif;font-size:20px;color:var(--lime);">${latest.bodyFatPct!=null?latest.bodyFatPct.toFixed(1)+'%':'—'}</div></div>
      <div><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;font-weight:700;">Lean</div><div style="font-family:'Archivo Black',sans-serif;font-size:20px;color:var(--cyan);">${latest.leanMass!=null?latest.leanMass.toFixed(1):'—'}<span style="font-size:11px;color:var(--text3);">kg</span></div></div>
      <div><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;font-weight:700;">Fat mass</div><div style="font-family:'Archivo Black',sans-serif;font-size:20px;color:var(--orange);">${latest.fatMass!=null?latest.fatMass.toFixed(1):'—'}<span style="font-size:11px;color:var(--text3);">kg</span></div></div>
    </div>
    ${latest.vatCm2!=null?`<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--bg2);border-radius:8px;margin-bottom:8px;">
      <div>
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Visceral fat</div>
        <div style="font-family:'Archivo Black',sans-serif;font-size:24px;color:${vatBand?vatBand.color:'var(--text)'};">${latest.vatCm2} cm²</div>
      </div>
      <div style="text-align:right;">
        ${vatBand?`<span style="background:${vatBand.color};color:#000;font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:.5px;">${vatBand.label}</span>`:''}
        <div style="font-size:10px;color:var(--text3);margin-top:4px;">target &lt;100 cm²</div>
      </div>
    </div>`:''}
    ${latest.tScore!=null?`<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--bg2);border-radius:8px;margin-bottom:8px;">
      <div>
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Bone density</div>
        <div style="font-family:'Archivo Black',sans-serif;font-size:24px;color:${tBand?tBand.color:'var(--text)'};">T ${latest.tScore.toFixed(1)}${latest.zScore!=null?` · Z ${latest.zScore.toFixed(1)}`:''}</div>
      </div>
      <div style="text-align:right;">
        ${tBand?`<span style="background:${tBand.color};color:#000;font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:.5px;">${tBand.label}</span>`:''}
        ${latest.bmdTotal!=null?`<div style="font-size:10px;color:var(--text3);margin-top:4px;">${latest.bmdTotal.toFixed(3)} g/cm²</div>`:''}
      </div>
    </div>`:''}
    ${latest.almi!=null||latest.lmi!=null||latest.fmi!=null?`<div style="font-size:11px;color:var(--text2);padding:6px 0;display:flex;gap:14px;flex-wrap:wrap;">
      ${latest.lmi!=null?`<span><strong style="color:var(--text);">LMI</strong> ${latest.lmi.toFixed(1)}</span>`:''}
      ${latest.almi!=null?`<span><strong style="color:var(--text);">ALMI</strong> ${latest.almi.toFixed(1)} ${latest.almi>=7.26?'<span style="color:var(--green);">✓</span>':'<span style="color:var(--red);">⚠</span>'}</span>`:''}
      ${latest.fmi!=null?`<span><strong style="color:var(--text);">FMI</strong> ${latest.fmi.toFixed(1)}</span>`:''}
      ${latest.muscleSymmetryPct!=null?`<span><strong style="color:var(--text);">L/R imbalance</strong> ${latest.muscleSymmetryPct.toFixed(1)}%</span>`:''}
    </div>`:''}
    <div style="font-size:11px;color:var(--text3);margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">Next scan recommended: <strong style="color:var(--text2);">${nextStr}</strong> (3 months)</div>
    <div style="display:flex;gap:8px;margin-top:10px;">
      <button class="btn btn-lime btn-sm" style="flex:1;" onclick="openDexaEdit()">+ Add scan</button>
      ${getDexaScans().length>1?`<button class="btn btn-ghost btn-sm" style="flex:1;" onclick="showDexaHistory()">History (${getDexaScans().length})</button>`:''}
    </div>
  </div>`;
}

// ============================================================
// PHASE 41l — BLOOD PRESSURE CARD (Track page)
// ============================================================
function renderBPCard(){
  const current=(typeof getCurrentBP==='function')?getCurrentBP():null;
  const avg7=(typeof getBPAverage==='function')?getBPAverage(7):null;
  const trend=(typeof getBPTrend==='function')?getBPTrend():null;
  // Empty state — first time
  if(!current){
    return `<div class="card" style="margin-bottom:10px;">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px;">Blood Pressure</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:10px;line-height:1.5;">Track your BP — LVH context means &lt;130/80 is your target. Best taken 5 min after sitting, pre-coffee, same arm + position each time.</div>
      <button class="btn btn-lime btn-sm" style="width:100%;" onclick="openBPEdit()">+ Add first reading</button>
    </div>`;
  }
  const band=getBPBand(current.systolic,current.diastolic);
  const sparkArr=getBPLog().slice(-14).map(r=>r.systolic).filter(v=>v);
  const sparkSvg=(sparkArr.length>=2&&typeof spark==='function')?spark(sparkArr,band?band.color:'var(--text)'):'';
  // Time since last reading
  const last=current.loggedAt?new Date(current.loggedAt):null;
  let agoStr='';
  if(last){
    const mins=Math.floor((Date.now()-last.getTime())/60000);
    if(mins<60)agoStr=mins+' min ago';
    else if(mins<24*60)agoStr=Math.floor(mins/60)+'h ago';
    else agoStr=Math.floor(mins/(24*60))+'d ago';
  }
  const trendArrow=trend?(trend.direction==='down'?'↓':trend.direction==='up'?'↑':'→'):'';
  const trendColor=trend?(trend.direction==='down'?'var(--green)':trend.direction==='up'?'var(--orange)':'var(--text3)'):'var(--text3)';
  return `<div class="card" style="margin-bottom:10px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
      <div>
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Blood Pressure</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">Last reading ${agoStr}</div>
      </div>
      <div style="text-align:right;">${sparkSvg}</div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
      <div style="font-family:'Archivo Black',sans-serif;font-size:36px;color:${band?band.color:'var(--text)'};letter-spacing:-1px;">${current.systolic}<span style="font-size:18px;color:var(--text3);"> / </span>${current.diastolic}<span style="font-size:14px;color:var(--text2);"> mmHg</span></div>
      ${current.pulse?`<div style="text-align:right;"><div style="font-size:11px;color:var(--text3);">pulse</div><div style="font-family:'Archivo Black',sans-serif;font-size:20px;color:var(--text);">${current.pulse}</div></div>`:''}
    </div>
    ${band?`<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <span style="background:${band.color};color:#000;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:.5px;">${band.label}</span>
      <span style="font-size:11px;color:var(--text3);">target &lt;${BP_TARGET_SYS}/${BP_TARGET_DIA} (LVH)</span>
    </div>`:''}
    ${avg7?`<div style="font-size:11px;color:var(--text2);padding-top:8px;border-top:1px solid var(--border);">
      <strong style="color:var(--text);">7-day avg:</strong> ${avg7.systolic} / ${avg7.diastolic}${avg7.pulse?` · pulse ${avg7.pulse}`:''} <span style="color:var(--text3);">(n=${avg7.n})</span>
      ${trend?`<span style="color:${trendColor};font-weight:600;margin-left:6px;">${trendArrow} ${Math.abs(trend.sysDelta)}/${Math.abs(trend.diaDelta)} vs 14d</span>`:''}
    </div>`:''}
    <button class="btn btn-lime btn-sm" style="width:100%;margin-top:10px;" onclick="openBPEdit()">+ Add reading</button>
  </div>`;
}

// BP history section (below the Body Fat list on Track page)
function renderBPHistory(){
  const arr=getBPLog();
  if(!arr.length)return '';
  const sorted=[...arr].sort((a,b)=>{
    const ad=(a.date||'')+(a.time||''),bd=(b.date||'')+(b.time||'');
    return ad<bd?1:ad>bd?-1:0;
  }).slice(0,30);
  return `<div class="card" style="margin-bottom:10px;">
      ${sorted.map(r=>{
        const band=getBPBand(r.systolic,r.diastolic);
        const dt=`${fmtDate(r.date)}${r.time?' · '+r.time:''}`;
        return `<div class="step-row" style="border-bottom:1px solid var(--border);">
          <div class="step-date">${dt}</div>
          <div class="step-bar-wrap" style="text-align:left;padding-left:10px;font-family:'Archivo Black',sans-serif;font-size:15px;color:${band?band.color:'var(--text)'};">${r.systolic}/${r.diastolic}${r.pulse?` <span style="font-size:11px;color:var(--text3);font-family:inherit;">· pulse ${r.pulse}</span>`:''}</div>
          <div class="step-count" style="text-align:right;">
            <span style="font-size:10px;color:var(--text3);">${(r.arm||'left')[0].toUpperCase()} · ${r.position||'sitting'}</span>
            <button class="del-btn" onclick="event.stopPropagation();delBPReading('${r.id}')" style="margin-left:4px;">×</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

// ============================================================
// PHASE 41h — VO2 MAX CARD (Track page)
// ============================================================
function renderVO2MaxCard(){
  const current=(typeof getCurrentVO2Max==='function')?getCurrentVO2Max():null;
  if(current==null)return ''; // no VO2 max data yet — Oura needs activity history
  const personal=(STATE.profile&&STATE.profile.personal)||{};
  const age=personal.age||52;
  const sex=personal.sex||'male';
  const band=(typeof getVO2MaxBand==='function')?getVO2MaxBand(current,age,sex):null;
  const trend=(typeof getVO2MaxTrend==='function')?getVO2MaxTrend(14):null;
  // 14-day sparkline
  const log=getVO2MaxLog();
  const recent=Object.keys(log).filter(d=>typeof log[d]?.vo2==='number').sort().slice(-14).map(d=>log[d].vo2);
  const sparkSvg=(recent.length>=2&&typeof spark==='function')?spark(recent,band?band.color:'var(--cyan)'):'';
  const deltaStr=trend?(trend.delta>0?'+':'')+trend.delta:'—';
  const deltaColor=trend?(trend.direction==='up'?'var(--green)':trend.direction==='down'?'var(--red)':'var(--text3)'):'var(--text3)';
  const arrowSpan=trend?(trend.direction==='up'?'↑':trend.direction==='down'?'↓':'→'):'';
  const nextStr=band&&band.nextThreshold?`next band ${band.nextThreshold}+`:'top band';
  return `<div class="card" style="margin-bottom:10px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
      <div>
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">VO₂ MAX · Cardio fitness</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">Oura · age ${age} ${sex}</div>
      </div>
      <div style="text-align:right;">${sparkSvg}</div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
      <div style="font-family:'Archivo Black',sans-serif;font-size:42px;color:${band?band.color:'var(--cyan)'};letter-spacing:-2px;">${current.toFixed(1)}<span style="font-size:14px;color:var(--text2);"> ml/kg/min</span></div>
      <div style="text-align:right;font-size:11px;">
        <div style="color:${deltaColor};font-weight:700;">${arrowSpan} ${deltaStr}</div>
        <div style="color:var(--text3);">14-day</div>
      </div>
    </div>
    ${band?`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <span style="background:${band.color};color:#000;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:.5px;">${band.label}</span>
      <span style="font-size:11px;color:var(--text3);">${nextStr}</span>
    </div>`:''}
    <div style="font-size:11px;color:var(--text2);line-height:1.5;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">
      💡 Zone-2 cardio 30 min × 3/week is the highest-leverage VO₂ improvement — also therapeutic for LVH, ALT and CRP.
    </div>
  </div>`;
}

// ============================================================
// PHASE 41 — STRETCH SECTION ON TRAIN PAGE (owner-only)
// Rendered by renderWorkout(); styled to match the existing
// exercise-row pattern (ex-item / ex-hdr / ex-chk / ex-info / ex-tag).
// ============================================================
function renderStretchCards(){
  if(typeof isStretchUser!=='function'||!isStretchUser())return '';
  const today=todayStr();
  const log=getStretchLog(today);
  const hr=new Date().getHours();
  const chk='<svg width="12" height="12" fill="none" stroke="#000" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';

  function buildRow(type){
    const routine=STRETCH_ROUTINES[type];
    const entry=log[type]||{};
    const done=!!entry.completed;
    const streak=getStretchStreak(type);
    const partialCount=Array.isArray(entry.completedStretches)?entry.completedStretches.length:0;
    const total=routine.stretches.length;
    // time-window logic
    let stateLabel, stateColor, icon;
    if(done){
      stateLabel='DONE';
      stateColor='var(--green)';
      icon=chk;
    }else if(type==='morning'){
      if(hr<12){ stateLabel='START'; stateColor='var(--lime)'; icon='🌅'; }
      else { stateLabel='LATE'; stateColor='var(--orange)'; icon='⚠️'; }
    }else if(type==='flexibility'){ // Phase 52: anytime — no time-window gating
      stateLabel='START'; stateColor='var(--lime)'; icon='🤸';
    }else{
      if(hr<17){ stateLabel='LATER'; stateColor='var(--text3)'; icon='🌙'; }
      else if(hr<22){ stateLabel='START'; stateColor='var(--blue)'; icon='🌙'; }
      else { stateLabel='LATE'; stateColor='var(--orange)'; icon='⚠️'; }
    }
    const metaParts=[`${routine.totalMinutes} min`,`${total} stretches`];
    if(done){
      const dur=(entry.startedAt&&entry.completedAt)?Math.max(1,Math.round((new Date(entry.completedAt).getTime()-new Date(entry.startedAt).getTime())/60000)):null;
      if(dur)metaParts[0]=`${dur} min`;
    }else if(partialCount>0){
      metaParts.push(`${partialCount}/${total} done`);
    }
    if(streak>0)metaParts.push(`🔥 ${streak} day${streak===1?'':'s'}`);
    const meta=metaParts.join(' · ');
    const muscleTag=type==='morning'?'Morning':'Evening';
    return `<div class="ex-item${done?' done':''}">
      <div class="ex-hdr" onclick="startStretchMode('${type}')" style="cursor:pointer;">
        <div class="ex-chk" style="${done?'background:var(--lime);border-color:var(--lime);':''}display:flex;align-items:center;justify-content:center;font-size:15px;">
          ${done?chk:icon}
        </div>
        <div class="ex-info">
          <div class="ex-name">${routine.title}</div>
          <div class="ex-meta">${meta}</div>
        </div>
        <div class="ex-tag" style="color:${stateColor};">${stateLabel}</div>
      </div>
    </div>`;
  }

  return `<div class="sec-label" style="margin-top:18px;">Mobility</div>
    <div id="stretchList">
      ${buildRow('morning')}
      ${buildRow('evening')}
      ${buildRow('flexibility')}
    </div>`;
}

// More page stretch history — owner-only
function renderStretchHistory(){
  if(typeof isStretchUser!=='function'||!isStretchUser())return '';
  const c=getStretchCompliance(7);
  const mStreak=getStretchStreak('morning');
  const eStreak=getStretchStreak('evening');
  const fStreak=getStretchStreak('flexibility'); // Phase 52
  const rmStreak=getStretchStreak('restMobility'); // Phase 69
  const log=pGet('stretchLog',{});
  const total=Object.values(log).reduce((s,d)=>s+((d.morning?.completed?1:0)+(d.evening?.completed?1:0)),0);
  const today=todayStr();
  // 7-day dot grid: green=both done, amber=one done or partial, red=none, grey=future (not applicable here)
  const days=[];
  for(let i=6;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);
    const ds=_ukDate(d);
    const entry=log[ds]||{};
    const m=!!entry.morning?.completed, e=!!entry.evening?.completed;
    const mPartial=entry.morning&&!entry.morning.completed&&(entry.morning.completedStretches||[]).length>0;
    const ePartial=entry.evening&&!entry.evening.completed&&(entry.evening.completedStretches||[]).length>0;
    let color,label;
    if(m&&e){color='var(--green)';label='Both';}
    else if(m||e){color='#ffc107';label=m?'AM only':'PM only';}
    else if(mPartial||ePartial){color='var(--orange)';label='Partial';}
    else if(ds<=today){color='var(--red)';label='None';}
    else {color='var(--border)';label='—';}
    days.push({ds,color,label,short:new Date(ds+'T12:00:00').toLocaleDateString('en-GB',{weekday:'narrow'})});
  }
  // Phase 52: flexibility gets its own 7-day dot row (anytime routine)
  const fdays=[];
  for(let i=6;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);
    const ds=_ukDate(d);
    const entry=log[ds]||{};
    const f=!!entry.flexibility?.completed;
    const fPartial=entry.flexibility&&!entry.flexibility.completed&&(entry.flexibility.completedStretches||[]).length>0;
    let color;
    if(f)color='var(--green)';
    else if(fPartial)color='var(--orange)';
    else if(ds<=today)color='var(--red)';
    else color='var(--border)';
    fdays.push({ds,color,short:new Date(ds+'T12:00:00').toLocaleDateString('en-GB',{weekday:'narrow'})});
  }
  return `<div class="sec-label">Stretching · Mobility</div>
  <div class="card" style="margin-bottom:10px;">
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px;">
      <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Morning · 7d</div><div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:${c.morning.pct>=70?'var(--green)':c.morning.pct>=40?'var(--orange)':'var(--red)'};">${c.morning.done}<span style="font-size:11px;">/7</span></div><div style="font-size:10px;color:var(--text3);">🔥 ${mStreak} day streak</div></div>
      <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Evening · 7d</div><div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:${c.evening.pct>=70?'var(--green)':c.evening.pct>=40?'var(--orange)':'var(--red)'};">${c.evening.done}<span style="font-size:11px;">/7</span></div><div style="font-size:10px;color:var(--text3);">🔥 ${eStreak} day streak</div></div>
      <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Flexibility · 7d</div><div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:${c.flexibility.pct>=70?'var(--green)':c.flexibility.pct>=40?'var(--orange)':'var(--red)'};">${c.flexibility.done}<span style="font-size:11px;">/7</span></div><div style="font-size:10px;color:var(--text3);">🔥 ${fStreak} day streak</div></div>
      <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Rest-Gap · 7d</div><div style="font-family:'Archivo Black',sans-serif;font-size:18px;color:${c.restMobility.pct>=70?'var(--green)':c.restMobility.pct>=40?'var(--orange)':'var(--red)'};">${c.restMobility.done}<span style="font-size:11px;">/7</span></div><div style="font-size:10px;color:var(--text3);">🔥 ${rmStreak} day · deep squats in-set</div></div>
    </div>
    <div style="font-size:9px;color:var(--text3);margin-bottom:3px;">🌅🌙 Morning + Evening</div>
    <div style="display:flex;gap:6px;margin-bottom:6px;">
      ${days.map(d=>`<div style="flex:1;text-align:center;"><div style="width:24px;height:24px;border-radius:50%;background:${d.color};margin:0 auto;" title="${d.ds} · ${d.label}"></div><div style="font-size:9px;color:var(--text3);margin-top:3px;">${d.short}</div></div>`).join('')}
    </div>
    <div style="font-size:9px;color:var(--text3);margin-bottom:3px;">🤸 Flexibility</div>
    <div style="display:flex;gap:6px;margin-bottom:6px;">
      ${fdays.map(d=>`<div style="flex:1;text-align:center;"><div style="width:24px;height:24px;border-radius:50%;background:${d.color};margin:0 auto;" title="${d.ds}"></div><div style="font-size:9px;color:var(--text3);margin-top:3px;">${d.short}</div></div>`).join('')}
    </div>
    <div style="font-size:11px;color:var(--text3);margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">Total sessions completed: ${total} · combined ${c.combined.pct}% (last 7d)</div>
  </div>`;
}

function renderNotificationBell(){
  const unread=(typeof getUnreadNotificationCount==='function')?getUnreadNotificationCount():0;
  return `<button onclick="openNotifications()" aria-label="Notifications" style="position:relative;background:var(--s2);border:1px solid var(--border);border-radius:10px;width:38px;height:38px;cursor:pointer;font-size:17px;color:var(--text2);flex-shrink:0;">🔔${unread>0?`<span style="position:absolute;top:-6px;right:-6px;background:var(--red);color:#fff;font-size:10px;font-weight:700;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 3px;">${unread>9?'9+':unread}</span>`:''}</button>`;
}

function renderTrainingNutritionBanners(){
  let html='';
  const mins=(typeof getMinutesToSession==='function')?getMinutesToSession():null;
  if(mins!=null&&mins>0&&mins<=90){
    if(mins>60){
      html+=`<div class="card" style="margin-bottom:10px;border-color:var(--lime);background:rgba(200,255,0,.05);">
        <div style="font-size:12px;color:var(--lime);font-weight:700;">🏋️ Training in ~${mins} mins</div>
        <div style="font-size:11px;color:var(--text2);margin-top:3px;">Pre-workout meal should be finishing now. Have you had your carbs and protein?</div></div>`;
    }else{
      html+=`<div class="card" style="margin-bottom:10px;border-color:var(--orange);background:rgba(255,85,0,.05);">
        <div style="font-size:12px;color:var(--orange);font-weight:700;">🏋️ Training in ~${mins} mins</div>
        <div style="font-size:11px;color:var(--text2);margin-top:3px;">Time to wrap up eating — last meal before your session.</div></div>`;
    }
  }
  const pw=(typeof getPostWorkoutWindow==='function')?getPostWorkoutWindow():null;
  if(pw&&pw.phase==='open'){
    html+=`<div class="card" style="margin-bottom:10px;border-color:var(--lime);background:rgba(200,255,0,.06);">
      <div style="font-size:12px;color:var(--lime);font-weight:700;">⚡ Post-workout window open · ${pw.minsLeft} min left</div>
      <div style="font-size:11px;color:var(--text2);margin-top:3px;">Get protein in within the hour — log your Clear Whey shake. Session burned ~${getSessionCalorieBurn()} cals.</div></div>`;
  }else if(pw&&pw.phase==='missed'){
    html+=`<div class="card" style="margin-bottom:10px;border-color:var(--orange);background:rgba(255,85,0,.05);">
      <div style="font-size:12px;color:var(--orange);font-weight:700;">Post-workout protein window missed</div>
      <div style="font-size:11px;color:var(--text2);margin-top:3px;">Log your shake now — late protein still beats none.</div></div>`;
  }
  const day=(STATE.exLog||{})[todayStr()]||{};
  if(day._session&&day._session.completedAt){
    const st=getSessionTypeForDate(todayStr());
    if(st==='lower'){
      html+=`<div style="font-size:11px;color:var(--text2);background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:10px;">🦵 Heavy lower session done — quads &amp; hamstrings need protein. Hit your protein target today.</div>`;
    }else if(st==='upper'){
      html+=`<div style="font-size:11px;color:var(--text2);background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:10px;">💪 Upper session done — chest, back &amp; shoulders need protein. Creatine and Omega 3 taken?</div>`;
    }
  }
  return html;
}
