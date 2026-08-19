// Phase 106: Kettlebell Swing DENSITY progression engine — unit tests (zero-dep).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const KB = require("../public/kb-density.js");

// ---- builders ----
let _d = 0;
function nextDate() { _d++; return "2026-09-" + String(_d).padStart(2, "0"); }
// a density session: sets completed, target, whether last set was clean, effort, + config
function dens(load, o) {
  o = o || {};
  return {
    kb_swing: {
      done: true,
      sets: [{
        density: true, load,
        reps: o.reps == null ? 15 : o.reps,
        restSec: o.restSec == null ? 60 : o.restSec,
        targetSets: o.targetSets == null ? 3 : o.targetSets,
        setsCompleted: o.setsCompleted == null ? 3 : o.setsCompleted,
        cleanLastSet: o.cleanLastSet == null ? true : o.cleanLastSet,
        effort: o.effort || "solid",
        done: true,
      }],
    },
  };
}
function build(specs) { _d = 0; const log = {}; specs.forEach(s => { log[nextDate()] = s; }); return log; }

test("cold start = 3 sets × 15 @ 60s", () => {
  const s = KB.suggest({}, 20);
  assert.equal(s.targetSets, 3);
  assert.equal(s.reps, 15);
  assert.equal(s.restSec, 60);
  assert.equal(s.lever, "start");
  assert.ok(/Start/.test(s.reason));
});

test("clear (hit sets, clean, solid) → +1 set next time", () => {
  const s = KB.suggest(build([dens(20, { targetSets: 3, setsCompleted: 3, effort: "solid" })]), 20);
  assert.equal(s.targetSets, 4, "3 clean+solid → aim 4");
  assert.equal(s.reps, 15);
  assert.equal(s.restSec, 60);
  assert.equal(s.lever, "sets");
  assert.ok(/\+1 set/.test(s.reason));
});

test("easy also advances; tough holds", () => {
  const easy = KB.suggest(build([dens(20, { targetSets: 4, setsCompleted: 4, effort: "easy" })]), 20);
  assert.equal(easy.targetSets, 5, "easy → +1");
  const tough = KB.suggest(build([dens(20, { targetSets: 4, setsCompleted: 4, effort: "tough" })]), 20);
  assert.equal(tough.targetSets, 4, "tough → hold");
  assert.equal(tough.lever, "hold");
  assert.ok(/tough/.test(tough.reason));
});

test("under-shooting the target holds (repeat, don't add)", () => {
  const s = KB.suggest(build([dens(20, { targetSets: 5, setsCompleted: 4, effort: "solid" })]), 20);
  assert.equal(s.targetSets, 5, "only 4/5 → repeat 5, not 6");
  assert.equal(s.lever, "hold");
});

test("a short (partial) last set holds even at target count", () => {
  const s = KB.suggest(build([dens(20, { targetSets: 4, setsCompleted: 4, cleanLastSet: false, effort: "solid" })]), 20);
  assert.equal(s.targetSets, 4, "short last set → repeat before adding");
  assert.equal(s.lever, "hold");
  assert.ok(/short/.test(s.reason));
});

test("at the set cap (8), clearing cuts rest by 5s instead of adding a set", () => {
  const s = KB.suggest(build([dens(20, { targetSets: 8, setsCompleted: 8, restSec: 60, effort: "solid" })]), 20);
  assert.equal(s.targetSets, 8, "held at cap");
  assert.equal(s.restSec, 55, "rest cut 60 → 55");
  assert.equal(s.lever, "rest");
  assert.ok(/cut rest/.test(s.reason));
});

test("rest floors at 20s, then clearing adds a rep and resets rest", () => {
  const atFloor = KB.suggest(build([dens(20, { targetSets: 8, setsCompleted: 8, restSec: 25, effort: "solid" })]), 20);
  assert.equal(atFloor.restSec, 20, "25 → 20 (floor)");
  assert.equal(atFloor.lever, "rest");
  const belowWouldFloor = KB.suggest(build([dens(20, { targetSets: 8, setsCompleted: 8, restSec: 20, reps: 15, effort: "solid" })]), 20);
  assert.equal(belowWouldFloor.reps, 16, "at floor + clear → reps 15 → 16");
  assert.equal(belowWouldFloor.restSec, 60, "rest resets for the new block");
  assert.equal(belowWouldFloor.lever, "reps");
});

test("readiness < 60 holds (no advance); null readiness / no guard advances", () => {
  const hist = build([dens(20, { targetSets: 3, setsCompleted: 3, effort: "solid" })]);
  assert.equal(KB.suggest(hist, 20, { readiness: 80 }).targetSets, 4, "high readiness → +1");
  const low = KB.suggest(hist, 20, { readiness: 50 });
  assert.equal(low.targetSets, 3, "low readiness → hold");
  assert.equal(low.lever, "hold");
  assert.ok(/Readiness/.test(low.reason));
  assert.equal(KB.suggest(hist, 20).targetSets, 4, "no readiness passed → advances");
});

test("per-load independence: a new load starts fresh, old load preserved", () => {
  const log = build([dens(20, { targetSets: 4, setsCompleted: 4, effort: "solid" })]);
  assert.equal(KB.suggest(log, 20).targetSets, 5, "20kg advanced");
  const s24 = KB.suggest(log, 24);
  assert.equal(s24.targetSets, 3, "new 24kg starts at 3");
  assert.equal(s24.lever, "start");
});

test("only the LATEST session at a load drives the next target", () => {
  // did well (would →5), then a tough hold at 5, then under-shot at 5 → still hold 5
  const s = KB.suggest(build([
    dens(20, { targetSets: 4, setsCompleted: 4, effort: "easy" }),
    dens(20, { targetSets: 5, setsCompleted: 5, effort: "tough" }),
  ]), 20);
  assert.equal(s.targetSets, 5, "last was tough at 5 → hold 5");
  assert.equal(s.lever, "hold");
});

test("PB per load = best FULL density (most total swings, shorter rest tiebreak)", () => {
  const log = build([
    dens(20, { targetSets: 5, setsCompleted: 5, reps: 15, restSec: 60, effort: "solid" }), // 75 swings
    dens(20, { targetSets: 6, setsCompleted: 6, reps: 15, restSec: 45, effort: "solid" }), // 90 swings
    dens(24, { targetSets: 3, setsCompleted: 3, reps: 15, restSec: 60, effort: "solid" }), // 45 swings
  ]);
  const pb = KB.pbsByLoad(log);
  assert.equal(pb["20"], "6×15 @45s");
  assert.equal(pb["24"], "3×15 @60s");
});

test("a SKIPPED (0 sets) session is not a PB and holds", () => {
  const log = build([dens(20, { targetSets: 4, setsCompleted: 0, cleanLastSet: false, effort: "solid" })]);
  assert.equal(KB.pbsByLoad(log)["20"], undefined, "no PB from a skip");
  assert.equal(KB.suggest(log, 20).targetSets, 4, "skip holds target");
});
