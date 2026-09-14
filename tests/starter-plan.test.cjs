// Phase 118: starter meal plan builder — run with `npm test` (node --test, no deps).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildStarterMealPlan } = require("../public/starter-plan.js");

const totals = p => p.meals.reduce((a, m) => ({ cals: a.cals + m.cals, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }), { cals: 0, protein: 0, carbs: 0, fat: 0 });
const within = (v, t, pct) => Math.abs(v - t) <= t * pct;

test("scales a 6-meal template to a lean-bulk target (macros within ~15%, protein never under)", () => {
  const p = buildStarterMealPlan({ calories: 3100, protein: 150, carbs: 470, fat: 75 }, { phase: "lean-bulk" });
  assert.equal(p.meals.length, 6);
  assert.ok(p.starter && /Lean bulk starter plan/.test(p.name));
  const t = totals(p);
  assert.ok(t.protein >= 150, "protein at or above target");
  assert.ok(within(t.carbs, 470, 0.15), "carbs " + t.carbs);
  assert.ok(within(t.fat, 75, 0.15), "fat " + t.fat);
  for (const m of p.meals) {
    assert.equal(m.cals, m.ingredients.reduce((a, i) => a + i.cals, 0), "meal totals = ingredient sums");
    assert.ok(/^\d\d:\d\d$/.test(m.time));
    assert.ok(Array.isArray(m.supplements));
    for (const i of m.ingredients) assert.ok(i.name && i.cals >= 0 && i.gi, JSON.stringify(i));
  }
  assert.ok(p.meals.map(m => m.time).every((t, i, a) => i === 0 || t > a[i - 1]), "meal times ascend");
});

test("excluded foods are swapped or dropped and never appear", () => {
  const p = buildStarterMealPlan({ calories: 2500, protein: 210, carbs: 235, fat: 78 }, { phase: "cut", excluded: ["fish", "dairy", "nuts"] });
  const txt = JSON.stringify(p).toLowerCase();
  for (const bad of ["salmon", "yoghurt", "milk", "whey", "almond", "peanut"]) assert.ok(!txt.includes(bad), "still contains " + bad);
  assert.ok(txt.includes("chicken") && txt.includes("egg"), "swapped to allowed proteins");
  assert.ok(totals(p).protein >= 190, "protein still close to target after swaps: " + totals(p).protein);
  // two excluded fats both swapped to avocado → one merged row, not two
  const ev = p.meals.find(m => m.id === "sp-evening");
  assert.ok(ev && ev.ingredients.filter(i => /avocado/.test(i.name)).length <= 1, "duplicate swap-ins merged");
});

test("a small cut target shrinks portions (never below sensible minimums) and an eating window sets the times", () => {
  const p = buildStarterMealPlan({ calories: 1500, protein: 120, carbs: 130, fat: 50 }, { phase: "cut", eatingWindow: { enabled: true, start: 12, end: 20 } });
  const t = totals(p);
  assert.ok(within(t.cals, 1500, 0.15), "kcal " + t.cals);
  assert.ok(t.protein >= 115, "protein " + t.protein);
  for (const m of p.meals) for (const i of m.ingredients) {
    const g = /^(\d+)g /.exec(i.name); if (g) assert.ok(+g[1] >= 20, "crumb portion " + i.name);
  }
  assert.equal(p.meals[0].time, "12:00");
  assert.ok(p.meals[p.meals.length - 1].time <= "20:00", "last meal inside the window");
  assert.ok(/Cut starter plan/.test(p.name));
});
