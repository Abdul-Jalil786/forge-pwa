// ============================================================
// DATA LAYER
// ============================================================

const WORKOUTS = {
  upper: {
    name:'UPPER BODY', type:'upper',
    muscles:'Chest · Back · Shoulders · Biceps · Triceps · Core',
    duration:'55–60',
    exercises:[
      {id:'u1',name:'Chest Press',sets:4,reps:'6–8',rest:90,muscle:'Chest',size:'medium',yt:'https://www.youtube.com/results?search_query=chest+press+form'},
      {id:'u2',name:'Incline Dumbbell Press',sets:3,reps:'8–10',rest:90,muscle:'Upper Chest',size:'medium',yt:'https://www.youtube.com/results?search_query=incline+dumbbell+press+form'},
      {id:'u3',name:'Seated Row',sets:4,reps:'6–8',rest:90,muscle:'Back',size:'medium',yt:'https://www.youtube.com/results?search_query=seated+cable+row+form'},
      {id:'u4',name:'Shoulder Press',sets:3,reps:'6–8',rest:90,muscle:'Shoulders',size:'medium',yt:'https://www.youtube.com/results?search_query=dumbbell+shoulder+press+form'},
      {id:'u5',name:'Lat Pulldown',sets:3,reps:'8–10',rest:90,muscle:'Lats',size:'medium',yt:'https://www.youtube.com/results?search_query=lat+pulldown+form'},
      {id:'u6',name:'Bicep Curl',sets:3,reps:'10–12',rest:60,muscle:'Biceps',size:'small',yt:'https://www.youtube.com/results?search_query=dumbbell+bicep+curl+form'},
      {id:'u7',name:'Tricep Pushdown',sets:3,reps:'10–12',rest:60,muscle:'Triceps',size:'small',yt:'https://www.youtube.com/results?search_query=tricep+pushdown+form'},
      {id:'u8',name:'Face Pull',sets:3,reps:'12–15',rest:45,muscle:'Rear Delts',size:'small',yt:'https://www.youtube.com/results?search_query=face+pull+exercise+form'},
      {id:'u9',name:'Plank',sets:3,reps:'30–45s',rest:45,muscle:'Core',metric:'time',yt:'https://www.youtube.com/results?search_query=plank+form+technique'},
    ]
  },
  lower: {
    name:'LOWER BODY', type:'lower',
    muscles:'Quads · Hamstrings · Glutes · Calves · Lower Back · Core',
    duration:'60–65',
    exercises:[
      {id:'l1',name:'Leg Press',sets:4,reps:'6–8',rest:120,muscle:'Quads',size:'large',yt:'https://www.youtube.com/results?search_query=leg+press+form+technique'},
      {id:'l2',name:'Romanian Deadlift',sets:4,reps:'6–8',rest:120,muscle:'Hamstrings',size:'large',yt:'https://www.youtube.com/results?search_query=romanian+deadlift+form'},
      {id:'l3',name:'Leg Extension',sets:3,reps:'10–12',rest:60,muscle:'Quads',size:'medium',yt:'https://www.youtube.com/results?search_query=leg+extension+machine+form'},
      {id:'l4',name:'Leg Curl',sets:3,reps:'10–12',rest:60,muscle:'Hamstrings',size:'medium',yt:'https://www.youtube.com/results?search_query=leg+curl+machine+form'},
      {id:'l5',name:'Hip Thrust',sets:3,reps:'8–10',rest:90,muscle:'Glutes',size:'large',yt:'https://www.youtube.com/results?search_query=hip+thrust+barbell+form'},
      {id:'l6',name:'Calf Raise',sets:4,reps:'15–20',rest:45,muscle:'Calves',size:'medium',yt:'https://www.youtube.com/results?search_query=calf+raise+form'},
      {id:'l7',name:'Good Mornings',sets:3,reps:'10–12',rest:90,muscle:'Lower Back / Hams',size:'small',yt:'https://www.youtube.com/results?search_query=good+morning+barbell+form'},
      {id:'l8',name:'Ab Crunch',sets:3,reps:'15',rest:45,muscle:'Core',size:'small',yt:'https://www.youtube.com/results?search_query=ab+crunch+form+technique'},
    ]
  }
};

// Time-based exercise detection + formatting
const _TIME_KEYWORDS=['plank','side-plank','side plank','dead-hang','dead hang','wall-sit','wall sit','hollow-hold','hollow hold','l-sit','l sit'];
function isTimeBased(ex){
  if(ex.metric==='time')return true;
  const n=(ex.name||'').toLowerCase();
  return _TIME_KEYWORDS.some(k=>n.includes(k));
}
function fmtSec(s){
  s=Math.floor(s);
  if(s<60)return s+'s';
  return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
}

// Training cycle — anchored to a start date
// 4-day pattern: Day 0=Upper, Day 1=Rest, Day 2=Lower, Day 3=Rest
function _trainingDayInCycle(dateStr){
  const startDate = STATE.trainingStartDate || '2026-05-08';
  const start = new Date(startDate + 'T12:00:00');
  const target = new Date(dateStr + 'T12:00:00');
  const diffDays = Math.floor((target - start) / 86400000);
  if (diffDays < 0) return -1;
  return ((diffDays % 4) + 4) % 4;
}

// ============================================================
// STATE — synced with backend
// ============================================================
let STATE = {
  profile: null,
  weightLog: [],
  foods: {},
  stepsLog: {},
  exLog: {},
  measLog: [],
  sleepLog: {},
  swimLog: {},
  supps: [],
  suppDone: {},
  water: {},
  foodTemplates: [],
  bfLog: [],
  mealPlan: null,
  recovery: {},
  bodyComp: {},
  coachingReports: [],
  planStartDate: null,
  trainingStartDate: null,
  waterClicked: {},
  supplementLog: {},
  skinCare: { products: [], phase: 1, phaseStartDate: null, tretinoinReady: false, weeklyCheckIn: {} },
  skinCareLog: {},
};

