// Phase 57: lightweight headless render smoke test — zero deps (node --test + vm
// + a tiny DOM shim). Boots the real frontend scripts, seeds a representative
// owner state, and asserts the main pages + the Coach Settings section render
// without throwing and expose their key controls. Smoke coverage only — this is
// NOT a full UI test suite; it catches load-time errors, render-time
// ReferenceErrors, template-literal breakage, and missing control ids.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Async post-render loaders (admin stats etc.) are stubbed out, but ignore any
// stray rejection so the smoke run never fails on background fetch noise.
process.on("unhandledRejection", () => {});

// --- Minimal DOM element ---
function makeEl() {
  return {
    _html: "", style: {}, dataset: {}, value: "", textContent: "", checked: false, disabled: false,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, setAttribute() {}, removeAttribute() {},
    focus() {}, blur() {}, click() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    get innerHTML() { return this._html; }, set innerHTML(v) { this._html = String(v); },
  };
}

// --- Fresh context with a shimmed window/document/localStorage ---
function makeContext() {
  const els = {};
  const getEl = (id) => (els[id] || (els[id] = makeEl()));
  const document = {
    getElementById: getEl, createElement: () => makeEl(),
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    body: makeEl(), documentElement: makeEl(), head: makeEl(), cookie: "",
  };
  const localStorage = {
    _s: {}, getItem(k) { return this._s[k] != null ? this._s[k] : null; },
    setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; }, clear() { this._s = {}; },
  };
  const navigator = { serviceWorker: { register: () => Promise.resolve() }, onLine: true, userAgent: "node" };
  const win = {
    _forgeUserEmail: "jay@afjltd.co.uk", addEventListener() {}, removeEventListener() {},
    location: { href: "http://localhost/", search: "", pathname: "/", replace() {} },
    history: { replaceState() {}, pushState() {} },
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    navigator,
  };
  const ctx = {
    window: win, document, localStorage, navigator, location: win.location, history: win.history,
    matchMedia: win.matchMedia,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    alert() {}, confirm: () => true, prompt: () => null,
    fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve("") }),
    console, JSON, Math, Date, Array, Object, String, Number, Boolean, RegExp, Map, Set, Promise, Error,
    parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, URLSearchParams,
  };
  ctx.window = win; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  return { ctx, els };
}

const FILES = ["targets.js", "programme-shared.js", "proactive-core.js", "data.js", "workout.js", "pages.js", "app.js"];
function bootApp() {
  const { ctx, els } = makeContext();
  for (const f of FILES) {
    const code = fs.readFileSync(path.join(__dirname, "..", "public", f), "utf8");
    vm.runInContext(code, ctx, { filename: f });
  }
  return { ctx, els };
}

// Representative owner state (getActive() === STATE.profile).
const SEED = {
  profile: {
    email: "jay@afjltd.co.uk", name: "Jay",
    personal: { age: 52, heightCm: 180, sex: "male", ethnicity: "south-asian", activityLevel: "moderate", phase: "cut", dateOfBirth: "1974-01-01" },
    startWeight: 113.5, targetWeight: 93, startBF: 32, targetBF: 18, targetLBM: 80, targetVisceralFat: 6,
    startDate: "2026-05-08", planStartDate: "2026-05-08",
    calsGym: 2200, calsRest: 2200, macros: { protein: 244, carbs: 145, fat: 77 }, programId: "upper-lower-4d",
    medications: [{ id: "m1", name: "Mounjaro", dose: "5mg" }], bloodMarkers: [],
    healthConditions: [{ key: "lvh", label: "LVH", notes: "cardiac" }, { key: "smoker", label: "Smoker" }],
    coachTargets: { proteinPerMeal: 40, proteinFloorDaily: 150, waterRestMl: 3000, waterGymMl: 3500, deficitKcal: 500 },
    glp1InjectionDow: 3, eatingWindow: { enabled: true, start: 12, end: 20 }, sessionTimes: {},
  },
  trainingStartDate: "2026-05-08",
  weightLog: [{ date: "2026-07-10", weight: 105, source: "manual" }], bfLog: [{ date: "2026-07-10", bf: 30 }],
  foods: {}, exLog: {}, sleepLog: {}, recovery: {}, stepsLog: {}, calorieLog: {}, supplements: [], supplementLog: {},
  reminders: [], notifications: [], waterLog: {}, fastingLog: {}, mounjaroLog: {}, injuries: {}, exerciseNotes: {},
  measLog: [], dexaScans: [], boditraxLog: [{ id: "bdx1", source: "boditrax", date: "2026-07-14", weight: 106.1, muscle: 73.8, fat: 28.5, ffm: 77.6, visceral: 14 }],
  bodyComp: {}, bpLog: [], vo2maxLog: [], cardioLog: {}, skinCare: { products: [] },
  skinCareLog: {}, stretchLog: {}, coachingReports: [], mealPlan: { meals: [] }, sessionFeel: {}, recoveryOverrides: {},
};
function seed(ctx) {
  vm.runInContext("Object.assign(STATE, " + JSON.stringify(SEED) + ")", ctx);
  // stub async loaders that would fetch during renderMore's post-hook
  vm.runInContext("loadAdminStats = function(){}; loadInviteList = function(){}; loadCoachStatus = function(){};", ctx);
}

test("all frontend scripts load without throwing", () => {
  assert.doesNotThrow(() => bootApp());
});

const PAGES = [
  { fn: "renderToday", id: "page-today" },
  { fn: "renderTrack", id: "page-track" },
  { fn: "renderFood", id: "page-food" },
  { fn: "renderCoach", id: "page-coach" },
  { fn: "renderMore", id: "page-more" },
  { fn: "renderBody", id: "page-body" },
];
for (const pg of PAGES) {
  test(`${pg.fn} renders without throwing and populates ${pg.id}`, () => {
    const { ctx, els } = bootApp();
    seed(ctx);
    assert.equal(typeof ctx[pg.fn], "function", `${pg.fn} is not defined`);
    assert.doesNotThrow(() => ctx[pg.fn](), `${pg.fn} threw`);
    assert.ok((els[pg.id] && els[pg.id]._html || "").length > 0, `${pg.id} was not populated`);
  });
}

test("More page renders the Coach Settings section + key controls", () => {
  const { ctx, els } = bootApp();
  seed(ctx);
  ctx.renderMore();
  const html = els["page-more"]._html;
  for (const needle of [
    "Coach Settings", "Health Conditions", "Coach Targets",
    "ct-protfloor", "ct-permeal", "ct-deficit", "ct-water-rest", "ct-steps",
    "cs-dob", "hc-free", "cs-injday", "cs-ew-start", "cs-ew-end",
  ]) {
    assert.ok(html.includes(needle), `Coach Settings missing control/label: ${needle}`);
  }
});

test("Coach Settings save/remove handlers are all defined", () => {
  const { ctx } = bootApp();
  for (const fn of [
    "saveCoachTargets", "saveInjectionDay", "saveEatingWindow", "saveCoachDob",
    "addHealthConditionQuick", "addHealthConditionFree", "removeHealthCondition", "loadCoachSettingsUI",
  ]) {
    assert.equal(typeof ctx[fn], "function", `${fn} not defined`);
  }
});

test("5-day progression uses the CURRENT template's rep range (per-template exObj)", () => {
  const { ctx } = bootApp();
  seed(ctx);
  vm.runInContext(`STATE.profile.programId='upper-lower-5d-fixed'; STATE.profile.programmeStartDate='2026-07-20';`, ctx);
  // Shoulder Press (u4) is 6–8 in the old 'upper' template but 10–12 in upperA.
  // Last session: 40kg × 9 reps, solid. Under 10–12 that's below top → HOLD/climb
  // reps; under 6–8 (the global-dedupe default) 9≥8 → it would add weight.
  const prev = { date: "2026-07-20", log: { u4: { sets: [{ kg: 40, reps: 9, effort: "solid" }] } } };
  vm.runInContext(`globalThis._prev = ${JSON.stringify(prev)};`, ctx);
  const withTemplate = vm.runInContext(
    `suggestWeight('u4', _prev, undefined, { exObj: WORKOUTS.upperA.exercises.find(e=>e.id==='u4'), prevSessions:[_prev], forDate:'2026-07-27' })`, ctx);
  assert.equal(withTemplate.dir, null, "upperA 10–12: 9 reps is below top → hold + climb reps");
  const withoutTemplate = vm.runInContext(
    `suggestWeight('u4', _prev, undefined, { prevSessions:[_prev], forDate:'2026-07-27' })`, ctx);
  assert.equal(withoutTemplate.dir, "up", "global default 6–8: 9≥8 → adds weight (proves the template range matters)");
});

