// Phase 108a: KB Swing open-ended EMOM ("beat your minutes") engine — unit tests.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const KB = require("../public/kb-emom.js");

let _d = 0;
function nextDate() { _d++; return "2026-09-" + String(_d).padStart(2, "0"); }
// an EMOM session: minutes DONE, effort, reps/min (target defaults to minutes done)
function emom(load, minutes, effort, reps) {
  return { kb_swing: { done: true, sets: [{ emom: true, load, rounds: minutes, roundsTarget: minutes, repsPerMin: reps == null ? 15 : reps, effort: effort || "solid" }] } };
}
function build(specs) { _d = 0; const log = {}; specs.forEach(s => { log[nextDate()] = s; }); return log; }

test("cold start = aim 5 min × 15, no last effort", () => {
  const s = KB.suggest({}, 20);
  assert.equal(s.type, "emom");
  assert.equal(s.minutes, 5);
  assert.equal(s.reps, 15);
  assert.equal(s.lastEffort, null);
  assert.equal(s.lever, "start");
});

test("easy or solid → beat it (minutes done + 1); carries the last effort", () => {
  const easy = KB.suggest(build([emom(20, 6, "easy")]), 20);
  assert.equal(easy.minutes, 7, "did 6 easy → beat 7");
  assert.equal(easy.lastEffort, "easy");
  assert.ok(/Beat 7 min/.test(easy.reason) && /easy/.test(easy.reason));
  const solid = KB.suggest(build([emom(20, 6, "solid")]), 20);
  assert.equal(solid.minutes, 7, "did 6 solid → beat 7");
  assert.equal(solid.lastEffort, "solid");
});

test("tough → hold (repeat the minutes you managed)", () => {
  const s = KB.suggest(build([emom(20, 7, "tough")]), 20);
  assert.equal(s.minutes, 7, "did 7 tough → repeat 7");
  assert.equal(s.lever, "hold");
  assert.ok(/Repeat 7 min/.test(s.reason) && /tough/.test(s.reason));
});

test("hold never drops below the 5-min start floor", () => {
  assert.equal(KB.suggest(build([emom(20, 3, "tough")]), 20).minutes, 5, "did 3 tough → floor at 5");
});

test("reach 10+ min easy/solid → reps +5 and target resets to 5", () => {
  const s = KB.suggest(build([emom(20, 10, "solid", 15)]), 20);
  assert.equal(s.minutes, 5, "reset to 5 min");
  assert.equal(s.reps, 20, "15 → 20 reps");
  assert.equal(s.lever, "reps");
  assert.ok(/reps up to 20/.test(s.reason));
  // then climb minutes again at 20 reps
  const climb = KB.suggest(build([emom(20, 10, "solid", 15), emom(20, 5, "solid", 20)]), 20);
  assert.equal(climb.minutes, 6);
  assert.equal(climb.reps, 20);
});

test("readiness < 60 holds (no climb); null / no-Oura climbs", () => {
  const hist = build([emom(20, 6, "solid")]); // would beat 7
  assert.equal(KB.suggest(hist, 20, { readiness: 80 }).minutes, 7, "high readiness → beat 7");
  const low = KB.suggest(hist, 20, { readiness: 50 });
  assert.equal(low.minutes, 6, "low readiness → hold 6");
  assert.equal(low.lever, "hold");
  assert.ok(/Readiness/.test(low.reason));
  assert.equal(KB.suggest(hist, 20).minutes, 7, "no readiness passed → climbs");
});

test("per-load independence: a new weight starts its own aim-5 ladder", () => {
  const log = build([emom(20, 7, "solid")]);
  assert.equal(KB.suggest(log, 20).minutes, 8, "20kg beats 8");
  const s24 = KB.suggest(log, 24);
  assert.equal(s24.minutes, 5, "new 24kg aims 5");
  assert.equal(s24.lever, "start");
});

test("only the LATEST session at a load drives the next target", () => {
  const s = KB.suggest(build([emom(20, 6, "easy"), emom(20, 8, "tough")]), 20);
  assert.equal(s.minutes, 8, "last was 8 tough → hold 8");
  assert.equal(s.lever, "hold");
});

test("PB per load = best (most reps, then most minutes)", () => {
  const log = build([emom(20, 8, "solid", 15), emom(20, 6, "solid", 20), emom(24, 5, "solid", 15)]);
  const pb = KB.pbsByLoad(log);
  assert.equal(pb["20"], "6 min × 20", "20 reps beats 15 even at fewer minutes");
  assert.equal(pb["24"], "5 min × 15");
});

test("old EMOM logs without an effort field default to solid (still climb)", () => {
  const log = build([{ kb_swing: { done: true, sets: [{ emom: true, load: 20, rounds: 6, roundsTarget: 6, repsPerMin: 15 }] } }]);
  const s = KB.suggest(log, 20);
  assert.equal(s.minutes, 7, "no effort → treated solid → beat 7");
  assert.equal(s.lastEffort, "solid");
});
