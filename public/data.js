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
      {id:'core_pallof',name:'Pallof Press',sets:3,reps:'10 each side',rest:60,muscle:'Core',size:'small',yt:'https://www.youtube.com/results?search_query=pallof+press+form'},
      {id:'neck_ext',name:'Cable Neck Extension (back)',sets:2,reps:'12–15',rest:45,muscle:'Neck',size:'small',yt:'https://www.youtube.com/results?search_query=cable+neck+extension+harness+form'},
      {id:'neck_front',name:'Cable Neck Flexion (front)',sets:2,reps:'12–15',rest:45,muscle:'Neck',size:'small',yt:'https://www.youtube.com/results?search_query=cable+neck+flexion+harness+form'},
      {id:'u9',name:'Plank',sets:3,reps:'30–45s',rest:45,muscle:'Core',metric:'time',yt:'https://www.youtube.com/results?search_query=plank+form+technique'},
      {id:'core_dead_bug',name:'Dead Bug',sets:3,reps:'10 each side',rest:45,muscle:'Core',size:'small',yt:'https://www.youtube.com/results?search_query=dead+bug+exercise+form'},
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
      {id:'core_pallof',name:'Pallof Press',sets:3,reps:'10 each side',rest:60,muscle:'Core',size:'small',yt:'https://www.youtube.com/results?search_query=pallof+press+form'},
      {id:'core_dead_bug',name:'Dead Bug',sets:3,reps:'10 each side',rest:45,muscle:'Core',size:'small',yt:'https://www.youtube.com/results?search_query=dead+bug+exercise+form'},
      {id:'core_suitcase',name:'Suitcase Carry',sets:3,reps:'40s/side',metric:'carry',targetSeconds:40,rest:60,muscle:'Core',size:'medium',yt:'https://www.youtube.com/results?search_query=suitcase+carry+form'},
    ]
  },
  // Phase 42d: Full Body 3-day (gym) — beginner-friendly, shares exercise IDs with
  // upper/lower where the movement is identical so history transfers across programs.
  full: {
    name:'FULL BODY', type:'full',
    muscles:'Legs · Chest · Back · Shoulders · Arms · Core',
    duration:'45–55',
    exercises:[
      {id:'l1',name:'Leg Press',sets:3,reps:'8–10',rest:120,muscle:'Quads',size:'large',yt:'https://www.youtube.com/results?search_query=leg+press+form+technique'},
      {id:'u1',name:'Chest Press',sets:3,reps:'8–10',rest:90,muscle:'Chest',size:'medium',yt:'https://www.youtube.com/results?search_query=chest+press+form'},
      {id:'u3',name:'Seated Row',sets:3,reps:'8–10',rest:90,muscle:'Back',size:'medium',yt:'https://www.youtube.com/results?search_query=seated+cable+row+form'},
      {id:'u4',name:'Shoulder Press',sets:2,reps:'8–10',rest:90,muscle:'Shoulders',size:'medium',yt:'https://www.youtube.com/results?search_query=dumbbell+shoulder+press+form'},
      {id:'l4',name:'Leg Curl',sets:2,reps:'10–12',rest:60,muscle:'Hamstrings',size:'medium',yt:'https://www.youtube.com/results?search_query=leg+curl+machine+form'},
      {id:'u5',name:'Lat Pulldown',sets:2,reps:'8–10',rest:90,muscle:'Lats',size:'medium',yt:'https://www.youtube.com/results?search_query=lat+pulldown+form'},
      {id:'u6',name:'Bicep Curl',sets:2,reps:'10–12',rest:60,muscle:'Biceps',size:'small',yt:'https://www.youtube.com/results?search_query=dumbbell+bicep+curl+form'},
      {id:'u7',name:'Tricep Pushdown',sets:2,reps:'10–12',rest:60,muscle:'Triceps',size:'small',yt:'https://www.youtube.com/results?search_query=tricep+pushdown+form'},
      {id:'u9',name:'Plank',sets:2,reps:'30–45s',rest:45,muscle:'Core',metric:'time',yt:'https://www.youtube.com/results?search_query=plank+form+technique'},
    ]
  },
  // Phase 42d: Home Full Body 3-day — dumbbells + bodyweight, no machines.
  home: {
    name:'HOME FULL BODY', type:'home',
    muscles:'Legs · Chest · Back · Shoulders · Arms · Core',
    duration:'40–50',
    exercises:[
      {id:'h1',name:'Goblet Squat',sets:3,reps:'10–12',rest:90,muscle:'Quads',size:'medium',yt:'https://www.youtube.com/results?search_query=goblet+squat+form'},
      {id:'h2',name:'Push-Up',sets:3,reps:'8–15',rest:60,muscle:'Chest',size:'small',yt:'https://www.youtube.com/results?search_query=push+up+form'},
      {id:'h3',name:'One-Arm Dumbbell Row',sets:3,reps:'8–10',rest:90,muscle:'Back',size:'medium',yt:'https://www.youtube.com/results?search_query=one+arm+dumbbell+row+form'},
      {id:'h4',name:'Dumbbell Romanian Deadlift',sets:3,reps:'10–12',rest:90,muscle:'Hamstrings',size:'medium',yt:'https://www.youtube.com/results?search_query=dumbbell+romanian+deadlift+form'},
      {id:'u4',name:'Shoulder Press',sets:2,reps:'8–10',rest:90,muscle:'Shoulders',size:'medium',yt:'https://www.youtube.com/results?search_query=dumbbell+shoulder+press+form'},
      {id:'h5',name:'Lateral Raise',sets:2,reps:'12–15',rest:60,muscle:'Shoulders',size:'small',yt:'https://www.youtube.com/results?search_query=dumbbell+lateral+raise+form'},
      {id:'u6',name:'Bicep Curl',sets:2,reps:'10–12',rest:60,muscle:'Biceps',size:'small',yt:'https://www.youtube.com/results?search_query=dumbbell+bicep+curl+form'},
      {id:'u9',name:'Plank',sets:2,reps:'30–45s',rest:45,muscle:'Core',metric:'time',yt:'https://www.youtube.com/results?search_query=plank+form+technique'},
      {id:'core_dead_bug',name:'Dead Bug',sets:2,reps:'10 each side',rest:45,muscle:'Core',size:'small',yt:'https://www.youtube.com/results?search_query=dead+bug+exercise+form'},
    ]
  },
  // Phase 60: fixed 5-day split (upper-lower-5d-fixed). Reuses existing exercise
  // IDs so logged history carries across from the old 4-day programme. New IDs:
  // cardio_z2 (Zone 2 walk, timed) and reh_1/2/3 (shoulder rehab, category:'rehab').
  upperA: {
    name:'UPPER A', type:'upperA',
    muscles:'Shoulders · Chest · Back · Lats',
    duration:'50–60',
    exercises:[
      {id:'u4',name:'Shoulder Press',sets:3,reps:'10–12',rest:90,muscle:'Shoulders',size:'medium',yt:'https://www.youtube.com/results?search_query=dumbbell+shoulder+press+form'},
      {id:'u1',name:'Chest Press',sets:3,reps:'8–10',rest:90,muscle:'Chest',size:'medium',yt:'https://www.youtube.com/results?search_query=chest+press+form'},
      {id:'u3',name:'Seated Row',sets:3,reps:'8–10',rest:90,muscle:'Back',size:'medium',yt:'https://www.youtube.com/results?search_query=seated+cable+row+form'},
      {id:'u5',name:'Lat Pulldown',sets:3,reps:'10–12',rest:90,muscle:'Lats',size:'medium',yt:'https://www.youtube.com/results?search_query=lat+pulldown+form'},
      {id:'h5',name:'Lateral Raise',sets:2,reps:'12–15',rest:60,muscle:'Shoulders',size:'small',yt:'https://www.youtube.com/results?search_query=dumbbell+lateral+raise+form'},
      {id:'reh_1',name:'Rehab 1',sets:2,reps:'12–15',rest:45,muscle:'Shoulders',size:'small',category:'rehab',yt:'https://www.youtube.com/results?search_query=shoulder+rehab+exercise'},
      {id:'reh_2',name:'Rehab 2',sets:2,reps:'12–15',rest:45,muscle:'Shoulders',size:'small',category:'rehab',yt:'https://www.youtube.com/results?search_query=shoulder+rehab+exercise'},
      {id:'reh_3',name:'Rehab 3',sets:2,reps:'12–15',rest:45,muscle:'Shoulders',size:'small',category:'rehab',yt:'https://www.youtube.com/results?search_query=shoulder+rehab+exercise'},
    ]
  },
  lowerA: {
    name:'LOWER A', type:'lowerA',
    muscles:'Quads · Hamstrings · Calves · Core',
    duration:'50–60',
    exercises:[
      {id:'h1',name:'Goblet Squat',sets:3,reps:'10–12',rest:90,muscle:'Quads',size:'medium',yt:'https://www.youtube.com/results?search_query=goblet+squat+form'},
      {id:'l1',name:'Leg Press',sets:4,reps:'8–10',rest:120,muscle:'Quads',size:'large',yt:'https://www.youtube.com/results?search_query=leg+press+form+technique'},
      {id:'l2',name:'Romanian Deadlift',sets:3,reps:'8',rest:120,muscle:'Hamstrings',size:'large',yt:'https://www.youtube.com/results?search_query=romanian+deadlift+form'},
      {id:'l6',name:'Calf Raise',sets:3,reps:'12–15',rest:45,muscle:'Calves',size:'medium',yt:'https://www.youtube.com/results?search_query=calf+raise+form'},
      {id:'core_pallof',name:'Pallof Press',sets:3,reps:'10 each side',rest:60,muscle:'Core',size:'small',yt:'https://www.youtube.com/results?search_query=pallof+press+form'},
    ]
  },
  upperB: {
    name:'UPPER B', type:'upperB',
    muscles:'Chest · Back · Shoulders · Arms · Core',
    duration:'50–60',
    exercises:[
      {id:'u2',name:'Incline Dumbbell Press',sets:3,reps:'8–10',rest:90,muscle:'Upper Chest',size:'medium',yt:'https://www.youtube.com/results?search_query=incline+dumbbell+press+form'},
      {id:'h3',name:'One-Arm Dumbbell Row',sets:3,reps:'10 each side',rest:90,muscle:'Back',size:'medium',yt:'https://www.youtube.com/results?search_query=one+arm+dumbbell+row+form'},
      {id:'u4',name:'Shoulder Press',sets:3,reps:'10–12',rest:90,muscle:'Shoulders',size:'medium',yt:'https://www.youtube.com/results?search_query=dumbbell+shoulder+press+form'},
      {id:'u8',name:'Face Pull',sets:3,reps:'15',rest:45,muscle:'Rear Delts',size:'small',yt:'https://www.youtube.com/results?search_query=face+pull+exercise+form'},
      {id:'u6',name:'Bicep Curl',sets:2,reps:'12',rest:60,muscle:'Biceps',size:'small',yt:'https://www.youtube.com/results?search_query=dumbbell+bicep+curl+form'},
      {id:'core_dead_bug',name:'Dead Bug',sets:3,reps:'10 each side',rest:45,muscle:'Core',size:'small',yt:'https://www.youtube.com/results?search_query=dead+bug+exercise+form'},
      {id:'reh_1',name:'Rehab 1',sets:2,reps:'12–15',rest:45,muscle:'Shoulders',size:'small',category:'rehab',yt:'https://www.youtube.com/results?search_query=shoulder+rehab+exercise'},
      {id:'reh_2',name:'Rehab 2',sets:2,reps:'12–15',rest:45,muscle:'Shoulders',size:'small',category:'rehab',yt:'https://www.youtube.com/results?search_query=shoulder+rehab+exercise'},
      {id:'reh_3',name:'Rehab 3',sets:2,reps:'12–15',rest:45,muscle:'Shoulders',size:'small',category:'rehab',yt:'https://www.youtube.com/results?search_query=shoulder+rehab+exercise'},
    ]
  },
  lowerB: {
    name:'LOWER B', type:'lowerB',
    muscles:'Glutes · Quads · Hamstrings · Core',
    duration:'50–60',
    exercises:[
      {id:'l5',name:'Hip Thrust',sets:4,reps:'8–10',rest:90,muscle:'Glutes',size:'large',yt:'https://www.youtube.com/results?search_query=hip+thrust+barbell+form'},
      {id:'l1',name:'Leg Press',sets:3,reps:'10–12',rest:120,muscle:'Quads',size:'large',yt:'https://www.youtube.com/results?search_query=leg+press+form+technique'},
      {id:'l4',name:'Leg Curl',sets:3,reps:'10–12',rest:60,muscle:'Hamstrings',size:'medium',yt:'https://www.youtube.com/results?search_query=leg+curl+machine+form'},
      {id:'core_suitcase',name:'Suitcase Carry',sets:3,reps:'40s/side',metric:'carry',targetSeconds:40,rest:60,muscle:'Core',size:'medium',yt:'https://www.youtube.com/results?search_query=suitcase+carry+form'},
    ]
  },
  zone2: {
    name:'ZONE 2 CARDIO', type:'zone2',
    muscles:'Aerobic base · Recovery',
    duration:'40–45',
    exercises:[
      {id:'cardio_z2',name:'Zone 2 Walk',sets:1,reps:'40–45 min',rest:0,muscle:'Cardio',size:'cardio',metric:'time',cardio:true,unit:'min',capMin:45,yt:'https://www.youtube.com/results?search_query=zone+2+cardio+walking'},
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
// Phase 53: a loaded carry timed PER SIDE — each set logs weight + time held on
// the LEFT and the RIGHT separately. Distinct from isTimeBased single-value holds
// and from rep-based "each side" moves (Pallof, Dead Bug stay reps).
function isCarry(ex){ return !!(ex&&ex.metric==='carry'); }
function fmtSec(s){
  s=Math.floor(s);
  if(s<60)return s+'s';
  return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
}

// Training cycle — anchored to a start date. Delegates to the shared programme
// module (programme-shared.js) so the client + server share ONE schedule impl.
// 4-day pattern: Day 0=Upper, Day 1=Rest, Day 2=Lower, Day 3=Rest
function _trainingDayInCycle(dateStr){
  return FORGE_PROGRAMME.trainingDayInCycle(dateStr, STATE.trainingStartDate);
}

// ---- Phase 42d: program templates ----
// profile.programId selects the schedule + sessions. Default = the original
// Upper/Lower 4-day cycle, so existing users see zero change. The schedule
// (getSessionType) now delegates to the shared FORGE_PROGRAMME.sessionTypeForDate
// so exercise-schedule logic lives in exactly one place (see programme-shared.js).
const PROGRAMS = {
  'upper-lower-4d': {
    id:'upper-lower-4d', name:'Upper / Lower 4-Day',
    desc:'Alternating Upper / Rest / Lower / Rest cycle',
    getSessionType(dateStr){
      return FORGE_PROGRAMME.sessionTypeForDate('upper-lower-4d', dateStr, STATE.trainingStartDate);
    },
  },
  // Phase 60: fixed-weekday 5-day split. Anchored to profile.programmeStartDate
  // (NOT trainingStartDate) so it can start on a specific Monday without touching
  // the historical training anchor; dates before programmeStartDate are unscheduled.
  'upper-lower-5d-fixed': {
    id:'upper-lower-5d-fixed', name:'Upper / Lower 5-Day (fixed)',
    desc:'Mon Upper A · Tue Lower A · Wed rest · Thu Upper B · Fri Lower B · Sat Zone 2 · Sun rest',
    getSessionType(dateStr){
      return FORGE_PROGRAMME.sessionTypeForDate('upper-lower-5d-fixed', dateStr, (STATE.profile&&STATE.profile.programmeStartDate)||STATE.trainingStartDate);
    },
  },
  'full-body-3d': {
    id:'full-body-3d', name:'Full Body 3-Day',
    desc:'Mon · Wed · Fri full-body sessions',
    getSessionType(dateStr){
      return FORGE_PROGRAMME.sessionTypeForDate('full-body-3d', dateStr, STATE.trainingStartDate);
    },
  },
  'home-3d': {
    id:'home-3d', name:'Home Full Body 3-Day',
    desc:'Mon · Wed · Fri at home — dumbbells + bodyweight',
    getSessionType(dateStr){
      return FORGE_PROGRAMME.sessionTypeForDate('home-3d', dateStr, STATE.trainingStartDate);
    },
  },
};
function getProgramId(){return (STATE.profile&&STATE.profile.programId)||'upper-lower-4d';}
function getProgram(){return PROGRAMS[getProgramId()]||PROGRAMS['upper-lower-4d'];}
// Phase 60: per-user rehab visibility. Rehab-category exercises (the owner's
// physio work) are ON by default and hidden for any user with
// profile.showRehab===false (set for Naveed by the programme migration). Every
// guided-workout render/nav path reads getWorkout()/sessionExercises() so the
// exercise list is consistent (indices never drift). Classification + history
// still read the FULL WORKOUTS templates, so hiding rehab never loses history.
function sessionExercises(sessionKey){
  const w=WORKOUTS[sessionKey];
  if(!w||!Array.isArray(w.exercises))return [];
  const showRehab=!(STATE.profile&&STATE.profile.showRehab===false);
  return showRehab?w.exercises:w.exercises.filter(e=>e.category!=='rehab');
}
function getWorkout(sessionKey){
  const w=WORKOUTS[sessionKey];
  if(!w)return w;
  return {...w, exercises: sessionExercises(sessionKey)};
}
// Union of every exercise across all program templates, deduped by id.
function getAllExercises(){
  const seen=new Set(),out=[];
  Object.values(WORKOUTS).forEach(w=>(w.exercises||[]).forEach(e=>{
    if(!seen.has(e.id)){seen.add(e.id);out.push(e);}
  }));
  return out;
}

// ============================================================
// STATE — synced with backend
// ============================================================
let STATE = {
  profile: null,
  sessionFeel: {},        // Phase 44: {date: 'strong'|'ok'|'tired'} — asked before prescriptions
  recoveryOverrides: {},  // Phase 44: {date: {readiness, hrvDown3d, feel, choice, deloadHolds}}
  foodComplete: {},       // Phase 48a: {date: true} — user confirmed "that's everything I ate"
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
  vo2maxLog: {},
  cardioLog: {},
  bpLog: [],
  boditraxLog: [],
  dexaScans: [],
  healthRecords: [],
  stretchLog: {},
  stretchStreak: { morning: 0, evening: 0, flexibility: 0, combined: 0, lastMorningDate: null, lastEveningDate: null, lastFlexibilityDate: null },
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
  // Phase 42e: name-based fallback removed — any user named "Jay…" was passing
  return false;
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
  // Recompute the day's compliance fraction + stamp Mounjaro injection-day flag
  const {am,pm}=getSkinVisibleItems(date);
  const items=[...am,...pm];
  const dn=items.filter(it=>log[date][it.itemId]===true).length;
  log[date]._compliance=items.length?Math.round((dn/items.length)*100)/100:0;
  log[date]._mounjaro_day=new Date(date+'T12:00:00').getDay()===_injectionDow();
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
// Phase 42e: Mounjaro UI only shows for users actually ON it (meds or supplements),
// mirroring the cron gate.
function _userOnMounjaro(){
  const rx=/mounjaro|tirzepatide/i;
  const meds=(STATE.profile&&STATE.profile.medications)||[];
  const supps=STATE.supplements||[];
  return (Array.isArray(meds)&&meds.some(m=>rx.test((m&&m.name)||'')))
    ||supps.some(s=>rx.test((s&&s.name)||'')||(s&&s.frequency)==='weekly-wednesday');
}
// Configured injection day-of-week (Sun=0…Sat=6) from Coach Settings; falls back
// to Wednesday (3) when the user hasn't set one, preserving pre-Phase-40 behaviour.
function _injectionDow(){
  const d=STATE.profile&&STATE.profile.glp1InjectionDow;
  return (typeof d==='number'&&d>=0&&d<=6)?d:3;
}
function isMounjaroDay(){return new Date().getDay()===_injectionDow()&&_userOnMounjaro();}
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

// ---- Phase 42f: offline-safe saves — failed writes queue + retry ----
// Failures used to be silently swallowed (catch {}). Now: network errors and
// 5xx responses queue the write in localStorage, a badge shows unsynced count,
// and the queue flushes on reconnect / every 30s. One entry per endpoint
// (each field-scoped endpoint writes the whole value, so latest-wins is correct).
let _syncQueue = [];
const _SYNC_QUEUE_KEY = "forge_sync_queue";
try { _syncQueue = JSON.parse(localStorage.getItem(_SYNC_QUEUE_KEY)) || []; } catch { _syncQueue = []; }

function _persistSyncQueue() {
  try { localStorage.setItem(_SYNC_QUEUE_KEY, JSON.stringify(_syncQueue.slice(-100))); } catch {}
  _updateSyncBadge();
}
function _updateSyncBadge() {
  const el = document.getElementById("sync-badge");
  if (!el) return;
  if (_syncQueue.length) {
    el.style.display = "inline-flex";
    el.textContent = "⟳ " + _syncQueue.length + " unsynced";
  } else {
    el.style.display = "none";
  }
}
function _queueWrite(endpoint, body) {
  _syncQueue = _syncQueue.filter(q => q.endpoint !== endpoint);
  _syncQueue.push({ endpoint, body, ts: Date.now() });
  _persistSyncQueue();
}
function _dropQueued(endpoint) {
  const before = _syncQueue.length;
  _syncQueue = _syncQueue.filter(q => q.endpoint !== endpoint);
  if (_syncQueue.length !== before) _persistSyncQueue();
}
async function _putJSON(endpoint, body) {
  const token = localStorage.getItem("forge_token");
  if (!token) return true; // logged out — nothing to sync
  const r = await fetch(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify(body),
  });
  // 4xx = the request itself is bad — retrying won't help, don't queue
  if (!r.ok && r.status >= 500) throw new Error("HTTP " + r.status);
  return r.ok;
}
async function flushSyncQueue() {
  if (!_syncQueue.length || !navigator.onLine) return;
  const pending = [..._syncQueue];
  _syncQueue = [];
  for (const item of pending) {
    try {
      // Full-state body is rebuilt at flush time so we never replay a stale snapshot
      const body = item.endpoint === "/api/state" ? { state: STATE } : item.body;
      await _putJSON(item.endpoint, body);
    } catch {
      _syncQueue.push(item);
    }
  }
  _persistSyncQueue();
}
if (typeof window !== "undefined") {
  window.addEventListener("online", () => { flushSyncQueue(); });
  setInterval(() => { flushSyncQueue(); }, 30000);
}

async function saveStateNow() {
  console.warn("[Forge] Full state PUT — prefer field-scoped saves");
  localStorage.setItem("forge_state_cache", JSON.stringify(STATE));
  if (!localStorage.getItem("forge_token")) return;
  try {
    await _putJSON("/api/state", { state: STATE });
    _dropQueued("/api/state");
  } catch {
    _queueWrite("/api/state", null); // body rebuilt from STATE at flush time
  }
}

async function saveFieldToServer(endpoint, body) {
  if (!localStorage.getItem("forge_token")) return;
  try {
    await _putJSON(endpoint, body);
    _dropQueued(endpoint); // fresher write landed — stale queued one is obsolete
  } catch {
    _queueWrite(endpoint, body);
  }
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

// ---- Phase 56: make-up sessions (non-cascading override) ----
// A missed scheduled session can be made up on the ADJACENT rest/empty day. It
// logs against the ACTUAL date but links to the missed date via
// exLog[actualDate]._session.forDate. The fixed-calendar formula is never touched,
// so nothing downstream shifts. Skips are stored as exLog[plannedDate]._session.skipped.
function _dayHasLoggedWork(dayLog){
  return Object.keys(dayLog||{}).some(k=>!k.startsWith('_')&&dayLog[k]&&Array.isArray(dayLog[k].sets)&&dayLog[k].sets.some(s=>s.kg||s.reps||s.seconds));
}
function isSessionSkipped(date){
  const d=getExLogForDate(date);
  return !!(d&&d._session&&d._session.skipped);
}
function isSessionMadeUp(plannedDate){
  const exLog=getExLog();
  return Object.values(exLog).some(d=>d&&d._session&&d._session.forDate===plannedDate);
}
// On a rest/empty day, returns {date,type} of the immediately-previous scheduled
// session if it was missed (no work, not skipped, not already made up), else null.
function getMissedSession(asOfDate){
  asOfDate=asOfDate||todayStr();
  if(getSessionTypeForDate(asOfDate)!==null)return null;       // today is itself a scheduled session
  if(_dayHasLoggedWork(getExLogForDate(asOfDate)))return null; // today already has logged work
  const y=new Date(asOfDate+'T12:00:00');y.setDate(y.getDate()-1);
  const yDate=y.toISOString().slice(0,10);
  const yType=getSessionTypeForDate(yDate);
  if(!yType)return null;                                       // yesterday wasn't a scheduled session
  if(_dayHasLoggedWork(getExLogForDate(yDate)))return null;    // yesterday was completed
  if(isSessionSkipped(yDate))return null;                      // user skipped it
  if(isSessionMadeUp(yDate))return null;                       // already made up somewhere
  return {date:yDate,type:yType};
}
function skipMissedSession(date,type){
  const dayLog=getExLogForDate(date);
  if(!dayLog._session||typeof dayLog._session!=='object')dayLog._session={};
  dayLog._session.skipped=true;
  if(type&&!dayLog._session.sessionType)dayLog._session.sessionType=type;
  saveExLogForDate(date,dayLog);
}
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
  const allEx=getAllExercises();
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

// Session type for any past or future date — delegates to the user's program (Phase 42d)
function getSessionTypeForDate(dateStr){
  return getProgram().getSessionType(dateStr);
}

// Most recent session of the same type with logged sets, before a given date
// Phase 46: classify a logged day by what was ACTUALLY trained, not by the
// calendar. The rigid 4-day cycle assumes you train exactly every other day
// forever; the moment you take an extra rest day or shift your week, a real
// upper/lower session lands on a date the calendar calls something else — and
// the old lookup (which filtered by getSessionTypeForDate) silently LOST that
// session, so progression "missed" your last upper/lower. Now we match on the
// session type stored at workout time, falling back to classifying by the
// logged exercise IDs against the program templates.
function _classifyLoggedSession(dayLog){
  if(!dayLog||typeof dayLog!=='object')return null;
  if(dayLog._session&&dayLog._session.sessionType)return dayLog._session.sessionType;
  const logged=Object.keys(dayLog).filter(k=>!k.startsWith('_')&&dayLog[k]&&Array.isArray(dayLog[k].sets)&&dayLog[k].sets.some(s=>s.kg||s.reps||s.seconds));
  if(!logged.length)return null;
  let best=null,bestCount=0;
  for(const [type,w] of Object.entries(WORKOUTS)){
    const ids=new Set((w.exercises||[]).map(e=>e.id));
    const c=logged.filter(id=>ids.has(id)).length;
    if(c>bestCount){bestCount=c;best=type;}
  }
  return best;
}

function getPreviousSessionData(beforeDate,sessionType){
  if(!sessionType)return null;
  const exLog=getExLog();
  const dates=Object.keys(exLog).filter(d=>d<beforeDate).sort().reverse();
  for(const date of dates){
    const dayLog=exLog[date];
    if(_classifyLoggedSession(dayLog)!==sessionType)continue;
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
    const dayLog=exLog[date];
    if(!dayLog)continue;
    if(_classifyLoggedSession(dayLog)!==sessionType)continue;
    const hasData=Object.values(dayLog).some(e=>e.sets?.some(s=>s.kg||s.reps||s.seconds));
    if(!hasData)continue;
    out.push({date,log:dayLog});
    if(out.length>=limit)break;
  }
  return out;
}

// Phase 60: exercise-centric history — the most recent session of ANY type that
// has logged data for a given exercise id. Used as a fallback so progression
// references carry over when the SAME id moves between session types (e.g. Leg
// Press l1 from the old 'lower' day into the new lowerA/lowerB) — the same-type
// lookup finds nothing on a brand-new programme, this finds the real last weight.
function getLastExercisePerformance(exId, beforeDate){
  const exLog=getExLog();
  const dates=Object.keys(exLog).filter(d=>d<beforeDate).sort().reverse();
  for(const date of dates){
    const dayLog=exLog[date];
    const ex=dayLog&&dayLog[exId];
    if(ex&&Array.isArray(ex.sets)&&ex.sets.some(s=>s.kg||s.reps||s.seconds))return {date,log:dayLog};
  }
  return null;
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

// Phase 47: per-exercise running notes (user-written; coach training-swap also
// writes here). Shape: state.exerciseNotes[exId] = {note, addedAt, source}.
function getExerciseNote(exId){
  const n=(STATE.exerciseNotes||{})[exId];
  return (n&&n.note)?n.note:'';
}
function setExerciseNote(exId,text){
  if(!STATE.exerciseNotes||typeof STATE.exerciseNotes!=='object')STATE.exerciseNotes={};
  if(text)STATE.exerciseNotes[exId]={note:String(text).slice(0,300),addedAt:new Date().toISOString(),source:'user'};
  else delete STATE.exerciseNotes[exId];
  updateLocalCache();
  saveFieldToServer('/api/state/exercise-notes',{value:STATE.exerciseNotes});
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
  // Prefer the most recent trusted scan (Boditrax/DEXA) within the last 30 days
  // so "current lean" and the change-from-start caption reflect the device the
  // user trusts — not a single noisy daily Withings reading. Otherwise fall back
  // to the latest reading of any source.
  const blended=(typeof PROACTIVE_CORE!=='undefined'&&PROACTIVE_CORE.blendedLeanSeries)?PROACTIVE_CORE.blendedLeanSeries(STATE):null;
  if(blended&&blended.length){
    const today=todayStr();
    const within=(d)=>Math.abs((new Date(today+'T12:00:00')-new Date(d+'T12:00:00'))/86400000)<=30;
    const recentReliable=blended.filter(p=>p.priority>=2&&within(p.date));
    if(recentReliable.length)return recentReliable[recentReliable.length-1].lean;
    return blended[blended.length-1].lean;
  }
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
    // Source-prioritised (DEXA > Boditrax > Withings): Boditrax/DEXA scans
    // override their own dates; Withings daily BIA fills the gaps between them.
    const blended=getBlendedLeanSeries();
    if(blended)return blended.map(p=>({date:p.date,lbm:p.lean,source:p.source}));
    // Fallback (engine not loaded): weight × (1 − bf/100).
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
  // Lean mass: report the reliability-weighted trend (Boditrax/DEXA anchor the
  // slope; Withings daily is the fallback) rather than a raw last-14-points rate
  // that noisy daily BIA would dominate.
  if(metric==='lbm'&&typeof PROACTIVE_CORE!=='undefined'&&PROACTIVE_CORE.leanTrendRate){
    const r=PROACTIVE_CORE.leanTrendRate(STATE,{until:todayStr()});
    if(r&&r.perWeek!=null)return r.perWeek;
  }
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

// Phase 51b: smoothed body-comp status — compares your RECENT average (last 7
// days, so a single bad-sleep water spike can't flip it) to your value ~14 days
// ago. It's a *smoothed point-to-point*, so the status colour ALWAYS matches the
// direction of the 14-day number you see: lean UP = green, lean DOWN = amber/red.
// Raw daily numbers are unchanged; only colour/status decisions use this.
function smoothedBodyCompTrend(metric, phase = 'cut') {
  // metric: 'lbm' or 'fat'
  // phase: 'cut' | 'recomp' | 'lean-bulk' | 'maintenance'

  const today = todayStr();
  const toDate = s => new Date(s + 'T12:00:00');
  const todayDate = toDate(today);
  const subDays = (n) => {
    const d = new Date(todayDate); d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };

  // Lean mass: judge status on the reliability-weighted TREND RATE (kg/week) so a
  // trusted Boditrax/DEXA scan governs the colour and a sparse pair of scans 60
  // days apart isn't misread as a 14-day crash. Withings-only users keep the
  // prior behaviour via the same per-week thresholds.
  if (metric === 'lbm' && typeof PROACTIVE_CORE !== 'undefined' && PROACTIVE_CORE.leanTrendRate) {
    const r = PROACTIVE_CORE.leanTrendRate(STATE, { until: today });
    if (r && r.perWeek != null && r.n >= 2) {
      const rate = r.perWeek;                    // kg/week (negative = losing lean)
      const provisional = r.n < 3;
      const greenAbove = provisional ? -0.05 : -0.10;   // per-week (matches the old 14d ±)
      const redAtOrBelow = provisional ? -0.30 : -0.28;
      let status;
      if (rate >= greenAbove) status = 'green';
      else if (rate > redAtOrBelow) status = 'amber';
      else status = 'red';
      const curVal = r.last ? r.last.lean : null;
      return {
        status, delta: Math.round(rate * 2 * 100) / 100, // 14-day-equivalent for display continuity
        currentAvg: curVal, prevAvg: (curVal != null ? Math.round((curVal - rate * 2) * 100) / 100 : null),
        provisional, entriesCurrent: r.n, entriesPrior: r.n, windowDays: 14,
        ratePerWeek: rate, source: r.source
      };
    }
  }

  // Build entries: array of {date, value} for the metric
  let entries;
  if (metric === 'lbm') {
    // Fallback (engine unavailable): weight × (1 - bf/100), aligned per-date.
    const wl = getWeightLog();
    const bl = getBfLog();
    entries = wl.map(we => {
      const bfe = bl.filter(b => b.date <= we.date).pop();
      if (!bfe) return null;
      return { date: we.date, value: Math.round(we.weight * (1 - bfe.bf / 100) * 100) / 100 };
    }).filter(Boolean);
  } else if (metric === 'fat') {
    // fat mass = weight × (bf/100)
    const wl = getWeightLog();
    const bl = getBfLog();
    entries = wl.map(we => {
      const bfe = bl.filter(b => b.date <= we.date).pop();
      if (!bfe) return null;
      return { date: we.date, value: Math.round(we.weight * (bfe.bf / 100) * 100) / 100 };
    }).filter(Boolean);
  } else {
    return { status: 'insufficient', delta: null, currentAvg: null, prevAvg: null, provisional: true, entriesCurrent: 0, entriesPrior: 0, windowDays: 14 };
  }

  const sorted = entries.slice().sort((a, b) => a.date.localeCompare(b.date));
  const avg = arr => arr.length ? arr.reduce((s, e) => s + e.value, 0) / arr.length : null;

  // RECENT anchor = average of the last 7 days (smooths a single noisy weigh-in).
  // Fall back to the last up-to-3 readings overall if nothing in the last 7 days.
  const recent = sorted.filter(e => e.date > subDays(7));
  const recentUsed = (recent.length ? recent : sorted.slice(-3));
  const currentAvg = avg(recentUsed);

  // PAST anchor = the value ~14 days ago (latest reading on/before 14 days ago).
  // This is the same "14 days ago" point the displayed 14d delta uses, so the
  // colour can't contradict the number.
  const pastEntry = sorted.filter(e => e.date <= subDays(14)).pop();
  const prevAvg = pastEntry ? pastEntry.value : null;

  if (currentAvg == null || prevAvg == null) {
    return { status: 'insufficient', delta: null, currentAvg, prevAvg, provisional: true, entriesCurrent: recentUsed.length, entriesPrior: pastEntry ? 1 : 0, windowDays: 14 };
  }

  const delta = Math.round((currentAvg - prevAvg) * 100) / 100;
  const provisional = recentUsed.length < 2 || sorted.length < 4;

  // Status mapping
  let status;
  if (metric === 'lbm') {
    // Lean: any rise or holding within noise = green; small drop = amber; only a
    // genuine, sustained drop = red. Thresholds loosened (Phase 51b) so normal
    // scale/BIA wobble can't trip the warning.
    // Provisional uses half-thresholds (more lenient because less confidence)
    const greenAbove = provisional ? -0.1 : -0.2;
    const redAtOrBelow = provisional ? -0.3 : -0.55;
    if (delta >= greenAbove) status = 'green';
    else if (delta > redAtOrBelow) status = 'amber';
    else status = 'red';
  } else {
    // Fat: depends on phase
    if (phase === 'cut') {
      if (delta <= -0.15) status = 'green';
      else if (delta >= 0.15) status = 'red';
      else status = 'amber';  // holding fat on a cut = stall
    } else if (phase === 'lean-bulk') {
      if (delta <= 0.4) status = 'green';
      else if (delta <= 0.8) status = 'amber';
      else status = 'red';
    } else {
      // recomp or maintenance
      if (delta <= -0.15) status = 'green';
      else if (delta <= 0.15) status = 'grey';
      else if (delta <= 0.45) status = 'amber';
      else status = 'red';
    }
  }

  return {
    status,
    delta,
    currentAvg: Math.round(currentAvg * 100) / 100,
    prevAvg: Math.round(prevAvg * 100) / 100,
    provisional,
    entriesCurrent: recentUsed.length,
    entriesPrior: pastEntry ? 1 : 0,
    windowDays: 14
  };
}

function _statusColor(status) {
  return status === 'green' ? 'var(--green)'
       : status === 'amber' ? '#ffc107'
       : status === 'red'   ? 'var(--red)'
       : status === 'grey'  ? 'var(--text2)'
       :                      'var(--text3)';  // insufficient
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
  const phase = (STATE.profile?.personal?.phase) || 'cut';
  const t = smoothedBodyCompTrend('lbm', phase);
  return t.status === 'red';
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
  const allEx=getAllExercises();
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
// Phase 42e: eating window is a per-user profile setting. Missing profile field
// = legacy behaviour (enabled, 12:00–20:00) so existing users see no change;
// the wizard writes it explicitly (default OFF) for new users.
function getEatingWindow(){
  const ew=STATE.profile&&STATE.profile.eatingWindow;
  if(!ew)return {enabled:true,start:12,end:20};
  return {enabled:ew.enabled!==false,start:ew.start!=null?ew.start:12,end:ew.end!=null?ew.end:20};
}

// ---- S1: Dynamic calorie targets (Mifflin-St Jeor) ----
function getCurrentLeanMass(){
  const lbm=(typeof getCurrentLBM==='function')?getCurrentLBM():null;
  if(lbm)return lbm;
  const w=getCurrentWeight(),bf=getCurrentBf();
  if(w&&bf)return Math.round(w*(1-bf/100)*10)/10;
  return null;
}
// Phase 42a: thin wrapper over the pure engine in targets.js.
// Phase-driven (cut/recomp/lean-bulk/maintenance), sex-based floors, under-18
// no-deficit guard. Legacy users keep exact pre-42 numbers via profile.targetOverrides
// (seeded server-side). Returns null when the personal profile is incomplete.
function calculateDynamicTargets(weight,leanMass,sessionType){
  const p=STATE.profile||{};
  const personal=p.personal||{};
  return computeTargets({
    weight,leanMass,sessionType,
    age:personal.age,heightCm:personal.heightCm,sex:personal.sex,
    phase:personal.phase,activityLevel:personal.activityLevel,
    overrides:p.targetOverrides,
  });
}
// Recompute targets for all three session types + persist to profile
function applyDynamicTargets(){
  if(!STATE.profile)return null;
  const weight=getCurrentWeight();
  if(!weight)return null;
  const lean=getCurrentLeanMass();
  const rest=calculateDynamicTargets(weight,lean,'rest');
  if(!rest)return null; // incomplete personal profile — keep existing targets
  const dt={
    rest,
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
  // Phase 42d: full/home session types map to the training-day target
  if(st&&dt&&dt.upper)return dt.upper;
  const p=STATE.profile||{};
  return {calories:st?(p.calsGym||2500):(p.calsRest||2400),protein:p.proteinTarget||180,carbs:p.carbsTarget||0,fat:p.fatTarget||0,sessionType:key};
}

// ---- Phase 44: pre-session feel + recovery gate overrides + session score ----
// Phase 48a: "that's everything I ate today" — lets the adaptive engine trust a
// genuinely low-intake day (normal on Mounjaro) instead of treating it as a
// forgotten log. Toggled from the Food page.
function getFoodComplete(date){return !!pGet('foodComplete',{})[date||todayStr()];}
function setFoodComplete(date,val){
  date=date||todayStr();
  const m=pGet('foodComplete',{});
  if(val)m[date]=true; else delete m[date];
  STATE.foodComplete=m;
  updateLocalCache();
  saveFieldToServer(`/api/state/food-complete/${date}`,{value:val?true:false});
}
function toggleFoodComplete(date){
  date=date||todayStr();
  setFoodComplete(date,!getFoodComplete(date));
  if(typeof renderFood==='function')renderFood();
}

function getSessionFeel(date){return pGet('sessionFeel',{})[date||todayStr()]||null;}
function setSessionFeel(feel,date){
  date=date||todayStr();
  const all=pGet('sessionFeel',{});
  all[date]=feel;
  STATE.sessionFeel=all;
  updateLocalCache();
  saveFieldToServer(`/api/state/session-feel/${date}`,{value:feel});
}
function getRecoveryOverride(date){return pGet('recoveryOverrides',{})[date||todayStr()]||null;}
function saveRecoveryOverride(patch,date){
  date=date||todayStr();
  const all=pGet('recoveryOverrides',{});
  all[date]={...(all[date]||{}),...patch};
  STATE.recoveryOverrides=all;
  updateLocalCache();
  saveFieldToServer(`/api/state/recovery-overrides/${date}`,{value:all[date]});
  return all[date];
}

// Session volume: Σ kg×reps for loaded sets, seconds for timed holds.
// Mixed units, but consistent per user — only ever compared to own history.
function computeSessionVolume(dayLog){
  let vol=0;
  for(const [exId,ex] of Object.entries(dayLog||{})){
    if(exId.startsWith('_')||!ex||!Array.isArray(ex.sets))continue;
    const exObj=getAllExercises().find(e=>e.id===exId);
    if(exObj&&typeof isCarry==='function'&&isCarry(exObj))continue; // Phase 53: carries excluded from volume (no kg×reps)
    const timed=exObj?isTimeBased(exObj):false;
    for(const s of ex.sets){
      if(timed)vol+=parseFloat(s.seconds)||0;
      else vol+=(parseFloat(s.kg)||0)*(parseInt(s.reps)||0);
    }
  }
  return Math.round(vol);
}
// Score = volume as % of the 4-week average for this session type + effort mix.
function computeSessionScore(date,sessionType){
  const exLog=getExLog();
  const dayLog=exLog[date]||{};
  const volume=computeSessionVolume(dayLog);
  const cutoff=new Date(date+'T12:00:00');
  cutoff.setDate(cutoff.getDate()-28);
  const cutoffStr=cutoff.toISOString().slice(0,10);
  const vols=[];
  for(const [d,log] of Object.entries(exLog)){
    if(d>=date||d<cutoffStr)continue;
    if(getSessionTypeForDate(d)!==sessionType)continue;
    const v=computeSessionVolume(log);
    if(v>0)vols.push(v);
  }
  const avg4w=vols.length?Math.round(vols.reduce((a,b)=>a+b,0)/vols.length):null;
  const pct=avg4w?Math.round((volume/avg4w)*100):null;
  const effortMix={easy:0,solid:0,tough:0,rated:0};
  for(const [exId,ex] of Object.entries(dayLog)){
    if(exId.startsWith('_')||!ex||!Array.isArray(ex.sets))continue;
    for(const s of ex.sets){
      const e=s.effort;
      if(e==='easy'||e==='solid'||e==='tough'){effortMix[e]++;effortMix.rated++;}
    }
  }
  return {volume,avg4w,pct,effortMix,sessions4w:vols.length};
}

// ---- S2: Fasting window ----
function getFastingLog(date){
  const e=pGet('fastingLog',{})[date||todayStr()];
  return (e&&Object.keys(e).length)?e:null;
}
function isFastingWindowOpen(){
  const ew=getEatingWindow();
  if(!ew.enabled)return true; // no window = always open
  const h=new Date().getHours()+new Date().getMinutes()/60;
  return h>=ew.start&&h<ew.end;
}
// {phase:'before'|'open'|'after', minsToOpen, minsToClose, fastedMins / elapsedMins}
function getWindowCountdown(){
  const ew=getEatingWindow();
  if(!ew.enabled)return null;
  const now=new Date();
  const h=now.getHours()+now.getMinutes()/60;
  const minsInDay=now.getHours()*60+now.getMinutes();
  const openMin=ew.start*60, closeMin=ew.end*60;
  if(h<ew.start){
    return {phase:'before',minsToOpen:openMin-minsInDay,minsToClose:closeMin-minsInDay,fastedMins:minsInDay+(24*60-closeMin)};
  }
  if(h<ew.end){
    return {phase:'open',minsToOpen:0,minsToClose:closeMin-minsInDay,elapsedMins:minsInDay-openMin,windowMins:closeMin-openMin};
  }
  return {phase:'after',minsToOpen:(24*60-minsInDay)+openMin,minsToClose:0,fastedMins:minsInDay-closeMin};
}
// Recompute today's fasting log from logged foods (called on each food change)
function recomputeFastingLog(date){
  if(!getEatingWindow().enabled)return; // Phase 42e: no window, no fasting tracking
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
  const ew=getEatingWindow();
  const openMin=ew.start*60,closeMin=ew.end*60;
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
  if(!getEatingWindow().enabled)return 0; // Phase 42e
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
function isPostInjectionDay(){return new Date().getDay()===(_injectionDow()+1)%7&&_userOnMounjaro();} // day after injection
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
    if(s.frequency==='weekly-wednesday'&&dow!==_injectionDow())return false;
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
  // Phase 52: Flexibility routine — owner-only, "anytime" (no time-window gating).
  // Added alongside morning/evening; shares the generic session engine + timer.
  flexibility: {
    id: 'flexibility',
    title: 'Flexibility',
    subtitle: 'Build splits & forward fold — protect the lower back',
    totalMinutes: 14,
    bestTime: 'After lifting on gym days, or midday on rest days — not before bed',
    stretches: [
      { id:'f1_hip_hinge', name:'Soft-Knee Hip Hinge', duration:10, unit:'reps', sides:false,
        instructions:"Stand tall with a soft bend in the knees. Push the hips straight back, keeping the back flat, until you feel the hamstrings load. Stand back up. Slow and controlled.",
        benefit:"Grooves a safe hip hinge and warms the hamstrings — the foundation for a flat-back forward fold without loading the spine.",
        cue:"Hips back, flat back, stop before the spine rounds" },
      { id:'f2_hamstring', name:'Flat-Back Hamstring Stretch', duration:60, unit:'seconds', sides:true,
        instructions:"Place one heel slightly forward, leg straight, toes up. Hinge forward from the hip with a flat back until you feel the stretch behind the thigh. Hold and breathe. Keep the spine long.",
        benefit:"Lengthens the hamstrings through a flat-back hinge so the stretch goes into the muscle, not the lower back.",
        cue:"Hinge from hip, flat back, feel it in the hamstring not the spine" },
      { id:'f3_frog', name:'Frog Stretch', duration:90, unit:'seconds', sides:false,
        instructions:"On all fours, widen the knees out to the sides, knees bent about 90 degrees with feet in line with the knees. Sink the hips gently back toward the heels. Keep the lower back neutral.",
        benefit:"Opens the inner thighs and hips — key mobility for the straddle and the front split.",
        cue:"Knees ~90°, feet in line, tuck tailbone slightly to protect the back" },
      { id:'f4_frog_rock', name:'Frog Rocking', duration:60, unit:'seconds', sides:false,
        instructions:"From the frog position, rock the hips slowly forward and back within a comfortable range. Move with the breath. Stay well short of any pinch or strain.",
        benefit:"Adds gentle movement to the frog stretch to ease the hips open without forcing the end range.",
        cue:"Rock gently forward and back, don't force" },
      { id:'f5_straddle', name:'Straddle / Pancake Fold', duration:60, unit:'seconds', sides:false,
        instructions:"Sit with the legs wide apart, toes pointing up. Hinge forward from the hips with a flat back, walking the hands forward only as far as the flat back allows. Breathe into the stretch.",
        benefit:"Builds the straddle (pancake) fold — hip and adductor mobility for the middle split.",
        cue:"Legs wide, hinge forward flat-backed" },
      { id:'f6_couch', name:'Couch Stretch', duration:45, unit:'seconds', sides:true,
        instructions:"Place the back foot up against a wall or couch with the front foot planted in a lunge. Tuck the tailbone and rise the torso tall until you feel the stretch in the back-leg hip flexor and quad.",
        benefit:"Opens the hip flexor and quad of the back leg — direct front-split preparation and relief for anterior pelvic tilt.",
        cue:"Opens the back-leg hip flexor — front split prep" },
      { id:'f7_runners_lunge', name:"Low Runner's Lunge", duration:45, unit:'seconds', sides:true,
        instructions:"From a lunge, lower the back knee toward the floor and sink the hips forward. Keep the torso long and tall. Breathe into the front of the back hip.",
        benefit:"Lengthens the hip flexors and opens the hips for split work.",
        cue:"Sink into the lunge, keep the torso long" },
      { id:'f8_split_slides', name:'Front Split Slides', duration:45, unit:'seconds', sides:true,
        instructions:"With a towel under the front heel on a smooth floor, ease the front foot forward toward a split shape, hands on the floor carrying your weight. Go only to a comfortable stretch — never bounce.",
        benefit:"Progresses the front split safely, with the hands controlling how deep you go.",
        cue:"Ease toward split shape on a towel, hands supporting" },
      { id:'f9_figure_four', name:'Figure-Four Glute Stretch', duration:60, unit:'seconds', sides:true,
        instructions:"Lie on your back. Cross one ankle over the opposite knee. Pull both legs toward the chest, holding behind the thigh. Keep the head down and the shoulders relaxed.",
        benefit:"Releases the glutes and hips after the split work — a back-friendly finish.",
        cue:"Calms the hips, back-friendly finish" },
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
  streak.lastFlexibilityDate=type==='flexibility'?date:streak.lastFlexibilityDate; // Phase 52
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
  let mDone=0,eDone=0,fDone=0;
  for(let i=0;i<days;i++){
    const d=new Date();d.setDate(d.getDate()-i);
    const entry=log[_ukDate(d)]||{};
    if(entry.morning&&entry.morning.completed)mDone++;
    if(entry.evening&&entry.evening.completed)eDone++;
    if(entry.flexibility&&entry.flexibility.completed)fDone++; // Phase 52
  }
  const total=days;
  return {
    morning:{done:mDone,total,pct:Math.round((mDone/total)*100)},
    evening:{done:eDone,total,pct:Math.round((eDone/total)*100)},
    flexibility:{done:fDone,total,pct:Math.round((fDone/total)*100)}, // Phase 52
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

// Canonical supplement list for Jay (Phase 39, updated Phase 41b)
// All supplements with M1; Mounjaro Wed 18:00 (post-workout); zinc 25mg; single Omega 3 dose (Bare Biology 1,700mg)
function JAY_SUPPLEMENTS_V39(){
  return [
    {id:'supp-sidr-honey',name:'Sidr Honey',dose:'1 tsp in warm water',time:'07:30',mealId:'',timing:'on-waking',withFood:false,critical:true,notes:'Morning ritual'},
    {id:'vit-d',name:'Vitamin D3',dose:'4,000 IU',time:'12:00',mealId:'',timing:'meal-1',withFood:true,critical:true,notes:'Fat-soluble — take with food'},
    {id:'omega-3',name:'Omega 3',dose:'2 caps (Bare Biology, 1,700mg total)',time:'12:00',mealId:'',timing:'meal-1',withFood:true,critical:true,notes:'Anti-inflammatory · therapeutic dose for CRP + ALT'},
    {id:'supp-zinc',name:'Zinc',dose:'25mg',time:'12:00',mealId:'',timing:'meal-1',withFood:true,critical:false,notes:'With meal 1 — testosterone + immune support'},
    {id:'metformin-am',name:'Metformin',dose:'1000mg',time:'12:00',mealId:'',timing:'with-food',withFood:true,critical:true,notes:'Medication — take with food'},
    {id:'supp-coq10',name:'CoQ10',dose:'2 caps (200mg total)',time:'15:00',mealId:'pre-workout',timing:'meal-2',withFood:true,critical:false,notes:'Fat-soluble · statin-induced CoQ10 depletion support · with pre-workout meal'},
    {id:'supp-magnesium',name:'Magnesium Glycinate',dose:'300mg',time:'22:00',mealId:'',timing:'bedtime',withFood:false,critical:true,notes:'Sleep support'},
    {id:'supp-mounjaro',name:'Mounjaro',dose:'5mg',time:'18:00',mealId:'',timing:'wednesday-meal-2',withFood:true,critical:true,frequency:'weekly-wednesday',notes:'GLP-1 — Wednesday injection post-workout'},
  ];
}

// ---- S6: Water tracker (ml) ----
function getWaterLog(date){
  const log=pGet('waterLog',{});
  return log[date||todayStr()]||{entries:[],total:0};
}
// Phase 42a: 35ml/kg (+500 gym days) via targets.js; profile.targetOverrides wins.
function getWaterTarget(date){
  const st=(typeof getSessionTypeForDate==='function')?getSessionTypeForDate(date||todayStr()):null;
  const w=(typeof getCurrentWeight==='function')?getCurrentWeight():null;
  return computeWaterTarget({weight:w,isGymDay:!!st,overrides:(STATE.profile||{}).targetOverrides});
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
    if((e.total||0)>=(e.target||3000))hit++;
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
    if(n>0)wl[date]={entries:[{amount:n*250,time:'12:00',type:'migrated'}],total:n*250,target:3000};
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

// ---- Phase 41h: Oura VO2 max ----
function getVO2MaxLog(){return pGet('vo2maxLog',{})||{};}
function getCurrentVO2Max(){
  const log=getVO2MaxLog();
  const dates=Object.keys(log).filter(d=>typeof log[d]?.vo2==='number').sort();
  if(!dates.length)return null;
  return log[dates[dates.length-1]].vo2;
}
function getVO2MaxBand(value,age,sex){
  if(value==null)return null;
  // Cooper Institute norms, simplified. Female bands ~5 lower.
  const isFemale=sex==='female';
  const adjust=isFemale?-5:0;
  let bands;
  if(!age||age<40)bands=[35,40,45,50,55];
  else if(age<50) bands=[32,37,42,47,52];
  else if(age<60) bands=[26,31,36,41,45];
  else            bands=[24,28,32,36,40];
  const labels=['Poor','Fair','Average','Good','Excellent','Superior'];
  const colors=['var(--red)','var(--orange)','#ffc107','var(--lime)','var(--green)','var(--cyan)'];
  for(let i=0;i<bands.length;i++){
    if(value<bands[i]+adjust)return {label:labels[i],color:colors[i],nextThreshold:bands[i]+adjust,index:i};
  }
  return {label:labels[labels.length-1],color:colors[colors.length-1],nextThreshold:null,index:labels.length-1};
}
// ---- Phase 41i: Cardio log (zone-2 etc., owner-tracked, rest-day-only nudging) ----
const CARDIO_TARGET_PER_WEEK=3;
function getCardioLog(date){return (pGet('cardioLog',{})[date||todayStr()])||null;}
function setCardioLog(date,entry){
  const log=pGet('cardioLog',{});
  log[date]={...(log[date]||{}),...entry,loggedAt:new Date().toISOString()};
  STATE.cardioLog=log;
  updateLocalCache();
  saveFieldToServer(`/api/state/cardio-log/${date}`,{value:log[date]});
}
function isRestDay(date){
  return (typeof getSessionTypeForDate==='function')&&getSessionTypeForDate(date||todayStr())===null;
}
// Sessions logged in the last N days
// ---- Phase 41o: DEXA body-composition scans (gold-standard reference) ----
const DEXA_VAT_BANDS=[
  {max:100,label:'Normal',color:'var(--green)'},
  {max:160,label:'Increased',color:'#ffc107'},
  {max:9999,label:'High',color:'var(--red)'},
];
const DEXA_TSCORE_BANDS=[
  {min:-1,label:'Normal',color:'var(--green)'},
  {min:-2.5,label:'Osteopenia',color:'#ffc107'},
  {min:-9,label:'Osteoporosis',color:'var(--red)'},
];
function getDexaScans(){
  const arr=pGet('dexaScans',[]);
  return Array.isArray(arr)?arr:[];
}
function getLatestDexaScan(){
  const arr=getDexaScans();
  if(!arr.length)return null;
  return [...arr].sort((a,b)=>(a.date||'').localeCompare(b.date||''))[arr.length-1];
}
function getDexaVATBand(vatCm2){
  if(vatCm2==null)return null;
  for(const b of DEXA_VAT_BANDS)if(vatCm2<b.max)return b;
  return DEXA_VAT_BANDS[DEXA_VAT_BANDS.length-1];
}
function getDexaTScoreBand(tScore){
  if(tScore==null)return null;
  if(tScore>-1)return DEXA_TSCORE_BANDS[0];
  if(tScore>-2.5)return DEXA_TSCORE_BANDS[1];
  return DEXA_TSCORE_BANDS[2];
}
function addDexaScan(scan){
  const arr=getDexaScans();
  const entry={
    id:'dexa_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
    date:scan.date||todayStr(),
    provider:String(scan.provider||'').slice(0,80),
    weight:scan.weight?+scan.weight:null,
    bodyFatPct:scan.bodyFatPct?+scan.bodyFatPct:null,
    fatMass:scan.fatMass?+scan.fatMass:null,
    leanMass:scan.leanMass?+scan.leanMass:null,
    boneMass:scan.boneMass?+scan.boneMass:null,
    vatCm2:scan.vatCm2?+scan.vatCm2:null,
    bmdTotal:scan.bmdTotal?+scan.bmdTotal:null,
    tScore:scan.tScore!=null?+scan.tScore:null,
    zScore:scan.zScore!=null?+scan.zScore:null,
    lmi:scan.lmi?+scan.lmi:null,
    almi:scan.almi?+scan.almi:null,
    fmi:scan.fmi?+scan.fmi:null,
    androidFatPct:scan.androidFatPct?+scan.androidFatPct:null,
    gynoidFatPct:scan.gynoidFatPct?+scan.gynoidFatPct:null,
    muscleSymmetryPct:scan.muscleSymmetryPct?+scan.muscleSymmetryPct:null,
    longevityIndex:scan.longevityIndex?+scan.longevityIndex:null,
    notes:String(scan.notes||'').slice(0,400),
    loggedAt:new Date().toISOString(),
  };
  arr.push(entry);
  STATE.dexaScans=arr;
  updateLocalCache();
  saveFieldToServer('/api/state/dexa-scans',{dexaScans:arr});
  return entry;
}
function updateDexaScan(id,patch){
  const arr=getDexaScans();
  const i=arr.findIndex(s=>s&&s.id===id);
  if(i<0)return;
  arr[i]={...arr[i],...patch,id};
  STATE.dexaScans=arr;
  updateLocalCache();
  saveFieldToServer('/api/state/dexa-scans',{dexaScans:arr});
}
function deleteDexaScan(id){
  const arr=getDexaScans().filter(s=>s&&s.id!==id);
  STATE.dexaScans=arr;
  updateLocalCache();
  saveFieldToServer('/api/state/dexa-scans',{dexaScans:arr});
}

// ============================================================
// PHASE 58 — BODITRAX (trusted multi-frequency BIA; source:'boditrax')
// ============================================================
// The reliability hierarchy (DEXA > Boditrax > Withings) lives in the shared,
// tested proactive-core engine; these helpers own storage + CRUD only.
function getBoditraxLog(){const a=pGet('boditraxLog',[]);return Array.isArray(a)?a:[];}
function getLatestBoditrax(){
  const arr=getBoditraxLog();
  if(!arr.length)return null;
  return [...arr].sort((a,b)=>(a.date||'').localeCompare(b.date||''))[arr.length-1];
}
// Validate a raw entry via the shared engine (falls back gracefully if the core
// isn't loaded). Returns {ok, errors, clean}.
function validateBoditrax(raw){
  if(typeof PROACTIVE_CORE!=='undefined'&&PROACTIVE_CORE.validateBoditraxEntry)return PROACTIVE_CORE.validateBoditraxEntry(raw);
  const clean={source:'boditrax',date:String(raw.date||'').slice(0,10)};
  return{ok:!!clean.date,errors:clean.date?{}:{date:'Date required'},clean};
}
function addBoditraxEntry(raw){
  const v=validateBoditrax(raw);
  if(!v.ok)return v;
  const arr=getBoditraxLog();
  const entry={id:'bdx_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),...v.clean,loggedAt:new Date().toISOString()};
  arr.push(entry);
  STATE.boditraxLog=arr;
  updateLocalCache();
  saveFieldToServer('/api/state/boditrax-log',{boditraxLog:arr});
  return{...v,entry};
}
function updateBoditraxEntry(id,raw){
  const v=validateBoditrax(raw);
  if(!v.ok)return v;
  const arr=getBoditraxLog();
  const i=arr.findIndex(s=>s&&s.id===id);
  if(i<0)return{ok:false,errors:{id:'not found'},clean:v.clean};
  arr[i]={...arr[i],...v.clean,id,loggedAt:new Date().toISOString()};
  STATE.boditraxLog=arr;
  updateLocalCache();
  saveFieldToServer('/api/state/boditrax-log',{boditraxLog:arr});
  return{...v,entry:arr[i]};
}
function deleteBoditraxEntry(id){
  const arr=getBoditraxLog().filter(s=>s&&s.id!==id);
  STATE.boditraxLog=arr;
  updateLocalCache();
  saveFieldToServer('/api/state/boditrax-log',{boditraxLog:arr});
}
// Blended lean series ({date,lean,source}) via the shared engine, start-scoped.
function getBlendedLeanSeries(){
  if(typeof PROACTIVE_CORE==='undefined'||!PROACTIVE_CORE.blendedLeanSeries)return null;
  const start=getActive()?.startDate;
  const s=PROACTIVE_CORE.blendedLeanSeries(STATE);
  return start?s.filter(p=>p.date>=start):s;
}

// Phase 55: Health Records — document wrappers (source text + provider/title) for
// the Body-page timeline. The extracted NUMBERS live in bloodMarkers / dexaScans.
function getHealthRecords(){const a=pGet('healthRecords',[]);return Array.isArray(a)?a:[];}
function saveHealthRecords(arr){STATE.healthRecords=arr;updateLocalCache();saveFieldToServer('/api/state/health-records',{healthRecords:arr});}
function addHealthRecord(rec){
  const a=getHealthRecords();
  const entry={
    id:'hr_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
    type:rec.type==='dexa'?'dexa':'bloods',
    date:rec.date||todayStr(),
    provider:String(rec.provider||'').slice(0,120),
    title:String(rec.title||'').slice(0,160),
    sourceText:String(rec.sourceText||'').slice(0,20000),
    addedAt:new Date().toISOString(),
  };
  a.push(entry);
  saveHealthRecords(a);
  return entry;
}
function deleteHealthRecord(id){saveHealthRecords(getHealthRecords().filter(r=>r&&r.id!==id));}

// ---- Phase 41l: Blood pressure tracking (LVH-aware) ----
const BP_TARGET_SYS=130, BP_TARGET_DIA=80; // ACC/AHA target for LVH / elevated CV risk
const BP_BANDS=[
  {max_s:120,max_d:80,label:'Normal',color:'var(--green)',code:'normal'},
  {max_s:130,max_d:80,label:'Elevated',color:'#ffc107',code:'elevated'},
  {max_s:140,max_d:90,label:'Stage 1',color:'var(--orange)',code:'stage1'},
  {max_s:180,max_d:120,label:'Stage 2',color:'var(--red)',code:'stage2'},
  {max_s:9999,max_d:9999,label:'Crisis',color:'#ff0000',code:'crisis'},
];
function getBPLog(){
  const arr=pGet('bpLog',[]);
  return Array.isArray(arr)?arr:[];
}
function getBPBand(systolic,diastolic){
  if(systolic==null||diastolic==null)return null;
  for(const b of BP_BANDS){
    if(systolic<b.max_s&&diastolic<b.max_d)return b;
  }
  return BP_BANDS[BP_BANDS.length-1];
}
function getCurrentBP(){
  const arr=getBPLog();
  if(!arr.length)return null;
  // Sort by date then time (most recent last)
  const sorted=[...arr].sort((a,b)=>{
    const ad=(a.date||'')+(a.time||''),bd=(b.date||'')+(b.time||'');
    return ad<bd?-1:ad>bd?1:0;
  });
  return sorted[sorted.length-1];
}
function getBPAverage(days){
  const cutoff=new Date();cutoff.setDate(cutoff.getDate()-days);
  const cutoffStr=_ukDate(cutoff);
  const recent=getBPLog().filter(r=>r&&r.date>=cutoffStr&&r.systolic&&r.diastolic);
  if(!recent.length)return null;
  const sumS=recent.reduce((s,r)=>s+r.systolic,0);
  const sumD=recent.reduce((s,r)=>s+r.diastolic,0);
  const pulseReadings=recent.filter(r=>r.pulse);
  const sumP=pulseReadings.reduce((s,r)=>s+r.pulse,0);
  return {
    systolic:Math.round(sumS/recent.length),
    diastolic:Math.round(sumD/recent.length),
    pulse:pulseReadings.length?Math.round(sumP/pulseReadings.length):null,
    n:recent.length,
    days,
  };
}
function getBPTrend(){
  const week1=getBPAverage(7);
  const week2=getBPAverage(14);
  if(!week1||!week2)return null;
  return {
    sysDelta:week1.systolic-week2.systolic,
    diaDelta:week1.diastolic-week2.diastolic,
    direction:week1.systolic<week2.systolic?'down':week1.systolic>week2.systolic?'up':'flat',
  };
}
function addBPReading(reading){
  const arr=getBPLog();
  const entry={
    id:'bp_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
    date:reading.date||todayStr(),
    time:reading.time||fmtNow(),
    systolic:parseInt(reading.systolic)||0,
    diastolic:parseInt(reading.diastolic)||0,
    pulse:reading.pulse?parseInt(reading.pulse):null,
    arm:reading.arm||'left',
    position:reading.position||'sitting',
    notes:String(reading.notes||'').slice(0,200),
    loggedAt:new Date().toISOString(),
  };
  arr.push(entry);
  STATE.bpLog=arr;
  updateLocalCache();
  saveFieldToServer('/api/state/bp-log',{bpLog:arr});
  return entry;
}
function deleteBPReading(id){
  const arr=getBPLog().filter(r=>r&&r.id!==id);
  STATE.bpLog=arr;
  updateLocalCache();
  saveFieldToServer('/api/state/bp-log',{bpLog:arr});
}

function getCardioCompliance(days){
  const log=pGet('cardioLog',{});
  let sessions=0,totalMin=0,hrSum=0,hrN=0,restDayMatch=0,nonRestDay=0;
  for(let i=0;i<days;i++){
    const d=new Date();d.setDate(d.getDate()-i);
    const ds=_ukDate(d);
    const e=log[ds];
    if(!e)continue;
    sessions++;
    totalMin+=(+e.duration)||0;
    if(typeof e.avgHr==='number'){hrSum+=e.avgHr;hrN++;}
    if(isRestDay(ds))restDayMatch++;else nonRestDay++;
  }
  return{sessions,totalMin,avgHr:hrN?Math.round(hrSum/hrN):null,restDayMatch,nonRestDay,days};
}

function getVO2MaxTrend(days){
  const log=getVO2MaxLog();
  const cutoff=new Date();cutoff.setDate(cutoff.getDate()-days);
  const cutoffStr=_ukDate(cutoff);
  const recent=Object.keys(log).filter(d=>d>=cutoffStr&&typeof log[d]?.vo2==='number').sort();
  if(recent.length<2)return null;
  const first=log[recent[0]].vo2;
  const last=log[recent[recent.length-1]].vo2;
  return {first,last,delta:Math.round((last-first)*10)/10,days,direction:last>first?'up':last<first?'down':'flat'};
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
