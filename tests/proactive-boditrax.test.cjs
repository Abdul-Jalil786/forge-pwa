// Phase 58: Boditrax source-hierarchy blending + range validation (zero-dep).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../public/proactive-core.js");

// The three real Boditrax scans the migration seeds.
const BODITRAX = [
  { source: "boditrax", date: "2026-05-16", weight: 114.4, muscle: 75.7, fat: 34.8, water: 56.7, bone: 3.9, ffm: 79.6, visceral: 17, cellular: 7.0, bmr: 2384, metabolicAge: 67, physique: 3, legMuscle: 77, boditraxScore: 612, proteinPct: 17 },
  { source: "boditrax", date: "2026-07-09", weight: 107.1, muscle: 74.6, fat: 28.6, water: 56.2, bone: 3.9, ffm: 78.5, visceral: 14, cellular: 7.1, bmr: 2327, metabolicAge: 56, physique: 6, legMuscle: 81, boditraxScore: 695, proteinPct: 17 },
  { source: "boditrax", date: "2026-07-15", weight: 106.1, muscle: 73.8, fat: 28.5, water: 55.1, bone: 3.8, ffm: 77.6, visceral: 14, cellular: 7.2, bmr: 2298, metabolicAge: 57, physique: 6, legMuscle: 79, boditraxScore: 689, proteinPct: 18 },
];

// A DENSE daily Withings series (as a real Withings sync produces) that on its
// own implies a much steeper lean drop: lean ≈ 79.5 (16 May) → 76.3 (17 Jul) ≈
// −3.2kg, with a steep last-14-day slope that trips lbm_drop when Boditrax is
// absent. Daily entries from 16 May through 17 Jul, BF sliding 30.5% → 27.9%.
function addDays(date, k) { const dt = new Date(date + "T12:00:00"); dt.setDate(dt.getDate() + k); return dt.toISOString().slice(0, 10); }
function withingsState() {
  const weightLog = [], bfLog = [];
  const START = "2026-05-16", DAYS = 62; // through 2026-07-17
  for (let i = 0; i <= DAYS; i++) {
    const date = addDays(START, i);
    // Weight falls ~0.14kg/day; BF falls ~0.042pp/day → lean slides ~0.05kg/day.
    const w = Math.round((114.4 - i * 0.137) * 10) / 10;
    const bf = Math.round((30.5 - i * 0.042) * 10) / 10;
    weightLog.push({ date, weight: w, source: "withings" });
    bfLog.push({ date, bf, source: "withings" });
  }
  return { weightLog, bfLog };
}

test("blendedLeanSeries: Boditrax overrides Withings on a shared date", () => {
  const st = withingsState();
  st.boditraxLog = BODITRAX;
  const series = core.blendedLeanSeries(st);
  const may16 = series.find((p) => p.date === "2026-05-16");
  assert.equal(may16.source, "boditrax", "Boditrax must win over Withings on the same date");
  assert.equal(may16.lean, 79.6, "lean should be the Boditrax FFM, not the Withings-derived 79.5");
});

test("blendedLeanSeries: DEXA outranks Boditrax on a shared date", () => {
  const st = { boditraxLog: BODITRAX, dexaScans: [{ date: "2026-07-15", leanMass: 80.2 }] };
  const series = core.blendedLeanSeries(st);
  const jul15 = series.find((p) => p.date === "2026-07-15");
  assert.equal(jul15.source, "dexa");
  assert.equal(jul15.lean, 80.2);
});

test("blendedLeanSeries: reliableOnly keeps only Boditrax/DEXA points", () => {
  const st = withingsState();
  st.boditraxLog = BODITRAX;
  const rel = core.blendedLeanSeries(st, { reliableOnly: true });
  assert.equal(rel.length, 3, "only the 3 Boditrax scans remain");
  assert.ok(rel.every((p) => p.priority >= 2));
});

