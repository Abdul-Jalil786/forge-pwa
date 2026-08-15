// Phase 92: Kettlebell Swing EMOM progression engine — unit tests (zero-dep).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const KB = require("../public/kb-emom.js");

// ---- builders ----
let _d = 0;
function nextDate() { _d++; return "2026-09-" + String(_d).padStart(2, "0"); }
function p1(load, full) { // a Phase-1 normal session
  const reps = full ? 10 : 6;
  return { kb_swing: { done: true, sets: [{ kg: load, reps, done: true }, { kg: load, reps, done: true }, { kg: load, reps, done: true }] } };
}
function emom(load, roundsTarget, rounds, reps) { // an EMOM session
  return { kb_swing: { done: true, sets: [{ emom: true, load, roundsTarget, rounds, repsPerMin: reps || 12, done: true }] } };
}
function build(specs) { _d = 0; const log = {}; specs.forEach(s => { log[nextDate()] = s; }); return log; }

test("Phase 1: needs 4 FULL 3×10 to unlock EMOM", () => {
  const s3 = KB.suggest(build([p1(20, true), p1(20, true), p1(20, true)]), 20);
  assert.equal(s3.phase, 1);
  assert.equal(s3.type, "normal");
  assert.ok(/3\/4 FULL/.test(s3.reason), "shows progress to unlock");
  const s4 = KB.suggest(build([p1(20, true), p1(20, true), p1(20, true), p1(20, true)]), 20);
  assert.equal(s4.phase, 2);
  assert.equal(s4.type, "emom");
  assert.equal(s4.minutes, 5);
  assert.equal(s4.reps, 12, "Phase 2 entry = EMOM 5min × 12");
});

test("a non-FULL Phase-1 session resets the consecutive count", () => {
  const s = KB.suggest(build([p1(20, true), p1(20, true), p1(20, false), p1(20, true)]), 20);
  assert.equal(s.phase, 1, "streak broken → still Phase 1");
});

test("Phase 2 ladder: +1 minute per FULL, 5→6→7→8", () => {
  const base = [p1(20, true), p1(20, true), p1(20, true), p1(20, true)]; // → EMOM 5
  const after = (emoms) => KB.suggest(build(base.concat(emoms)), 20);
  assert.equal(after([emom(20, 5, 5)]).minutes, 6, "FULL at 5 → 6");
  assert.equal(after([emom(20, 5, 5), emom(20, 6, 6)]).minutes, 7, "→ 7");
  assert.equal(after([emom(20, 5, 5), emom(20, 6, 6), emom(20, 7, 7)]).minutes, 8, "→ 8");
  assert.ok(/\+1 from last session/.test(after([emom(20, 5, 5)]).reason));
});

test("PARTIAL drops to rounds-completed, never below the last FULL floor", () => {
  const base = [p1(20, true), p1(20, true), p1(20, true), p1(20, true)];
  // climb to 7 (FULL at 5, FULL at 6 → floor 6, now attempting 7), then PARTIAL 5/7
  const s = KB.suggest(build(base.concat([emom(20, 5, 5), emom(20, 6, 6), emom(20, 7, 5)])), 20);
  assert.equal(s.minutes, 6, "PARTIAL 5/7 with floor 6 → next target 6, not 5");
  assert.ok(/repeating/.test(s.reason));
});

test("two PARTIALs at the same target → Consolidating for the engine", () => {
  const base = [p1(20, true), p1(20, true), p1(20, true), p1(20, true)];
  // FULL 5 (floor5, →6), PARTIAL 5/6 (floor5 → target5), PARTIAL 4/5 (reduced=max(4,5)=5 == target5) → consolidate
  const s = KB.suggest(build(base.concat([emom(20, 5, 5), emom(20, 6, 5), emom(20, 5, 4)])), 20);
  assert.equal(s.consolidating, true, "flagged consolidating");
  assert.equal(s.minutes, 5);
  assert.ok(/Consolidating at 5 min/.test(s.reason));
});

test("Phase 2 → 3: 3 consecutive FULL at 8×12 → reps 15, ladder restarts at 8", () => {
  const base = [p1(20, true), p1(20, true), p1(20, true), p1(20, true)];
  const climb = [emom(20, 5, 5), emom(20, 6, 6), emom(20, 7, 7)]; // now at target 8
  const at8 = (n) => { const a = []; for (let i = 0; i < n; i++) a.push(emom(20, 8, 8)); return a; };
  const two = KB.suggest(build(base.concat(climb, at8(2))), 20);
  assert.equal(two.phase, 2, "2 FULL at 8 → still Phase 2");
  assert.equal(two.minutes, 8, "held at 8");
  const three = KB.suggest(build(base.concat(climb, at8(3))), 20);
  assert.equal(three.phase, 3);
  assert.equal(three.reps, 15, "Phase 3 → 15 reps");
  assert.equal(three.minutes, 8, "Phase 3 ladder restarts at 8 min");
  // then Phase 3 climbs 8→9→10 and holds
  const p3climb = base.concat(climb, at8(3), [emom(20, 8, 8, 15), emom(20, 9, 9, 15), emom(20, 10, 10, 15)]);
  assert.equal(KB.suggest(build(p3climb), 20).minutes, 10, "Phase 3 caps at 10 min");
});

test("readiness < 60 caps at the last FULL level; no-Oura skips the guard", () => {
  const base = [p1(20, true), p1(20, true), p1(20, true), p1(20, true)];
  const hist = base.concat([emom(20, 5, 5), emom(20, 6, 6)]); // FULL at 6 → floor 6, next target 7
  assert.equal(KB.suggest(build(hist), 20, { readiness: 80 }).minutes, 7, "high readiness → climb to 7");
  const low = KB.suggest(build(hist), 20, { readiness: 55 });
  assert.equal(low.minutes, 6, "low readiness → capped at last FULL (6)");
  assert.equal(low.capped, true);
  assert.equal(KB.suggest(build(hist), 20, { readiness: 55, hasOura: false }).minutes, 7, "no Oura → guard skipped");
});

test("per-load independence + re-entry on a new weight (point 17/18)", () => {
  const base = [p1(20, true), p1(20, true), p1(20, true), p1(20, true)];
  const hist = base.concat([emom(20, 5, 5), emom(20, 6, 6), emom(20, 7, 7)]); // 20kg at target 8
  const log = build(hist);
  assert.equal(KB.suggest(log, 20).minutes, 8, "20kg ladder at 8");
  const s24 = KB.suggest(log, 24);
  assert.equal(s24.type, "emom");
  assert.equal(s24.minutes, 5, "new 24kg re-enters at 5 min");
  assert.ok(/New weight/.test(s24.reason));
  // switching back to 20kg restores its ladder position (history intact)
  assert.equal(KB.suggest(log, 20).minutes, 8, "20kg ladder preserved");
});

test("not-yet-unlocked: a new load stays at Phase 1 3×10", () => {
  const log = build([p1(20, true), p1(20, true)]); // only 2 FULL, not unlocked
  const s = KB.suggest(log, 24);
  assert.equal(s.phase, 1);
  assert.equal(s.type, "normal");
});

test("PB per load = best completed EMOM", () => {
  const base = [p1(20, true), p1(20, true), p1(20, true), p1(20, true)];
  const log = build(base.concat([emom(20, 5, 5), emom(20, 6, 6), emom(20, 7, 7), emom(20, 8, 8), emom(24, 5, 5), emom(24, 6, 6)]));
  const pb = KB.pbsByLoad(log);
  assert.equal(pb["20"], "8×12", "best 20kg EMOM");
  assert.equal(pb["24"], "6×12", "best 24kg EMOM");
});