test("5-day scheduled deload: 60% of last non-deload weight, 2 sets, flagged", () => {
  const { ctx } = bootApp();
  seed(ctx);
  vm.runInContext(`STATE.profile.programId='upper-lower-5d-fixed'; STATE.profile.programmeStartDate='2026-07-20';`, ctx);
  // A real working session at 40kg on a NON-deload week (Jul 27).
  const prev = { date: "2026-07-27", log: { u4: { sets: [{ kg: 40, reps: 11, effort: "solid" }, { kg: 40, reps: 10, effort: "solid" }] } } };
  vm.runInContext(`globalThis._d = ${JSON.stringify(prev)};`, ctx);
  // forDate 2026-08-17 = week index 4 = deload.
  const sug = vm.runInContext(
    `suggestWeight('u4', _d, undefined, { exObj: WORKOUTS.upperA.exercises.find(e=>e.id==='u4'), prevSessions:[_d], forDate:'2026-08-17' })`, ctx);
  assert.equal(sug.scheduledDeload, true, "flagged as scheduled deload");
  assert.equal(sug.deload, true);
  assert.equal(sug.setsOverride, 2, "set count overridden to 2");
  assert.equal(sug.kg, 24, "60% of 40kg = 24kg");
  // Rehab is exempt from deload (no scheduledDeload overlay)
  const rehabPrev = { date: "2026-07-27", log: { reh_1: { sets: [{ kg: 5, reps: 15 }] } } };
  const rehSug = vm.runInContext(
    `suggestWeight('reh_1', ${JSON.stringify(rehabPrev)}, undefined, { exObj: WORKOUTS.upperA.exercises.find(e=>e.id==='reh_1'), prevSessions:[${JSON.stringify(rehabPrev)}], forDate:'2026-08-17' })`, ctx);
  assert.ok(!rehSug || !rehSug.scheduledDeload, "rehab exempt from scheduled deload");
});

test("5-day post-deload: progression references the last NON-deload weight, not the 60% week", () => {
  const { ctx } = bootApp();
  seed(ctx);
  vm.runInContext(`STATE.profile.programId='upper-lower-5d-fixed'; STATE.profile.programmeStartDate='2026-07-20';`, ctx);
  // Most recent session was the deload week (24kg on Aug 17); before it, real 40kg.
  const deload = { date: "2026-08-17", log: { u4: { sets: [{ kg: 24, reps: 10 }, { kg: 24, reps: 10 }] } } };
  const real = { date: "2026-08-10", log: { u4: { sets: [{ kg: 40, reps: 12, effort: "solid" }, { kg: 40, reps: 12, effort: "solid" }] } } };
  // forDate Aug 24 = week 0 (normal). Reference must be the 40kg session, so a
  // top-of-range (12) solid week progresses UP from 40, not from 24.
  const sug = vm.runInContext(
    `suggestWeight('u4', ${JSON.stringify(deload)}, undefined, { exObj: WORKOUTS.upperA.exercises.find(e=>e.id==='u4'), prevSessions:[${JSON.stringify(deload)}, ${JSON.stringify(real)}], forDate:'2026-08-24' })`, ctx);
  assert.equal(sug.dir, "up", "progresses up off the real week");
  assert.ok(sug.kg > 24, `must build off 40kg not the 24kg deload (got ${sug.kg}kg)`);
});

test("progression is rep-range-aware per day (undulating split: Leg Press 8–10 vs 10–12)", () => {
  const { ctx } = bootApp();
  seed(ctx);
  const T = "2026-07-25";
  // Lower A trains Leg Press (l1) at 8–10 reps (heavier); Lower B at 10–12
  // (lighter). Both logged with their real session type. The reference for each
  // day must come from THAT day's rep range, not blend across them.
  vm.runInContext(`
    STATE.profile.programId='upper-lower-5d-fixed'; STATE.profile.programmeStartDate='2026-07-06';
    STATE.exLog={
      '2026-07-14':{_session:{sessionType:'lowerA'}, l1:{sets:[{kg:328,reps:9,effort:'solid'},{kg:328,reps:8,effort:'solid'}],done:true}},
      '2026-07-18':{_session:{sessionType:'lowerB'}, l1:{sets:[{kg:300,reps:11,effort:'solid'},{kg:300,reps:11,effort:'solid'}],done:true}}
    };
  `, ctx);
  const q = (e) => vm.runInContext(e, ctx);

  // A new Lower B day (10–12) references the 300kg Lower B history — NOT 328kg.
  const sugB = q(`suggestWeight('l1', null, 0, { exObj: WORKOUTS.lowerB.exercises.find(e=>e.id==='l1'), prevSessions:[], forDate:'${T}' })`);
  assert.ok(sugB, "lower B suggestion exists");
  assert.ok(sugB.kg <= 315, `Lower B references the ~300kg 10–12 history, not the 328kg 8–10 day (got ${sugB.kg})`);
  assert.ok(/300/.test(sugB.reason || ''), "Lower B reason cites the 300kg set");

  // A new Lower A day (8–10) references the 328kg Lower A history.
  const sugA = q(`suggestWeight('l1', null, 0, { exObj: WORKOUTS.lowerA.exercises.find(e=>e.id==='l1'), prevSessions:[], forDate:'${T}' })`);
  assert.ok(sugA.kg >= 325, `Lower A references the 328kg 8–10 history (got ${sugA.kg})`);
});

test("suitcase carry: time double progression 40→50→60→+5kg, effort-aware", () => {
  const { ctx } = bootApp();
  seed(ctx);
  // prevSession = 3 completed sets, both sides held `secs` at `kg`, aimed `target`.
  const sug = (secs, kg, effort, target) => {
    const sets = [0, 1, 2].map(() => ({ done: true, leftSeconds: secs, rightSeconds: secs, leftKg: kg, rightKg: kg, targetSeconds: target, effort }));
    return vm.runInContext(`(function(){var s=suggestCarry('core_suitcase',${JSON.stringify({ date: '2026-07-20', log: { core_suitcase: { sets } } })});return JSON.stringify({kg:s.leftKg,sec:s.targetSeconds});})()`, ctx);
  };
  const exp = (kg, sec) => JSON.stringify({ kg, sec });
  // First time → start at the 40s floor, no weight assumed.
  assert.equal(vm.runInContext(`suggestCarry('core_suitcase',null).targetSeconds`, ctx), 40);
  // Climb the time at a fixed weight: 40→50→60.
  assert.equal(sug(40, 25, 'solid', 40), exp(25, 50), "held 40 → climb to 50, hold weight");
  assert.equal(sug(50, 25, 'solid', 50), exp(25, 60), "held 50 → climb to 60, hold weight");
  // Held the 60s ceiling on all sets → +5kg, reset to 40s (easy OR solid).
  assert.equal(sug(60, 25, 'solid', 60), exp(30, 40), "held 60 solid → +5kg, back to 40");
  assert.equal(sug(60, 25, 'easy', 60),  exp(30, 40), "held 60 easy → +5kg, back to 40 (easy adds weight)");
  // Tough at the ceiling → hold weight, stay at 60.
  assert.equal(sug(60, 25, 'tough', 60), exp(25, 60), "held 60 tough → hold weight + time");
  // Fell under the 40s floor → drop 2.5kg, back to 40.
  assert.equal(sug(35, 25, 'solid', 40), exp(22.5, 40), "under floor → drop weight");
  // Short of the target but above the floor → repeat weight + time.
  assert.equal(sug(47, 25, 'solid', 50), exp(25, 50), "short of target → repeat");
});

