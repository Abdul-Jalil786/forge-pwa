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
    "ct-protfloor", "ct-permeal", "ct-deficit", "ct-water-rest",
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
