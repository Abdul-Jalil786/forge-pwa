// Phase 61: weekly-report shared metrics (zero-dep). SINGLE SOURCE for the Coach
// card + AI context. All windows/targets passed in — deterministic.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../public/proactive-core.js");

const TODAY = "2026-07-19"; // a Sunday
function d(k) { const dt = new Date(TODAY + "T12:00:00"); dt.setDate(dt.getDate() + k); return dt.toISOString().slice(0, 10); }
// last7 = d(-6)..d(0)
const WIN = [];
for (let i = 6; i >= 0; i--) WIN.push(d(-i));

test("grade bands A/B/C/D/F (D now exists at >=45)", () => {
  assert.equal(core.scoreToGrade(95), "A");
  assert.equal(core.scoreToGrade(80), "B");
  assert.equal(core.scoreToGrade(65), "C");
  assert.equal(core.scoreToGrade(50), "D");
  assert.equal(core.scoreToGrade(30), "F");
  assert.equal(core.scoreToGrade(null), "—");
});

test("steps: hit vs target, missing day = miss; no target = null score", () => {
  const steps = {}; WIN.forEach((dt, i) => { if (i !== 2) steps[dt] = i < 5 ? 12000 : 4000; }); // day idx2 missing
  const st = { stepsLog: steps };
  const m = core.stepsMetric(st, { days: WIN, stepsTarget: 10000 });
  assert.equal(m.total, 7);
  assert.equal(m.hit, WIN.filter((dt, i) => i !== 2 && i < 5).length, "days >=10k");
  assert.equal(m.logged, 6, "missing day not logged");
  assert.equal(m.score, Math.round(m.hit / 7 * 100));
  // no target
  assert.equal(core.stepsMetric(st, { days: WIN, stepsTarget: null }).score, null);
});

test("protein: floor is THE number (no ×0.9); no floor = null score", () => {
  const foods = {}; WIN.forEach((dt, i) => { foods[dt] = [{ cals: 2000, protein: i < 4 ? 210 : 150 }]; });
  const st = { foods };
  const m = core.proteinMetric(st, { days: WIN, proteinFloor: 200 });
  assert.equal(m.hit, 4, "4 days >=200g exactly (195 would fail — no fudge)");
  assert.equal(m.score, Math.round(4 / 7 * 100));
  // exactly at floor counts; just under does not
  const st2 = { foods: { [d(0)]: [{ cals: 2000, protein: 200 }], [d(-1)]: [{ cals: 2000, protein: 199 }] } };
  const m2 = core.proteinMetric(st2, { days: WIN, proteinFloor: 200 });
  assert.equal(m2.hit, 1, "200 hits, 199 misses");
  assert.equal(core.proteinMetric(st, { days: WIN, proteinFloor: null }).score, null, "no target -> null (not 0/7)");
});

test("sleep: duration + timing; 7h@11pm vs 7h@3am grade differently", () => {
  const mk = (bed) => { const s = {}; WIN.forEach(dt => { s[dt] = { hours: 7.0, bedtime: bed }; }); return { sleepLog: s }; };
  const eleven = core.sleepMetric(mk(23), { days: WIN }); // 11pm
  const three = core.sleepMetric(mk(3), { days: WIN });   // 3am
  assert.equal(eleven.durationScore, 100);
  assert.equal(eleven.timingScore, 100, "before midnight = full");
  assert.equal(eleven.score, 100);
  assert.equal(three.timingScore, 0, "after 1am = none");
  assert.equal(three.score, 60, "100*.6 + 0*.4");
  assert.notEqual(core.scoreToGrade(eleven.score), core.scoreToGrade(three.score), "A vs C — different grades");
  assert.equal(eleven.avgBedtimeClock, "11:00pm");
  assert.equal(three.avgBedtimeClock, "3:00am");
});

test("sleep: bedtime averaged on a night-scale (across midnight) + graceful when absent", () => {
  const s = { [d(0)]: { hours: 7, bedtime: 23 }, [d(-1)]: { hours: 7, bedtime: 1 } }; // 11pm + 1am
  const m = core.sleepMetric({ sleepLog: s }, { days: WIN });
  assert.equal(m.avgBedtimeClock, "12:00am", "avg of 11pm & 1am = midnight, not noon");
  assert.equal(m.nightsLogged, 2);
  // no bedtime anywhere -> duration-only, hasTiming false
  const noBed = core.sleepMetric({ sleepLog: { [d(0)]: { hours: 8 } } }, { days: WIN });
  assert.equal(noBed.hasTiming, false);
  assert.equal(noBed.score, 100, "duration-only fallback");
  assert.equal(noBed.avgBedtimeClock, null);
});

test("weight: 7d least-squares slope (kg/week), not last-minus-first", () => {
  const wl = WIN.map((dt, i) => ({ date: dt, weight: 100 - i * 0.1, source: "withings" })); // −0.1/day
  const m = core.weightMetric({ weightLog: wl }, { days: WIN });
  assert.ok(Math.abs(m.perWeek - -0.7) < 0.02, `~ −0.7kg/wk, got ${m.perWeek}`);
  assert.equal(m.hasTrend, true);
  assert.equal(core.weightMetric({ weightLog: [{ date: d(0), weight: 100 }] }, { days: WIN }).hasTrend, false, "1 reading = no trend");
});

