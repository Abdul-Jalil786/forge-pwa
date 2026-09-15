// Phase 42a: nutrition targets engine tests — run with `npm test` (node --test, no deps).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { computeTargets, computeWaterTarget, pickProgramId, programOptionsFor, activityFactorFor, PROGRAM_DAYS } = require("../public/targets.js");

// Jay's seeded profile.targetOverrides — must match seedJayTargetOverridesV1 in server/index.ts
const JAY_OVERRIDES = {
  deficitFixed: 350,
  proteinPerKgLBM: 2.2,
  proteinMin: 200,
  calorieFloor: 2400,
  activityFactor: 1.55,
  waterRest: 3000,
  waterGym: 3500,
};
const JAY = { age: 52, heightCm: 180, sex: "male", phase: "cut", overrides: JAY_OVERRIDES };

// The exact pre-Phase-42 formula (data.js, Phase 41b) — the parity reference.
function legacyFormula(weight, leanMass, sessionType) {
  const bmr = 10 * weight + 6.25 * 180 - 5 * 52 + 5;
  const tdee = bmr * 1.55;
  const sessionBonus = sessionType === "lower" ? 150 : sessionType === "upper" ? 100 : 0;
  const calsTarget = Math.max(2400, tdee - 350 + sessionBonus);
  const proteinTarget = Math.max((leanMass || weight * 0.7) * 2.2, 200);
  const fatTarget = (calsTarget * 0.30) / 9;
  const carbTarget = Math.max(0, (calsTarget - proteinTarget * 4 - calsTarget * 0.30) / 4);
  return {
    calories: Math.round(calsTarget), protein: Math.round(proteinTarget),
    carbs: Math.round(carbTarget), fat: Math.round(fatTarget),
    bmr: Math.round(bmr), tdee: Math.round(tdee), sessionType,
  };
}

test("Jay parity: seeded overrides reproduce the legacy formula exactly", () => {
  for (const weight of [120, 113.8, 110, 105, 100, 95, 93]) {
    for (const lean of [76.8, 75, 72, null]) {
      for (const st of ["rest", "upper", "lower"]) {
        const got = computeTargets({ weight, leanMass: lean, sessionType: st, ...JAY });
        assert.deepEqual(got, legacyFormula(weight, lean, st), `weight=${weight} lean=${lean} ${st}`);
      }
    }
  }
});

test("recomp female: gentle deficit, bodyweight protein, no Jay floors", () => {
  const t = computeTargets({
    weight: 63, leanMass: null, sessionType: "rest",
    age: 28, heightCm: 165, sex: "female", phase: "recomp", activityLevel: "light",
  });
  // BMR = 630 + 1031.25 - 140 - 161 = 1360.25 · TDEE ×1.375 = 1870.3 · −10% = 1683.3
  assert.equal(t.bmr, 1360);
  assert.equal(t.calories, 1683);
  assert.equal(t.protein, 126); // 63kg × 2.0 g/kg — NOT 200g
  assert.ok(t.calories < t.tdee, "recomp eats below TDEE");
});

test("female calorie floor binds at 1400, not 2400", () => {
  const t = computeTargets({
    weight: 50, sessionType: "rest",
    age: 30, heightCm: 155, sex: "female", phase: "cut", activityLevel: "sedentary",
  });
  assert.equal(t.calories, 1400);
  // macros stay coherent at the floor: protein + fat + carbs ≈ calories
  const kcal = t.protein * 4 + t.carbs * 4 + t.fat * 9;
  assert.ok(Math.abs(kcal - t.calories) < 30, `macros sum ${kcal} vs ${t.calories}`);
});

test("male calorie floor is 1600", () => {
  const t = computeTargets({
    weight: 55, sessionType: "rest",
    age: 25, heightCm: 165, sex: "male", phase: "cut", activityLevel: "sedentary",
  });
  assert.equal(t.calories, 1600);
});

test("under-18 never gets a deficit, even on cut", () => {
  const t = computeTargets({
    weight: 60, sessionType: "rest",
    age: 16, heightCm: 170, sex: "female", phase: "cut", activityLevel: "moderate",
  });
  assert.equal(t.calories, t.tdee, "16yo on 'cut' eats at maintenance");
});

