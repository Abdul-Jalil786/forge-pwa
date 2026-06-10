// Phase 42b: goal recommendation engine tests — run with `npm test`.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { recommendGoal, bandFor, BF_BANDS } = require("../public/targets.js");

test("daughter case: 28F average BF band → recomp", () => {
  const r = recommendGoal({ age: 28, sex: "female", heightCm: 165, weight: 63, bf: 27 });
  assert.equal(r.phase, "recomp");
  assert.equal(r.guard, null);
  assert.ok(r.allowed.includes("cut"), "adults can still choose cut");
  assert.equal(r.bmi, 23.1);
});

test("high BF + high BMI adult → cut", () => {
  // Jay-shaped stats: 52M, 113.8kg, 29.9% BF
  const r = recommendGoal({ age: 52, sex: "male", heightCm: 180, weight: 113.8, bf: 29.9 });
  assert.equal(r.phase, "cut");
});

test("above-average band (not obese) adult → gentle cut", () => {
  // 45M, 25% BF — above-avg band for 40-59 (avg max 23, above-avg max 28), BMI < 30
  const r = recommendGoal({ age: 45, sex: "male", heightCm: 180, weight: 88, bf: 25 });
  assert.equal(r.phase, "cut");
  assert.ok(r.reasons.some(s => s.includes("gentle")), "framed as gentle with recomp alternative");
});

test("lean but low muscle → lean-bulk", () => {
  // 22M, 175cm, 58kg, 12% BF: BMI 18.9, LBMI = 51/3.06 = 16.7 → Low band
  const r = recommendGoal({ age: 22, sex: "male", heightCm: 175, weight: 58, bf: 12 });
  assert.equal(r.phase, "lean-bulk");
});

test("athletic and muscular → maintenance", () => {
  // 30M, 178cm, 80kg, 12% BF: LBMI = 70.4/3.17 = 22.2 → Excellent
  const r = recommendGoal({ age: 30, sex: "male", heightCm: 178, weight: 80, bf: 12 });
  assert.equal(r.phase, "maintenance");
});

test("underweight guard: BMI < 18.5 → lean-bulk, cut not allowed", () => {
  const r = recommendGoal({ age: 25, sex: "female", heightCm: 168, weight: 50 }); // BMI 17.7
  assert.equal(r.phase, "lean-bulk");
  assert.equal(r.guard, "underweight");
  assert.ok(!r.allowed.includes("cut"), "cut must not be offered");
});

test("minor guard: 16F carrying extra → recomp, cut not allowed", () => {
  const r = recommendGoal({ age: 16, sex: "female", heightCm: 160, weight: 70, bf: 34 }); // BMI 27.3
  assert.equal(r.phase, "recomp");
  assert.equal(r.guard, "minor");
  assert.ok(!r.allowed.includes("cut"), "cut must not be offered to minors");
  assert.ok(r.reasons.some(s => s.includes("never cuts calories")), "growth framing present");
});

test("minor guard: healthy 15M → maintenance, cut not allowed", () => {
  const r = recommendGoal({ age: 15, sex: "male", heightCm: 172, weight: 60, bf: 15 });
  assert.equal(r.phase, "maintenance");
  assert.equal(r.guard, "minor");
  assert.ok(!r.allowed.includes("cut"));
  assert.ok(r.allowed.includes("lean-bulk"), "a surplus is fine for minors");
});

test("BMI-only path: obese → cut, overweight → recomp, normal → maintenance", () => {
  assert.equal(recommendGoal({ age: 40, sex: "male", heightCm: 175, weight: 95 }).phase, "cut");      // BMI 31
  assert.equal(recommendGoal({ age: 40, sex: "male", heightCm: 175, weight: 84 }).phase, "recomp");   // BMI 27.4
  assert.equal(recommendGoal({ age: 40, sex: "female", heightCm: 165, weight: 60 }).phase, "maintenance"); // BMI 22
});

test("incomplete stats → null", () => {
  assert.equal(recommendGoal({ age: 30, sex: "male", heightCm: 175 }), null);
  assert.equal(recommendGoal({ sex: "male", heightCm: 175, weight: 70 }), null);
  assert.equal(recommendGoal(null), null);
});

test("bandFor matches WYS _classify semantics (value < max, last band catches rest)", () => {
  const bands = BF_BANDS("female", 28);
  assert.equal(bandFor(bands, 16.9).label, "Athletic");
  assert.equal(bandFor(bands, 17).label, "Fitness"); // boundary goes UP a band
  assert.equal(bandFor(bands, 50).label, "Obese");
  assert.equal(bandFor(bands, 50).index, 4);
});

test("every recommendation carries human-readable reasons", () => {
  const cases = [
    { age: 28, sex: "female", heightCm: 165, weight: 63, bf: 27 },
    { age: 52, sex: "male", heightCm: 180, weight: 113.8, bf: 29.9 },
    { age: 16, sex: "female", heightCm: 160, weight: 70, bf: 34 },
    { age: 40, sex: "male", heightCm: 175, weight: 84 },
  ];
  for (const c of cases) {
    const r = recommendGoal(c);
    assert.ok(r.reasons.length >= 1 && r.reasons.every(s => typeof s === "string" && s.length > 20), JSON.stringify(c));
    assert.ok(r.headline, "headline present");
  }
});
