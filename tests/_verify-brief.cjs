// Phase 112 manual check (dist-based): session-brief target resolution.
// Run: npx tsc && node tests/_verify-brief.cjs
const assert = require("node:assert/strict");
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "a".repeat(64);
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://x:x@localhost:5432/x";
process.env.JWT_SECRET = process.env.JWT_SECRET || "x".repeat(40);
const { briefTargets } = require("../dist/server/ai-coach.js");

// 1. active phase wins for calories; coachTargets wins for protein floor
let r = briefTargets({ activePhase: { calorieTarget: 2500, proteinFloor: 190 }, coachTargets: { proteinFloorDaily: 200 }, dynamicTargets: { lower: { calories: 2600 } }, calsGym: 2400, macros: { protein: 183 } }, "lowerA");
assert.deepEqual(r, { kcalTarget: 2500, proteinFloor: 200 });
// 2. no active phase → per-session dynamic target by type (lower / upper / rest)
const dt = { dynamicTargets: { rest: { calories: 2200 }, upper: { calories: 2350 }, lower: { calories: 2450 } }, macros: { protein: 183 } };
assert.equal(briefTargets(dt, "lowerB").kcalTarget, 2450);
assert.equal(briefTargets(dt, "upperA").kcalTarget, 2350);
assert.equal(briefTargets(dt, "full").kcalTarget, 2350);
assert.equal(briefTargets(dt, "rest").kcalTarget, 2200);
assert.equal(briefTargets(dt, "lowerB").proteinFloor, 183, "falls back to macros.protein");
// 3. legacy calsGym/calsRest fallback; active-phase protein floor before macros
assert.deepEqual(briefTargets({ calsGym: 2500, calsRest: 2400, activePhase: { proteinFloor: 180 }, macros: { protein: 250 } }, "upper"), { kcalTarget: 2500, proteinFloor: 180 });
assert.equal(briefTargets({ calsGym: 2500, calsRest: 2400 }, "zone2").kcalTarget, 2400);
// 4. nothing set → nulls, never throws
assert.deepEqual(briefTargets({}, "lowerA"), { kcalTarget: null, proteinFloor: null });
assert.deepEqual(briefTargets(undefined, ""), { kcalTarget: null, proteinFloor: null });
console.log("briefTargets: 4 checks OK");