test("leanTrendRate: 3 Boditrax scans give ≈ −0.2 kg/week (matches 'since May')", () => {
  const st = { boditraxLog: BODITRAX };
  const r = core.leanTrendRate(st, { until: "2026-07-17" });
  assert.equal(r.source, "boditrax");
  assert.equal(r.n, 3);
  assert.ok(Math.abs(r.perWeek - -0.2) < 0.03, `expected ≈ −0.2/wk, got ${r.perWeek}`);
});

test("leanTrendRate: Boditrax anchors the trend even amid steep daily Withings noise", () => {
  const st = withingsState();
  st.boditraxLog = BODITRAX;
  const r = core.leanTrendRate(st, { until: "2026-07-17" });
  assert.equal(r.source, "boditrax", "reliable source must govern when >= 2 exist");
  assert.ok(r.perWeek > -0.3, `Boditrax-anchored rate ${r.perWeek} should be milder than the −0.3 alarm line`);
});

test("leanTrendRate: falls back to Withings when no reliable anchors exist", () => {
  const st = withingsState(); // no Boditrax / DEXA
  const r = core.leanTrendRate(st, { until: "2026-07-17" });
  assert.equal(r.source, "withings");
  assert.ok(r.perWeek < -0.3, `Withings-only 14d rate ${r.perWeek} should be steep (false alarm)`);
});

test("lbm_drop trigger: Boditrax suppresses the false alarm Withings would raise", () => {
  const withingsOnly = withingsState();
  const opts = { today: "2026-07-17", exerciseReps: {} };
  const firedWithings = core.computeTriggers(withingsOnly, opts).filter((f) => f.type === "lbm_drop");
  assert.equal(firedWithings.length, 1, "Withings-only steep drop SHOULD fire lbm_drop");

  const blended = withingsState();
  blended.boditraxLog = BODITRAX;
  const firedBlended = core.computeTriggers(blended, opts).filter((f) => f.type === "lbm_drop");
  assert.equal(firedBlended.length, 0, "Boditrax anchor (≈ −0.2/wk) must NOT fire the false alarm");
});

test("_leanFromBoditrax via blend: derives lean from weight − fat when ffm absent", () => {
  const st = { boditraxLog: [{ source: "boditrax", date: "2026-07-15", weight: 106.1, fat: 28.5 }] };
  const series = core.blendedLeanSeries(st);
  assert.equal(series[0].lean, 77.6, "106.1 − 28.5 = 77.6");
});

// ---- range validation ----
test("validateBoditraxEntry: accepts a full valid scan", () => {
  const r = core.validateBoditraxEntry(BODITRAX[0]);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.clean.source, "boditrax");
  assert.equal(r.clean.ffm, 79.6);
});

test("validateBoditraxEntry: requires date/weight/muscle/fat/visceral", () => {
  const r = core.validateBoditraxEntry({ weight: 106, muscle: 74 });
  assert.equal(r.ok, false);
  assert.ok(r.errors.date, "missing date flagged");
  assert.ok(r.errors.fat, "missing fat flagged");
  assert.ok(r.errors.visceral, "missing visceral flagged");
  assert.ok(!r.errors.weight, "weight was supplied");
});

test("validateBoditraxEntry: optional fields may be omitted", () => {
  const r = core.validateBoditraxEntry({ date: "2026-07-15", weight: 106.1, muscle: 73.8, fat: 28.5, visceral: 14 });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.clean.bmr, null);
  assert.equal(r.clean.ffm, null);
});

test("validateBoditraxEntry: rejects out-of-range values (required and optional)", () => {
  const bad = core.validateBoditraxEntry({ date: "2026-07-15", weight: 999, muscle: 73.8, fat: 28.5, visceral: 14, bmr: 99 });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.weight, "weight 999 out of range");
  assert.ok(bad.errors.bmr, "bmr 99 below floor");
});

test("validateBoditraxEntry: non-numeric value is rejected", () => {
  const r = core.validateBoditraxEntry({ date: "2026-07-15", weight: "abc", muscle: 73.8, fat: 28.5, visceral: 14 });
  assert.equal(r.ok, false);
  assert.ok(r.errors.weight);
});