// ---- OWNER GATE (Phase 35) — some features are personal to the owner only ----
const OWNER_EMAIL='jay@afjltd.co.uk';
function isOwner(){
  // Primary: the authenticated email captured from /api/auth/me (cached in localStorage)
  const email=(window._forgeUserEmail||localStorage.getItem('forge_email')||'').toLowerCase();
  if(email===OWNER_EMAIL)return true;
  // Fallback: profile fields (older accounts may not have email captured yet)
  const p=STATE.profile||{};
  if((p.email||'').toLowerCase()===OWNER_EMAIL)return true;
  return !!(p.name && p.name.toLowerCase().startsWith('jay'));
}

// ---- SKIN CARE (Phase 35) ----
function getSkinCare(){const s=pGet('skinCare',{products:[]});if(!Array.isArray(s.products))s.products=[];return s;}
function getSkinProducts(){return getSkinCare().products;}
function getSkinCareLog(date){return(pGet('skinCareLog',{})[date])||{};}

function saveSkinCare(skinCare){
  STATE.skinCare=skinCare;
  updateLocalCache();
  saveFieldToServer('/api/state/skin-care',{skinCare});
}
function addSkinProduct(p){
  const sc=getSkinCare();
  sc.products.push({id:'skn_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),...p});
  saveSkinCare(sc);
}
function updateSkinProduct(id,patch){
  const sc=getSkinCare();
  const i=sc.products.findIndex(x=>x.id===id);
  if(i>=0){sc.products[i]={...sc.products[i],...patch};saveSkinCare(sc);}
}
function deleteSkinProduct(id){
  const sc=getSkinCare();
  sc.products=sc.products.filter(x=>x.id!==id);
  saveSkinCare(sc);
}
function setSkinItemDone(date,itemId,done){
  const log=pGet('skinCareLog',{});
  if(!log[date])log[date]={};
  log[date][itemId]=done;
  STATE.skinCareLog=log;
  // Recompute the day's compliance fraction + stamp Mounjaro (Wednesday) flag
  const {am,pm}=getSkinVisibleItems(date);
  const items=[...am,...pm];
  const dn=items.filter(it=>log[date][it.itemId]===true).length;
  log[date]._compliance=items.length?Math.round((dn/items.length)*100)/100:0;
  log[date]._mounjaro_day=new Date(date+'T12:00:00').getDay()===3;
  updateLocalCache();
  saveFieldToServer(`/api/state/skin-care-log/${date}`,{value:log[date]});
}
function setSkinIrritation(date,level){
  const log=pGet('skinCareLog',{});
  if(!log[date])log[date]={};
  log[date]._irritation=level;
  STATE.skinCareLog=log;
  updateLocalCache();
  saveFieldToServer(`/api/state/skin-care-log/${date}`,{value:log[date]});
}
// Is a product due on `date`? freq + startedDate drive the cycle.
function skinDueOn(product,date){
  const freq=product.frequency||'daily';
  if(freq==='daily')return true;
  if(freq==='5x-week'){ // 5 nights/week = weekdays Mon-Fri
    const dow=new Date(date+'T12:00:00').getDay();
    return dow>=1&&dow<=5;
  }
  const start=product.startedDate;
  if(!start)return true; // no start date → treat as daily
  const d0=new Date(start+'T12:00:00').getTime();
  const d1=new Date(date+'T12:00:00').getTime();
  const days=Math.round((d1-d0)/86400000);
  if(days<0)return false;
  const step={'every-2-days':2,'every-3-days':3,'every-4-days':4,'weekly':7}[freq];
  return step?(days%step===0):true;
}

// ---- SKIN CARE PHASES + CONFLICT ENGINE (Phase 37) ----
const SKIN_PHASES=[
  {n:1,freq:'every-4-days',label:'Every 4 days'},
  {n:2,freq:'every-3-days',label:'Every 3 days'},
  {n:3,freq:'every-2-days',label:'Every other day'},
  {n:4,freq:'5x-week',label:'5 nights per week'},
  {n:5,freq:'daily',label:'Every night'},
  {n:6,freq:'daily',label:'Tretinoin 0.025%'},
];
function getSkinPhase(){
  const n=getSkinCare().phase||1;
  return SKIN_PHASES.find(p=>p.n===n)||SKIN_PHASES[0];
}
function isMounjaroDay(){return new Date().getDay()===3;} // Wednesday
function isRetinolNight(date){
  return getSkinProducts().some(p=>p.type==='retinol'&&skinDueOn(p,date));
}

// Conflict engine — single source of truth for what's visible on a date.
// Returns { am:[items], pm:[items], retinolNight } — each item {product, slot, itemId}.
function getSkinVisibleItems(date){
  const products=getSkinProducts();
  const due=products.filter(p=>skinDueOn(p,date));
  const retinolNight=due.some(p=>p.type==='retinol');
  const mk=(p,slot)=>({product:p,slot,itemId:`${p.id}_${slot}`});
  // AM — fixed order: cleanser, vitamin-c, moisturizer, spf
  const am=[];
  for(const t of ['cleanser','vitamin-c','moisturizer','spf']){
    const p=due.find(x=>(x.slot==='am'||x.slot==='both')&&x.type===t);
    if(p)am.push(mk(p,'am'));
  }
  // PM — branches on retinol night
  const pm=[];
  if(retinolNight){
    for(const t of ['cleanser','moisturizer','retinol']){
      const p=due.find(x=>(x.slot==='pm'||x.slot==='both')&&x.type===t);
      if(p)pm.push(mk(p,'pm'));
    }
    const cica=due.find(x=>x.id==='skn-cicaplast');
    if(cica)pm.push(mk(cica,'pm'));
  }else{
    const cleanser=due.find(x=>(x.slot==='pm'||x.slot==='both')&&x.type==='cleanser');
    if(cleanser)pm.push(mk(cleanser,'pm'));
    // serums thinnest-first (lower concentration → applied first)
    const serums=due.filter(x=>x.slot==='pm'&&x.type==='serum')
      .sort((a,b)=>(parseFloat(a.concentration)||0)-(parseFloat(b.concentration)||0));
    for(const p of serums)pm.push(mk(p,'pm'));
    const moist=due.find(x=>(x.slot==='pm'||x.slot==='both')&&x.type==='moisturizer');
    if(moist)pm.push(mk(moist,'pm'));
    const honey=due.find(x=>x.id==='skn-honeymask');
    if(honey)pm.push(mk(honey,'pm'));
  }
  return {am,pm,retinolNight};
}

// Compliance % across last `days` days (counts only conflict-engine-visible items).
function getSkinCompliance(days){
  let due=0,done=0;
  for(let i=0;i<days;i++){
    const d=new Date();d.setDate(d.getDate()-i);
    const ds=d.toISOString().slice(0,10);
    const {am,pm}=getSkinVisibleItems(ds);
    const items=[...am,...pm];
    if(items.length===0)continue;
    const log=getSkinCareLog(ds);
    for(const it of items){due++;if(log[it.itemId]===true)done++;}
  }
  return due>0?Math.round((done/due)*100):0;
}
// Today's compliance as {done,total,pct}.
function getTodaySkinCompliance(){
  const today=todayStr();
  const {am,pm}=getSkinVisibleItems(today);
  const items=[...am,...pm];
  const log=getSkinCareLog(today);
  const done=items.filter(it=>log[it.itemId]===true).length;
  return {done,total:items.length,pct:items.length?Math.round((done/items.length)*100):0};
}
function getSkinIrritationSummary(days){
  const counts={none:0,'mild-dryness':0,peeling:0,redness:0,burning:0};
  for(let i=0;i<days;i++){
    const d=new Date();d.setDate(d.getDate()-i);
    const ir=getSkinCareLog(d.toISOString().slice(0,10))._irritation;
    if(ir&&counts[ir]!==undefined)counts[ir]++;
  }
  return counts;
}
// Retinol phase readiness — 3 conditions: 3wk min, no redness/burning 14d, 100% retinol compliance 14d.
function getRetinolPhaseReadiness(){
  const sc=getSkinCare();
  const phaseNum=sc.phase||1;
  if(phaseNum>=5)return{ready:false,atMax:true,phaseNum,reason:phaseNum>=6?'On tretinoin':'At final retinol phase (every night)'};
  const ret=sc.products.find(p=>p.type==='retinol');
  const phaseStart=sc.phaseStartDate||ret?.frequencyStartedAt;
  const weeksAtPhase=phaseStart?((Date.now()-new Date(phaseStart+'T12:00:00').getTime())/(7*86400000)):0;
  const irr=getSkinIrritationSummary(14);
  const badIrritation=irr.redness>0||irr.burning>0;
  let retDue=0,retDone=0;
  for(let i=0;i<14;i++){
    const d=new Date();d.setDate(d.getDate()-i);
    const ds=d.toISOString().slice(0,10);
    if(ret&&skinDueOn(ret,ds)){retDue++;if(getSkinCareLog(ds)[`${ret.id}_pm`]===true)retDone++;}
  }
  const retComplete=retDue>0?(retDone/retDue):1;
  const reasons=[];
  if(weeksAtPhase<3)reasons.push(`3 weeks at this phase needed (${weeksAtPhase.toFixed(1)} so far)`);
  if(badIrritation)reasons.push(`irritation logged: ${irr.redness} redness, ${irr.burning} burning in 14d`);
  if(retComplete<1)reasons.push(`retinol compliance ${Math.round(retComplete*100)}% in 14d (need 100%)`);
  const ready=reasons.length===0&&weeksAtPhase>=3;
  const next=SKIN_PHASES.find(p=>p.n===phaseNum+1);
  return{ready,atMax:false,phaseNum,weeksAtPhase,reason:ready?'All conditions met':reasons.join(' · '),nextPhase:next?next.n:null,nextFrequency:next?next.freq:null};
}
// Per-product analytics for the More page (Phase 37)
function getSkinProductLastUsed(productId){
  const all=pGet('skinCareLog',{});
  const dates=Object.keys(all).sort().reverse();
  for(const d of dates){
    const l=all[d]||{};
    if(l[`${productId}_am`]===true||l[`${productId}_pm`]===true)return d;
  }
  return null;
}
function getSkinProductCompliance(productId,days){
  let due=0,done=0;
  for(let i=0;i<days;i++){
    const dt=new Date();dt.setDate(dt.getDate()-i);
    const ds=dt.toISOString().slice(0,10);
    const {am,pm}=getSkinVisibleItems(ds);
    const its=[...am,...pm].filter(it=>it.product.id===productId);
    if(its.length===0)continue;
    const log=getSkinCareLog(ds);
    for(const it of its){due++;if(log[it.itemId]===true)done++;}
  }
  return due>0?Math.round((done/due)*100):null;
}
function getSkinProduct7Day(productId){
  const out=[];
  for(let i=6;i>=0;i--){
    const dt=new Date();dt.setDate(dt.getDate()-i);
    const ds=dt.toISOString().slice(0,10);
    const {am,pm}=getSkinVisibleItems(ds);
    const its=[...am,...pm].filter(it=>it.product.id===productId);
    if(its.length===0){out.push('na');continue;}
    const log=getSkinCareLog(ds);
    out.push(its.every(it=>log[it.itemId]===true)?'done':'missed');
  }
  return out;
}

function getSkinWeeklyCheckIn(date){return(getSkinCare().weeklyCheckIn||{})[date]||null;}
function setSkinWeeklyCheckIn(date,data){
  const sc=getSkinCare();
  if(!sc.weeklyCheckIn)sc.weeklyCheckIn={};
  sc.weeklyCheckIn[date]={score:data.score,trend:data.trend,notes:data.notes,date};
  STATE.skinCare=sc;
  const log=pGet('skinCareLog',{});
  if(!log[date])log[date]={};
  log[date]._skin_score=data.score;
  log[date]._skin_trend=data.trend;
  log[date]._skin_notes=data.notes;
  STATE.skinCareLog=log;
  updateLocalCache();
  saveFieldToServer(`/api/state/skin-care-weekly/${date}`,{score:data.score,trend:data.trend,notes:data.notes});
  saveFieldToServer(`/api/state/skin-care-log/${date}`,{value:log[date]});
}
function setSkinPhase(phaseNum){
  const sc=getSkinCare();
  const ph=SKIN_PHASES.find(p=>p.n===phaseNum);
  if(!ph)return;
  sc.phase=phaseNum;
  sc.phaseStartDate=todayStr();
  for(const p of sc.products){
    if(p.type==='retinol'||p.id==='skn-cicaplast'){p.frequency=ph.freq;p.frequencyStartedAt=todayStr();}
  }
  STATE.skinCare=sc;
  updateLocalCache();
  saveFieldToServer('/api/state/skin-care-phase',{phase:phaseNum});
}
let saveStateTimeout = null;

async function loadState() {
  // Phase 3: clean up old AI Coach key
  localStorage.removeItem('forge_apikey');
  const cached = localStorage.getItem("forge_state_cache");
  if (cached) { try { STATE = { ...STATE, ...JSON.parse(cached) }; } catch {} }
  const token = localStorage.getItem("forge_token");
  if (!token) return;
  try {
    const res = await fetch("/api/state", { headers: { Authorization: "Bearer " + token } });
    if (!res.ok) return;
    const data = await res.json();
    if (data.state && data.state.profile) {
      STATE = { ...STATE, ...data.state };
      localStorage.setItem("forge_state_cache", JSON.stringify(STATE));
    } else {
      const migrated = readLocalStorageMigration();
      if (migrated) {
        STATE = { ...STATE, ...migrated };
        await saveStateNow();
      }
    }
  } catch {}
}

async function saveStateNow() {
  console.warn("[Forge] Full state PUT — prefer field-scoped saves");
  localStorage.setItem("forge_state_cache", JSON.stringify(STATE));
  const token = localStorage.getItem("forge_token");
  if (!token) return;
  try {
    await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ state: STATE }),
    });
  } catch {}
}

