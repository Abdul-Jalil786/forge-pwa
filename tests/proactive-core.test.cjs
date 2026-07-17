// Phase 57: proactive-core correlation engine tests (zero-dep).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../public/proactive-core.js");

function d(base, k) { const dt = new Date(base + "T12:00:00"); dt.setDate(dt.getDate() + k); return dt.toISOString().slice(0, 10); }
const B = "2026-01-01";
const find = (c, key) => c.correlations.find((x) => x.key === key);

test("pearson computes r correctly and guards degenerate input", () => {
  assert.equal(core.pearson([[1, 1], [2, 2], [3, 3]]).r, 1);
  assert.equal(core.pearson([[1, 3], [2, 2], [3, 1]]).r, -1);
  assert.equal(core.pearson([[1, 5], [2, 5], [3, 5]]).r, null); // zero variance
  assert.equal(core.pearson([[1, 1]]).r, null);                 // n<2
});

test("steps→sleep: known positive correlation with n>=14 is reported", () => {
  const stepsLog = {}, sleepLog = {};
  for (let i = 0; i < 20; i++) { stepsLog[d(B, i)] = 5000 + i * 400; sleepLog[d(B, i + 1)] = { hours: 6 + i * 0.12 }; }
  const c = core.computeCorrelations({ stepsLog, sleepLog }, { exerciseReps: {} });
  const s = find(c, "steps_vs_sleep");
  assert.equal(s.insufficient, false);
  assert.equal(s.direction, "positive");
  assert.ok(s.r > 0.9, `expected strong r, got ${s.r}`);
  assert.ok(s.n >= 14);
});

test("insufficient-n case is flagged, not reported as a finding", () => {
  const stepsLog = {}, sleepLog = {};
  for (let i = 0; i < 5; i++) { stepsLog[d(B, i)] = 5000 + i * 400; sleepLog[d(B, i + 1)] = { hours: 6 + i * 0.1 }; }
  const c = core.computeCorrelations({ stepsLog, sleepLog }, { exerciseReps: {} });
  const s = find(c, "steps_vs_sleep");
  assert.equal(s.insufficient, true);
  assert.ok(s.n < core.MIN_N);
  assert.match(s.summary, /insufficient data/);
});

test("bedtime correlation reports no-data note when sleep-start is absent", () => {
  const c = core.computeCorrelations({ sleepLog: { [d(B, 0)]: { hours: 7 } }, recovery: { [d(B, 0)]: { readiness: 80 } } }, { exerciseReps: {} });
  const s = find(c, "bedtime_vs_readiness");
  assert.equal(s.insufficient, true);
  assert.match(s.summary, /not yet synced/i);
});

test("detectStalls flags a held lift and ignores a progressing one", () => {
  const reps = { u1: [6, 8], u3: [6, 8] };
  const exLog = {};
  for (let i = 0; i < 5; i++) {
    exLog[d(B, i * 4)] = {
      u1: { sets: [{ kg: 100, reps: 6 }, { kg: 100, reps: 6 }] },  // held 100kg, never hit 8 → stall
      u3: { sets: [{ kg: 50 + i * 2.5, reps: 8 }] },               // rising weight + hits top → fine
    };
  }
  const stalls = core.detectStalls({ exLog }, reps);
  const u1 = stalls.find((s) => s.exId === "u1");
  assert.ok(u1, "u1 should be stalled");
  assert.ok(u1.sessions >= 3);
  assert.equal(u1.kg, 100);
  assert.ok(!stalls.find((s) => s.exId === "u3"), "u3 should not be stalled");
});

test("GLP-1 effect: lower intake in the injection window is detected over cycles", () => {
  const base = "2026-02-01", foods = {}, mounjaroLog = {};
  for (let i = 0; i < 40; i++) { const day = d(base, i); const win = (i % 7) <= 3; foods[day] = [{ cals: win ? 1500 : 2500, protein: 150 }]; }
  for (let w = 0; w < 5; w++) mounjaroLog[d(base, w * 7)] = { injected: true };
  const c = core.computeCorrelations({ foods, mounjaroLog }, { exerciseReps: {}, onGlp1: true });
  const g = find(c, "glp1_vs_intake");
  assert.equal(g.insufficient, false);
  assert.equal(g.direction, "lower");
  assert.ok(g.deltaKcal < 0);
  assert.equal(g.nCycles, 5);
});

test("formatCorrelations produces a citable block", () => {
  const c = core.computeCorrelations({ stepsLog: {}, sleepLog: {} }, { exerciseReps: {} });
  const block = core.formatCorrelations(c);
  assert.match(block, /CORRELATIONS/);
  assert.match(block, /Stalled lifts/);
});
