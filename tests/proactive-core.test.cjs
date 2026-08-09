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

test("Phase 80: pattern mining discovers strong lagged + same-day relationships, ranked", () => {
  const stepsLog = {}, recovery = {}, sleepLog = {};
  for (let i = 0; i < 20; i++) {
    const day = d(B, i), next = d(B, i + 1);
    const steps = 6000 + i * 400, deep = 40 + (i % 7) * 8;
    stepsLog[day] = steps;
    sleepLog[day] = { hours: 7, deepMin: deep, remMin: 90 };
    (recovery[next] = recovery[next] || {}).readiness = 40 + (steps - 6000) / 200; // steps → next-day readiness
    (recovery[day] = recovery[day] || {}).hrv = 30 + deep * 0.5;                    // deep → same-day HRV
  }
  const c = core.computeCorrelations({ stepsLog, sleepLog, recovery }, { exerciseReps: {} });
  assert.ok(Array.isArray(c.discovered) && c.discovered.length >= 2, "found at least two patterns");
  assert.ok(c.discovered.length <= 3, "capped at 3");
  const labels = c.discovered.map((x) => x.label);
  assert.ok(labels.some((l) => /steps → next-day readiness/.test(l)), "found the lagged steps→readiness pattern");
  assert.ok(labels.some((l) => /deep sleep → HRV/.test(l)), "found the same-day deep→HRV pattern");
  // ranked by |r| descending
  assert.ok(Math.abs(c.discovered[0].r) >= Math.abs(c.discovered[c.discovered.length - 1].r), "ranked by strength");
  // formatted block carries the EXPLORATORY caveat
  const txt = core.formatCorrelations(c);
  assert.match(txt, /DISCOVERED PATTERNS/);
  assert.match(txt, /EXPLORATORY/);
});

test("Phase 80: weak/insufficient candidates are NOT surfaced as discovered patterns", () => {
  const stepsLog = {}, recovery = {};
  // noisy, near-zero relationship, and only 6 days (< MIN_N)
  const noise = [1, -1, 1, -1, 1, -1];
  for (let i = 0; i < 6; i++) { stepsLog[d(B, i)] = 8000 + noise[i] * 50; (recovery[d(B, i + 1)] = {}).readiness = 70 + noise[i]; }
  const c = core.computeCorrelations({ stepsLog, recovery }, { exerciseReps: {} });
  assert.equal((c.discovered || []).length, 0, "no spurious/underpowered patterns surfaced");
});

test("Phase 81: stall detection ignores a discontinued lift (last trained >28d ago)", () => {
  const reps = { neck_front: [12, 15], u1: [6, 8] };
  const exLog = {};
  // neck flexion: 4 sessions all @ 11.25kg back in June — since dropped from the program
  [0, 4, 8, 12].forEach((i) => { exLog[d("2026-06-01", i)] = { neck_front: { sets: [{ kg: 11.25, reps: 13 }] } }; });
  // u1: currently trained (recent), held @ 100kg for 4 sessions → a genuine stall
  [40, 44, 48, 52].forEach((i) => { exLog[d("2026-06-01", i)] = { u1: { sets: [{ kg: 100, reps: 6 }] } }; });
  const c = core.computeCorrelations({ exLog }, { exerciseReps: reps });
  assert.ok(!c.stalls.some((s) => s.exId === "neck_front"), "discontinued lift not flagged");
  assert.ok(c.stalls.some((s) => s.exId === "u1"), "current stall still flagged");
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