async function saveFieldToServer(endpoint, body) {
  const token = localStorage.getItem("forge_token");
  if (!token) return;
  try {
    await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(body),
    });
  } catch {}
}

function updateLocalCache() {
  localStorage.setItem("forge_state_cache", JSON.stringify(STATE));
}

function saveStateDebounced() {
  if (saveStateTimeout) clearTimeout(saveStateTimeout);
  saveStateTimeout = setTimeout(saveStateNow, 600);
}

function readLocalStorageMigration() {
  const profilesJson = localStorage.getItem("forge_profiles");
  if (!profilesJson) return null;
  let profiles;
  try { profiles = JSON.parse(profilesJson); } catch { return null; }
  if (!profiles.length) return null;
  const activeId = localStorage.getItem("forge_active");
  const profile = profiles.find(p => p.id === activeId) || profiles[0];
  const data = {
    profile: {
      name: profile.name,
      startWeight: profile.startWeight,
      targetWeight: profile.targetWeight,
      targetBF: profile.targetBF,
      calsGym: profile.calsGym,
      calsRest: profile.calsRest,
      proteinTarget: profile.proteinTarget,
    },
  };
  const keys = ["weightLog","foods","stepsLog","exLog","measLog","sleepLog","swimLog","supps","suppDone","water","foodTemplates"];
  keys.forEach(k => {
    const v = localStorage.getItem(`forge_${profile.id}_${k}`);
    if (v) { try { data[k] = JSON.parse(v); } catch {} }
  });
  return data;
}

