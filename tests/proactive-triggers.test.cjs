// Phase 57: proactive trigger + governance tests (zero-dep).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../public/proactive-core.js");

const T = "2026-07-15";
function d(k) { const dt = new Date(T + "T12:00:00"); dt.setDate(dt.getDate() + k); return dt.toISOString().slice(0, 10); }
const REPS = { u1: [6, 8], l1: [6, 8] };
const has = (fired, type) => fired.some((f) => f.type === type);

// A deliberately healthy state — nothing should fire.
function normalState() {
  const stepsLog = {}, sleepLog = {}, foods = {}, exLog = {}, weightLog = [];
  for (let i = 1; i <= 15; i++) stepsLog[d(-i)] = 10000;
  sleepLog[d(0)] = { hours: 8.0 };
  for (let i = 1; i <= 25; i++) sleepLog[d(-i)] = { hours: 7.0 + (i % 6) * 0.1 };
  foods[d(-1)] = [{ cals: 2200, protein: 200 }];
  foods[d(-2)] = [{ cals: 2200, protein: 200 }];
  for (let s = 0; s < 4; s++) exLog[d(-s * 4)] = { u1: { sets: [{ kg: 100, reps: 8, effort: "solid" }] } }; // hits top → no stall
  for (let i = 0; i <= 12; i++) weightLog.push({ date: d(-i), weight: 105 - (12 - i) * 0.08 }); // steadily falling
  return { stepsLog, sleepLog, foods, exLog, weightLog, bfLog: [{ date: d(-1), bf: 30 }], profile: { personal: { phase: "cut" }, coachTargets: { proteinFloorDaily: 150 } } };
}
const OPTS = { today: T, exerciseReps: REPS, proteinFloor: 150, phase: "cut", scheduledDays: [] };

test("normal week fires NO triggers and selects NO nudge", () => {
  const fired = core.computeTriggers(normalState(), OPTS);
  assert.deepEqual(fired, [], "expected no triggers on a healthy week: " + JSON.stringify(fired));
  assert.equal(core.selectNudge([], fired, T, {}), null);
});

test("low_steps fires when yesterday is under half the 14d average", () => {
  const s = normalState(); s.stepsLog[d(-1)] = 3000; // avg ~10k
  assert.ok(has(core.computeTriggers(s, OPTS), "low_steps"));
});

test("low_protein fires when under floor two days running", () => {
  const s = normalState(); s.foods[d(-1)] = [{ cals: 2000, protein: 120 }]; s.foods[d(-2)] = [{ cals: 2000, protein: 100 }];
  assert.ok(has(core.computeTriggers(s, OPTS), "low_protein"));
});

test("lift_stalled fires on a held lift", () => {
  const s = normalState();
  s.exLog = {};
  for (let k = 0; k < 4; k++) s.exLog[d(-k * 4)] = { l1: { sets: [{ kg: 180, reps: 6 }, { kg: 180, reps: 6 }] } }; // never hits 8
  assert.ok(has(core.computeTriggers(s, OPTS), "lift_stalled"));
});

test("poor_sleep fires when last night is in the bottom decile", () => {
  const s = normalState(); s.sleepLog[d(0)] = { hours: 4.5 }; // well below the ~7h field
  assert.ok(has(core.computeTriggers(s, OPTS), "poor_sleep"));
});

test("weight_plateau fires on a cut when the 10d trend is flat/up", () => {
  const s = normalState(); s.weightLog = [];
  for (let i = 0; i <= 12; i++) s.weightLog.push({ date: d(-i), weight: 100 }); // dead flat
  assert.ok(has(core.computeTriggers(s, OPTS), "weight_plateau"));
});

test("lbm_drop fires when lean mass falls > 0.3kg/week", () => {
  const s = normalState(); s.weightLog = []; s.bfLog = [];
  for (let i = 0; i <= 13; i++) { s.weightLog.push({ date: d(-i), weight: 105 - (13 - i) * 0.15 }); s.bfLog.push({ date: d(-i), bf: 30 }); }
  // weight falls ~2kg over 14d at ~constant BF → lean mass falls ~1.4kg → ~0.7kg/wk
  assert.ok(has(core.computeTriggers(s, OPTS), "lbm_drop"));
});

test("missed_sessions fires on 2 consecutive misses but a made-up session counts", () => {
  const s = normalState();
  const sched = [d(-6), d(-4), d(-2)];
  // d(-6) made up on d(-5); d(-4) and d(-2) genuinely missed
  s.exLog = { [d(-5)]: { u1: { sets: [{ kg: 100, reps: 8 }] }, _session: { forDate: d(-6), makeup: true } } };
  assert.ok(has(core.computeTriggers(s, { ...OPTS, scheduledDays: sched }), "missed_sessions"));
  // now satisfy the two misses → no fire
  s.exLog[d(-4)] = { u1: { sets: [{ kg: 100, reps: 8 }] } };
  s.exLog[d(-2)] = { u1: { sets: [{ kg: 100, reps: 8 }] } };
  assert.ok(!has(core.computeTriggers(s, { ...OPTS, scheduledDays: sched }), "missed_sessions"));
});

