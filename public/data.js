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
      {id:'core_dead_bug',name:'Dead Bug',sets:3,reps:'10 each side',rest:45,muscle:'Core',size:'small',yt:'https://www.youtube.com/results?search_query=dead+bug+exercise+form'},
      {id:'neck_ext',name:'Neck Extension (lying)',sets:2,reps:'12–15',rest:45,muscle:'Neck',size:'small',yt:'https://www.youtube.com/results?search_query=lying+neck+extension+form'},
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
      {id:'l8',name:'Ab Crunch',sets:3,reps:'15',rest:45,muscle:'Core',size:'small',yt:'https://www.youtube.com/results?search_query=ab+crunch+form+technique'},
      {id:'core_dead_bug',name:'Dead Bug',sets:3,reps:'10 each side',rest:45,muscle:'Core',size:'small',yt:'https://www.youtube.com/results?search_query=dead+bug+exercise+form'},
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
  injuries: {},
  waterLog: {},
  fastingLog: {},
  mounjaroLog: {},
  notifications: [],
  exerciseNotes: {},
  manualSteps: {},
  stretchLog: {},
  stretchStreak: { morning: 0, evening: 0, combined: 0, lastMorningDate: null, lastEveningDate: null },
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
  // Phase 39: recalculate calorie + macro targets for the new weight
  if(typeof applyDynamicTargets==='function')applyDynamicTargets();
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
  if(typeof recomputeFastingLog==='function')recomputeFastingLog(date);
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
  if(typeof recomputeFastingLog==='function')recomputeFastingLog(date);
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
function saveSteps(val,date=todayStr()){
  const l=getStepsLog();l[date]=val;
  // Phase 41: tag this date as a manual entry so Oura sync won't overwrite it
  const m=pGet('manualSteps',{})||{};m[date]=true;
  STATE.stepsLog=l; STATE.manualSteps=m;
  localStorage.setItem("forge_state_cache", JSON.stringify(STATE));
  saveStateDebounced();
}

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
  return Object.values(log).filter(e=>e&&e.done).length>=4;
}

// ============================================================
// INJURY FLAG SYSTEM (Phase 38)
// state.injuries = { [id]: {id,name,bodyPart,severity,affectedExercises[],status,notes,createdAt,resolvedAt} }
// severity: 'mild' | 'moderate' | 'severe'   status: 'active' | 'resolved'
// ============================================================
const INJURY_SEVERITY_RANK={mild:1,moderate:2,severe:3};
const INJURY_WEIGHT_FACTOR={mild:0.80,moderate:0.65,severe:0};

function getInjuries(){
  const i=pGet('injuries',{});
  return (i&&typeof i==='object'&&!Array.isArray(i))?i:{};
}
function getActiveInjuries(){
  return Object.values(getInjuries()).filter(j=>j&&j.status!=='resolved');
}
function isExerciseInjured(exId){
  return getActiveInjuries().some(j=>Array.isArray(j.affectedExercises)&&j.affectedExercises.includes(exId));
}
// Highest-severity active injury affecting an exercise → 'mild'|'moderate'|'severe'|null
function getInjurySeverity(exId){
  let best=null,bestRank=0;
  for(const j of getActiveInjuries()){
    if(!Array.isArray(j.affectedExercises)||!j.affectedExercises.includes(exId))continue;
    const rank=INJURY_SEVERITY_RANK[j.severity]||1;
    if(rank>bestRank){bestRank=rank;best=j.severity||'mild';}
  }
  return best;
}
// First active injury affecting an exercise (for naming in banners/suggestions)
function getInjuryForExercise(exId){
  let best=null,bestRank=0;
  for(const j of getActiveInjuries()){
    if(!Array.isArray(j.affectedExercises)||!j.affectedExercises.includes(exId))continue;
    const rank=INJURY_SEVERITY_RANK[j.severity]||1;
    if(rank>bestRank){bestRank=rank;best=j;}
  }
  return best;
}
function saveInjuries(injuries){
  STATE.injuries=injuries;
  updateLocalCache();
  saveFieldToServer('/api/state/injuries',{injuries});
}
function addInjury(inj){
  const all=getInjuries();
  const id='inj_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
  all[id]={
    id,
    name:String(inj.name||'Injury').slice(0,120),
    bodyPart:String(inj.bodyPart||'').slice(0,80),
    severity:INJURY_SEVERITY_RANK[inj.severity]?inj.severity:'mild',
    affectedExercises:Array.isArray(inj.affectedExercises)?inj.affectedExercises.slice(0,40):[],
    status:'active',
    notes:String(inj.notes||'').slice(0,400),
    createdAt:todayStr(),
    resolvedAt:null,
  };
  saveInjuries(all);
  return id;
}
function updateInjury(id,patch){
  const all=getInjuries();
  if(!all[id])return;
  all[id]={...all[id],...patch,id};
  saveInjuries(all);
}
function resolveInjury(id){
  const all=getInjuries();
  if(!all[id])return;
  all[id].status='resolved';
  all[id].resolvedAt=todayStr();
  saveInjuries(all);
}
function deleteInjury(id){
  const all=getInjuries();
  delete all[id];
  saveInjuries(all);
}

