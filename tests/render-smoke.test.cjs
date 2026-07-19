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

test("supplements grid: weekly Mounjaro due only on injection day; today pending not missed", () => {
  const { ctx } = bootApp();
  seed(ctx);
  vm.runInContext(`
    STATE.profile.glp1InjectionDow=3; // Wednesday
    STATE.supplements=[{id:'creatine',name:'Creatine',frequency:'daily'},{id:'mnj',name:'Mounjaro',frequency:'weekly-wednesday'}];
    STATE.supplementLog={'2026-07-15':{mnj:true}}; // ticked on the Wednesday in this week
  `, ctx);
  assert.equal(vm.runInContext("isSupplementDue(STATE.supplements[1],'2026-07-15')", ctx), true, "Mounjaro due Wed");
  assert.equal(vm.runInContext("isSupplementDue(STATE.supplements[1],'2026-07-16')", ctx), false, "Mounjaro NOT due Thu");
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
