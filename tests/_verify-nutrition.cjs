// Phase 48 verification (manual — run `npx tsc && node tests/_verify-nutrition.cjs`).
// Proves the adaptive nutrition engine's maths + muscle-governed recommendations.
const assert = require("node:assert/strict");
const { analyzeNutrition } = require("../dist/server/nutrition.js");

const ASOF = "2026-06-14";
function dayBefore(n) { return new Date(new Date(ASOF + "T12:00:00").getTime() - n * 86400000).toISOString().slice(0, 10); }

// build N days of food at `kcal` (within the 14-day window) + a weight series
function buildLogs({ kcal, wStart, wEnd, foodDays = 14, oura = null }) {
  const foods = {}, weightLog = [], calorieLog = {};
  for (let i = 1; i <= foodDays; i++) {
    const d = dayBefore(i);
    foods[d] = [{ cals: kcal, protein: 200, carbs: 200, fat: 75 }];
    if (oura != null) calorieLog[d] = { total: oura };
  }
  for (let i = 0; i <= 13; i++) {
    const d = dayBefore(13 - i);
    const w = wStart + (wEnd - wStart) * (i / 13);
    weightLog.push({ date: d, weight: Math.round(w * 100) / 100, source: "withings" });
  }
  return { foods, weightLog, calorieLog };
}
function strengthLifts(dir) {
  // dir 'up' = strength holding/rising; 'down' = falling
  const ex = {};
  const older = dir === "down" ? 100 : 90, recent = dir === "down" ? 90 : 95;
  const older2 = dir === "down" ? 145 : 140, recent2 = dir === "down" ? 135 : 145;
  ex[dayBefore(20)] = { u1: { sets: [{ kg: older, reps: 8 }] }, l1: { sets: [{ kg: older2, reps: 8 }] } };
  ex[dayBefore(6)] = { u1: { sets: [{ kg: recent, reps: 8 }] }, l1: { sets: [{ kg: recent2, reps: 8 }] } };
  return ex;
}
const profile = {
  personal: { sex: "male", phase: "cut" },
  dynamicTargets: { rest: { calories: 2400, protein: 200, carbs: 210, fat: 75 } },
  targetOverrides: { calorieFloor: 2400 },
  calsRest: 2400,
};
// a profile NOT pinned to a high floor — so the "trim carbs" path can trigger
const profileLowFloor = { ...profile, targetOverrides: { calorieFloor: 1800 } };

const checks = [];
function check(name, fn) { try { fn(); checks.push([name, true]); } catch (e) { checks.push([name, false, e.message]); } }

// 1. Sparse logging → low confidence, no change
check("sparse logging → low confidence, no recommendation", () => {
  const s = { profile, ...buildLogs({ kcal: 2400, wStart: 110, wEnd: 109.5, foodDays: 5 }) };
  const a = analyzeNutrition(s, ASOF);
  assert.equal(a.confidence, "low");
  assert.equal(a.recommendation, null);
  assert.ok(a.confidenceReason.includes("5/14"));
});

// 2. Losing too slow + muscle safe → cut carbs (down), clamped to -150
check("slow loss + muscle green → trim carbs, clamped", () => {
  const s = { profile: profileLowFloor, ...buildLogs({ kcal: 2400, wStart: 110.0, wEnd: 109.85, oura: 2520 }),
    exLog: strengthLifts("up"), measLog: [{ date: dayBefore(28), waist: 116 }, { date: dayBefore(2), waist: 114.5 }] };
  const a = analyzeNutrition(s, ASOF);
  assert.equal(a.confidence, "high");
  assert.equal(a.muscle.verdict, "green");
  assert.equal(a.recommendation.direction, "down");
  assert.equal(a.recommendation.carbDelta, -37);
  assert.equal(a.recommendation.calorieDelta, -148, "carbs×4, within the ±150 cap");
  assert.ok(Math.abs(a.recommendation.calorieDelta) <= 150, "respects the one-step cap");
  assert.ok(a.observedTDEE > 2400);
});

// 2b. His real case: 2400 floor + slow loss → hold + honest "add steps" advice
check("floor-bound + slow loss → hold with add-steps advice", () => {
  const s = { profile, ...buildLogs({ kcal: 2400, wStart: 110.0, wEnd: 109.85, oura: 2520 }),
    exLog: strengthLifts("up"), measLog: [{ date: dayBefore(28), waist: 116 }, { date: dayBefore(2), waist: 114.5 }] };
  const a = analyzeNutrition(s, ASOF);
  assert.equal(a.recommendation.direction, "hold");
  assert.ok(a.recommendation.reasons.some((r) => r.includes("add steps") || r.includes("minimum calories")), "honest floor advice");
});

// 3. Muscle at risk (strength falling) → eat MORE (up), even mid-cut
check("strength falling → ease, add carbs (muscle first)", () => {
  const s = { profile, ...buildLogs({ kcal: 2300, wStart: 110.5, wEnd: 109.5, oura: 2800 }),
    exLog: strengthLifts("down"), measLog: [{ date: dayBefore(28), waist: 115 }, { date: dayBefore(2), waist: 114 }] };
  const a = analyzeNutrition(s, ASOF);
  assert.equal(a.muscle.verdict, "red");
  assert.equal(a.recommendation.direction, "up");
  assert.ok(a.recommendation.carbDelta > 0, "adds carbs to protect muscle");
});

// 4. Oura disagrees badly → low confidence, no change
check("Oura disagreement → low confidence", () => {
  const s = { profile, ...buildLogs({ kcal: 2400, wStart: 110, wEnd: 109.6, oura: 3300 }), exLog: strengthLifts("up") };
  const a = analyzeNutrition(s, ASOF);
  assert.equal(a.confidence, "low");
  assert.equal(a.recommendation, null);
});

// 5. Floors respected — never recommend below the calorie floor
check("never goes below the calorie floor", () => {
  const s = { profile, ...buildLogs({ kcal: 2450, wStart: 110, wEnd: 109.95, oura: 2480 }), exLog: strengthLifts("up"),
    measLog: [{ date: dayBefore(28), waist: 116 }, { date: dayBefore(2), waist: 114 }] };
  const a = analyzeNutrition(s, ASOF);
  if (a.recommendation) assert.ok(a.recommendation.newRestCalories >= 2400, "respects 2400 floor");
});

// 6. Protein/fat never move — only carbs carry the change
check("only carbs change; the delta equals carbDelta×4", () => {
  const s = { profile: profileLowFloor, ...buildLogs({ kcal: 2400, wStart: 110.0, wEnd: 109.85, oura: 2520 }), exLog: strengthLifts("up"),
    measLog: [{ date: dayBefore(28), waist: 116 }, { date: dayBefore(2), waist: 114.5 }] };
  const a = analyzeNutrition(s, ASOF);
  assert.equal(a.recommendation.carbDelta * 4, a.recommendation.calorieDelta);
});

let fail = 0;
for (const [name, ok, err] of checks) { console.log(ok ? "✔" : "✘ FAIL", name, err ? "— " + err : ""); if (!ok) fail++; }
if (fail) process.exit(1);
console.log(`\nAll ${checks.length} nutrition-engine checks passed.`);