// ============================================================
// SESSION TIMES (Phase 38) — per day-of-week training start time
// profile.sessionTimes = { "0".."6": "HH:MM" | null }   (0=Sun)
// ============================================================
const _DEFAULT_SESSION_TIMES={0:'14:30',1:'16:00',2:null,3:'16:00',4:null,5:'16:00',6:'14:30'};
function getSessionTimes(){
  const st=(STATE.profile&&STATE.profile.sessionTimes)||null;
  return (st&&typeof st==='object')?st:{..._DEFAULT_SESSION_TIMES};
}
// Training start time for a given date string (falls back to default)
function getSessionTimeForDate(dateStr){
  const dow=new Date((dateStr||todayStr())+'T12:00:00').getDay();
  const st=getSessionTimes();
  const v=st[String(dow)]!==undefined?st[String(dow)]:_DEFAULT_SESSION_TIMES[dow];
  return v||null;
}
function saveSessionTimes(times){
  if(!STATE.profile)STATE.profile={};
  STATE.profile.sessionTimes=times;
  updateLocalCache();
  saveFieldToServer('/api/state/profile/session-times',{sessionTimes:times});
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
let _suppLogSaveTimer=null;
function setSupplementTaken(date,suppId,taken){
  const log=pGet('supplementLog',{});
  if(!log[date])log[date]={};
  log[date][suppId]=taken;
  STATE.supplementLog=log;
  updateLocalCache();
  // Debounced — collapses the meal-modal's N rapid toggles into one atomic PUT
  if(_suppLogSaveTimer)clearTimeout(_suppLogSaveTimer);
  _suppLogSaveTimer=setTimeout(()=>{
    saveFieldToServer(`/api/state/supplement-log/${date}`,{value:(STATE.supplementLog||{})[date]||{}});
  },350);
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

// ============================================================
// PHASE 39 — NUTRITION SYSTEM
// ============================================================
const EATING_WINDOW_START=12;   // 12:00
const EATING_WINDOW_END=18;     // 18:00

// ---- S1: Dynamic calorie targets (Mifflin-St Jeor) ----
function getCurrentLeanMass(){
  const lbm=(typeof getCurrentLBM==='function')?getCurrentLBM():null;
  if(lbm)return lbm;
  const w=getCurrentWeight(),bf=getCurrentBf();
  if(w&&bf)return Math.round(w*(1-bf/100)*10)/10;
  return null;
}
function calculateDynamicTargets(weight,leanMass,sessionType){
  const personal=(STATE.profile&&STATE.profile.personal)||{};
  const age=personal.age||52;
  const heightCm=personal.heightCm||180;
  const sexConst=(personal.sex==='female')?-161:5;
  const bmr=(10*weight)+(6.25*heightCm)-(5*age)+sexConst;
  const tdee=bmr*1.55;
  const deficit=500;
  const sessionBonus=sessionType==='lower'?150:sessionType==='upper'?100:0;
  const calsTarget=tdee-deficit+sessionBonus;
  const proteinTarget=Math.max((leanMass||weight*0.7)*2.2,180);
  const fatTarget=(calsTarget*0.30)/9;
  const carbTarget=Math.max(0,(calsTarget-(proteinTarget*4)-(calsTarget*0.30))/4);
  return {
    calories:Math.round(calsTarget),
    protein:Math.round(proteinTarget),
    carbs:Math.round(carbTarget),
    fat:Math.round(fatTarget),
    bmr:Math.round(bmr),
    tdee:Math.round(tdee),
    sessionType,
  };
}
// Recompute targets for all three session types + persist to profile
function applyDynamicTargets(){
  if(!STATE.profile)return null;
  const weight=getCurrentWeight();
  if(!weight)return null;
  const lean=getCurrentLeanMass();
  const dt={
    rest:calculateDynamicTargets(weight,lean,'rest'),
    upper:calculateDynamicTargets(weight,lean,'upper'),
    lower:calculateDynamicTargets(weight,lean,'lower'),
    calculatedFrom:weight,
    calculatedAt:new Date().toISOString(),
  };
  const start=STATE.profile.startWeight||weight;
  dt.milestoneCount=Math.max(0,Math.floor((start-weight)/5));
  const prev=STATE.profile.dynamicTargets;
  dt.milestoneJustHit=!!(prev&&typeof prev.milestoneCount==='number'&&dt.milestoneCount>prev.milestoneCount);
  STATE.profile.dynamicTargets=dt;
  // keep legacy fields loosely in sync
  STATE.profile.calsRest=dt.rest.calories;
  STATE.profile.calsGym=Math.round((dt.upper.calories+dt.lower.calories)/2);
  STATE.profile.proteinTarget=dt.rest.protein;
  STATE.profile.carbsTarget=dt.rest.carbs;
  STATE.profile.fatTarget=dt.rest.fat;
  if(!STATE.profile.macros)STATE.profile.macros={};
  STATE.profile.macros.protein=dt.rest.protein;
  STATE.profile.macros.carbs=dt.rest.carbs;
  STATE.profile.macros.fat=dt.rest.fat;
  updateLocalCache();
  saveFieldToServer('/api/state/profile/dynamic-targets',{dynamicTargets:dt});
  return dt;
}
// Calorie + macro target for a date, session-aware
function getDynamicTargetForDate(date){
  const st=(typeof getSessionTypeForDate==='function')?getSessionTypeForDate(date||todayStr()):null;
  const key=st||'rest';
  const dt=STATE.profile&&STATE.profile.dynamicTargets;
  if(dt&&dt[key])return dt[key];
  const p=STATE.profile||{};
  return {calories:st?(p.calsGym||2500):(p.calsRest||2400),protein:p.proteinTarget||180,carbs:p.carbsTarget||0,fat:p.fatTarget||0,sessionType:key};
}

// ---- S2: Fasting window ----
function getFastingLog(date){
  const e=pGet('fastingLog',{})[date||todayStr()];
  return (e&&Object.keys(e).length)?e:null;
}
function isFastingWindowOpen(){
  const h=new Date().getHours()+new Date().getMinutes()/60;
  return h>=EATING_WINDOW_START&&h<EATING_WINDOW_END;
}
// {phase:'before'|'open'|'after', minsToOpen, minsToClose, fastedMins / elapsedMins}
function getWindowCountdown(){
  const now=new Date();
  const h=now.getHours()+now.getMinutes()/60;
  const minsInDay=now.getHours()*60+now.getMinutes();
  const openMin=EATING_WINDOW_START*60, closeMin=EATING_WINDOW_END*60;
  if(h<EATING_WINDOW_START){
    return {phase:'before',minsToOpen:openMin-minsInDay,minsToClose:closeMin-minsInDay,fastedMins:minsInDay+(24*60-closeMin)};
  }
  if(h<EATING_WINDOW_END){
    return {phase:'open',minsToOpen:0,minsToClose:closeMin-minsInDay,elapsedMins:minsInDay-openMin,windowMins:closeMin-openMin};
  }
  return {phase:'after',minsToOpen:(24*60-minsInDay)+openMin,minsToClose:0,fastedMins:minsInDay-closeMin};
}
// Recompute today's fasting log from logged foods (called on each food change)
function recomputeFastingLog(date){
  date=date||todayStr();
  const foods=(pGet('foods',{})[date]||[]).filter(f=>f);
  const log=pGet('fastingLog',{});
  if(foods.length===0){
    if(log[date]){delete log[date];STATE.fastingLog=log;updateLocalCache();saveFieldToServer(`/api/state/fasting-log/${date}`,{value:{}});}
    return;
  }
  const times=foods.map(f=>{
    if(f.loggedAt){const d=new Date(f.loggedAt);return d.getHours()*60+d.getMinutes();}
    if(f.time){const [h,m]=String(f.time).split(':').map(Number);return (h||0)*60+(m||0);}
    return null;
  }).filter(t=>t!=null).sort((a,b)=>a-b);
  if(!times.length)return;
  const first=times[0],last=times[times.length-1];
  const openMin=EATING_WINDOW_START*60,closeMin=EATING_WINDOW_END*60;
  const broken=first<openMin||last>closeMin;
  const fmt=t=>String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
  const entry={
    windowMaintained:!broken,
    firstFoodTime:fmt(first),
    lastFoodTime:fmt(last),
    fastDurationHours:Math.round(((24*60-closeMin)+first)/60*10)/10,
    windowBroken:broken,
    windowBrokenAt:broken?(first<openMin?fmt(first):fmt(last)):null,
  };
  log[date]=entry;
  STATE.fastingLog=log;
  updateLocalCache();
  saveFieldToServer(`/api/state/fasting-log/${date}`,{value:entry});
}
function getFastingStreak(){
  const log=pGet('fastingLog',{});
  let streak=0;
  for(let i=0;i<400;i++){
    const d=new Date();d.setDate(d.getDate()-i);
    const e=log[_ukDate(d)];
    if(!e||(!e.windowMaintained&&!e.windowBroken)){ if(i===0)continue; break; }
    if(e.windowBroken)break;
    streak++;
  }
  return streak;
}

// ---- S3: Mounjaro mode ----
function isPostInjectionDay(){return new Date().getDay()===4;} // Thursday
const MOUNJARO_PRIORITY_FOODS=[
  {name:'Protein shake',protein:20,cals:85,note:'easy on the stomach'},
  {name:'Greek yoghurt 200g',protein:20,cals:120,note:'cold, soothing'},
  {name:'Cottage cheese 150g',protein:19,cals:130,note:'slow protein'},
  {name:'Boiled eggs ×3',protein:18,cals:210,note:'choline supports the liver'},
  {name:'Sidr honey + warm water',protein:0,cals:60,note:'settles the stomach'},
  {name:'Ginger tea',protein:0,cals:0,note:'nausea relief'},
];
function getMounjaroLog(date){return (pGet('mounjaroLog',{})[date||todayStr()])||null;}
function setMounjaroLog(date,patch){
  date=date||todayStr();
  const log=pGet('mounjaroLog',{});
  log[date]={...(log[date]||{}),...patch};
  STATE.mounjaroLog=log;
  updateLocalCache();
  saveFieldToServer(`/api/state/mounjaro-log/${date}`,{value:log[date]});
  return log[date];
}

// ---- S4: Per-meal protein threshold ----
const PROTEIN_THRESHOLD=40;
function getMealProteinStatus(grams){
  const g=Math.round(grams||0);
  if(g>=PROTEIN_THRESHOLD)return{band:'met',color:'var(--green)',label:`✓ ${g}g — 40g+ threshold met`};
  if(g>=30)return{band:'near',color:'var(--orange)',label:`⚠️ ${g}g — just below threshold`};
  return{band:'low',color:'var(--red)',label:`❌ ${g}g — below 40g threshold`};
}
// Per-meal logged protein for a date (foods grouped by mealId)
function getProteinDistribution(date){
  date=date||todayStr();
  const plan=STATE.mealPlan;
  const foods=pGet('foods',{})[date]||[];
  const meals=(plan&&plan.meals)||[];
  return meals.map(m=>{
    const logged=foods.filter(f=>f.mealId===m.id).reduce((s,f)=>s+(f.protein||0),0);
    return {id:m.id,name:m.name,planned:Math.round(m.protein||0),protein:Math.round(logged||0)};
  });
}
function getProteinDistributionScore(date){
  const rows=getProteinDistribution(date).slice(0,3);
  if(!rows.length)return null;
  const hits=rows.filter(r=>r.protein>=PROTEIN_THRESHOLD).length;
  const labels=['Critical — no meals hit threshold','Needs improvement','Good — one meal below threshold','Optimal protein distribution'];
  return {hits,total:rows.length,label:labels[hits]||labels[0]};
}

// ---- S5: Supplement timing groups ----
const SUPP_TIMING_GROUPS=[
  {key:'on-waking',label:'Morning · on waking'},
  {key:'meal-1',label:'Meal 1 · 12:00'},
  {key:'meal-2',label:'Meal 2 · 15:00'},
  {key:'meal-3',label:'Meal 3 · 17:30'},
  {key:'with-food',label:'Medications · with food'},
  {key:'wednesday-meal-2',label:'Weekly · Wednesday'},
  {key:'bedtime',label:'Bedtime'},
];
function getSupplementTiming(s){return s.timing||(s.mealId?'meal-1':'meal-1');}
function getMissedCriticalSupplements(date){
  date=date||todayStr();
  const log=getSupplementLog(date);
  const dow=new Date(date+'T12:00:00').getDay();
  return getSupplements().filter(s=>{
    if(!s.critical)return false;
    if(s.frequency==='weekly-wednesday'&&dow!==3)return false;
    return log[s.id]!==true;
  });
}
function getSupplementCompliance(days){return getSupplementAdherence(days);}
// ============================================================
// PHASE 41 — STRETCH ROUTINES (owner-only feature)
// ============================================================
const STRETCH_ROUTINES = {
  morning: {
    id: 'morning',
    title: 'Morning Mobility',
    subtitle: 'Wake up — fix posture — protect lower back',
    totalMinutes: 12,
    bestTime: 'On waking — before anything else',
    stretches: [
      { id:'s1_childs_pose', name:"Child's Pose", duration:90, unit:'seconds', sides:false,
        instructions:"Kneel on floor. Sit back toward heels. Extend arms forward on floor. Let lower back release completely. Breathe deeply into the stretch.",
        benefit:"Decompresses spine after sleep. Most important stretch for lower back injury.",
        cue:"Focus on breathing out tension in lower back",
        injury_note:"Safe for lower back injury — therapeutic" },
      { id:'s2_cat_cow', name:'Cat Cow', duration:10, unit:'reps', sides:false,
        instructions:"On hands and knees. Arch back up toward ceiling — hold 2 seconds. Drop belly toward floor — hold 2 seconds. Alternate slowly.",
        benefit:"Lubricates spine. Restores spinal mobility. Warms up every vertebra.",
        cue:"Slow and controlled — feel every vertebra moving" },
      { id:'s3_hip_flexor', name:'Hip Flexor Stretch', duration:60, unit:'seconds', sides:true,
        instructions:"Kneel on one knee. Front foot forward. Push hips forward gently until stretch felt in front of rear hip. Keep torso upright. Do not lean forward.",
        benefit:"Fixes anterior pelvic tilt. Directly reduces lower back pain. Counteracts sitting all day.",
        cue:"Tuck pelvis under slightly to deepen stretch" },
      { id:'s4_glute_bridge', name:'Glute Bridge Activation', duration:20, unit:'reps', sides:false,
        instructions:"Lie on back. Knees bent. Feet flat on floor. Push hips up toward ceiling. Squeeze glutes at top. Hold 2 seconds. Lower slowly.",
        benefit:"Activates dormant glutes. Counteracts flat glute development. Wakes up posterior chain.",
        cue:"Squeeze glutes hard at top — not just lifting hips" },
      { id:'s5_chest_stretch', name:'Doorway Chest Stretch', duration:45, unit:'seconds', sides:false,
        instructions:"Stand in doorway. Arms out at 90 degrees. Forearms against door frame. Lean gently forward until stretch felt across chest and front shoulders.",
        benefit:"Fixes forward shoulder rounding. Opens chest. Makes shoulders look broader.",
        cue:"Keep chin up — do not let head drop forward" },
      { id:'s6_thoracic_rotation', name:'Thoracic Rotation', duration:10, unit:'reps each side', sides:true,
        instructions:"Sit cross legged on floor. Hands behind head. Rotate upper body left and right slowly. Keep hips still. Only upper back rotates.",
        benefit:"Improves upper back mobility. Reduces stiffness from sitting. Improves posture.",
        cue:"Lead with elbow — rotate as far as comfortable" },
      { id:'s7_pelvic_tilt', name:'Pelvic Tilt', duration:15, unit:'reps', sides:false,
        instructions:"Lie on back. Knees bent. Flatten lower back into floor by squeezing glutes and abs simultaneously. Hold 5 seconds. Release. Repeat.",
        benefit:"Directly corrects anterior pelvic tilt. Retrains core and glutes. Visually flattens stomach.",
        cue:"Imagine pressing your lower back like a stamp into the floor" },
      { id:'s8_hamstring_stretch', name:'Standing Hamstring Stretch', duration:45, unit:'seconds', sides:true,
        instructions:"Stand tall. Place one heel on a low surface or keep foot on floor. Keep leg straight. Hinge forward from hips — not waist — until stretch felt in back of thigh.",
        benefit:"Releases tight hamstrings pulling pelvis forward. Supports RDL performance. Reduces lower back pain.",
        cue:"Hinge from hips not waist — keep back flat" },
    ],
  },
  evening: {
    id: 'evening',
    title: 'Evening Recovery',
    subtitle: 'Release the day — recover — prepare for sleep',
    totalMinutes: 15,
    bestTime: '60–90 minutes before bedtime',
    stretches: [
      { id:'e1_childs_pose', name:"Child's Pose", duration:90, unit:'seconds', sides:false,
        instructions:"Kneel on floor. Sit back toward heels. Extend arms forward on floor. Focus on releasing accumulated tension from the day. Breathe deeply.",
        benefit:"Releases spinal compression from full day. Calms nervous system. Prepares body for sleep.",
        cue:"Let every muscle release — nothing to do now" },
      { id:'e2_figure_four', name:'Figure Four Glute Stretch', duration:60, unit:'seconds', sides:true,
        instructions:"Lie on back. Cross right ankle over left knee. Pull both legs toward chest. Hold behind left thigh. Keep head on floor.",
        benefit:"Releases glutes and piriformis after training and sitting. Reduces lower back pain overnight.",
        cue:"Flex the foot of the crossed leg to protect the knee" },
      { id:'e3_forward_fold', name:'Seated Forward Fold', duration:60, unit:'seconds', sides:false,
        instructions:"Sit on floor. Legs straight in front. Reach toward feet as far as comfortable. Do not round the back aggressively. Breathe and relax into it.",
        benefit:"Lengthens entire posterior chain. Releases hamstrings, lower back and calves simultaneously.",
        cue:"Do not force — breathe and let gravity do the work" },
      { id:'e4_spinal_twist', name:'Supine Spinal Twist', duration:60, unit:'seconds', sides:true,
        instructions:"Lie on back. Bring one knee across body toward floor. Keep both shoulders flat on floor. Arms out to sides. Look away from the knee.",
        benefit:"Decompresses lumbar spine. Releases lower back tension. One of best pre-sleep stretches.",
        cue:"Keep shoulders flat — let gravity rotate the hip" },
      { id:'e5_legs_up_wall', name:'Legs Up the Wall', duration:180, unit:'seconds', sides:false,
        instructions:"Sit sideways against wall. Swing legs up wall. Lie flat on back. Arms by sides. Close eyes. Breathe slowly.",
        benefit:"Reverses blood pooling in legs. Reduces leg inflammation after training. Signals body day is over.",
        cue:"Close eyes — this is the transition from day to rest" },
      { id:'e6_neck_rolls', name:'Neck Rolls', duration:10, unit:'reps each direction', sides:true,
        instructions:"Sit comfortably. Drop chin to chest. Slowly roll head to one side — back — other side — forward. Gentle and slow. Never force.",
        benefit:"Releases neck tension from screens and driving. Maintains mobility as neck exercises are added.",
        cue:"Slow is more effective than fast — feel every point of tension" },
      { id:'e7_deep_breathing', name:'4-7-8 Breathing', duration:300, unit:'seconds', sides:false,
        instructions:"Sit or lie comfortably. Inhale through nose for 4 counts. Hold for 7 counts. Exhale through mouth for 8 counts. Repeat for 5 minutes.",
        benefit:"Activates parasympathetic nervous system. Lowers cortisol. Most powerful non-pharmaceutical sleep aid.",
        cue:"The exhale longer than inhale is the key — this is what calms the nervous system" },
    ],
  },
};

// Owner-only gate for the stretching feature (jay@afjltd.co.uk).
// Wraps isOwner() so the spec's contract is preserved.
function isStretchUser(){
  return (typeof isOwner==='function')?isOwner():false;
}

function getStretchRoutine(type){ return STRETCH_ROUTINES[type]||null; }
function getStretchLog(date){ return (pGet('stretchLog',{})[date||todayStr()])||{}; }
function _ensureStretchDay(log,date,type){
  if(!log[date])log[date]={};
  if(!log[date][type])log[date][type]={completed:false,startedAt:null,completedAt:null,completedStretches:[],skippedStretches:[]};
  return log[date][type];
}
function markStretchDone(date,type,stretchId){
  const log=pGet('stretchLog',{});
  const r=_ensureStretchDay(log,date,type);
  if(!r.startedAt)r.startedAt=new Date().toISOString();
  if(!r.completedStretches.includes(stretchId))r.completedStretches.push(stretchId);
  r.skippedStretches=r.skippedStretches.filter(x=>x!==stretchId);
  STATE.stretchLog=log;
  updateLocalCache();
  saveFieldToServer(`/api/state/stretch-log/${date}`,{value:log[date]});
}
function markStretchSkipped(date,type,stretchId){
  const log=pGet('stretchLog',{});
  const r=_ensureStretchDay(log,date,type);
  if(!r.startedAt)r.startedAt=new Date().toISOString();
  if(!r.skippedStretches.includes(stretchId))r.skippedStretches.push(stretchId);
  r.completedStretches=r.completedStretches.filter(x=>x!==stretchId);
  STATE.stretchLog=log;
  updateLocalCache();
  saveFieldToServer(`/api/state/stretch-log/${date}`,{value:log[date]});
}
function saveStretchSession(date,type,feel){
  const log=pGet('stretchLog',{});
  if(!log[date]||!log[date][type])return;
  const r=log[date][type];
  r.completedAt=new Date().toISOString();
  r.completed=true;
  if(feel)r.feel=feel;
  STATE.stretchLog=log;
  // recompute streak quickly
  const streak=pGet('stretchStreak',{morning:0,evening:0,combined:0});
  streak[type]=getStretchStreak(type);
  streak.lastMorningDate=type==='morning'?date:streak.lastMorningDate;
  streak.lastEveningDate=type==='evening'?date:streak.lastEveningDate;
  STATE.stretchStreak=streak;
  updateLocalCache();
  saveFieldToServer(`/api/state/stretch-log/${date}`,{value:log[date]});
}
function isRoutineComplete(date,type){
  const log=pGet('stretchLog',{});
  return !!(log[date]&&log[date][type]&&log[date][type].completed);
}
function getStretchStreak(type){
  const log=pGet('stretchLog',{});
  let streak=0;
  for(let i=0;i<400;i++){
    const d=new Date();d.setDate(d.getDate()-i);
    const ds=_ukDate(d);
    const entry=(log[ds]||{})[type];
    if(!entry||!entry.completed){
      if(i===0)continue; // today incomplete doesn't break the streak yet
      break;
    }
    streak++;
  }
  return streak;
}
function getStretchCompliance(days){
  const log=pGet('stretchLog',{});
  let mDone=0,eDone=0;
  for(let i=0;i<days;i++){
    const d=new Date();d.setDate(d.getDate()-i);
    const entry=log[_ukDate(d)]||{};
    if(entry.morning&&entry.morning.completed)mDone++;
    if(entry.evening&&entry.evening.completed)eDone++;
  }
  const total=days;
  return {
    morning:{done:mDone,total,pct:Math.round((mDone/total)*100)},
    evening:{done:eDone,total,pct:Math.round((eDone/total)*100)},
    combined:{done:mDone+eDone,total:total*2,pct:Math.round(((mDone+eDone)/(total*2))*100)},
  };
}
function getMostSkippedStretch(days,type){
  const log=pGet('stretchLog',{});
  const counts={};
  for(let i=0;i<days;i++){
    const d=new Date();d.setDate(d.getDate()-i);
    const entry=(log[_ukDate(d)]||{})[type];
    if(!entry||!Array.isArray(entry.skippedStretches))continue;
    entry.skippedStretches.forEach(id=>{counts[id]=(counts[id]||0)+1;});
  }
  let topId=null,topN=0;
  for(const [id,n] of Object.entries(counts)){if(n>topN){topN=n;topId=id;}}
  if(!topId)return null;
  const s=(STRETCH_ROUTINES[type]?.stretches||[]).find(x=>x.id===topId);
  return {id:topId,name:s?.name||topId,count:topN};
}

// Canonical supplement list for Jay (Phase 39)
function JAY_SUPPLEMENTS_V39(){
  return [
    {id:'supp-sidr-honey',name:'Sidr Honey',dose:'1 tsp in warm water',time:'07:30',mealId:'',timing:'on-waking',withFood:false,critical:true,notes:'Morning ritual'},
    {id:'supp-multivitamin',name:'Multivitamin',dose:'2 tablets',time:'12:00',mealId:'',timing:'meal-1',withFood:true,critical:false,notes:''},
    {id:'vit-d',name:'Vitamin D3',dose:'4,000 IU',time:'12:00',mealId:'',timing:'meal-1',withFood:true,critical:true,notes:'Fat-soluble — take with food'},
    {id:'omega-3',name:'Omega 3',dose:'2 capsules',time:'15:00',mealId:'',timing:'meal-2',withFood:true,critical:true,notes:'Anti-inflammatory'},
    {id:'supp-omega3-2',name:'Omega 3 (2nd dose)',dose:'2 capsules',time:'17:30',mealId:'',timing:'meal-3',withFood:true,critical:true,notes:'Anti-inflammatory'},
    {id:'supp-magnesium',name:'Magnesium Glycinate',dose:'300mg',time:'22:00',mealId:'',timing:'bedtime',withFood:false,critical:true,notes:'Sleep support'},
    {id:'metformin-am',name:'Metformin',dose:'1000mg',time:'12:00',mealId:'',timing:'with-food',withFood:true,critical:true,notes:'Medication — take with food'},
    {id:'supp-mounjaro',name:'Mounjaro',dose:'5mg',time:'15:00',mealId:'',timing:'wednesday-meal-2',withFood:true,critical:true,frequency:'weekly-wednesday',notes:'GLP-1 — Wednesday injection after meal 2'},
    {id:'supp-zinc',name:'Zinc',dose:'30mg',time:'12:00',mealId:'',timing:'meal-1',withFood:true,critical:false,notes:'With meal 1 — testosterone + immune support'},
    {id:'supp-coq10',name:'CoQ10',dose:'200mg',time:'15:00',mealId:'',timing:'meal-2',withFood:true,critical:false,notes:'With meal 2 — fat-soluble, statin-induced CoQ10 depletion support'},
  ];
}

// ---- S6: Water tracker (ml) ----
const WATER_TARGET_BASE=3000, WATER_TARGET_GYM=3500;
function getWaterLog(date){
  const log=pGet('waterLog',{});
  return log[date||todayStr()]||{entries:[],total:0};
}
function getWaterTarget(date){
  const st=(typeof getSessionTypeForDate==='function')?getSessionTypeForDate(date||todayStr()):null;
  return st?WATER_TARGET_GYM:WATER_TARGET_BASE;
}
function getWaterTotal(date){return getWaterLog(date).total||0;}
function _saveWaterLog(date,entry){
  const log=pGet('waterLog',{});
  log[date]=entry;
  STATE.waterLog=log;
  updateLocalCache();
  saveFieldToServer(`/api/state/water-log/${date}`,{value:entry});
}
function addWaterEntry(date,amount,type){
  date=date||todayStr();
  const entries=[...(getWaterLog(date).entries||[])];
  entries.push({amount:Math.round(amount),time:fmtNow(),type:type||'custom'});
  _saveWaterLog(date,{entries,total:entries.reduce((s,e)=>s+(e.amount||0),0),target:getWaterTarget(date)});
}
function removeLastWaterEntry(date){
  date=date||todayStr();
  const entries=[...(getWaterLog(date).entries||[])];
  entries.pop();
  _saveWaterLog(date,{entries,total:entries.reduce((s,e)=>s+(e.amount||0),0),target:getWaterTarget(date)});
}
function getWaterCompliance(days){
  const log=pGet('waterLog',{});
  let hit=0,counted=0,sum=0,lo=null,hi=null;
  for(let i=0;i<days;i++){
    const d=new Date();d.setDate(d.getDate()-i);
    const e=log[_ukDate(d)];
    if(!e)continue;
    counted++;sum+=e.total||0;
    if((e.total||0)>=(e.target||WATER_TARGET_BASE))hit++;
    if(lo==null||e.total<lo)lo=e.total||0;
    if(hi==null||e.total>hi)hi=e.total||0;
  }
  return{hit,counted,avg:counted?Math.round(sum/counted):0,low:lo||0,high:hi||0,days};
}
// One-shot: migrate old cup tracker (×250ml) into waterLog (local only)
function migrateWaterCups(){
  if(STATE._waterMigrated)return;
  const cups=pGet('water',{});
  const wl=pGet('waterLog',{});
  Object.keys(cups).forEach(date=>{
    if(wl[date])return;
    const n=cups[date]||0;
    if(n>0)wl[date]={entries:[{amount:n*250,time:'12:00',type:'migrated'}],total:n*250,target:WATER_TARGET_BASE};
  });
  STATE.waterLog=wl;
  STATE._waterMigrated=true;
  updateLocalCache();
}

// ---- S7: Glycaemic index estimate (keyword-based) ----
const _GI_HIGH=['white rice','jasmine rice','white bread','bagel','mashed potato','potato','cornflakes','rice cake','watermelon','dates','sugar','glucose','soda','cola','fruit juice','crisps','chips','pretzel','doughnut','donut','cereal'];
const _GI_MOD=['basmati','brown rice','wholemeal','whole wheat','wholewheat','oats','porridge','sweet potato','banana','pasta','couscous','honey','pitta','popcorn','mango','raisin'];
const _GI_LOW=['chicken','turkey','beef','egg','salmon','fish','tuna','yoghurt','yogurt','greek','cottage cheese','cheese','lentil','chickpea','bean','berry','berries','blueberr','strawberr','raspberr','apple','pear','broccoli','spinach','salad','vegetable','veg ','nuts','almond','peanut','avocado','milk','protein shake','whey','tofu','barley','quinoa','hummus'];
function estimateGI(name){
  const n=String(name||'').toLowerCase();
  if(_GI_HIGH.some(k=>n.includes(k)))return{gi:70,band:'high',label:'🔴 Higher GI — monitor'};
  if(_GI_MOD.some(k=>n.includes(k)))return{gi:50,band:'moderate',label:'🟡 Moderate GI'};
  if(_GI_LOW.some(k=>n.includes(k)))return{gi:30,band:'low',label:'🟢 Low GI'};
  return{gi:null,band:'unknown',label:''};
}
function getBloodMarker(nameKeyword){
  const arr=(STATE.profile&&STATE.profile.bloodMarkers)||[];
  if(!Array.isArray(arr))return null;
  const k=String(nameKeyword).toLowerCase();
  return arr.find(m=>String(m.name||'').toLowerCase().includes(k))||null;
}

// ---- S8: Training–nutrition integration ----
function getMinutesToSession(){
  const st=(typeof getSessionTypeForDate==='function')?getSessionTypeForDate(todayStr()):null;
  if(!st)return null;
  const time=(typeof getSessionTimeForDate==='function')?getSessionTimeForDate(todayStr()):null;
  if(!time)return null;
  const [h,m]=time.split(':').map(Number);
  const now=new Date();
  return (h*60+(m||0))-(now.getHours()*60+now.getMinutes());
}
// {phase:'open'|'done'|'missed', minsLeft}
function getPostWorkoutWindow(){
  const day=(pGet('exLog',{})[todayStr()])||{};
  const sess=day._session;
  if(!sess||!sess.completedAt)return null;
  const mins=(Date.now()-sess.completedAt)/60000;
  const foods=pGet('foods',{})[todayStr()]||[];
  const shake=foods.some(f=>{
    const n=(f.name||'').toLowerCase();
    if(!(n.includes('shake')||n.includes('whey')||n.includes('protein')))return false;
    if(!f.loggedAt)return true;
    return new Date(f.loggedAt).getTime()>=sess.completedAt;
  });
  if(shake)return{phase:'done',minsLeft:0};
  if(mins>60)return{phase:'missed',minsLeft:0};
  return{phase:'open',minsLeft:Math.max(0,Math.round(60-mins))};
}
function getSessionCalorieBurn(){
  const st=(typeof getSessionTypeForDate==='function')?getSessionTypeForDate(todayStr()):null;
  if(!st)return 0;
  const cal=(pGet('calorieLog',{})[todayStr()]);
  if(cal&&cal.workout)return Math.round(cal.workout);
  return st==='lower'?450:350;
}

// ---- Phase 40: notifications ----
function getNotifications(){
  const list=pGet('notifications',[]);
  if(!Array.isArray(list))return [];
  const today=todayStr();
  return list.filter(n=>n&&(!n.expiresAt||n.expiresAt>=today));
}
function getUnreadNotificationCount(){return getNotifications().filter(n=>!n.read).length;}
function markNotificationRead(id){
  const list=pGet('notifications',[]);
  if(!Array.isArray(list))return;
  const n=list.find(x=>x&&x.id===id);
  if(n)n.read=true;
  STATE.notifications=list;
  updateLocalCache();
  const jwt=localStorage.getItem('forge_token');
  if(jwt)fetch(`/api/state/notifications/${id}/read`,{method:'PUT',headers:{Authorization:'Bearer '+jwt}}).catch(()=>{});
}
function markAllNotificationsRead(){
  const list=pGet('notifications',[]);
  if(!Array.isArray(list))return;
  list.forEach(n=>{if(n)n.read=true;});
  STATE.notifications=list;
  updateLocalCache();
  const jwt=localStorage.getItem('forge_token');
  if(jwt)getNotifications().forEach(n=>{
    fetch(`/api/state/notifications/${n.id}/read`,{method:'PUT',headers:{Authorization:'Bearer '+jwt}}).catch(()=>{});
  });
}
function dismissExpiredNotifications(){
  const list=pGet('notifications',[]);
  if(!Array.isArray(list)||!list.length)return;
  const today=todayStr();
  const fresh=list.filter(n=>n&&(!n.expiresAt||n.expiresAt>=today));
  if(fresh.length!==list.length){
    STATE.notifications=fresh;
    updateLocalCache();
    const jwt=localStorage.getItem('forge_token');
    if(jwt)fetch('/api/state/notifications/expired',{method:'DELETE',headers:{Authorization:'Bearer '+jwt}}).catch(()=>{});
  }
}