// ============================================================
// PROFILE SYSTEM (single profile per account)
// ============================================================
function getActive() { return STATE.profile; }
function saveProfiles() { saveStateDebounced(); }
function setActive() { /* no-op */ }

// Compatibility helpers — used by all the existing get/save functions below
function pGet(k, def = null) { return STATE[k] !== undefined && STATE[k] !== null ? STATE[k] : def; }
function pSet(k, v) {
  STATE[k] = v;
  localStorage.setItem("forge_state_cache", JSON.stringify(STATE));
  saveStateDebounced();
}

// Globals kept for legacy code paths (read-only stubs)
let profiles = [];
let activePid = null;

// ============================================================
// DATE HELPERS
// ============================================================
const _ukDate=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
function todayStr(){return _ukDate(new Date());}
function dayOfWeek(){return new Date().getDay();} // 0=Sun
function getTodaySession(){return getSessionTypeForDate(todayStr());}
function dayName(){return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dayOfWeek()];}
function fmtDate(str){return new Date(str+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});}
function fmtNow(){const n=new Date();return n.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});}
function getLast7(){
  const days=[];
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(_ukDate(d));}
  return days;
}
function getLast30(){
  const days=[];
  for(let i=29;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(_ukDate(d));}
  return days;
}

// ============================================================
// WEIGHT
// ============================================================
function getWeightLog(){return pGet('weightLog',[]);}
function getCurrentWeight(){const l=getWeightLog();return l.length?l[l.length-1].weight:(getActive()?.startWeight||0);}
function saveWeightEntry(kg){
  const log=getWeightLog();
  const idx=log.findIndex(e=>e.date===todayStr());
  if(idx>=0){log[idx].weight=kg;log[idx].source='manual';}
  else log.push({date:todayStr(),weight:kg,source:'manual'});
  STATE.weightLog=log;
  updateLocalCache();
  saveFieldToServer('/api/state/weight',{date:todayStr(),weight:kg});
}

