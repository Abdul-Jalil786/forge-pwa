// Phase 57: guards the profile write routes that back the Coach Settings UI.
// Text-based (server TS isn't built during `npm test`), same approach as the
// coach-prompt / programme-shared tests. Protects the merge-not-replace fix and
// the coach-config validation ranges from regressing.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const state = fs.readFileSync(path.join(__dirname, "..", "server", "state.ts"), "utf8");

test("personal route MERGES into existing personal (does not wholesale-replace)", () => {
  assert.ok(
    state.includes("COALESCE(state->'profile'->'personal', '{}'::jsonb) || ${valueJson}"),
    "personal route must merge, or the seeded dateOfBirth is dropped on a partial save"
  );
});

test("personal route accepts dateOfBirth (YYYY-MM-DD)", () => {
  assert.ok(state.includes("dateOfBirth must be YYYY-MM-DD"), "dateOfBirth validation missing");
});

test("coach-config route exists", () => {
  assert.ok(state.includes('router.put("/profile/coach-config"'), "coach-config route missing");
});

test("coachTargets MERGES into existing (partial update preserves other keys)", () => {
  assert.ok(
    state.includes("COALESCE(state->'profile'->'coachTargets', '{}'::jsonb) ||"),
    "coachTargets must merge so a partial update doesn't wipe the other targets"
  );
});

test("eatingWindow MERGES into existing", () => {
  assert.ok(state.includes("COALESCE(state->'profile'->'eatingWindow', '{}'::jsonb) ||"));
});

test("coach-config enforces the specified numeric ranges", () => {
  for (const lit of [
    "proteinFloorDaily: [100, 350]",
    "proteinPerMeal: [20, 80]",
    "waterRestMl: [1000, 6000]",
    "waterGymMl: [1000, 6000]",
    "deficitKcal: [0, 1200]",
  ]) {
    assert.ok(state.includes(lit), `missing coach-config range: ${lit}`);
  }
});

test("glp1InjectionDow validated 0-6", () => {
  assert.ok(state.includes("glp1InjectionDow must be 0-6"));
});