test("suitcase carry screens render (countdown target, 5s switch, effort)", () => {
  const { ctx, els } = bootApp();
  seed(ctx);
  vm.runInContext(`todayStr=function(){return '2026-07-25';};`, ctx);
  // lowerB exercise index 3 = core_suitcase (Suitcase Carry).
  const idx = vm.runInContext(`getWorkout('lowerB').exercises.findIndex(e=>e.id==='core_suitcase')`, ctx);
  assert.ok(idx >= 0, "carry is in lowerB");
  vm.runInContext(`wm={active:true,session:'lowerB',exIdx:${idx},setIdx:0,mode:'set',autoReg:null,carrySide:'left'};`, ctx);
  assert.doesNotThrow(() => vm.runInContext(`renderWmSetCarry()`, ctx), "carry set screen renders");
  const set = els['wmContent']._html;
  assert.ok(/range 40s–60s/.test(set), "shows the 40–60s range as plain seconds (not 1:00)");
  assert.ok(/aim 40s per side/.test(set), "counts down from the 40s floor first time");
  assert.doesNotThrow(() => vm.runInContext(`renderWmCarrySwitch()`, ctx), "5s switch renders");
  assert.ok(/Switch hands/.test(els['wmContent']._html), "switch screen shows");
  assert.doesNotThrow(() => vm.runInContext(`renderWmCarryEffort()`, ctx), "carry effort renders");
  assert.ok(/How did that feel/.test(els['wmContent']._html), "effort screen shows");
});

test("Tricep Rope Pushdown (u7) is a normal working lift in Upper B, not a filler", () => {
  const { ctx } = bootApp();
  seed(ctx);
  const q = (e) => vm.runInContext(e, ctx);
  const ids = q(`getWorkout('upperB').exercises.map(e=>e.id)`);
  assert.ok(ids.includes('u7'), "u7 renders in Upper B");
  assert.equal(q(`getWorkout('upperB').exercises.find(e=>e.id==='u7').name`), 'Tricep Rope Pushdown');
  assert.equal(q(`getWorkout('upperB').exercises.find(e=>e.id==='u7').size`), 'small', "size:small → lightest increments (like u6)");
  assert.equal(q(`FILLERS['u7']===undefined`), true, "u7 is NOT a filler drill");
  assert.equal(q(`computeSessionVolume({u7:{sets:[{kg:25,reps:15}]}})`), 375, "u7 counts as a normal working set");
});

test("filler drills never pollute working-set history; parent-keyed store avoids collisions", () => {
  const { ctx } = bootApp();
  seed(ctx);
  const T = "2026-07-25";
  vm.runInContext(`todayStr=function(){return '${T}';};`, ctx);
  const q = (e) => vm.runInContext(e, ctx);

  // Empty fillers array → Deep Squat Hold default; assigned → that filler.
  assert.equal(q(`getFillerForLift({id:'h5'}).id`), 'fill_deep_squat', "no fillers → deep-squat default");
  assert.equal(q(`getFillerForLift({id:'u4',fillers:['fill_band_pull_apart']}).id`), 'fill_band_pull_apart');
  assert.equal(q(`FILLERS.fill_deep_squat.target`), 60, "deep squat default 60s");
  assert.equal(q(`FILLERS.fill_deep_squat.max`), 120, "progressable to 120s");

  // Real Upper A session: u4 (Shoulder Press) + reh_2 (Band Pull-Apart) are real
  // WORKING lifts. Band Pull-Apart is also the filler *movement* for u4 — but the
  // filler drill id is fill_band_pull_apart, stored under _fillers[u4].
  q(`STATE.exLog={'${T}':{_session:{sessionType:'upperA'}, u4:{sets:[{kg:50,reps:10,done:true}]}, reh_2:{sets:[{kg:5,reps:15,done:true}]}}};`);
  q(`logFillerGap('${T}','u4','fill_band_pull_apart',0,'done'); logFillerGap('${T}','u4','fill_band_pull_apart',1,'done'); logFillerGap('${T}','u1','fill_band_ext_rot',0,'skipped');`);

  // Stored under _fillers, keyed by PARENT lift — never under reh_2 or the drill id.
  assert.equal(q(`getExLogForDate('${T}').reh_2.sets.length`), 1, "reh_2 working set untouched");
  assert.equal(q(`getExLogForDate('${T}').fill_band_pull_apart===undefined`), true, "no exercise entry for the filler id");
  assert.equal(q(`Object.keys(getExLogForDate('${T}')._fillers).sort().join(',')`), 'u1,u4', "fillers keyed by parent lift");

  // Volume counts ONLY the two real working sets (50×10 + 5×15 = 575).
  assert.equal(q(`computeSessionVolume(getExLogForDate('${T}'))`), 575, "fillers excluded from volume");
  // Progression/autoreg never see fillers (id lookups + the _ skip).
  assert.equal(q(`getExercisePreviousSessions('fill_band_pull_apart','2026-08-01',5).length`), 0, "filler absent from progression history");
  assert.equal(q(`_classifyLoggedSession(getExLogForDate('${T}'))`), 'upperA', "session classify ignores _fillers");

  // Adherence recap: 2 done, 1 skipped.
  const adh = q(`JSON.stringify(fillerAdherence('${T}'))`);
  assert.ok(/"done":2/.test(adh) && /"skipped":1/.test(adh), "adherence tallies done + skipped per lift");
});

// Phase 63: rest-gap accessories replace the throwaway filler — during a
// compound's rest you log the session's own small/rehab work as REAL sets, so it
// ticks off the end-of-session list instead of showing up again later.
test("logging an accessory during rest records a real set without touching the countdown", () => {
  const { ctx } = bootApp();
  seed(ctx);
  const T = "2026-07-25";
  vm.runInContext(`todayStr=function(){return '${T}';};`, ctx);
  // Resting after Shoulder Press (u4) set 1; reh_2 Band Pull-Apart is a 2×15 accessory.
  vm.runInContext(`STATE.exLog={'${T}':{u4:{sets:[{kg:50,reps:10,done:true}]}}};`, ctx);
  vm.runInContext(`wm={active:true,session:'upperA',exIdx:0,setIdx:0,mode:'rest',restTarget:90,restStarted:123456,restInterval:null};`, ctx);
  vm.runInContext(`renderWmRest()`, ctx);
  const before = vm.runInContext(`JSON.stringify({t:wm.restTarget,s:wm.restStarted,m:wm.mode})`, ctx);
  vm.runInContext(`document.getElementById('wm-acc-reps-reh_2').value='15'; wmRestLogSet('reh_2');`, ctx);
  const after = vm.runInContext(`JSON.stringify({t:wm.restTarget,s:wm.restStarted,m:wm.mode})`, ctx);
  assert.equal(before, after, "rest timer state (target/started/mode) untouched by logging an accessory");
  assert.equal(vm.runInContext(`getExLogForDate('${T}').reh_2.sets.filter(s=>s.done).length`, ctx), 1, "one real set logged on reh_2");
  assert.equal(vm.runInContext(`getExLogForDate('${T}').reh_2.sets[0].reps`, ctx), 15, "reps recorded on the accessory");
  assert.equal(vm.runInContext(`getExLogForDate('${T}').reh_2.sets[0].viaRest`, ctx), true, "tagged as done during rest");
  assert.equal(vm.runInContext(`!!getExLogForDate('${T}').reh_2.done`, ctx), false, "not complete after 1 of 2 sets");
  assert.equal(vm.runInContext(`getExLogForDate('${T}').u4.sets.length`, ctx), 1, "resting lift's own log untouched");
});

