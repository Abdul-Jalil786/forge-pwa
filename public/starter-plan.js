// Phase 118: deterministic starter meal plan for a new account — no AI, no key.
// Builds a 5–6 meal plan from a fixed template of ordinary UK foods, scaled to
// the user's computed macro targets, with excluded foods removed. Everything it
// writes is the normal items-locked meal-plan shape (meals[] → ingredients[]),
// so the user edits it in place exactly like any other plan.
// Pure/UMD (browser global + node require) like targets.js.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else Object.assign(root, factory());
})(typeof self !== 'undefined' ? self : this, function () {

  // per 100g (or per unit when `unit` is set). tags drive exclusion matching.
  const FOODS = {
    oats:      { short: 'Oats', food: 'rolled oats',                 cals: 379, protein: 13, carbs: 68, fat: 7,   gi: 'moderate', tags: ['oat', 'gluten', 'cereal'] },
    egg:       { short: 'Eggs', food: 'whole eggs',                  unit: 'each', step: 1,   cals: 78,  protein: 6.3, carbs: 0.6, fat: 5.3, gi: 'low', tags: ['egg'] },
    berries:   { short: 'Berries', food: 'mixed berries',               cals: 43,  protein: 1,  carbs: 10, fat: 0.3, gi: 'low', tags: ['berry', 'berries', 'fruit'] },
    milk:      { short: 'Milk', food: 'semi-skimmed milk',           unit: 'ml', step: 50,   cals: 0.47, protein: 0.036, carbs: 0.048, fat: 0.017, gi: 'low', tags: ['milk', 'dairy', 'lactose'] },
    chicken:   { short: 'Chicken', food: 'chicken breast, grilled',     cals: 165, protein: 31, carbs: 0,  fat: 3.6, gi: 'low', tags: ['chicken', 'poultry', 'meat'] },
    rice:      { short: 'Rice', food: 'cooked basmati rice',         cals: 130, protein: 2.7, carbs: 28, fat: 0.3, gi: 'moderate', tags: ['rice'] },
    veg:       { short: 'Veg', food: 'mixed vegetables',            cals: 40,  protein: 2,  carbs: 7,  fat: 0.4, gi: 'low', tags: ['vegetable', 'veg'] },
    oil:       { short: 'Olive oil', food: 'olive oil',                   unit: 'tsp', step: 1,   cals: 40,  protein: 0,  carbs: 0,  fat: 4.5, gi: 'low', tags: ['oil', 'olive'] },
    banana:    { short: 'Banana', food: 'banana',                      unit: 'each', step: 0.5, cals: 105, protein: 1.3, carbs: 27, fat: 0.3, gi: 'moderate', tags: ['banana', 'fruit'] },
    yoghurt:   { short: 'Yoghurt', food: 'Greek yoghurt (0% fat)',      cals: 57,  protein: 10, carbs: 4,  fat: 0.2, gi: 'low', tags: ['yoghurt', 'yogurt', 'dairy', 'lactose'] },
    whey:      { short: 'Whey', food: 'whey protein (scoop)',        unit: 'scoop', step: 0.5, cals: 120, protein: 24, carbs: 3, fat: 1.5, gi: 'low', tags: ['whey', 'protein powder', 'dairy', 'lactose'] },
    beef:      { short: 'Beef mince', food: 'lean beef mince (5%), cooked', cals: 137, protein: 21, carbs: 0,  fat: 5,   gi: 'low', tags: ['beef', 'red meat', 'meat', 'mince'] },
    potato:    { short: 'Sweet potato', food: 'sweet potato, baked',         cals: 90,  protein: 2,  carbs: 21, fat: 0.1, gi: 'moderate', tags: ['potato', 'sweet potato'] },
    salmon:    { short: 'Salmon', food: 'salmon fillet, baked',        cals: 208, protein: 20, carbs: 0,  fat: 13,  gi: 'low', tags: ['salmon', 'fish', 'seafood'] },
    pb:        { short: 'Peanut butter', food: 'peanut butter',               unit: 'tbsp', step: 0.5, cals: 94, protein: 4, carbs: 3, fat: 8, gi: 'low', tags: ['peanut', 'nut', 'nuts'] },
    almonds:   { short: 'Almonds', food: 'almonds',                     cals: 579, protein: 21, carbs: 22, fat: 50,  gi: 'low', tags: ['almond', 'nut', 'nuts'] },
    avocado:   { short: 'Avocado', food: 'avocado (flesh)',             cals: 160, protein: 2,  carbs: 9,  fat: 15,  gi: 'low', tags: ['avocado'] },
  };

  // role: 'protein' | 'carb' | 'fat' scale to hit the target; 'fixed' never scales.
  const TEMPLATE = [
    { id: 'sp-breakfast', slot: 'Breakfast', items: [
      ['oats', 70, 'carb'], ['milk', 200, 'fixed'], ['egg', 3, 'protein'], ['berries', 100, 'fixed'],
    ]},
    { id: 'sp-lunch', slot: 'Lunch', items: [
      ['chicken', 150, 'protein'], ['rice', 200, 'carb'], ['veg', 150, 'fixed'], ['oil', 1, 'fat'],
    ]},
    { id: 'sp-preworkout', slot: 'Pre-workout', items: [
      ['banana', 1, 'carb'], ['yoghurt', 200, 'protein'],
    ]},
    { id: 'sp-postworkout', slot: 'Post-workout', items: [
      ['whey', 1, 'protein'], ['milk', 250, 'fixed'],
    ]},
    { id: 'sp-dinner', slot: 'Dinner', items: [
      ['salmon', 150, 'protein'], ['potato', 250, 'carb'], ['veg', 150, 'fixed'],
    ]},
    { id: 'sp-evening', slot: 'Evening', items: [
      ['yoghurt', 150, 'protein'], ['pb', 1, 'fat'], ['almonds', 20, 'fat'],
    ]},
  ];
  // swap-ins when a template food is excluded (first non-excluded wins)
  const ALTERNATIVES = { salmon: ['chicken', 'beef'], chicken: ['beef', 'salmon'], beef: ['chicken'], whey: ['yoghurt'], yoghurt: ['egg'], milk: [], oats: ['potato'], rice: ['potato'], potato: ['rice'], pb: ['avocado'], almonds: ['avocado'], egg: ['yoghurt'] };
  // grams/units used when a food is swapped in (per-unit foods need sensible counts)
  const SWAP_QTY = { chicken: 150, beef: 150, salmon: 150, whey: 1, yoghurt: 200, egg: 3, potato: 250, rice: 200, avocado: 50 };

  const _norm = s => String(s || '').toLowerCase().trim().replace(/s$/, '');
  function isExcluded(key, excluded) {
    const f = FOODS[key]; if (!f) return true;
    const hay = [f.food].concat(f.tags || []).map(_norm);
    return excluded.some(ex => ex && hay.some(h => h.includes(ex) || ex.includes(h)));
  }
  function resolveFood(key, excluded) {
    if (!isExcluded(key, excluded)) return key;
    for (const alt of (ALTERNATIVES[key] || [])) if (!isExcluded(alt, excluded)) return alt;
    return null;
  }
  const _qtyLabel = (f, qty) => {
    if (f.unit === 'each') return `${qty % 1 ? qty : Math.round(qty)} ${f.food}`;
    if (f.unit === 'scoop') return `${qty} scoop${qty === 1 ? '' : 's'} ${f.food.replace(' (scoop)', '')}`;
    if (f.unit === 'tbsp' || f.unit === 'tsp') return `${qty} ${f.unit} ${f.food}`;
    return `${Math.round(qty)}${f.unit || 'g'} ${f.food}`;
  };
  const _per = (f, qty) => f.unit ? qty : qty / 100; // multiplier vs the stored macros
  const _roundQty = (f, qty) => {
    const step = f.step || (f.unit ? 1 : 10);
    return Math.round(qty / step) * step;
  };
  const _minQty = f => f.unit === 'each' ? 1 : f.unit === 'ml' ? 100 : f.unit ? 0.5 : 20;

  function _mealTimes(n, window) {
    if (window && window.enabled && window.end > window.start) {
      const span = window.end - window.start;
      return Array.from({ length: n }, (_, i) => {
        const h = window.start + (n === 1 ? 0 : span * i / (n - 1)) - (i === n - 1 ? 0.5 : 0);
        const hh = Math.floor(h), mm = Math.round((h - hh) * 60 / 15) * 15;
        return String(hh).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0');
      });
    }
    const def = ['08:00', '12:30', '15:00', '17:30', '19:30', '21:30'];
    return def.slice(0, n);
  }

  // targets: {calories, protein, carbs, fat}; opts: {phase, excluded[], eatingWindow, name}
  function buildStarterMealPlan(targets, opts) {
    opts = opts || {};
    const excluded = (opts.excluded || []).map(_norm).filter(Boolean);
    const tP = +targets.protein || 0, tC = +targets.carbs || 0, tF = +targets.fat || 0;
    // 1) instantiate rows, swapping excluded foods
    let meals = TEMPLATE.map(m => {
      const rows = [];
      m.items.forEach(([key, qty, role]) => {
        const k = resolveFood(key, excluded); if (!k) return;
        const q = k === key ? qty : (SWAP_QTY[k] != null ? SWAP_QTY[k] : qty);
        const dup = rows.find(r => r.key === k && r.role === role);
        if (dup) dup.qty += q; else rows.push({ key: k, qty: q, role });
      });
      return { id: m.id, slot: m.slot, rows };
    });
    meals = meals.filter(m => m.rows.some(r => r.role === 'protein' || r.role === 'carb'));
    // 2) scale by role toward the targets (3 passes — roles cross-contribute)
    const mult = { protein: 1, carb: 1, fat: 1 };
    const sum = macro => meals.reduce((s, m) => s + m.rows.reduce((a, r) => {
      const f = FOODS[r.key]; return a + f[macro] * _per(f, r.qty) * (mult[r.role] || 1);
    }, 0), 0);
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    for (let pass = 0; pass < 3; pass++) {
      for (const [role, macro, target, lo, hi] of [['carb', 'carbs', tC, 0.35, 2.5], ['protein', 'protein', tP, 0.8, 2.2], ['fat', 'fat', tF, 0.3, 3]]) {
        if (!target) continue;
        const others = meals.reduce((s, m) => s + m.rows.reduce((a, r) => r.role === role ? a : a + FOODS[r.key][macro] * _per(FOODS[r.key], r.qty) * (mult[r.role] || 1), 0), 0);
        const own = meals.reduce((s, m) => s + m.rows.reduce((a, r) => r.role === role ? a + FOODS[r.key][macro] * _per(FOODS[r.key], r.qty) : a, 0), 0);
        if (own > 0) mult[role] = clamp((target - others) / own, lo, hi);
      }
    }
    // 2b) calorie reconciliation: protein/fat floors can leave the plan over the
    // calorie target (e.g. a low computed protein target vs the template's own
    // protein) — trim the carb sources so total kcal lands near the target.
    const tK = +targets.calories || 0;
    if (tK > 0) {
      const kcalNow = sum('cals');
      const carbKcal = meals.reduce((s, m) => s + m.rows.reduce((a, r) => r.role === 'carb' ? a + FOODS[r.key].cals * _per(FOODS[r.key], r.qty) * mult.carb : a, 0), 0);
      if (kcalNow > tK * 1.03 && carbKcal > 0) mult.carb = clamp(mult.carb * (carbKcal - (kcalNow - tK)) / carbKcal, 0.35, 2.5);
    }
    // 3) round, drop crumbs, emit the plan shape
    const times = _mealTimes(meals.length, opts.eatingWindow);
    const out = meals.map((m, i) => {
      const ingredients = m.rows.map(r => {
        const f = FOODS[r.key];
        let qty = _roundQty(f, r.qty * (mult[r.role] || 1));
        if (qty < _minQty(f)) return null;
        const k = _per(f, qty);
        return { name: _qtyLabel(f, qty), cals: Math.round(f.cals * k), protein: Math.round(f.protein * k), carbs: Math.round(f.carbs * k), fat: Math.round(f.fat * k * 10) / 10, gi: f.gi, _short: f.short, _role: r.role };
      }).filter(Boolean);
      const t = ingredients.reduce((a, x) => ({ cals: a.cals + x.cals, protein: a.protein + x.protein, carbs: a.carbs + x.carbs, fat: a.fat + x.fat }), { cals: 0, protein: 0, carbs: 0, fat: 0 });
      // name the meal from what's actually in it — scaled foods first, fixed sides only if needed
      const order = { protein: 0, carb: 1, fixed: 2, fat: 3 };
      const named = ingredients.slice().sort((a, b) => (order[a._role] ?? 9) - (order[b._role] ?? 9));
      const shorts = named.map(x => x._short).filter((v, j, a) => v && a.indexOf(v) === j).slice(0, 3);
      const name = m.slot + ': ' + (shorts.length > 1 ? shorts.slice(0, -1).join(', ') + ' & ' + shorts[shorts.length - 1] : shorts[0] || '');
      ingredients.forEach(x => { delete x._short; delete x._role; });
      return { id: m.id, name, time: times[i], cals: t.cals, protein: t.protein, carbs: t.carbs, fat: Math.round(t.fat), ingredients, supplements: [] };
    }).filter(m => m.ingredients.length);
    const tot = out.reduce((a, m) => ({ cals: a.cals + m.cals, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }), { cals: 0, protein: 0, carbs: 0, fat: 0 });
    const phaseWord = { 'cut': 'Cut', 'recomp': 'Recomp', 'lean-bulk': 'Lean bulk', 'maintenance': 'Maintenance' }[opts.phase] || 'Starter';
    return {
      name: opts.name || `${phaseWord} starter plan — ~${tot.cals} kcal · ${tot.protein}P/${tot.carbs}C/${tot.fat}F`,
      meals: out,
      starter: true,
      generatedAt: new Date().toISOString(),
      totals: tot,
    };
  }

  return { buildStarterMealPlan, STARTER_FOODS: FOODS };
});