// ============================================================
// BODY FAT
// ============================================================
function getBfLog(){return pGet('bfLog',[]);}
function getCurrentBf(){const l=getBfLog();return l.length?l[l.length-1].bf:null;}
function saveBfEntry(bf){
  const log=getBfLog();
  const idx=log.findIndex(e=>e.date===todayStr());
  if(idx>=0){log[idx].bf=bf;log[idx].source='manual';}
  else log.push({date:todayStr(),bf,source:'manual'});
  pSet('bfLog',log);
}

// ============================================================
// FOOD
// ============================================================
function getFoods(date=todayStr()){return(pGet('foods',{})[date]||[]);}
function saveFoodEntry(entry,date=todayStr()){
  const all=pGet('foods',{});
  if(!all[date])all[date]=[];
  all[date].push(entry);
  STATE.foods=all;
  updateLocalCache();
  saveFieldToServer(`/api/state/foods/${date}`,{value:all[date]});
  if(!STATE.planStartDate){
    STATE.planStartDate=todayStr();
    pSet('planStartDate',todayStr());
  }
}
function deleteFoodEntry(idx,date=todayStr()){
  const all=pGet('foods',{});
  if(all[date])all[date].splice(idx,1);
  STATE.foods=all;
  updateLocalCache();
  saveFieldToServer(`/api/state/foods/${date}`,{value:all[date]||[]});
}
function getTodayTotals(){
  const foods=getFoods();
  return{
    cals:foods.reduce((s,f)=>s+f.cals,0),
    protein:foods.reduce((s,f)=>s+(f.protein||0),0),
    carbs:foods.reduce((s,f)=>s+(f.carbs||0),0),
    fat:foods.reduce((s,f)=>s+(f.fat||0),0),
  };
}

// ============================================================
// FOOD TEMPLATES
// ============================================================
function getTemplates(){return pGet('foodTemplates',[]);}
function saveTemplate(t){const ts=getTemplates();ts.push(t);pSet('foodTemplates',ts);}
function deleteTemplate(i){const ts=getTemplates();ts.splice(i,1);pSet('foodTemplates',ts);}

// ============================================================
// STEPS
// ============================================================
function getStepsLog(){return pGet('stepsLog',{});}
function getTodaySteps(){return getStepsLog()[todayStr()]||0;}
function saveSteps(val,date=todayStr()){const l=getStepsLog();l[date]=val;pSet('stepsLog',l);}

// ============================================================
// EXERCISE LOG
// ============================================================
function getExLog(){return pGet('exLog',{});}
function getTodayExLog(){return getExLog()[todayStr()]||{};}
function getExLogForDate(date){return getExLog()[date]||{};}

function saveExLog(data){
  const all=getExLog();
  all[todayStr()]=data;
  STATE.exLog=all;
  updateLocalCache();
  saveFieldToServer(`/api/state/exLog/${todayStr()}`,{value:data});
}
function saveExLogForDate(date,data){
  const all=getExLog();
  all[date]=data;
  STATE.exLog=all;
  updateLocalCache();
  saveFieldToServer(`/api/state/exLog/${date}`,{value:data});
}

function getBestLift(exId){
  const log=getExLog();
  const allEx=[...WORKOUTS.upper.exercises,...WORKOUTS.lower.exercises];
  const exObj=allEx.find(e=>e.id===exId);
  const timed=exObj&&isTimeBased(exObj);
  let best=null;
  Object.entries(log).forEach(([date,day])=>{
    const ex=day[exId];
    if(!ex?.sets)return;
    ex.sets.forEach(s=>{
      if(timed){
        const sec=parseFloat(s.seconds);
        if(sec&&(!best||sec>best.seconds))best={seconds:sec,date};
      }else{
        const kg=parseFloat(s.kg);
        if(kg&&(!best||kg>best.kg))best={kg,date};
      }
    });
  });
  return best;
}

// Session type for any past or future date based on SCHEDULE
function getSessionTypeForDate(dateStr){
  const cycle = _trainingDayInCycle(dateStr);
  if (cycle === 0) return 'upper';
  if (cycle === 2) return 'lower';
  return null;
}

// Most recent session of the same type with logged sets, before a given date
function getPreviousSessionData(beforeDate,sessionType){
  if(!sessionType)return null;
  const exLog=getExLog();
  const dates=Object.keys(exLog).filter(d=>d<beforeDate).sort().reverse();
  for(const date of dates){
    if(getSessionTypeForDate(date)!==sessionType)continue;
    const dayLog=exLog[date];
    const hasData=Object.values(dayLog).some(e=>e.sets?.some(s=>s.kg||s.reps||s.seconds));
    if(hasData)return{date,log:dayLog};
  }
  return null;
}

// Phase 28: get the last N sessions of a given type (most recent first), each with log + date
function getPreviousSessions(beforeDate, sessionType, limit){
  if(!sessionType)return [];
  const exLog=getExLog();
  const dates=Object.keys(exLog).filter(d=>d<beforeDate).sort().reverse();
  const out=[];
  for(const date of dates){
    if(getSessionTypeForDate(date)!==sessionType)continue;
    const dayLog=exLog[date];
    if(!dayLog)continue;
    const hasData=Object.values(dayLog).some(e=>e.sets?.some(s=>s.kg||s.reps||s.seconds));
    if(!hasData)continue;
    out.push({date,log:dayLog});
    if(out.length>=limit)break;
  }
  return out;
}