test("rest screen offers session accessories; completing one drops it from the main flow", () => {
  const { ctx, els } = bootApp();
  seed(ctx);
  const T = "2026-07-25";
  vm.runInContext(`todayStr=function(){return '${T}';};`, ctx);
  vm.runInContext(`STATE.exLog={'${T}':{u4:{sets:[{kg:50,reps:10,done:true,effort:'solid'}]}}};`, ctx);
  vm.runInContext(`wm={active:true,session:'upperA',exIdx:0,setIdx:0,mode:'rest',restTarget:90,restStarted:1};`, ctx);
  assert.doesNotThrow(() => vm.runInContext(`renderWmRest()`, ctx), "rest screen renders the accessory panel");
  const html = els['wmContent']._html;
  assert.ok(/Knock out accessories now/.test(html), "accessory panel shown during rest");
  assert.ok(/Band Pull-Apart/.test(html), "the session's Band Pull-Apart accessory is offered");
  assert.ok(/wmRestLogSet\('reh_2'\)/.test(html), "log button wired to the accessory's own id");
  assert.ok(!/wmRestLogSet\('u4'\)/.test(html), "the compound being rested is not offered as its own accessory");
  // Complete reh_2 (2 sets) during rest → marked done and skipped by the main flow.
  vm.runInContext(`document.getElementById('wm-acc-reps-reh_2').value='15'; wmRestLogSet('reh_2');`, ctx);
  vm.runInContext(`document.getElementById('wm-acc-reps-reh_2').value='15'; wmRestLogSet('reh_2');`, ctx);
  assert.equal(vm.runInContext(`getExLogForDate('${T}').reh_2.done`, ctx), true, "reh_2 complete after 2 sets");
  assert.equal(vm.runInContext(`_wmExComplete('reh_2')`, ctx), true, "flow treats reh_2 as complete");
  const rehIdx = vm.runInContext(`getWorkout('upperA').exercises.findIndex(e=>e.id==='reh_2')`, ctx);
  assert.notEqual(vm.runInContext(`_wmNextPendingIdx(${rehIdx - 1})`, ctx), rehIdx, "completed accessory is skipped when advancing");
});