// ---- governance ----
test("selectNudge picks the highest-severity eligible trigger", () => {
  const fired = [{ type: "a", severity: 2 }, { type: "lbm_drop", severity: 4 }];
  assert.equal(core.selectNudge([], fired, T, {}).type, "lbm_drop");
});

test("max one selection per day", () => {
  const fired = [{ type: "low_steps", severity: 2 }];
  assert.equal(core.selectNudge([{ type: "poor_sleep", date: T, delivered: true }], fired, T, {}), null);
});

test("max 3 delivered per week", () => {
  const fired = [{ type: "low_steps", severity: 2 }];
  const hist = [{ type: "x", date: d(-1), delivered: true }, { type: "y", date: d(-2), delivered: true }, { type: "z", date: d(-3), delivered: true }];
  assert.equal(core.selectNudge(hist, fired, T, {}), null);
});

test("per-type cooldown blocks re-fire within 5 days, allows after", () => {
  const fired = [{ type: "low_steps", severity: 2 }];
  assert.equal(core.selectNudge([{ type: "low_steps", date: d(-3), delivered: true }], fired, T, {}), null);
  assert.ok(core.selectNudge([{ type: "low_steps", date: d(-6), delivered: true }], fired, T, {}));
});

test("SIMULATION: bad steps then bad sleep → exactly one nudge, steps-sleep correlation available", () => {
  const s = normalState(); // keeps the 14d steps baseline (10k) + a sleep history
  s.stepsLog[d(-1)] = 2500;                                    // bad steps yesterday
  for (let i = 1; i <= 25; i++) s.sleepLog[d(-i)] = { hours: 7.5 };
  s.sleepLog[d(0)] = { hours: 4.2 };                          // bad sleep last night
  const fired = core.computeTriggers(s, OPTS);
  assert.ok(has(fired, "low_steps"), "low_steps should fire");
  assert.ok(has(fired, "poor_sleep"), "poor_sleep should fire");
  const chosen = core.selectNudge([], fired, T, {});
  assert.ok(chosen, "should select exactly one nudge");
  // the steps↔sleep correlation is present in the context the scanner would cite
  const corr = core.computeCorrelations(s, { exerciseReps: REPS });
  assert.match(core.formatCorrelations(corr), /Steps .* sleep/i);
});

// Governance requirement: the scanner's LLM call is charged to the same daily
// budget as the Express routes (code-level guard — no DB in unit tests).
const fs = require("node:fs");
const path = require("node:path");
test("scanner routes its LLM call through the shared aiBudget accounting", () => {
  const p = fs.readFileSync(path.join(__dirname, "..", "server", "proactive.ts"), "utf8");
  const idxCharge = p.indexOf("chargeAiBudget");
  const idxCall = p.indexOf("messages.create");
  assert.ok(idxCharge >= 0, "scanner must call chargeAiBudget");
  assert.ok(idxCall >= 0, "scanner must call the model");
  assert.ok(idxCharge < idxCall, "budget must be charged BEFORE the LLM call");
  const cs = fs.readFileSync(path.join(__dirname, "..", "server", "coach-settings.ts"), "utf8");
  assert.ok(cs.includes("chargeAiBudget"), "the Express middleware must use the same shared charger");
});

// Phase 60: scheduled deload-week-starting trigger (fed by proactive.ts from the
// shared deloadWeekInfo — today isDeload && yesterday not).
test("deload_week trigger fires only when a deload week is starting", () => {
  const s = normalState();
  assert.ok(has(core.computeTriggers(s, { ...OPTS, deloadStarting: true }), "deload_week"), "fires on the first deload day");
  assert.ok(!has(core.computeTriggers(s, { ...OPTS, deloadStarting: false }), "deload_week"), "silent when not starting");
});

test("deloadWeekInfo drives 'deload starting' = first day of the deload week", () => {
  const shared = require("../public/programme-shared.js");
  const S = "2026-07-20";
  const isStart = (date) => {
    const t = shared.deloadWeekInfo(S, date);
    const y = shared.deloadWeekInfo(S, new Date(new Date(date + "T12:00:00").getTime() - 86400000).toISOString().slice(0, 10));
    return !!(t && t.isDeload && (!y || !y.isDeload));
  };
  assert.equal(isStart("2026-08-17"), true, "Mon 17 Aug = deload week starts");
  assert.equal(isStart("2026-08-18"), false, "Tue 18 Aug = mid-deload, not starting");
  assert.equal(isStart("2026-08-10"), false, "a normal week never 'starts' a deload");
});
