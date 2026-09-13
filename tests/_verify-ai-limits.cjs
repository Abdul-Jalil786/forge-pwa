// Phase 116 manual check (dist-based): per-user AI limits resolution + sanitising.
// Run: npx tsc && node tests/_verify-ai-limits.cjs
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "a".repeat(64);
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://x:x@localhost:5432/x";
process.env.JWT_SECRET = process.env.JWT_SECRET || "x".repeat(40);
const assert = require("node:assert/strict");
const B = require("../dist/server/ai-budget.js");
// 1. owner keeps the legacy allowance + everything on
const owner = B.resolveAiLimits({}, "jay@afjltd.co.uk");
assert.equal(owner.dailyCap, 40); assert.equal(owner.monthlyCap, null); assert.equal(owner.regeneratePlan, true);
// 2. a non-owner with nothing set gets the safe defaults
const fresh = B.resolveAiLimits({}, "sam@example.com");
assert.equal(fresh.dailyCap, 4); assert.equal(fresh.monthlyCap, 60);
assert.equal(fresh.weeklyReport, true); assert.equal(fresh.sessionBrief, true);
assert.equal(fresh.regeneratePlan, false); assert.equal(fresh.maxLbm, false); assert.equal(fresh.monthlyDeepDive, false);
// 3. owner-set custom limits overlay the defaults ("report only" profile)
const custom = B.resolveAiLimits({ profile: { aiLimits: { dailyCap: 2, sessionBrief: false, sessionReflection: false, recomputeMacros: false, junk: "x", monthlyCap: "30" } } }, "sam@example.com");
assert.equal(custom.dailyCap, 2); assert.equal(custom.monthlyCap, 30);
assert.equal(custom.weeklyReport, true); assert.equal(custom.sessionBrief, false); assert.equal(custom.recomputeMacros, false);
assert.equal(custom.junk, undefined, "unknown keys dropped");
// 4. feature gating: disabled features refused; owner/keyTest always allowed
assert.equal(B.aiFeatureAllowed(custom, "sessionBrief"), false);
assert.equal(B.aiFeatureAllowed(custom, "weeklyReport"), true);
assert.equal(B.aiFeatureAllowed(custom, "keyTest"), true);
assert.equal(B.aiFeatureAllowed(custom, "owner"), true);
assert.equal(B.aiFeatureAllowed(custom, undefined), true);
// 5. sanitiser clamps + rejects garbage
assert.equal(B.sanitizeAiLimits({ dailyCap: 9999 }).dailyCap, 200);
assert.equal(B.sanitizeAiLimits({ dailyCap: -3 }).dailyCap, 0);
assert.equal(B.sanitizeAiLimits({ monthlyCap: null }).monthlyCap, null);
assert.equal(B.sanitizeAiLimits("nope"), null);
assert.equal(B.sanitizeAiLimits({ foo: 1 }), null);
console.log("ai-limits: 5 checks OK");