// Phase 63a: accessory-panel defaults are grounded in last session (match/beat),
// falling back to the rep-range top / progression weight for a first-timer.
test("rest accessory defaults reference last session's reps + weight", () => {
  const { ctx, els } = bootApp();
  seed(ctx);
  const T = "2026-07-25";
  vm.runInContext(`todayStr=function(){return '${T}';};`, ctx);
  // A prior upperA session: Band Pull-Apart at 20 reps, weighted Lateral Raise (h5) at 8kg×14.
  vm.runInContext(`STATE.exLog={
    '2026-07-21':{_session:{sessionType:'upperA'}, u4:{done:true,sets:[{kg:50,reps:10,done:true},{kg:50,reps:10,done:true},{kg:50,reps:10,done:true}]}, u1:{done:true,sets:[{kg:40,reps:8,done:true}]}, u3:{done:true,sets:[{kg:40,reps:8,done:true}]}, u5:{done:true,sets:[{kg:40,reps:10,done:true}]}, reh_2:{done:true,sets:[{reps:20,done:true},{reps:20,done:true}]}, h5:{done:true,sets:[{kg:8,reps:14,done:true},{kg:8,reps:14,done:true}]}},
    '${T}':{u4:{sets:[{kg:50,reps:10,done:true}]}}
  };`, ctx);
  vm.runInContext(`wm={active:true,session:'upperA',exIdx:0,setIdx:0,mode:'rest',restTarget:90,restStarted:1};`, ctx);
  vm.runInContext(`renderWmRest()`, ctx);
  const html = els['wmContent']._html;
  // Band Pull-Apart (rehab, no weight) reps default = last session's 20, not the range top (15).
  assert.ok(/id="wm-acc-reps-reh_2"[\s\S]*?value="20"/.test(html), "reh_2 reps default to last session's 20 reps");
  assert.ok(/last 20/.test(html), "shows a 'last time' reference for reh_2");
  // Lateral Raise (weighted) shows last 8kg×14 and pre-fills a weight.
  assert.ok(/last 8kg×14/.test(html), "shows last time's weight×reps for the weighted accessory");
  assert.ok(/id="wm-acc-kg-h5"[\s\S]*?value="[0-9]/.test(html), "weighted accessory pre-fills a kg default");
});

test("weighted compounds get set-to-set guidance; accessories left alone", () => {
  const { ctx } = bootApp();
  seed(ctx);
  // reps:99 forces the "topped the range" branch → non-null guidance for any lift
  // the engine covers. null = the lift gets no set-to-set autoregulation.
  const guided = (tmpl, id) => vm.runInContext(
    `!!_autoregNextSet(WORKOUTS['${tmpl}'].exercises.find(e=>e.id==='${id}'), {kg:40,reps:99,effort:'easy'}, 1)`, ctx);

  // Fixed: these weighted lifts now carry a rep range → guidance on every day.
  assert.ok(guided('lowerA', 'l2'),          "RDL (lowerA) now gets guidance");
  assert.ok(guided('upperB', 'h3'),          "One-Arm Row (upperB) now gets guidance");
  assert.ok(guided('upperB', 'u8'),          "Face Pull (upperB) now gets guidance");
  assert.ok(guided('upperB', 'u6'),          "Bicep Curl (upperB) now gets guidance");
  assert.ok(guided('lowerA', 'core_pallof'), "Pallof (lowerA) now gets guidance");
  // The add-weight reps target is the range floor (double progression):
  const rdl = vm.runInContext(`_autoregNextSet(WORKOUTS.lowerA.exercises.find(e=>e.id==='l2'), {kg:100,reps:8,effort:'easy'}, 1)`, ctx);
  assert.equal(rdl.reps, 6, "RDL 6–8: topped → reps reset to floor (6)");

  // Left alone: bodyweight + rehab accessories get NO weight autoregulation.
  assert.ok(!guided('upperB', 'core_dead_bug'), "Dead Bug left alone (no guidance)");
  assert.ok(!guided('upperA', 'reh_2'),         "Band Pull-Apart left alone");
  assert.ok(!guided('upperA', 'reh_3'),         "Banded Flexion left alone");
});

test("_autoregNextSet returns an explicit reps target on every branch (never undefined)", () => {
  const { ctx } = bootApp();
  seed(ctx);
  // Same fixture as the investigation: u1 Chest Press, range 8–10, medium lift
  // (increments +5 / +2.5 / −2.5), last set logged at 60kg.
  const ar = (reps, effort) => vm.runInContext(
    `_autoregNextSet(WORKOUTS.upperA.exercises.find(e=>e.id==='u1'), {kg:60,reps:${reps},effort:'${effort}'}, 1)`, ctx);
  const easy  = ar(10, 'easy');   // topped + easy  → +weight, reps to FLOOR
  const solid = ar(10, 'solid');  // topped + solid → +weight, reps to FLOOR
  const inRng = ar(8,  'solid');  // in range       → hold, aim +1
  const tough = ar(9,  'tough');  // grind          → hold weight + reps
  const drop  = ar(6,  'solid');  // below range    → drop weight, aim top

  // Weight is unchanged (confirmed-correct behaviour) — assert it stays put.
  assert.equal(easy.kg, 65);   assert.equal(solid.kg, 62.5);
  assert.equal(inRng.kg, 60);  assert.equal(tough.kg, 60);   assert.equal(drop.kg, 57.5);

  // Reps — the fix — exact pairs, matching _suggestWeightCore's double progression:
  assert.equal(easy.reps, 8,  "add-weight (easy) resets reps to BOTTOM (8), NOT top (10)");
  assert.equal(solid.reps, 8, "add-weight (solid) resets reps to BOTTOM (8), NOT top (10)");
  assert.equal(inRng.reps, 9, "in-range aims one more rep (8→9), capped at 10");
  assert.equal(tough.reps, 9, "tough holds the same reps just done (9)");
  assert.equal(drop.reps, 10, "drop aims the range top at the lighter load");

  // Regression guard: NO branch may return a non-finite reps.
  for (const r of [easy, solid, inRng, tough, drop])
    assert.ok(Number.isFinite(r.reps), "reps must be a finite number on every branch");
});

test("next-set prefill reflects the add-weight guidance (kg up + reps to bottom)", () => {
  const { ctx } = bootApp();
  seed(ctx);
  vm.runInContext(`todayStr = function(){ return '2026-07-25'; };`, ctx);
  vm.runInContext(`Object.assign(STATE, { exLog: { '2026-07-14': { _session:{sessionType:'upperA'}, u1:{ sets:[{kg:60,reps:9,effort:'solid'}], done:true } } } });`, ctx);
  // Guided workout: upperA, exercise index 1 = u1 Chest Press (range 8–10), set 1.
  vm.runInContext(`wm = { active:true, session:'upperA', exIdx:1, setIdx:0, mode:'set', restTarget:90, autoReg:null };`, ctx);
  // Log set 1 = 60kg × 10 (top of range), rate SOLID → guidance "add weight".
  vm.runInContext(`document.getElementById('wm-kg').value='60'; document.getElementById('wm-reps').value='10';`, ctx);
  vm.runInContext(`wmMarkSetDone(90);`, ctx);
  vm.runInContext(`wmRecordEffort('solid');`, ctx); // → rest screen, computes wm.autoReg

  const stored = vm.runInContext(`JSON.stringify(wm.autoReg)`, ctx);
  assert.ok(/"kg":62\.5/.test(stored), "guidance adds weight to 62.5kg");
  assert.ok(/"reps":8/.test(stored), "guidance now stores reps=8 (bottom), not undefined");

  // (~1902) Transition preview shows the next set's kg AND bottom-of-range reps.
  vm.runInContext(`wmStartNextSet();`, ctx);
  const trans = vm.runInContext(`document.getElementById('wmContent').innerHTML`, ctx);
  assert.ok(/62\.5kg × 8 reps/.test(trans), `transition preview shows 62.5kg × 8 reps (got: ${(trans.match(/[\d.]+kg × \d+ reps/)||[])[0]})`);

  // (~1332) Set screen prefills the actual inputs.
  vm.runInContext(`wm.mode='set'; renderWmSet();`, ctx);
  const setHtml = vm.runInContext(`document.getElementById('wmContent').innerHTML`, ctx);
  const kg = (setHtml.match(/id="wm-kg"[^>]*value="([^"]*)"/) || [])[1];
  const reps = (setHtml.match(/id="wm-reps"[^>]*value="([^"]*)"/) || [])[1];
  assert.equal(kg, '62.5', "set-2 weight prefill = 62.5kg (incremented)");
  assert.equal(reps, '8', "set-2 reps prefill = 8 (bottom of range) — was showing 10");
});

test("skincare: 3-step tretinoin frequency ladder (retinol journey retired)", () => {
  const { ctx } = bootApp();
  seed(ctx);
  vm.runInContext(`
    STATE.skinCare={products:[{id:'skn-retinol',name:'Tretinoin 0.025%',type:'retinol',concentration:'0.025%',slot:'pm',frequency:'every-2-days',frequencyStartedAt:'2026-06-01'}],phase:1,phaseStartDate:'2026-06-01'};
    STATE.skinCareLog={};
  `, ctx);
  assert.equal(vm.runInContext("SKIN_PHASES.length", ctx), 3, "3-step ladder");
  assert.equal(vm.runInContext("JSON.stringify(SKIN_PHASES.map(p=>p.freq))", ctx), JSON.stringify(["every-2-days", "5x-week", "daily"]));
  const r = vm.runInContext("getSkinPhaseReadiness()", ctx);
  assert.equal(r.phaseNum, 1);
  assert.equal(r.nextFrequency, "5x-week", "next step = 5 nights/week");
  const html = vm.runInContext("renderRetinolJourney()", ctx);
  assert.ok(/Tretinoin 0\.025%/.test(html), "card titled with the product");
  assert.ok(/Step 1 — Every other night · current/.test(html), "current step framed as frequency");
  assert.ok(!/Phase 6|Discuss with coach|graduate/i.test(html), "no retinol-graduation framing");
});

test("blood markers: two dated panels render distinctly + HbA1c trends 72→47 (toward range)", () => {
  const { ctx, els } = bootApp();
  seed(ctx);
  // April panel (2026-05-08) + July panel (2026-07-22). HbA1c falls 72→47 (both
  // ABOVE the upper-bound ref, so falling = toward range = good). HDL rises but
  // (lower-bound) a hypothetical fall would be bad. eGFR is a ">90" qualifier.
  vm.runInContext(`
    STATE.profile.bloodMarkers = [
      { id:'hba1c',      name:'HbA1c', value:72, unit:'mmol/mol', refLow:null, refHigh:42, category:'diabetes', date:'2026-05-08' },
      { id:'hdl',        name:'HDL Cholesterol', value:1.01, unit:'mmol/L', refLow:1.04, refHigh:null, category:'cholesterol', date:'2026-05-08' },
      { id:'testosterone', name:'Testosterone (Total)', value:9.55, unit:'nmol/L', refLow:8.4, refHigh:28.7, category:'hormones', date:'2026-05-08' },
      { id:'hba1c-jul26', name:'HbA1c', value:47, unit:'mmol/mol', refLow:20, refHigh:41, category:'diabetes', date:'2026-07-22' },
      { id:'hdl-jul26',  name:'HDL Cholesterol', value:1.11, unit:'mmol/L', refLow:1.0, refHigh:null, category:'cholesterol', date:'2026-07-22' },
      { id:'egfr-jul26', name:'eGFR', value:90, valueQualifier:'>', unit:'mL/min/1.73m²', refLow:60, refHigh:null, category:'kidney', date:'2026-07-22' }
    ];
    STATE.healthRecords = [
      { id:'hr1', type:'bloods', date:'2026-05-08', provider:'Bloodwork Group' },
      { id:'hr2', type:'bloods', date:'2026-07-22', provider:'NHS · UHB (Dr S Mughal)' }
    ];
  `, ctx);

  // (a) Body page Health Records timeline shows TWO distinct blood panels.
  ctx.renderBody();
  const body = els["page-body"]._html;
  assert.ok(/22 Jul 2026/.test(body), "Body page shows the July panel");
  assert.ok(/8 May 2026/.test(body), "Body page still shows the April panel");
  const panelCount = (body.match(/🩸/g) || []).length; // one blood-drop icon per distinct panel row
  assert.equal(panelCount, 2, "exactly two distinct blood panels on the Body page");

  // (b) Blood Markers list de-dupes to ONE HbA1c row with a 72→47 trend.
  ctx.renderMore();
  ctx.renderBloodMarkersList();
  const list = els["blm-list"]._html;
  assert.equal((list.match(/HbA1c/g) || []).length, 1, "HbA1c appears once (de-duped), not twice");
  assert.ok(/↓ 72 → 47/.test(list), "HbA1c trend line renders 72 → 47");
  // Falling HbA1c is TOWARD the range → good (green); never flagged red.
  const hb = vm.runInContext("_markerTrend({value:47,refLow:20,refHigh:41,date:'2026-07-22'},{value:72,refLow:null,refHigh:42,date:'2026-05-08'})", ctx);
  assert.equal(hb.dir, "good", "HbA1c falling = toward range = good");
  // Falling HDL is AWAY from the range → bad (lower-bound marker).
  const hdlDown = vm.runInContext("_markerTrend({value:0.9,refLow:1.0,refHigh:null,date:'2026-07-22'},{value:1.11,refLow:1.0,refHigh:null,date:'2026-05-08'})", ctx);
  assert.equal(hdlDown.dir, "bad", "HDL falling = away from range = bad");

  // (c) eGFR ">90" renders with its qualifier, not a bare 90.
  assert.ok(/&gt;90|>90/.test(list), "eGFR renders with its > qualifier");

  // (d) The latest panel header reflects the July date.
  assert.ok(/Latest panel: 22 Jul 2026/.test(els["blm-panel-date"]._html || els["blm-panel-date"].textContent || ""), "header shows latest panel date");

  // (e) April-only markers absent from July (testosterone) are untouched + still shown once.
  assert.equal((list.match(/Testosterone/g) || []).length, 1, "testosterone (April-only) still present, once");
});

test("exercise history survives a programme switch (id-keyed, not session-type-keyed)", () => {
  const { ctx } = bootApp();
  seed(ctx);
  const T = "2026-07-20";
  // Old 'upper'/'lower' sessions logged BEFORE the switch to the 5-day split.
  // Their _session.sessionType is the OLD type, so the same-type lookup for
  // 'upperA'/'lowerA' must MISS them — but per-exercise (id-keyed) history has
  // to find them, because u4/u1/l1 are the same ids in every template.
  vm.runInContext(`
    STATE.profile.programId='upper-lower-5d-fixed'; STATE.profile.programmeStartDate='${T}';
    STATE.exLog={
      '2026-06-20':{_session:{sessionType:'upper'},u4:{sets:[{kg:50,reps:8,effort:'solid'}],done:true},u1:{sets:[{kg:70,reps:8,effort:'solid'}],done:true},u3:{sets:[{kg:65,reps:9,effort:'solid'}],done:true},u5:{sets:[{kg:60,reps:10,effort:'solid'}],done:true}},
      '2026-06-24':{_session:{sessionType:'lower'},l1:{sets:[{kg:200,reps:9,effort:'solid'}],done:true}},
      '2026-06-28':{_session:{sessionType:'upper'},u4:{sets:[{kg:50,reps:9,effort:'solid'}],done:true}}
    };
  `, ctx);
  const q = (e) => vm.runInContext(e, ctx);

  // 1) Same-type session lookups ARE blind after the switch — the root cause.
  assert.equal(q(`getPreviousSessionData('${T}','upperA')`), null, "same-type lookup finds nothing post-switch");
  assert.equal(q(`getPreviousSessions('${T}','upperA',5).length`), 0);

  // 2) Exercise-centric (id-keyed) history finds the old sessions regardless of type.
  assert.equal(q(`JSON.stringify(getExercisePreviousSessions('u4','${T}',5).map(s=>s.date))`), JSON.stringify(["2026-06-28", "2026-06-20"]));
  assert.equal(q(`getLastExercisePerformance('u4','${T}').date`), "2026-06-28");
  assert.equal(q(`JSON.stringify(getExercisePreviousSessions('l1','${T}',5).map(s=>s.date))`), JSON.stringify(["2026-06-24"]));

  // 3) Progression continues from the established weights, not a fresh default.
  const sug = q(`suggestWeight('u4', getPreviousSessionData('${T}','upperA'), 0, { exObj: WORKOUTS.upperA.exercises.find(e=>e.id==='u4'), prevSessions:getPreviousSessions('${T}','upperA',5), forDate:'${T}' })`);
  assert.ok(sug, "shoulder-press suggestion is not null after the switch");
  assert.equal(sug.kg, 50, "references the 50kg history, not a fresh default");
  const sugL = q(`suggestWeight('l1', getPreviousSessionData('${T}','lowerA'), 0, { exObj: WORKOUTS.lowerA.exercises.find(e=>e.id==='l1'), prevSessions:getPreviousSessions('${T}','lowerA',5), forDate:'${T}' })`);
  assert.equal(sugL.kg, 200, "leg-press references its real history across the switch");

  // 4) The Train-page display shows the last session, not "no history yet".
  const html = q(`buildExItem(WORKOUTS.upperA.exercises.find(e=>e.id==='u4'), {}, getPreviousSessionData('${T}','upperA'), false, '${T}')`);
  assert.ok(/↺ Last: 50×9/.test(html), "renders the last-session summary from id-keyed history");
  assert.ok(!/no history yet/.test(html), "does NOT show 'no history yet' when history exists");
});

test("skincare readiness needs 4 weeks/step (tretinoin is stronger than retinol)", () => {
  const { ctx } = bootApp();
  seed(ctx);
  vm.runInContext(`STATE.skinCare={products:[{id:'r',type:'retinol',frequency:'every-2-days',frequencyStartedAt:'2026-07-05'}],phase:1,phaseStartDate:'2026-07-05'};STATE.skinCareLog={};`, ctx);
  const r = vm.runInContext("getSkinPhaseReadiness()", ctx);
  assert.equal(r.ready, false, "2 weeks in → not ready");
  assert.ok(/4 weeks/.test(r.reason), "cites the 4-week minimum");
});

test("supplements grid: weekly Mounjaro due only on injection day; today pending not missed", () => {
  const { ctx } = bootApp();
  seed(ctx);
  // Pin "today" (like every other test in this file). getSupplementAdherence()
  // measures the last 7 days from todayStr(), so without this the ticked Wednesday
  // fell outside the window on any real run date and the test was date-flaky.
  vm.runInContext(`todayStr=function(){return '2026-07-25';};`, ctx); // Saturday
  vm.runInContext(`
    STATE.profile.glp1InjectionDow=3; // Wednesday
    STATE.supplements=[{id:'creatine',name:'Creatine',frequency:'daily'},{id:'mnj',name:'Mounjaro',frequency:'weekly-wednesday'}];
    STATE.supplementLog={'2026-07-22':{mnj:true}}; // ticked on the Wednesday inside the 7-day window
  `, ctx);
  assert.equal(vm.runInContext("isSupplementDue(STATE.supplements[1],'2026-07-22')", ctx), true, "Mounjaro due Wed");
  assert.equal(vm.runInContext("isSupplementDue(STATE.supplements[1],'2026-07-23')", ctx), false, "Mounjaro NOT due Thu");
  const adh = vm.runInContext("getSupplementAdherence(7)", ctx);
  assert.equal(adh.byId.mnj.total, 1, "only the 1 due day (Wed) is in the denominator");
  assert.equal(adh.byId.mnj.taken, 1);
  assert.equal(adh.byId.mnj.pct, 100, "Mounjaro 1/1 = 100%");
  assert.equal(adh.byId.creatine.total, 6, "today's untaken (pending) creatine excluded; 6 past due days");
  const html = vm.runInContext("renderSupplementsCoach()", ctx);
  assert.ok(/title="pending"/.test(html), "today renders as pending");
  assert.ok(/title="na"/.test(html), "Mounjaro non-due days render n/a, not missed");
});

test("Weekly Report Card is a thin wrapper over the shared engine (no drift)", () => {
  const { ctx } = bootApp();
  seed(ctx);
  // Seed a week of data so the card computes real values.
  vm.runInContext(`
    STATE.planStartDate='2026-05-08';
    STATE.profile.coachTargets={proteinFloorDaily:200, stepsDaily:10000};
    (function(){
      var days=getLast7();
      STATE.stepsLog={}; STATE.foods={}; STATE.sleepLog={}; STATE.weightLog=[];
      days.forEach(function(d,i){
        STATE.stepsLog[d]= i<5?12000:3000;
        STATE.foods[d]=[{cals:2000,protein: i<5?210:150}];
        STATE.sleepLog[d]={hours:7.2, bedtime:23};
        STATE.weightLog.push({date:d, weight:105 - i*0.1, source:'withings'});
      });
    })();
  `, ctx);
  const card = vm.runInContext("getWeeklyReport()", ctx);
  // Independently recompute via the shared engine with the SAME opts the wrapper builds.
  const direct = vm.runInContext(`(function(){
    var ct=STATE.profile.coachTargets;
    var scheduled=[];
    getLast7().forEach(function(d){var t=getSessionTypeForDate(d); if(t){scheduled.push({date:d,type:t,exerciseIds:sessionExercises(t).map(function(e){return e.id;})});}});
    return PROACTIVE_CORE.weeklyReport(STATE,{today:todayStr(),stepsTarget:ct.stepsDaily,proteinFloor:ct.proteinFloorDaily,scheduled:scheduled});
  })()`, ctx);
  const { isBaseline, ...cardCore } = card;
  // Normalise (-0 → 0 etc.) — proves identical serialised values = no drift.
  assert.equal(JSON.stringify(cardCore), JSON.stringify(direct), "card must equal the shared-engine result exactly");
  assert.equal(card.steps.target, 10000, "steps target from coachTargets.stepsDaily");
  assert.equal(card.protein.floor, 200, "protein floor from coachTargets.proteinFloorDaily (no ×0.9)");
  assert.equal(card.protein.hit, 5);
  assert.equal(card.grades.sleep, "A");
});

test("Coach page renders the rebuilt card (weighted caption + letter grades)", () => {
  const { ctx, els } = bootApp();
  seed(ctx);
  vm.runInContext(`STATE.planStartDate='2026-05-08'; STATE.profile.coachTargets={proteinFloorDaily:200,stepsDaily:10000};
    STATE.sleepLog={}; getLast7().forEach(function(d){STATE.sleepLog[d]={hours:7.2,bedtime:23};});`, ctx);
  ctx.renderCoach();
  const html = els["page-coach"]._html;
  assert.ok(/Weighted: protein 30% · training 30% · steps 20% · sleep 20%/.test(html), "weights caption shown");
  assert.ok(/nights logged/.test(html), "sleep shows nights-logged");
});

test("week strip supports next/prev-week navigation + shows the new 5-day badges", () => {
  const { ctx } = bootApp();
  seed(ctx);
  vm.runInContext(`STATE.profile.programId='upper-lower-5d-fixed'; STATE.profile.programmeStartDate='2026-07-20'; viewDate='2026-07-25';`, ctx);
  const html = vm.runInContext("renderWeekStrip()", ctx);
  assert.ok(/shiftViewWeek\(-1\)/.test(html) && /shiftViewWeek\(1\)/.test(html), "prev + next week controls present");
  assert.ok(/>UA</.test(html), "Mon 20 Jul shows Upper A badge");
  assert.ok(/>LA</.test(html), "Tue shows Lower A");
  assert.ok(/>Z2</.test(html), "Sat shows the Zone 2 badge (was '•' before)");
  assert.equal(typeof ctx.shiftViewWeek, "function", "shiftViewWeek defined");
  assert.equal(typeof ctx.goToThisWeek, "function", "goToThisWeek defined");
});

test("shared-id history carries over across the programme switch (leg press l1)", () => {
  const { ctx } = bootApp();
  seed(ctx);
  vm.runInContext(`STATE.profile.programId='upper-lower-5d-fixed'; STATE.profile.programmeStartDate='2026-07-20';
    // Historical LOWER-day session (old programme) with Leg Press at 275kg
    // (the +53 sled-corrected value). No 'lowerA' session exists yet.
    STATE.exLog={ '2026-07-10': { l1: { sets: [{ kg: 275, reps: 8, effort: 'solid' }] } } };`, ctx);
  // Prescribing l1 for a new lowerA session (Tue 21 Jul) — same-type history is
  // empty, so the cross-type fallback must find the 275kg leg press.
  const sug = vm.runInContext(
    `suggestWeight('l1', getPreviousSessionData('2026-07-21','lowerA'), undefined, { exObj: WORKOUTS.lowerA.exercises.find(e=>e.id==='l1'), prevSessions: getPreviousSessions('2026-07-21','lowerA',5), forDate:'2026-07-21' })`, ctx);
  assert.ok(sug && sug.kg != null, "must carry over history, not show FIND WEIGHT");
  assert.equal(sug.kg, 275, "references the 275kg leg press from the old lower day");
  // With NO history anywhere → genuinely no reference (FIND WEIGHT).
  vm.runInContext("STATE.exLog={};", ctx);
  const none = vm.runInContext(
    `suggestWeight('l1', null, undefined, { exObj: WORKOUTS.lowerA.exercises.find(e=>e.id==='l1'), prevSessions: [], forDate:'2026-07-21' })`, ctx);
  assert.ok(!none || none.kg == null, "no history → no fabricated weight");
});

test("5-day switch-day (Sun 19 Jul): rest + no make-up of the pre-switch programme", () => {
  const { ctx } = bootApp();
  seed(ctx);
  vm.runInContext(`STATE.profile.programId='upper-lower-5d-fixed'; STATE.profile.programmeStartDate='2026-07-20'; STATE.exLog={};`, ctx);
  // Sun 19 Jul: old 4-day cycle would show Upper; new programme → rest (gated).
  assert.equal(vm.runInContext("getSessionTypeForDate('2026-07-19')", ctx), null, "switch-day = rest");
  // Yesterday (Sat 18) is also pre-start → gated null → getMissedSession offers nothing.
  assert.equal(vm.runInContext("getMissedSession('2026-07-19')", ctx), null, "no make-up on the switch day");
  // From Mon 20 Jul the split runs.
  assert.equal(vm.runInContext("getSessionTypeForDate('2026-07-20')", ctx), "upperA", "Mon = UPPER_A");
  assert.equal(vm.runInContext("getSessionTypeForDate('2026-07-25')", ctx), "zone2", "Sat = ZONE2");
});

test("migration seedFiveDaySplitV1 switches BOTH users with correct rehab flags", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "server", "index.ts"), "utf8");
  assert.ok(src.includes("async function seedFiveDaySplitV1"), "migration missing");
  assert.ok(src.includes("await seedFiveDaySplitV1()"), "migration not wired into the chain");
  assert.ok(/jay@afjltd\.co\.uk[\s\S]*showRehab: true/.test(src), "Jay: rehab on");
  assert.ok(/mohammed\.naveed@birmingham\.gov\.uk[\s\S]*showRehab: false/.test(src), "Naveed: rehab off");
  assert.ok(src.includes('programmeStartDate = "2026-07-20"'), "programmeStartDate = Mon 20 Jul");
  assert.ok(src.includes('programId = "upper-lower-5d-fixed"'), "programId set");
  assert.ok(src.includes("fiveDaySplitV1"), "one-shot guard");
});

