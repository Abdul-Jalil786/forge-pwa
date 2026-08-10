// Phase 89 walk-analysis verification (manual — run `npx tsc && node tests/_verify-walk.cjs`).
// Proves the pure walk-analysis math: duration, pace, avg/max HR, and HR drift.
const assert = require("node:assert/strict");
const { analyzeWalk, analyzeAllWalks, isWalkActivity } = require("../dist/server/walk-analysis.js");

const checks = [];
function check(name, fn) { try { fn(); checks.push([name, true]); } catch (e) { checks.push([name, false, e.message]); } }

// helper: build 1-sample-per-minute HR map rising linearly lo→hi over the window
function hrMap(startIso, mins, lo, hi) {
  const m = {}, t0 = Date.parse(startIso);
  for (let i = 0; i <= mins; i++) m[new Date(t0 + i * 60000).toISOString()] = lo + Math.round((i * (hi - lo)) / mins);
  return m;
}

check("30-min 1.5mi walk → pace 3.0, avg 110, max 120, drift +13", () => {
  const start = "2026-08-10T09:00:00Z", end = "2026-08-10T09:30:00Z";
  const r = analyzeAllWalks(
    [{ id: "w1", day: "2026-08-10", start, end, distanceM: 2414, source: "oura", activity: "walking" }],
    hrMap(start, 30, 100, 120)
  ).w1;
  assert.equal(r.durationMin, 30);
  assert.equal(r.paceMph, 3);
  assert.equal(r.avgHR, 110);
  assert.equal(r.maxHR, 120);
  assert.equal(r.hrDrift, 13, "final-third avg − first-third avg");
  assert.equal(r.hrSamples, 31);
});

check("no distance → pace null, HR still computed", () => {
  const start = "2026-08-10T09:00:00Z", end = "2026-08-10T09:20:00Z";
  const r = analyzeWalk({ id: "w2", day: "2026-08-10", start, end, distanceM: null, source: "oura" },
    Object.entries(hrMap(start, 20, 105, 105)).map(([iso, bpm]) => ({ t: Date.parse(iso), bpm })));
  assert.equal(r.paceMph, null, "no distance → no pace");
  assert.equal(r.avgHR, 105);
  assert.equal(r.hrDrift, 0, "flat HR → zero drift");
});

check("no HR samples in window → HR fields null, pace still works", () => {
  const r = analyzeWalk({ id: "w3", day: "2026-08-10", start: "2026-08-10T09:00:00Z", end: "2026-08-10T09:30:00Z", distanceM: 2414, source: "manual" }, []);
  assert.equal(r.avgHR, null);
  assert.equal(r.maxHR, null);
  assert.equal(r.hrDrift, null);
  assert.equal(r.paceMph, 3, "manual walk with distance still gets pace");
});

check("HR outside the walk window is ignored", () => {
  const start = "2026-08-10T09:00:00Z", end = "2026-08-10T09:10:00Z";
  const map = hrMap("2026-08-10T08:00:00Z", 180, 60, 60); // 3h of resting HR around the walk
  // overlay a walk-window bump
  for (let i = 0; i <= 10; i++) map[new Date(Date.parse(start) + i * 60000).toISOString()] = 115;
  const r = analyzeAllWalks([{ id: "w4", day: "2026-08-10", start, end, distanceM: null, source: "oura", activity: "walking" }], map).w4;
  assert.equal(r.avgHR, 115, "only in-window samples counted, not the 60bpm rest before/after");
});

check("isWalkActivity matches only walking", () => {
  assert.equal(isWalkActivity("walking"), true);
  assert.equal(isWalkActivity("Walking"), true);
  assert.equal(isWalkActivity("running"), false);
  assert.equal(isWalkActivity(undefined), false);
});

let fail = 0;
for (const [name, ok, err] of checks) { console.log(ok ? "✔" : "✘ FAIL", name, err ? "— " + err : ""); if (!ok) fail++; }
if (fail) process.exit(1);
console.log(`\nAll ${checks.length} walk-analysis checks passed.`);
