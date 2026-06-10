// ---- Phase 42a: Nutrition targets engine (pure) ----
// Loaded before data.js. No DOM, no STATE — every input is a parameter, so the
// same file is require()-able from Node for tests (see tests/targets.test.cjs).
//
// Per-user overrides (profile.targetOverrides) exist so legacy users keep their
// exact pre-42 numbers: a fixed-kcal deficit beats the phase percentage, an
// LBM-based protein rule beats the bodyweight g/kg rule, and explicit floors
// beat the sex-based defaults.

const PHASE_DEFAULTS = {
  'cut':         { deficitPct: 0.20,  proteinPerKg: 2.2 },
  'recomp':      { deficitPct: 0.10,  proteinPerKg: 2.0 },
  'lean-bulk':   { deficitPct: -0.10, proteinPerKg: 1.8 },
  'maintenance': { deficitPct: 0,     proteinPerKg: 1.6 },
};

const ACTIVITY_FACTORS = {
  'sedentary': 1.2,
  'light': 1.375,
  'moderate': 1.55,
  'active': 1.725,
  'very-active': 1.9,
};

// Mifflin-St Jeor. Non-female uses the male constant (matches prior behavior).
function computeBMR(p) {
  const sexConst = p.sex === 'female' ? -161 : 5;
  return (10 * p.weight) + (6.25 * p.heightCm) - (5 * p.age) + sexConst;
}

// params: { weight, leanMass?, sessionType:'rest'|'upper'|'lower',
//           age, heightCm, sex, phase?, activityLevel?, overrides? }
// Returns null when the profile is too incomplete to compute safely —
// callers fall back to legacy profile fields and prompt for the profile.
function computeTargets(params) {
  const { weight, leanMass, sessionType } = params;
  const { age, heightCm, sex } = params;
  if (!weight || !age || !heightCm || !sex) return null;
  const o = params.overrides || {};
  const phase = params.phase || 'maintenance';
  const pd = PHASE_DEFAULTS[phase] || PHASE_DEFAULTS['maintenance'];

  const bmr = computeBMR({ weight, heightCm, age, sex });
  const af = o.activityFactor || ACTIVITY_FACTORS[params.activityLevel] || 1.55;
  const tdee = bmr * af;

  // Minors never get a deficit, whatever the phase says.
  let deficit = (o.deficitFixed != null) ? o.deficitFixed : tdee * pd.deficitPct;
  if (age < 18 && deficit > 0) deficit = 0;

  const sessionBonus = sessionType === 'lower' ? (o.sessionBonusLower != null ? o.sessionBonusLower : 150)
                     : sessionType === 'upper' ? (o.sessionBonusUpper != null ? o.sessionBonusUpper : 100)
                     : 0;
  const floor = (o.calorieFloor != null) ? o.calorieFloor : (sex === 'female' ? 1400 : 1600);
  const calsTarget = Math.max(floor, tdee - deficit + sessionBonus);

  let proteinTarget;
  if (o.proteinPerKgLBM != null) {
    proteinTarget = Math.max((leanMass || weight * 0.7) * o.proteinPerKgLBM, o.proteinMin || 0);
  } else {
    proteinTarget = weight * (o.proteinPerKg || pd.proteinPerKg);
  }
  // Protein never exceeds 45% of calories — keeps macros coherent at floor calories.
  proteinTarget = Math.min(proteinTarget, (calsTarget * 0.45) / 4);

  const fatTarget = (calsTarget * 0.30) / 9;
  const carbTarget = Math.max(0, (calsTarget - (proteinTarget * 4) - (calsTarget * 0.30)) / 4);

  return {
    calories: Math.round(calsTarget),
    protein: Math.round(proteinTarget),
    carbs: Math.round(carbTarget),
    fat: Math.round(fatTarget),
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    sessionType,
  };
}

// 35ml/kg rounded to 250ml, +500ml on training days. Overrides win.
function computeWaterTarget(p) {
  const o = (p && p.overrides) || {};
  if (p.isGymDay && o.waterGym != null) return o.waterGym;
  if (!p.isGymDay && o.waterRest != null) return o.waterRest;
  if (!p.weight) return p.isGymDay ? 2750 : 2250;
  const base = Math.round((p.weight * 35) / 250) * 250;
  return base + (p.isGymDay ? 500 : 0);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeBMR, computeTargets, computeWaterTarget, PHASE_DEFAULTS, ACTIVITY_FACTORS };
}