test("rehab exercises are per-user: shown by default, hidden when profile.showRehab===false", () => {
  const { ctx } = bootApp();
  seed(ctx);
  // Default (owner / Jay): rehab visible in UPPER_A
  const withRehab = vm.runInContext("sessionExercises('upperA').map(e=>e.id)", ctx);
  assert.ok(withRehab.includes("reh_1") && withRehab.includes("reh_3"), "rehab shown by default");
  assert.ok(withRehab.includes("u4"), "normal lifts still present");
  // Naveed: showRehab=false → rehab filtered out, everything else intact
  vm.runInContext("STATE.profile.showRehab=false;", ctx);
  const noRehab = vm.runInContext("sessionExercises('upperA').map(e=>e.id)", ctx);
  assert.ok(!noRehab.includes("reh_1") && !noRehab.includes("reh_2") && !noRehab.includes("reh_3"), "rehab hidden for Naveed");
  assert.ok(noRehab.includes("u4") && noRehab.includes("u1"), "non-rehab lifts unaffected");
  // getWorkout reflects the same filtering (used by every render/nav path)
  const gw = vm.runInContext("getWorkout('upperA').exercises.length", ctx);
  assert.equal(gw, noRehab.length, "getWorkout uses the same filter as sessionExercises");
});

test("deload week caps weighted lifts at 2 sets; rehab/cardio keep their count", () => {
  const { ctx } = bootApp();
  seed(ctx);
  vm.runInContext(`STATE.profile.programId='upper-lower-5d-fixed'; STATE.profile.programmeStartDate='2026-07-20';`, ctx);
  const u4 = vm.runInContext("WORKOUTS.upperA.exercises.find(e=>e.id==='u4')", ctx);
  const reh = vm.runInContext("WORKOUTS.upperA.exercises.find(e=>e.id==='reh_1')", ctx);
  const z2 = vm.runInContext("WORKOUTS.zone2.exercises.find(e=>e.id==='cardio_z2')", ctx);
  // Non-deload week (today outside a deload) → template sets
  // (isDeloadWeekToday reads the real clock, so assert the RELATIONSHIP via the helper)
  const effU4 = vm.runInContext("(function(){var _r=isDeloadWeekToday();return {deload:_r, u4:_effectiveSets(WORKOUTS.upperA.exercises.find(e=>e.id==='u4')), reh:_effectiveSets(WORKOUTS.upperA.exercises.find(e=>e.id==='reh_1')), z2:_effectiveSets(WORKOUTS.zone2.exercises.find(e=>e.id==='cardio_z2'))};})()", ctx);
  if (effU4.deload) {
    assert.equal(effU4.u4, 2, "weighted lift capped at 2 on a deload week");
  } else {
    assert.equal(effU4.u4, u4.sets, "weighted lift uses template sets off deload");
  }
  // Rehab + cardio always keep their template count regardless of deload
  assert.equal(effU4.reh, reh.sets, "rehab keeps its set count");
  assert.equal(effU4.z2, z2.sets, "cardio keeps its set count");
});