test("under-18 surplus phases still work (lean-bulk allowed)", () => {
  const t = computeTargets({
    weight: 60, sessionType: "rest",
    age: 17, heightCm: 175, sex: "male", phase: "lean-bulk", activityLevel: "moderate",
  });
  assert.ok(t.calories > t.tdee, "surplus is not a deficit — allowed for minors");
});

test("lean-bulk eats above TDEE", () => {
  const t = computeTargets({
    weight: 70, sessionType: "rest",
    age: 24, heightCm: 178, sex: "male", phase: "lean-bulk", activityLevel: "moderate",
  });
  assert.equal(t.calories, Math.round(t.tdee + Math.max(t.tdee * 0.10, 300)), "Phase 119: surplus = max(10%, 300 kcal)");
});

test("maintenance eats at TDEE", () => {
  const t = computeTargets({
    weight: 70, sessionType: "rest",
    age: 40, heightCm: 170, sex: "female", phase: "maintenance", activityLevel: "moderate",
  });
  assert.equal(t.calories, Math.round(t.tdee));
});

test("missing phase defaults to maintenance (no surprise deficit)", () => {
  const t = computeTargets({
    weight: 70, sessionType: "rest",
    age: 35, heightCm: 175, sex: "male", activityLevel: "moderate",
  });
  assert.equal(t.calories, Math.round(t.tdee));
});

test("incomplete profile returns null (no silent Jay-default fallback)", () => {
  assert.equal(computeTargets({ weight: 70, sessionType: "rest", age: 30, sex: "male" }), null);          // no height
  assert.equal(computeTargets({ weight: 70, sessionType: "rest", heightCm: 175, sex: "male" }), null);    // no age
  assert.equal(computeTargets({ weight: 70, sessionType: "rest", age: 30, heightCm: 175 }), null);        // no sex
  assert.equal(computeTargets({ sessionType: "rest", age: 30, heightCm: 175, sex: "male" }), null);       // no weight
});

test("activity level scales TDEE", () => {
  const base = { weight: 70, sessionType: "rest", age: 30, heightCm: 175, sex: "male", phase: "maintenance" };
  const sed = computeTargets({ ...base, activityLevel: "sedentary" });
  const act = computeTargets({ ...base, activityLevel: "very-active" });
  assert.ok(act.tdee > sed.tdee * 1.5, "very-active well above sedentary");
});

test("water: 35ml/kg rounded to 250ml, +500 on gym days", () => {
  assert.equal(computeWaterTarget({ weight: 63, isGymDay: false }), 2250);  // 2205 → 2250
  assert.equal(computeWaterTarget({ weight: 63, isGymDay: true }), 2750);
  assert.equal(computeWaterTarget({ weight: 113.8, isGymDay: false }), 4000); // 3983 → 4000
});

test("water: Jay's overrides win", () => {
  assert.equal(computeWaterTarget({ weight: 113.8, isGymDay: false, overrides: JAY_OVERRIDES }), 3000);
  assert.equal(computeWaterTarget({ weight: 113.8, isGymDay: true, overrides: JAY_OVERRIDES }), 3500);
});

// ---- Phase 114: full-macro override (profile.targetOverrides.macros) ----
test("Phase 114: a pinned macros override is returned verbatim for every session type", () => {
  const base = { weight: 75.2, age: 21, heightCm: 173, sex: "male", phase: "lean-bulk", activityLevel: "moderate" };
  const pinned = { macros: { calories: 3100, protein: 150, carbs: 470, fat: 75 } };
  for (const st of ["rest", "upper", "lower"]) {
    const r = computeTargets({ ...base, sessionType: st, overrides: pinned });
    assert.equal(r.calories, 3100, st + " calories pinned");
    assert.equal(r.protein, 150); assert.equal(r.carbs, 470); assert.equal(r.fat, 75);
    assert.equal(r.overridden, true);
    assert.ok(r.tdee > 2000 && r.bmr > 1000, "bmr/tdee still computed for display");
  }
  // optional rest-day calories
  const rest = computeTargets({ ...base, sessionType: "rest", overrides: { macros: { calories: 3100, caloriesRest: 2900, protein: 150, carbs: 470, fat: 75 } } });
  assert.equal(rest.calories, 2900, "caloriesRest used on rest days");
  assert.equal(computeTargets({ ...base, sessionType: "upper", overrides: { macros: { calories: 3100, caloriesRest: 2900, protein: 150, carbs: 470, fat: 75 } } }).calories, 3100);
  // no/invalid override → computed as before (lean-bulk ≈ +10% over TDEE, not 3100)
  const computed = computeTargets({ ...base, sessionType: "rest", overrides: { macros: { calories: 0 } } });
  assert.equal(computed.overridden, undefined);
  assert.notEqual(computed.calories, 3100);
  assert.equal(computed.protein, 150, "lean-bulk default protein computed (Phase 119: 2.0 g/kg)");
});