// Was a session completed on a date? (4+ exercises marked done)
function wasSessionCompleted(date){
  const log=getExLog()[date]||{};
  return Object.values(log).filter(e=>e.done).length>=4;
}

// ============================================================
// MEASUREMENTS
// ============================================================
function getMeasLog(){return pGet('measLog',[]);}
function getLatestMeas(){const l=getMeasLog();return l.length?l[l.length-1]:null;}
function saveMeasEntry(entry){
  const l=getMeasLog();
  const idx=l.findIndex(e=>e.date===todayStr());
  if(idx>=0)l[idx]={...entry,date:todayStr()}; else l.push({...entry,date:todayStr()});
  pSet('measLog',l);
}

// ============================================================
// SLEEP
// ============================================================
function getSleepLog(){return pGet('sleepLog',{});}
function saveSleepEntry(hours,quality){
  const l=getSleepLog();
  l[todayStr()]={hours,quality,source:'manual'};
  STATE.sleepLog=l;
  updateLocalCache();
  saveFieldToServer(`/api/state/sleep/${todayStr()}`,{value:{hours,quality,source:'manual'}});
}
function getAvgSleep(days=7){
  const l=getSleepLog();
  const dates=getLast7();
  const entries=dates.map(d=>l[d]?.hours||0).filter(h=>h>0);
  return entries.length?Math.round((entries.reduce((a,b)=>a+b,0)/entries.length)*10)/10:0;
}

// ============================================================
// SWIM LOG
// ============================================================
function getSwimLog(){return pGet('swimLog',{});}
function saveSwimEntry(entry){const l=getSwimLog();if(!l[todayStr()])l[todayStr()]=[];l[todayStr()].push(entry);pSet('swimLog',l);}

// ============================================================
// SUPPLEMENTS
// ============================================================
function getSupps(){return pGet('supps',[]);}
function getSuppDone(){return pGet('suppDone',{});}
function toggleSuppDone(i){const d=getSuppDone();const k=`${todayStr()}_${i}`;d[k]=!d[k];pSet('suppDone',d);}
function isSuppDone(i){return!!(getSuppDone()[`${todayStr()}_${i}`]);}

// ============================================================
// WATER
// ============================================================
function getWater(){
  const wc=pGet('waterClicked',{});
  if(!wc[todayStr()])return 0;
  return pGet('water',{})[todayStr()]||0;
}
function saveWater(cups){
  const w=pGet('water',{});
  w[todayStr()]=cups;
  STATE.water=w;
  const wc=pGet('waterClicked',{});
  wc[todayStr()]=true;
  STATE.waterClicked=wc;
  updateLocalCache();
  saveFieldToServer(`/api/state/water/${todayStr()}`,{cups});
}

// ============================================================
// MEAL HELPERS (Phase 18)
// ============================================================
function _slugify(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}

function getMealIngredients(meal){
  if(Array.isArray(meal.ingredients))return meal.ingredients;
  let str=meal.ingredients||'';
  str=str.replace(/(?:·\s*)?Take with:\s*[^·]+?(?:\.|$)/i,'').trim();
  const names=str.split('·').map(s=>s.trim()).filter(s=>s.length);
  if(!names.length)return[{name:meal.name,cals:meal.cals||0,protein:meal.protein||0,carbs:meal.carbs||0,fat:meal.fat||0}];
  const n=names.length;
  return names.map(name=>({name,cals:Math.round((meal.cals||0)/n),protein:Math.round((meal.protein||0)/n),carbs:Math.round((meal.carbs||0)/n),fat:Math.round((meal.fat||0)/n)}));
}

function getMealSupplements(meal){
  // Phase 19: prefer state.supplements filtered by mealId
  const supps=getSupplements();
  if(supps.length>0){
    const linked=supps.filter(s=>s.mealId===meal.id);
    if(linked.length>0)return linked;
  }
  // Legacy fallback: parse from meal data
  if(Array.isArray(meal.supplements))return meal.supplements;
  const match=/(?:·\s*)?Take with:\s*([^·]+?)(?:\.|$)/i.exec(meal.ingredients||'');
  if(!match)return[];
  return match[1].split(',').map(s=>s.trim()).filter(s=>s.length).map(s=>({id:_slugify(s),name:s,dose:''}));
}

function getSupplementLog(date){return(pGet('supplementLog',{})[date])||{};}
function setSupplementTaken(date,suppId,taken){
  const log=pGet('supplementLog',{});
  if(!log[date])log[date]={};
  log[date][suppId]=taken;
  STATE.supplementLog=log;
  updateLocalCache();
  saveStateDebounced();
}

// ============================================================
// SUPPLEMENTS (Phase 19)
// ============================================================
function getSupplements(){return pGet('supplements',[])||[];}

function addSupplement({name,dose,time,mealId,notes}){
  const supps=getSupplements();
  let id=_slugify(name);
  if(supps.some(s=>s.id===id)){
    let n=2;while(supps.some(s=>s.id===id+'-'+n))n++;
    id=id+'-'+n;
  }
  supps.push({id,name,dose:dose||'',time:time||'',mealId:mealId||'',notes:notes||''});
  pSet('supplements',supps);
  return id;
}

function updateSupplement(id,patch){
  const supps=getSupplements();
  const idx=supps.findIndex(s=>s.id===id);
  if(idx<0)return;
  Object.assign(supps[idx],patch);
  pSet('supplements',supps);
}

function deleteSupplement(id){
  const supps=getSupplements().filter(s=>s.id!==id);
  pSet('supplements',supps);
}