test("training: schedule-aware; >=60% done = complete; make-ups + Zone 2 count", () => {
  // Scheduled: Mon upperA(8 ex), Sat zone2(1 ex). exLog: upperA 5/8 done (62%) → complete; zone2 done.
  const exLog = {
    [d(-6)]: { u4: { done: true }, u1: { done: true }, u3: { done: true }, u5: { done: true }, h5: { done: true }, reh_1: {}, reh_2: {}, reh_3: {} }, // 5/8 = 62%
    [d(-1)]: { cardio_z2: { done: true } },
  };
  const sched = [
    { date: d(-6), type: "upperA", exerciseIds: ["u4", "u1", "u3", "u5", "h5", "reh_1", "reh_2", "reh_3"] },
    { date: d(-1), type: "zone2", exerciseIds: ["cardio_z2"] },
  ];
  const m = core.trainingMetric({ exLog }, { scheduled: sched });
  assert.equal(m.scheduled, 2);
  assert.equal(m.completed, 2, "upperA 62% + zone2 100%");
  assert.equal(m.score, 100);
  // under 60% (4/8=50%) → not complete
  const exLow = { [d(-6)]: { u4: { done: true }, u1: { done: true }, u3: { done: true }, u5: { done: true } } };
  assert.equal(core.trainingMetric({ exLog: exLow }, { scheduled: [sched[0]] }).completed, 0);
  // make-up on another date counts for the scheduled date
  const exMakeup = { [d(-4)]: { cardio_z2: { done: true }, _session: { forDate: d(-1) } } };
  assert.equal(core.trainingMetric({ exLog: exMakeup }, { scheduled: [sched[1]] }).completed, 1, "make-up satisfies zone2");
});

test("weeklyReport: weighted overall (protein30/training30/steps20/sleep20), renormalised", () => {
  const st = {
    stepsLog: Object.fromEntries(WIN.map((dt, i) => [dt, i < 5 ? 12000 : 3000])),      // 5/7 → 71
    foods: Object.fromEntries(WIN.map((dt, i) => [dt, [{ cals: 2000, protein: i < 5 ? 210 : 150 }]])), // 5/7 → 71
    sleepLog: Object.fromEntries(WIN.map(dt => [dt, { hours: 7.2, bedtime: 23 }])),     // 100
    weightLog: WIN.map((dt, i) => ({ date: dt, weight: 105 - i * 0.1 })),
    exLog: {},
  };
  const sched = [ // 4 lifts + zone2, 3 completed
    { date: d(-6), type: "upperA", exerciseIds: ["u4", "u1"] },
    { date: d(-5), type: "lowerA", exerciseIds: ["l1", "l2"] },
    { date: d(-1), type: "zone2", exerciseIds: ["cardio_z2"] },
  ];
  st.exLog[d(-6)] = { u4: { done: true }, u1: { done: true } };
  st.exLog[d(-5)] = { l1: { done: true }, l2: { done: true } };
  st.exLog[d(-1)] = { cardio_z2: { done: true } };
  const r = core.weeklyReport(st, { today: TODAY, stepsTarget: 10000, proteinFloor: 200, scheduled: sched });
  assert.equal(r.training.score, 100, "3/3 scheduled done");
  assert.equal(r.steps.score, 71);
  assert.equal(r.protein.score, 71);
  assert.equal(r.sleep.score, 100);
  // weighted: (71*.3 + 100*.3 + 71*.2 + 100*.2) = 21.3+30+14.2+20 = 85.5 → 86 (round)
  assert.equal(r.overall, 86);
  assert.equal(r.grades.sleep, "A");
  assert.equal(r.window.days, 7);
});

test("weeklyReport: components with no target drop out of the weighted mean", () => {
  const st = { stepsLog: {}, foods: {}, sleepLog: { [d(0)]: { hours: 8, bedtime: 22 } }, weightLog: [], exLog: {} };
  const r = core.weeklyReport(st, { today: TODAY, stepsTarget: null, proteinFloor: null, scheduled: [] });
  assert.equal(r.steps.score, null);
  assert.equal(r.protein.score, null);
  assert.equal(r.training.score, null, "no scheduled sessions");
  assert.equal(r.sleep.score, 100);
  assert.equal(r.overall, 100, "only sleep contributes → renormalised to sleep alone");
});

test("VERIFY 5-day week: 4 lifts + Zone 2 all done = 5/5; deload-week sessions count", () => {
  // A full 5-day training week, all sessions completed (>=60% exercises done).
  const sched = [
    { date: d(-6), type: "upperA", exerciseIds: ["u4", "u1", "u3", "u5", "h5"] },
    { date: d(-5), type: "lowerA", exerciseIds: ["h1", "l1", "l2", "l6", "core_pallof"] },
    { date: d(-3), type: "upperB", exerciseIds: ["u2", "h3", "u4", "u8", "u6", "core_dead_bug"] },
    { date: d(-2), type: "lowerB", exerciseIds: ["l5", "l1", "l4", "core_suitcase"] },
    { date: d(-1), type: "zone2", exerciseIds: ["cardio_z2"] },
  ];
  const exLog = {};
  sched.forEach(s => { exLog[s.date] = {}; s.exerciseIds.forEach(id => { exLog[s.date][id] = { done: true }; }); });
  const m = core.trainingMetric({ exLog }, { scheduled: sched });
  assert.equal(m.completed, 5);
  assert.equal(m.scheduled, 5);
  assert.equal(m.score, 100, "4 lifts + Zone 2 done = 5/5 = 100%");
  // Deload week: SAME exercises, fewer sets — a completed deload session still has
  // its exercises marked done, so it counts (2-set sessions count as complete).
  const deloadDay = { u4: { done: true }, u1: { done: true }, u3: { done: true } }; // 3/5 = 60%
  assert.equal(core.trainingMetric({ exLog: { [d(-6)]: deloadDay } }, { scheduled: [sched[0]] }).completed, 1, "deload session (60% done) counts");
});
