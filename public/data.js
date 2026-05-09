// ============================================================
// DATA LAYER
// ============================================================

const WORKOUTS = {
  upper: {
    name:'UPPER BODY', type:'upper',
    muscles:'Chest · Back · Shoulders · Biceps · Triceps · Core',
    duration:'55–60',
    exercises:[
      {id:'u1',name:'Chest Press',sets:4,reps:'6–8',rest:90,muscle:'Chest',yt:'https://www.youtube.com/results?search_query=chest+press+form'},
      {id:'u2',name:'Incline Dumbbell Press',sets:3,reps:'8–10',rest:90,muscle:'Upper Chest',yt:'https://www.youtube.com/results?search_query=incline+dumbbell+press+form'},
      {id:'u3',name:'Seated Row',sets:4,reps:'6–8',rest:90,muscle:'Back',yt:'https://www.youtube.com/results?search_query=seated+cable+row+form'},
      {id:'u4',name:'Shoulder Press',sets:3,reps:'6–8',rest:90,muscle:'Shoulders',yt:'https://www.youtube.com/results?search_query=dumbbell+shoulder+press+form'},
      {id:'u5',name:'Lat Pulldown',sets:3,reps:'8–10',rest:90,muscle:'Lats',yt:'https://www.youtube.com/results?search_query=lat+pulldown+form'},
      {id:'u6',name:'Bicep Curl',sets:3,reps:'10–12',rest:60,muscle:'Biceps',yt:'https://www.youtube.com/results?search_query=dumbbell+bicep+curl+form'},
      {id:'u7',name:'Tricep Pushdown',sets:3,reps:'10–12',rest:60,muscle:'Triceps',yt:'https://www.youtube.com/results?search_query=tricep+pushdown+form'},
      {id:'u8',name:'Face Pull',sets:3,reps:'12–15',rest:45,muscle:'Rear Delts',yt:'https://www.youtube.com/results?search_query=face+pull+exercise+form'},
      {id:'u9',name:'Plank',sets:3,reps:'30–45s',rest:45,muscle:'Core',yt:'https://www.youtube.com/results?search_query=plank+form+technique'},
    ]
  },
  lower: {
    name:'LOWER BODY', type:'lower',
    muscles:'Quads · Hamstrings · Glutes · Calves · Lower Back · Core',
    duration:'60–65',
    exercises:[
      {id:'l1',name:'Leg Press',sets:4,reps:'6–8',rest:120,muscle:'Quads',yt:'https://www.youtube.com/results?search_query=leg+press+form+technique'},
      {id:'l2',name:'Romanian Deadlift',sets:4,reps:'6–8',rest:120,muscle:'Hamstrings',yt:'https://www.youtube.com/results?search_query=romanian+deadlift+form'},
      {id:'l3',name:'Leg Extension',sets:3,reps:'10–12',rest:60,muscle:'Quads',yt:'https://www.youtube.com/results?search_query=leg+extension+machine+form'},
      {id:'l4',name:'Leg Curl',sets:3,reps:'10–12',rest:60,muscle:'Hamstrings',yt:'https://www.youtube.com/results?search_query=leg+curl+machine+form'},
      {id:'l5',name:'Hip Thrust',sets:3,reps:'8–10',rest:90,muscle:'Glutes',yt:'https://www.youtube.com/results?search_query=hip+thrust+barbell+form'},
      {id:'l6',name:'Calf Raise',sets:4,reps:'15–20',rest:45,muscle:'Calves',yt:'https://www.youtube.com/results?search_query=calf+raise+form'},
      {id:'l7',name:'Back Extension',sets:3,reps:'12–15',rest:60,muscle:'Lower Back',yt:'https://www.youtube.com/results?search_query=back+extension+form'},
      {id:'l8',name:'Ab Crunch',sets:3,reps:'15',rest:45,muscle:'Core',yt:'https://www.youtube.com/results?search_query=ab+crunch+form+technique'},
    ]
  }
};

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
  photos: [],
  foodTemplates: [],
  bfLog: [],
  mealPlan: null,
  recovery: {},
  bodyComp: {},
  coachingReports: [],
  planStartDate: null,
  trainingStartDate: null,
  waterClicked: {},
};
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
  const keys = ["weightLog","foods","stepsLog","exLog","measLog","sleepLog","swimLog","supps","suppDone","water","photos","foodTemplates"];
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
function todayStr(){return new Date().toISOString().split('T')[0];}
function dayOfWeek(){return new Date().getDay();} // 0=Sun
function getTodaySession(){return getSessionTypeForDate(todayStr());}
function dayName(){return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dayOfWeek()];}
function fmtDate(str){return new Date(str+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});}
function fmtNow(){const n=new Date();return n.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});}
function getLast7(){
  const days=[];
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(d.toISOString().split('T')[0]);}
  return days;
}
function getLast30(){
  const days=[];
  for(let i=29;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(d.toISOString().split('T')[0]);}
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
  if(idx>=0)log[idx].weight=kg; else log.push({date:todayStr(),weight:kg});
  pSet('weightLog',log);
}

// ============================================================
// BODY FAT
// ============================================================
function getBfLog(){return pGet('bfLog',[]);}
function getCurrentBf(){const l=getBfLog();return l.length?l[l.length-1].bf:null;}
function saveBfEntry(bf){
  const log=getBfLog();
  const idx=log.findIndex(e=>e.date===todayStr());
  if(idx>=0)log[idx].bf=bf; else log.push({date:todayStr(),bf});
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
  pSet('foods',all);
  if(!STATE.planStartDate){
    STATE.planStartDate=todayStr();
    pSet('planStartDate',todayStr());
  }
}
function deleteFoodEntry(idx,date=todayStr()){
  const all=pGet('foods',{});
  if(all[date])all[date].splice(idx,1);
  pSet('foods',all);
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
  pSet('exLog',all);
}
function saveExLogForDate(date,data){
  const all=getExLog();
  all[date]=data;
  pSet('exLog',all);
}

function getBestLift(exId){
  const log=getExLog();
  let best=null;
  Object.entries(log).forEach(([date,day])=>{
    const ex=day[exId];
    if(!ex?.sets)return;
    ex.sets.forEach(s=>{
      const kg=parseFloat(s.kg);
      if(kg&&(!best||kg>best.kg))best={kg,date};
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
    const hasData=Object.values(dayLog).some(e=>e.sets?.some(s=>s.kg||s.reps));
    if(hasData)return{date,log:dayLog};
  }
  return null;
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
function saveSleepEntry(hours,quality){const l=getSleepLog();l[todayStr()]={hours,quality};pSet('sleepLog',l);}
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
  pSet('water',w);
  const wc=pGet('waterClicked',{});
  wc[todayStr()]=true;
  pSet('waterClicked',wc);
}

// ============================================================
// PHOTOS
// ============================================================
function getPhotos(){return pGet('photos',[]);}
function savePhoto(dataUrl){
  const p=getPhotos();
  p.push({date:todayStr(),data:dataUrl});
  pSet('photos',p);
}

// ============================================================
// STREAKS
// ============================================================
function calcStreak(type){
  let streak=0;
  const today=new Date();
  for(let i=0;i<365;i++){
    const d=new Date(today);d.setDate(d.getDate()-i);
    const key=d.toISOString().split('T')[0];
    let hit=false;
    if(type==='steps')hit=(getStepsLog()[key]||0)>=10000;
    else if(type==='food')hit=((pGet('foods',{})[key]||[]).length>0);
    else if(type==='gym'){
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