function getSupplementAdherence(days){
  const supps=getSupplements();
  const log=pGet('supplementLog',{});
  const byDay=[];
  const byId={};
  supps.forEach(s=>{byId[s.id]={taken:0,total:0,pct:0};});
  for(let i=days-1;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);
    const date=_ukDate(d);
    const dayLog=log[date]||{};
    let taken=0;
    supps.forEach(s=>{
      const t=dayLog[s.id]===true;
      if(t)taken++;
      if(byId[s.id]){byId[s.id].total++;if(t)byId[s.id].taken++;}
    });
    byDay.push({date,taken,total:supps.length,pct:supps.length?Math.round((taken/supps.length)*100):0});
  }
  let totalTaken=0,totalPossible=0;
  Object.values(byId).forEach(v=>{totalTaken+=v.taken;totalPossible+=v.total;v.pct=v.total?Math.round((v.taken/v.total)*100):0;});
  return{taken:totalTaken,missed:totalPossible-totalTaken,pct:totalPossible?Math.round((totalTaken/totalPossible)*100):0,byDay,byId};
}

// ============================================================
// PROGRESS HELPERS (Phase 22)
// ============================================================
function getCurrentLBM(){
  const w=getCurrentWeight();
  const bf=getCurrentBf();
  if(!w||!bf)return null;
  return Math.round(w*(1-bf/100)*100)/100;
}

function getJourneyEntries(metric){
  const start=getActive()?.startDate;
  if(metric==='weight'){
    const wl=getWeightLog();
    return start?wl.filter(e=>e.date>=start):wl;
  }
  if(metric==='bf'){
    const bl=getBfLog();
    return start?bl.filter(e=>e.date>=start):bl;
  }
  if(metric==='lbm'){
    const wl=getJourneyEntries('weight');
    const bl=getBfLog();
    return wl.map(we=>{
      const bfe=bl.filter(b=>b.date<=we.date).pop();
      if(!bfe)return null;
      return{date:we.date,lbm:Math.round(we.weight*(1-bfe.bf/100)*100)/100};
    }).filter(Boolean);
  }
  if(metric==='visceral'){
    const bc=pGet('bodyComp',{});
    const entries=Object.entries(bc).filter(([d,v])=>v.visceralFat!=null&&(!start||d>=start)).map(([d,v])=>({date:d,visceralFat:v.visceralFat})).sort((a,b)=>a.date.localeCompare(b.date));
    return entries;
  }
  return[];
}

function get14DayAvgRate(metric){
  const entries=getJourneyEntries(metric);
  if(entries.length<7)return 0;
  const last14=entries.slice(-14);
  if(last14.length<2)return 0;
  const val=e=>metric==='weight'?e.weight:metric==='bf'?e.bf:metric==='lbm'?e.lbm:e.visceralFat;
  const first=val(last14[0]),last=val(last14[last14.length-1]);
  const d0=new Date(last14[0].date+'T12:00:00'),d1=new Date(last14[last14.length-1].date+'T12:00:00');
  const weeks=Math.max(0.5,(d1-d0)/604800000);
  return Math.round(((last-first)/weeks)*100)/100;
}

function getProjectedGoalDate(){
  const proj=getProjections();
  if(!proj||!proj.goalDate)return null;
  return proj.goalDate.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}

function calcRate(entries,key){
  if(entries.length<2)return 0;
  const x0=new Date(entries[0].date+'T12:00:00').getTime();
  const points=entries.map(e=>({x:(new Date(e.date+'T12:00:00').getTime()-x0)/(1000*86400),y:e[key]}));
  const n=points.length;
  const sumX=points.reduce((s,p)=>s+p.x,0);
  const sumY=points.reduce((s,p)=>s+p.y,0);
  const sumXY=points.reduce((s,p)=>s+p.x*p.y,0);
  const sumXX=points.reduce((s,p)=>s+p.x*p.x,0);
  const denom=n*sumXX-sumX*sumX;
  if(denom===0)return 0;
  const slope=(n*sumXY-sumX*sumY)/denom;
  return Math.round(-slope*7*100)/100; // negative slope = losing → positive rate
}

function _addDays(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r;}
function _addWeeks(d,n){return _addDays(d,n*7);}

function getProjections(){
  const p=getActive();
  if(!p||!p.startDate)return null;
  const wl=getWeightLog().filter(e=>e.date>=p.startDate).sort((a,b)=>a.date.localeCompare(b.date));
  const bl=getBfLog().filter(e=>e.date>=p.startDate).sort((a,b)=>a.date.localeCompare(b.date));

  const wRate=calcRate(wl,'weight');
  const bRate=calcRate(bl,'bf');

  const currentW=wl.length?wl[wl.length-1].weight:p.startWeight;
  const currentBF=bl.length?bl[bl.length-1].bf:p.startBF;

  const weeksToWeight=(wRate>0&&p.targetWeight&&currentW>p.targetWeight)?Math.ceil((currentW-p.targetWeight)/wRate):null;
  const weeksToBF=(bRate>0&&p.targetBF&&currentBF>p.targetBF)?Math.ceil((currentBF-p.targetBF)/bRate):null;

  const today=new Date();
  const wDate=weeksToWeight?_addWeeks(today,weeksToWeight):null;
  const bDate=weeksToBF?_addWeeks(today,weeksToBF):null;
  const goalDate=wDate&&bDate?(wDate>bDate?wDate:bDate):(wDate||bDate);

  const entries=Math.min(wl.length,bl.length);
  const confidence=entries>=14?'high':entries>=7?'medium':'low';

  let range=null;
  if(goalDate){
    const buffer=confidence==='high'?14:confidence==='medium'?42:84;
    range={early:_addDays(goalDate,-buffer),late:_addDays(goalDate,buffer),point:goalDate,confidence};
  }

  const bindingMetric=wDate&&bDate?(wDate>=bDate?'weight':'bf'):(wDate?'weight':'bf');

  return{weightRate:wRate,bfRate:bRate,weeksToWeight,weeksToBF,wDate,bDate,goalDate,range,confidence,bindingMetric};
}