test("Mounjaro injection-day gate follows profile.glp1InjectionDow (not hardcoded Wed)", () => {
  const { ctx } = bootApp();
  seed(ctx);
  const set = (dow) => vm.runInContext(`STATE.profile.glp1InjectionDow = ${dow}; _injectionDow();`, ctx);
  assert.equal(set(6), 6, "Saturday (6) must be honoured");
  assert.equal(set(0), 0, "Sunday (0) must be honoured");
  // unset → defaults to Wednesday (3) for pre-Phase-40 users
  assert.equal(vm.runInContext("delete STATE.profile.glp1InjectionDow; _injectionDow();", ctx), 3);
  // isMounjaroDay / isPostInjectionDay must route through the configured day, not a literal
  const src = fs.readFileSync(path.join(__dirname, "..", "public", "data.js"), "utf8");
  assert.ok(/function isMounjaroDay\(\)\{return new Date\(\)\.getDay\(\)===_injectionDow\(\)/.test(src), "isMounjaroDay must use _injectionDow()");
  assert.ok(!/isMounjaroDay\(\)\{return new Date\(\)\.getDay\(\)===3/.test(src), "isMounjaroDay must not hardcode Wednesday");
});

test("Weekly GLP-1 supplement is due on the configured injection day, not Wednesday", () => {
  const { ctx } = bootApp();
  seed(ctx);
  // A critical weekly-wednesday (GLP-1) supplement, untaken.
  vm.runInContext(`STATE.supplements = [{ id: "supp-mounjaro", name: "Mounjaro", critical: true, frequency: "weekly-wednesday" }];
    STATE.supplementLog = {};`, ctx);
  // Injection day = Saturday (6). 2026-07-18 is a Saturday; 2026-07-15 is a Wednesday.
  vm.runInContext("STATE.profile.glp1InjectionDow = 6;", ctx);
  const dueSat = vm.runInContext(`getMissedCriticalSupplements("2026-07-18").length`, ctx);
  const dueWed = vm.runInContext(`getMissedCriticalSupplements("2026-07-15").length`, ctx);
  assert.equal(dueSat, 1, "GLP-1 supplement must be due on the configured Saturday");
  assert.equal(dueWed, 0, "GLP-1 supplement must NOT be due on Wednesday when the day is Saturday");
  // Change the day → the supplement follows.
  vm.runInContext("STATE.profile.glp1InjectionDow = 3;", ctx);
  assert.equal(vm.runInContext(`getMissedCriticalSupplements("2026-07-15").length`, ctx), 1, "moving the day to Wednesday makes Wednesday due");
  assert.equal(vm.runInContext(`getMissedCriticalSupplements("2026-07-18").length`, ctx), 0, "and Saturday no longer due");
});

test("Day Detail backfill renders all four trackers for a past day + wires handlers", () => {
  const { ctx } = bootApp();
  seed(ctx);
  vm.runInContext(`
    STATE.supplements=[{id:'supp-creatine',name:'Creatine',dose:'5g',critical:true,frequency:'daily'}];
    STATE.supplementLog={};
    STATE.profile.glp1InjectionDow=3;                       // Wednesday
    STATE.profile.medications=[{id:'m1',name:'Mounjaro 5mg'}];
    STATE.mounjaroLog={};
    STATE.skinCare={products:[{id:'p1',name:'SPF 50',type:'spf',slot:'am',frequency:'daily',startedDate:'2026-05-01'}]};
    STATE.skinCareLog={};
    STATE.waterLog={};
  `, ctx);
  // 2026-07-15 is a Wednesday → the Mounjaro injection-day section shows too
  const h = vm.runInContext("_ddBackfill('2026-07-15', false, false)", ctx);
  assert.ok(/Supplements — backfill/.test(h) && /ddToggleSupp\('2026-07-15','supp-creatine'/.test(h), "supplements");
  assert.ok(/Mounjaro — backfill/.test(h) && /ddToggleMounjaro\('2026-07-15'\)/.test(h), "mounjaro");
  assert.ok(/Skin care — backfill/.test(h) && /ddToggleSkin\('2026-07-15'/.test(h), "skin care");
  assert.ok(/Water — backfill/.test(h) && /ddAddWater\('2026-07-15',500\)/.test(h), "water");
  // never render for a future date
  assert.equal(vm.runInContext("_ddBackfill('2999-01-01', true, false)", ctx), "", "no backfill for future dates");
  for (const fn of ["ddToggleSupp","ddToggleMounjaro","ddToggleMjSideEffect","ddToggleSkin","ddAddWater","ddAddWaterCustom","ddUndoWater"]) {
    assert.equal(typeof ctx[fn], "function", `${fn} defined`);
  }
});

test("Day Detail backfill handlers persist to the date-keyed logs (past day)", () => {
  const { ctx } = bootApp();
  seed(ctx);
  vm.runInContext(`
    STATE.supplements=[{id:'s1',name:'Vit D',frequency:'daily'}]; STATE.supplementLog={};
    STATE.waterLog={}; STATE.mounjaroLog={};
    STATE.profile.medications=[{id:'m',name:'Mounjaro'}]; STATE.profile.glp1InjectionDow=3;
  `, ctx);
  ctx.ddToggleSupp("2026-07-11", "s1", true);
  assert.equal(vm.runInContext("getSupplementLog('2026-07-11').s1", ctx), true, "supplement backfilled to that date");
  ctx.ddAddWater("2026-07-11", 500);
  ctx.ddAddWater("2026-07-11", 250);
  assert.equal(vm.runInContext("getWaterTotal('2026-07-11')", ctx), 750, "water accumulates on that date");
  ctx.ddUndoWater("2026-07-11");
  assert.equal(vm.runInContext("getWaterTotal('2026-07-11')", ctx), 500, "undo removes the last entry");
  ctx.ddToggleMounjaro("2026-07-15"); // a Wednesday
  assert.equal(vm.runInContext("(getMounjaroLog('2026-07-15')||{}).injected", ctx), true, "Mounjaro injection backfilled on a past day");
  assert.equal(vm.runInContext("(getMounjaroLog('2026-07-15')||{}).injectionTime", ctx), null, "past-day backfill records no spurious 'now' time");
});

test("Body page renders the Boditrax card + handlers are defined", () => {
  const { ctx, els } = bootApp();
  seed(ctx);
  ctx.renderBody();
  const html = els["page-body"]._html;
  assert.ok(html.includes("Boditrax"), "Boditrax card missing from Body page");
  assert.ok(/106\.1/.test(html), "seeded Boditrax weight not rendered");
  for (const fn of ["openBoditraxEdit", "saveBoditraxScan", "deleteBoditraxFromModal", "showBoditraxHistory",
    "getBoditraxLog", "addBoditraxEntry", "updateBoditraxEntry", "deleteBoditraxEntry"]) {
    assert.equal(typeof ctx[fn], "function", `${fn} not defined`);
  }
});

test("Boditrax CRUD round-trips through STATE with validation", () => {
  const { ctx } = bootApp();
  seed(ctx);
  // valid add
  const ok = ctx.addBoditraxEntry({ date: "2026-07-16", weight: 105.5, muscle: 73.5, fat: 28.2, visceral: 14, ffm: 77.3 });
  assert.equal(ok.ok, true, JSON.stringify(ok.errors));
  const log = ctx.getBoditraxLog();
  assert.equal(log.length, 2, "entry not appended");
  const added = log.find((e) => e.date === "2026-07-16");
  assert.equal(added.source, "boditrax");
  // invalid add (missing required visceral, out-of-range weight) is rejected
  const bad = ctx.addBoditraxEntry({ date: "2026-07-17", weight: 999, muscle: 73 });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.visceral && bad.errors.weight);
  assert.equal(ctx.getBoditraxLog().length, 2, "invalid entry must not persist");
  // edit + delete
  ctx.updateBoditraxEntry(added.id, { date: "2026-07-16", weight: 105.0, muscle: 73.5, fat: 28.0, visceral: 13 });
  assert.equal(ctx.getBoditraxLog().find((e) => e.id === added.id).weight, 105.0);
  ctx.deleteBoditraxEntry(added.id);
  assert.equal(ctx.getBoditraxLog().length, 1, "delete failed");
});
