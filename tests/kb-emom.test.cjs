// Phase 108: Kettlebell Swing EMOM progression engine — unit tests (zero-dep).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const KB = require("../public/kb-emom.js");

// ---- builders ----
let _d = 0;
function nextDate() { _d++; return "2026-09-" + String(_d).padStart(2, "0"); }
// an EMOM session at a load: minutes attempted, minutes completed, reps/min
function emom(load, minutes, rounds, reps) {
  return { kb_swing: { done: true, sets: [{ emom: true, load, roundsTarget: minutes, rounds, repsPerMin: reps == null ? 15 : reps }] } };
}
function build(specs) { _d = 0; const log = {}; specs.forEach(s => { log[nextDate()] = s; }); return log; }

test("cold start = EMOM 5 min × 15", () => {
  const s = KB.suggest({}, 20);
  assert.equal(s.type, "emom");
  assert.equal(s.minutes, 5);
  assert.equal(s.reps, 15);
  assert.equal(s.lever, "start");
  assert.ok(/Start/.test(s.reason));
});

test("complete all minutes → +1 minute, up to the 10-min cap", () => {
  assert.equal(KB.suggest(build([emom(20, 5, 5)]), 20).minutes, 6, "FULL 5 → 6");
  assert.equal(KB.suggest(build([emom(20, 5, 5), emom(20, 6, 6)]), 20).minutes, 7, "→ 7");
  assert.equal(KB.suggest(build([emom(20, 5, 5), emom(20, 6, 6), emom(20, 7, 7), emom(20, 8, 8), emom(20, 9, 9)]), 20).minutes, 10, "→ 10");
  const s = KB.suggest(build([emom(20, 5, 5)]), 20);
  assert.equal(s.reps, 15, "reps unchanged while climbing minutes");
  assert.ok(/\+1 min/.test(s.reason));
});

test("complete 10 minutes → reps +5 and minutes reset to 5", () => {
  const s = KB.suggest(build([emom(20, 10, 10, 15)]), 20);
  assert.equal(s.minutes, 5, "reset to 5 min");
  assert.equal(s.reps, 20, "15 → 20 reps");
  assert.equal(s.lever, "reps");
  assert.ok(/reps up to 20/.test(s.reason));
  // and the next rep block climbs minutes again at 20 reps
  const climb = KB.suggest(build([emom(20, 10, 10, 15), emom(20, 5, 5, 20)]), 20);
  assert.equal(climb.minutes, 6);
  assert.equal(climb.reps, 20);
});

test("a PARTIAL holds — repeat the same minutes × reps", () => {
  const s = KB.suggest(build([emom(20, 5, 5), emom(20, 6, 4, 15)]), 20); // attempted 6, only did 4
  assert.equal(s.minutes, 6, "repeat 6, don't climb");
  assert.equal(s.reps, 15);
  assert.equal(s.lever, "hold");
  assert.ok(/Repeat 6 min/.test(s.reason));
});

test("readiness < 60 holds (no climb); null / no-Oura climbs", () => {
  const hist = build([emom(20, 5, 5)]); // cleared 5 → would climb to 6
  assert.equal(KB.suggest(hist, 20, { readiness: 80 }).minutes, 6, "high readiness → climb");
  const low = KB.suggest(hist, 20, { readiness: 50 });
  assert.equal(low.minutes, 5, "low readiness → hold");
  assert.equal(low.lever, "hold");
  assert.ok(/Readiness/.test(low.reason));
  assert.equal(KB.suggest(hist, 20).minutes, 6, "no readiness passed → climbs");
});

test("per-load independence: a new weight starts its own 5×15 ladder", () => {
  const log = build([emom(20, 7, 7)]); // 20kg at 7 → would climb to 8
  assert.equal(KB.suggest(log, 20).minutes, 8, "20kg climbs");
  const s24 = KB.suggest(log, 24);
  assert.equal(s24.minutes, 5, "new 24kg starts at 5");
  assert.equal(s24.reps, 15);
  assert.equal(s24.lever, "start");
});

test("only the LATEST session at a load drives the next target", () => {
  // cleared 5 (→6), then attempted 6 but PARTIAL → hold 6
  const s = KB.suggest(build([emom(20, 5, 5), emom(20, 6, 3)]), 20);
  assert.equal(s.minutes, 6);
  assert.equal(s.lever, "hold");
});

test("PB per load = best completed EMOM (most reps, then most minutes)", () => {
  const log = build([emom(20, 8, 8, 15), emom(20, 10, 10, 15), emom(20, 6, 6, 20), emom(24, 5, 5, 15)]);
  const pb = KB.pbsByLoad(log);
  assert.equal(pb["20"], "6 min × 20", "20 reps beats 15 reps even at fewer minutes");
  assert.equal(pb["24"], "5 min × 15");
});

test("density sets and old 3×10 sets are ignored (EMOM-only engine)", () => {
  const log = build([
    { kb_swing: { done: true, sets: [{ density: true, load: 20, reps: 15, setsCompleted: 5 }] } },
    { kb_swing: { done: true, sets: [{ kg: 20, reps: 10, done: true }] } },
  ]);
  assert.equal(KB.suggest(log, 20).lever, "start", "no EMOM history → cold start");
  assert.deepEqual(KB.pbsByLoad(log), {}, "no EMOM PBs from density/normal sets");
});