// Phase 118: the wizard's programme auto-pick is phase-aware and never hands a new
// user the owner's fixed-weekday split.
test("Phase 118: pickProgramId is phase-aware; programOptionsFor omits the owner split", () => {
  assert.equal(pickProgramId("some", 4, "gym", { phase: "lean-bulk", age: 21 }), "hyper-5d-bulk");
  assert.equal(pickProgramId("regular", 5, "gym", { phase: "recomp", age: 30 }), "hyper-5d-bulk");
  assert.equal(pickProgramId("some", 4, "gym", { phase: "cut", age: 45 }), "hyper-5d-cut");
  assert.equal(pickProgramId("some", 4, "gym", { phase: "maintenance", age: 21 }), "upper-lower-4d");
  assert.equal(pickProgramId("some", 4, "gym", { phase: "lean-bulk", age: 16 }), "upper-lower-4d", "minors never get the 5-day barbell programmes");
  assert.equal(pickProgramId("new", 4, "gym", { phase: "lean-bulk", age: 21 }), "full-body-3d", "beginners still start on full body");
  assert.equal(pickProgramId("some", 3, "gym", { phase: "lean-bulk", age: 21 }), "full-body-3d");
  assert.equal(pickProgramId("regular", 5, "home", { phase: "lean-bulk", age: 21 }), "home-3d");
  assert.equal(pickProgramId("some", 4, "gym"), "upper-lower-4d", "legacy 3-arg call unchanged");
  assert.ok(!programOptionsFor("gym").includes("upper-lower-5d-fixed"), "owner split not in the wizard list");
  assert.ok(programOptionsFor("gym").includes("hyper-5d-bulk") && programOptionsFor("gym").includes("hyper-5d-cut"));
  assert.deepEqual(programOptionsFor("home"), ["home-3d"]);
});

// Phase 119: the wizard asks about activity OUTSIDE the gym, so training sessions
// add to the multiplier instead of being assumed inside it.
test("Phase 119: training days raise the activity multiplier; lean-bulk gets a real surplus; Jay's override untouched", () => {
  assert.equal(activityFactorFor("sedentary", 0), 1.2);
  assert.equal(+activityFactorFor("sedentary", 5).toFixed(2), 1.45);
  assert.equal(activityFactorFor("very-active", 5), 1.9, "capped at 1.9");
  assert.equal(PROGRAM_DAYS["hyper-5d-bulk"], 5);
  assert.equal(PROGRAM_DAYS["upper-lower-4d"], 3.5);
  const steve = { weight: 72, age: 21, heightCm: 178, sex: "male", phase: "lean-bulk", activityLevel: "sedentary" };
  const before = computeTargets({ ...steve, sessionType: "upper" });
  const after = computeTargets({ ...steve, sessionType: "upper", trainingDays: 5 });
  assert.ok(after.tdee > before.tdee * 1.15, `5 sessions/wk lifts TDEE ${before.tdee} → ${after.tdee}`);
  assert.ok(after.calories >= 2800 && after.calories <= 3100, "72kg 21yo desk job + 5 gym days bulks on ~2.8–3.1k on a training day: " + after.calories);
  assert.equal(after.protein, 144, "lean-bulk protein 2.0 g/kg");
  assert.ok(after.calories - after.tdee >= 300 + 100, "surplus ≥300 + the training-day bonus");
  // owner parity: activityFactor override wins, no training-day bump
  const jay = computeTargets({ weight: 100, leanMass: 72, sessionType: "upper", ...JAY, trainingDays: 5 });
  const jay0 = computeTargets({ weight: 100, leanMass: 72, sessionType: "upper", ...JAY });
  assert.equal(jay.calories, jay0.calories);
  assert.equal(jay.tdee, jay0.tdee);
});