function getLBMDropAlert(){
  const rate=get14DayAvgRate('lbm');
  return rate<-0.05;
}

function getCurrentVisceralFat(){
  const bc=pGet('bodyComp',{});
  const dates=Object.keys(bc).filter(d=>bc[d].visceralFat!=null).sort();
  if(!dates.length)return null;
  return bc[dates[dates.length-1]].visceralFat;
}

function getStartVisceralFat(){
  const p=getActive();
  const start=p?.startDate;
  const bc=pGet('bodyComp',{});
  const dates=Object.keys(bc).filter(d=>bc[d].visceralFat!=null&&(!start||d>=start)).sort();
  if(!dates.length)return null;
  return bc[dates[0]].visceralFat;
}

function getProgressSummary(){
  const p=getActive();if(!p)return null;
  const cw=getCurrentWeight(),cbf=getCurrentBf(),clbm=getCurrentLBM(),cvf=getCurrentVisceralFat();
  const proj=getProjections();
  return{
    weight:{current:cw,start:p.startWeight,target:p.targetWeight,rate:get14DayAvgRate('weight'),projectedGoal:getProjectedGoalDate()},
    bf:{current:cbf,start:p.startBF,target:p.targetBF,rate:get14DayAvgRate('bf')},
    lbm:{current:clbm,start:p.startLBM,target:p.targetLBM,rate:get14DayAvgRate('lbm'),alert:getLBMDropAlert()},
    visceral:{current:cvf,start:getStartVisceralFat(),target:p.targetVisceralFat,rate:get14DayAvgRate('visceral')},
    projections:proj,
  };
}

// ============================================================
// STREAKS
// ============================================================
function calcStreak(type){
  let streak=0;
  const today=new Date();
  for(let i=0;i<365;i++){
    const d=new Date(today);d.setDate(d.getDate()-i);
    const key=_ukDate(d);
    let hit=false;
    if(type==='steps')hit=(getStepsLog()[key]||0)>=10000;
    else if(type==='food')hit=((pGet('foods',{})[key]||[]).length>0);
    else if(type==='gym'){
      // Skip scheduled rest days — they shouldn't break a training streak
      if(getSessionTypeForDate(key)===null){
        continue;
      }
      const exl=getExLog()[key]||{};
      hit=Object.values(exl).some(e=>e.done);
    }
    if(hit)streak++; else if(i>0)break;
  }
  return streak;
}

// ============================================================
// WEEKLY REPORT CARD
// ============================================================
function getWeeklyReport(){
  const p=getActive(); if(!p)return null;
  const days=getLast7();
  const stepsLog=getStepsLog();
  const foodLog=pGet('foods',{});
  const exLog=getExLog();
  const sleepLog=getSleepLog();

  const stepsHit=days.filter(d=>(stepsLog[d]||0)>=10000).length;
  const proteinDays=days.filter(d=>{
    const foods=foodLog[d]||[];
    return foods.reduce((s,f)=>s+(f.protein||0),0)>=p.proteinTarget*0.9;
  }).length;
  const gymDays=days.filter(d=>{
    const el=exLog[d]||{};
    return Object.values(el).filter(e=>e.done).length>=4;
  }).length;
  const avgSleep=getAvgSleep(7);
  const wl=getWeightLog();
  const weekWeights=wl.filter(e=>days.includes(e.date));
  const weightChange=weekWeights.length>=2?weekWeights[weekWeights.length-1].weight-weekWeights[0].weight:null;

  const scores={
    steps:Math.round((stepsHit/7)*100),
    protein:Math.round((proteinDays/7)*100),
    gym:Math.round((gymDays/4)*100),
    sleep:avgSleep>=7?100:avgSleep>=6?70:40,
  };
  const overall=Math.round((scores.steps+scores.protein+scores.gym+scores.sleep)/4);

  const planStart=STATE.planStartDate?new Date(STATE.planStartDate+'T00:00:00'):null;
  const isBaseline=!planStart||(Date.now()-planStart.getTime())<7*24*60*60*1000;

  return{stepsHit,proteinDays,gymDays,avgSleep,weightChange,scores,overall,isBaseline};
}

// Phase 20 migration: convert time-based exercise sets from {kg,reps} to {seconds}
function runPhase20Migration(){
  if(STATE.migrations?.phase20)return;
  const allEx=[...WORKOUTS.upper.exercises,...WORKOUTS.lower.exercises];
  const timeExIds=new Set(allEx.filter(e=>isTimeBased(e)).map(e=>e.id));
  const log=getExLog();
  let changed=false;
  Object.keys(log).forEach(date=>{
    const day=log[date];
    Object.keys(day).forEach(exId=>{
      if(!timeExIds.has(exId))return;
      const entry=day[exId];
      if(!entry.sets)return;
      entry.sets.forEach(s=>{
        if(s.seconds!==undefined)return; // already migrated
        if(s.kg||s.reps){
          s.seconds=parseFloat(s.kg)||parseInt(s.reps)||0;
          delete s.kg;delete s.reps;
          changed=true;
        }
      });
    });
  });
  if(!STATE.migrations)STATE.migrations={};
  STATE.migrations.phase20=true;
  STATE.exLog=log;
  updateLocalCache();
  if(changed)saveStateNow();
  else saveStateDebounced();
}

function grade(pct){
  if(pct>=90)return'A';
  if(pct>=75)return'B';
  if(pct>=60)return'C';
  return'F';
}
function gradeClass(pct){
  if(pct>=90)return'a';
  if(pct>=75)return'b';
  if(pct>=60)return'c';
  return'f';
}
