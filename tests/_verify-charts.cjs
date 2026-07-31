// Manual chart verification — boots the real frontend, seeds a rich weight/bf
// history, and asserts _trackWeightChart/_trackCompChart produce valid SVG that
// spans the plot area, with projection/target/band on weight and 2 series on comp.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

function makeEl() {
  const el = {
    _html: "", style: {}, dataset: {}, value: "", textContent: "", checked: false, disabled: false,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, setAttribute() {}, removeAttribute() {},
    focus() {}, blur() {}, click() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    get innerHTML() { return this._html; }, set innerHTML(v) { this._html = String(v); },
  };
  return el;
}
function makeContext() {
  const els = {};
  const getEl = (id) => (els[id] || (els[id] = makeEl()));
  const document = {
    getElementById: getEl, createElement: () => makeEl(),
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    body: makeEl(), documentElement: makeEl(), head: makeEl(), cookie: "",
  };
  const localStorage = { _s: {}, getItem(k){return this._s[k]!=null?this._s[k]:null;}, setItem(k,v){this._s[k]=String(v);}, removeItem(k){delete this._s[k];}, clear(){this._s={};} };
  const navigator = { serviceWorker: { register: () => Promise.resolve() }, onLine: true, userAgent: "node" };
  const win = { _forgeUserEmail:"jay@afjltd.co.uk", addEventListener(){}, removeEventListener(){}, location:{href:"http://localhost/",search:"",pathname:"/",replace(){}}, history:{replaceState(){},pushState(){}}, matchMedia:()=>({matches:false,addEventListener(){},addListener(){}}), navigator };
  const ctx = {
    window:win, document, localStorage, navigator, location:win.location, history:win.history, matchMedia:win.matchMedia,
    setTimeout:()=>0, clearTimeout(){}, setInterval:()=>0, clearInterval(){}, requestAnimationFrame:()=>0, cancelAnimationFrame(){},
    alert(){}, confirm:()=>true, prompt:()=>null,
    fetch:()=>Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({}),text:()=>Promise.resolve("")}),
    console, JSON, Math, Date, Array, Object, String, Number, Boolean, RegExp, Map, Set, Promise, Error,
    parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, URLSearchParams,
  };
  ctx.window = win; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  return { ctx, els };
}
const FILES = ["targets.js","programme-shared.js","proactive-core.js","data.js","workout.js","pages.js","app.js"];
function bootApp(){ const {ctx,els}=makeContext(); for(const f of FILES){ vm.runInContext(fs.readFileSync(path.join(__dirname,"..","public",f),"utf8"),ctx,{filename:f}); } return {ctx,els}; }

// Build ~12 weeks of daily-ish weight+bf from 8 May: 113.5→100.9, bf 32→24
function buildHistory(){
  const start = new Date("2026-05-08T12:00:00");
  const wl=[], bl=[];
  for(let d=0; d<=84; d+=3){
    const dt=new Date(start); dt.setDate(dt.getDate()+d);
    const iso=dt.toISOString().slice(0,10);
    const frac=d/84;
    const w=Math.round((113.5-12.6*frac + (d%2?0.3:-0.2))*10)/10; // slight noise
    const bf=Math.round((32-8*frac)*10)/10;
    wl.push({date:iso, weight:w, source:"withings"});
    bl.push({date:iso, bf});
  }
  return {wl,bl};
}

const {ctx} = bootApp();
const {wl,bl} = buildHistory();
const SEED = {
  profile: { email:"jay@afjltd.co.uk", name:"Jay",
    personal:{age:52,heightCm:180,sex:"male",phase:"cut"},
    startWeight:113.5, targetWeight:90, startBF:32, targetBF:18, targetLBM:80, targetVisceralFat:6,
    startDate:"2026-05-08", planStartDate:"2026-05-08", programId:"upper-lower-4d" },
  weightLog: wl, bfLog: bl,
  foods:{}, exLog:{}, sleepLog:{}, recovery:{}, stepsLog:{}, calorieLog:{}, supplements:[], supplementLog:{},
  reminders:[], notifications:[], waterLog:{}, bodyComp:{}, dexaScans:[], boditraxLog:[], measLog:[],
  coachingReports:[], mealPlan:{meals:[]},
};
vm.runInContext("Object.assign(STATE, "+JSON.stringify(SEED)+")", ctx);

// ---- Weight chart ----
const wHtml = ctx._trackWeightChart();
assert.ok(wHtml.includes('id="tchart-weight"'), "weight chart wrapper present");
assert.ok(wHtml.includes('<svg class="tchart"'), "weight svg present");
assert.ok(wHtml.includes('class="target"'), "target line present");
assert.ok(wHtml.includes('TARGET 90kg'), "target label 90kg");
assert.ok(wHtml.includes('stroke-dasharray="1 5"'), "projection dashed line present");
assert.ok(/fill="rgba\(200,255,0,\.10\)"/.test(wHtml), "confidence band polygon present");
assert.ok(wHtml.includes('Projected goal (90kg)'), "goal readout present");
// series polyline should span from padL(34) to near W-padR(416)
const wPoly = wHtml.match(/<polyline points="([^"]+)" fill="none" stroke="#c8ff00" stroke-width="2.4"/);
assert.ok(wPoly, "weight series polyline present");
const wxs = wPoly[1].split(" ").map(p=>parseFloat(p.split(",")[0]));
assert.ok(Math.min(...wxs) <= 50, "weight line starts near left pad, got "+Math.min(...wxs));
assert.ok(Math.max(...wxs) >= 180, "weight line's last actual point is well into the plot, got "+Math.max(...wxs));
console.log("  weight series x-span:", Math.min(...wxs).toFixed(1), "→", Math.max(...wxs).toFixed(1), "("+wxs.length+" pts)");
console.log("✓ Weight chart OK");

// ---- Composition chart ----
const cHtml = ctx._trackCompChart();
assert.ok(cHtml.includes('id="tchart-comp"'), "comp chart wrapper present");
assert.ok(cHtml.includes('Lean mass') && cHtml.includes('Fat mass'), "legend present");
const leanPoly = cHtml.match(/<polyline points="([^"]+)" fill="none" stroke="#2f7fd6"/);
const fatPoly  = cHtml.match(/<polyline points="([^"]+)" fill="none" stroke="#e0680f"/);
assert.ok(leanPoly, "lean series present");
assert.ok(fatPoly, "fat series present");
const lys = leanPoly[1].split(" ").map(p=>parseFloat(p.split(",")[1]));
const fys = fatPoly[1].split(" ").map(p=>parseFloat(p.split(",")[1]));
// lean y should be smaller (higher on screen) than fat y at every point (lean > fat in kg)
assert.ok(Math.min(...lys) < Math.min(...fys), "lean line sits above fat line");
assert.ok(/of it was fat/.test(cHtml), "composition note present");
console.log("  comp note:", (cHtml.match(/Down <b[^>]*>([^<]+)<\/b> since ([^—]+)—/)||[])[0] || "(n/a)");
console.log("✓ Composition chart OK");

// ---- degenerate cases: too few points → empty string, no throw ----
vm.runInContext("STATE.weightLog=[{date:'2026-07-10',weight:105}]; STATE.bfLog=[{date:'2026-07-10',bf:30}];", ctx);
assert.equal(ctx._trackWeightChart(), "", "too few weight entries → empty");
assert.equal(ctx._trackCompChart(), "", "too few comp entries → empty");
console.log("✓ Sparse-data guard OK");

console.log("\nALL CHART CHECKS PASSED");
