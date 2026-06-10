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

// ---- Phase 42b: goal recommendation ----
// Reference band data — single source of truth, shared with the Where You Stand
// card (pages.js WYS delegates here). Same semantics: first band where value < max.

function BF_BANDS(sex, age) {
  if (age == null) return null;
  if (sex === 'female') {
    if (age <= 39) return [
      { label: 'Athletic', max: 17, color: 'var(--green)' },
      { label: 'Fitness', max: 23, color: 'var(--lime)' },
      { label: 'Average', max: 28, color: 'var(--blue)' },
      { label: 'Above avg', max: 32, color: 'var(--orange)' },
      { label: 'Obese', max: Infinity, color: 'var(--red)' },
    ];
    if (age <= 59) return [
      { label: 'Athletic', max: 18, color: 'var(--green)' },
      { label: 'Fitness', max: 24, color: 'var(--lime)' },
      { label: 'Average', max: 29, color: 'var(--blue)' },
      { label: 'Above avg', max: 33, color: 'var(--orange)' },
      { label: 'Obese', max: Infinity, color: 'var(--red)' },
    ];
    return [
      { label: 'Athletic', max: 19, color: 'var(--green)' },
      { label: 'Fitness', max: 25, color: 'var(--lime)' },
      { label: 'Average', max: 30, color: 'var(--blue)' },
      { label: 'Above avg', max: 34, color: 'var(--orange)' },
      { label: 'Obese', max: Infinity, color: 'var(--red)' },
    ];
  }
  if (age <= 39) return [
    { label: 'Athletic', max: 11, color: 'var(--green)' },
    { label: 'Fitness', max: 17, color: 'var(--lime)' },
    { label: 'Average', max: 22, color: 'var(--blue)' },
    { label: 'Above avg', max: 27, color: 'var(--orange)' },
    { label: 'Obese', max: Infinity, color: 'var(--red)' },
  ];
  if (age <= 59) return [
    { label: 'Athletic', max: 13, color: 'var(--green)' },
    { label: 'Fitness', max: 18, color: 'var(--lime)' },
    { label: 'Average', max: 23, color: 'var(--blue)' },
    { label: 'Above avg', max: 28, color: 'var(--orange)' },
    { label: 'Obese', max: Infinity, color: 'var(--red)' },
  ];
  return [
    { label: 'Athletic', max: 14, color: 'var(--green)' },
    { label: 'Fitness', max: 19, color: 'var(--lime)' },
    { label: 'Average', max: 24, color: 'var(--blue)' },
    { label: 'Above avg', max: 29, color: 'var(--orange)' },
    { label: 'Obese', max: Infinity, color: 'var(--red)' },
  ];
}

const BMI_BANDS = [
  { label: 'Underweight', max: 18.5, color: 'var(--orange)' },
  { label: 'Normal', max: 25, color: 'var(--green)' },
  { label: 'Overweight', max: 30, color: 'var(--orange)' },
  { label: 'Obese I', max: 35, color: '#ff7043' },
  { label: 'Obese II', max: 40, color: 'var(--red)' },
  { label: 'Obese III', max: Infinity, color: '#d32f2f' },
];

const LBMI_BANDS = {
  male: [
    { label: 'Low', max: 17, color: 'var(--orange)' },
    { label: 'Average', max: 19, color: 'var(--blue)' },
    { label: 'Above avg', max: 22, color: 'var(--lime)' },
    { label: 'Excellent', max: 25, color: 'var(--green)' },
    { label: 'Very high', max: Infinity, color: '#4caf50' },
  ],
  female: [
    { label: 'Low', max: 14, color: 'var(--orange)' },
    { label: 'Average', max: 16, color: 'var(--blue)' },
    { label: 'Above avg', max: 18, color: 'var(--lime)' },
    { label: 'Excellent', max: 21, color: 'var(--green)' },
    { label: 'Very high', max: Infinity, color: '#4caf50' },
  ],
};

function bandFor(bands, v) {
  if (!Array.isArray(bands) || v == null) return null;
  for (let i = 0; i < bands.length; i++) {
    if (v < bands[i].max) return { label: bands[i].label, color: bands[i].color, index: i, total: bands.length };
  }
  const last = bands[bands.length - 1];
  return { label: last.label, color: last.color, index: bands.length - 1, total: bands.length };
}

const PHASE_LABELS = {
  'cut': 'Lose fat',
  'recomp': 'Tone up — lose fat + build muscle',
  'lean-bulk': 'Build muscle',
  'maintenance': 'Stay fit & maintain',
};

// stats: { age, sex, heightCm, weight, bf? (percent, optional) }
// Returns { phase, headline, reasons[], allowed[], guard, bmi, bfBand, lbmi, lbmiBand }
// or null when stats are incomplete. Deterministic — no AI, no state.
// Language rule: neutral, band-based, never diagnostic.
function recommendGoal(stats) {
  const { age, sex, heightCm, weight, bf } = stats || {};
  if (!age || !sex || !heightCm || !weight) return null;
  const hM = heightCm / 100;
  const bmi = Math.round((weight / (hM * hM)) * 10) / 10;
  const sexKey = sex === 'female' ? 'female' : 'male';
  const bfBand = bf != null ? bandFor(BF_BANDS(sexKey, age), bf) : null;
  const lbmi = bf != null ? Math.round(((weight * (1 - bf / 100)) / (hM * hM)) * 10) / 10 : null;
  const lbmiBand = lbmi != null ? bandFor(LBMI_BANDS[sexKey], lbmi) : null;
  const reasons = [];
  const out = (phase, guard, allowed) => ({
    phase, headline: PHASE_LABELS[phase], reasons, allowed, guard: guard || null,
    bmi, bfBand: bfBand && bfBand.label, lbmi, lbmiBand: lbmiBand && lbmiBand.label,
  });

  // Guard 1 — underweight: a deficit is never appropriate, whatever the goal.
  if (bmi < 18.5) {
    reasons.push(`BMI ${bmi} is in the underweight range. Eating a bit more and building muscle is what your stats call for — a calorie deficit isn't appropriate here.`);
    return out('lean-bulk', 'underweight', ['lean-bulk', 'maintenance']);
  }

  // Guard 2 — under 18: never a deficit. Recomp framing if carrying extra,
  // otherwise train + maintain. Lean-bulk (a surplus) stays available.
  if (age < 18) {
    const carryingExtra = (bfBand && bfBand.index >= 3) || bmi >= 25;
    if (carryingExtra) {
      reasons.push(bf != null
        ? `Body fat ${bf}% sits in the ${bfBand.label.toLowerCase()} band for your age.`
        : `BMI ${bmi} is above the typical range.`);
      reasons.push(`Because you're still growing, the plan never cuts calories — you'll eat at maintenance with plenty of protein, and training does the work. Body composition improves as you get stronger and taller.`);
      return out('recomp', 'minor', ['recomp', 'maintenance', 'lean-bulk']);
    }
    reasons.push(`Your stats are in a healthy range for your age. Under 18 the goal is strength, fitness and habits — eating enough matters as much as training.`);
    return out('maintenance', 'minor', ['recomp', 'maintenance', 'lean-bulk']);
  }

  // Adults with body fat % known — the full picture.
  if (bfBand) {
    if (bfBand.index >= 4 || bmi >= 30) {
      reasons.push(`Body fat ${bf}% and BMI ${bmi} are above the healthy bands for your age — a steady fat-loss phase would have the biggest health impact.`);
      reasons.push(`High protein and training keep your muscle while the fat comes off.`);
      return out('cut', null, ['cut', 'recomp', 'maintenance', 'lean-bulk']);
    }
    if (bfBand.index === 3) {
      reasons.push(`Body fat ${bf}% sits in the above-average band for your age (healthy is under ${BF_BANDS(sexKey, age)[2].max}%).`);
      reasons.push(`There's enough to lose that a gentle cut works well — but if you'd rather not count as tightly, recomp gets there slower and builds muscle on the way.`);
      return out('cut', null, ['cut', 'recomp', 'maintenance', 'lean-bulk']);
    }
    if (bfBand.index === 2) {
      reasons.push(`Body fat ${bf}% is in the average band for your age — not enough excess to need a hard cut.`);
      reasons.push(`A recomp — small deficit, high protein, consistent training — drops a few percent of fat while you build muscle. Best of both from where you're standing.`);
      return out('recomp', null, ['cut', 'recomp', 'maintenance', 'lean-bulk']);
    }
    // Athletic / Fitness band:
    if (lbmiBand && lbmiBand.index === 0) {
      reasons.push(`Body fat ${bf}% is already in the ${bfBand.label.toLowerCase()} band, but your lean mass index (${lbmi}) is on the low side — muscle is the thing to add.`);
      reasons.push(`A lean bulk — small surplus, progressive training — is what your stats call for.`);
      return out('lean-bulk', null, ['cut', 'recomp', 'maintenance', 'lean-bulk']);
    }
    reasons.push(`Body fat ${bf}% and lean mass are both in good bands for your age — nothing needs fixing.`);
    reasons.push(`Maintenance keeps you here: train for strength and fitness, eat at your TDEE.`);
    return out('maintenance', null, ['cut', 'recomp', 'maintenance', 'lean-bulk']);
  }

  // Adults, BMI only — more conservative without body fat %.
  if (bmi >= 30) {
    reasons.push(`BMI ${bmi} is in the obese range — a steady fat-loss phase would have the biggest health impact.`);
    return out('cut', null, ['cut', 'recomp', 'maintenance', 'lean-bulk']);
  }
  if (bmi >= 25) {
    reasons.push(`BMI ${bmi} is in the overweight range — but BMI alone can't tell muscle from fat.`);
    reasons.push(`Recomp is the safe productive default: small deficit, high protein, training. If you know your body fat %, add it to your profile and this recommendation sharpens up.`);
    return out('recomp', null, ['cut', 'recomp', 'maintenance', 'lean-bulk']);
  }
  reasons.push(`BMI ${bmi} is in the healthy range. Without a body fat % the safe call is maintenance — train, eat at TDEE, and add a body fat reading to refine this.`);
  return out('maintenance', null, ['cut', 'recomp', 'maintenance', 'lean-bulk']);
}

// ---- Phase 42c: program template picker ----
const PROGRAM_LABELS = {
  'upper-lower-4d': 'Upper / Lower split · 4 days a week',
  'full-body-3d': 'Full Body · 3 days a week',
  'home-3d': 'Home Full Body · 3 days a week · minimal equipment',
};

// experience: 'new'|'some'|'regular' · daysPerWeek: 2..5 · equipment: 'gym'|'home'
// Beginners get full-body regardless of available days — they progress faster on it.
function pickProgramId(experience, daysPerWeek, equipment) {
  if (equipment === 'home') return 'home-3d';
  if ((daysPerWeek || 3) >= 4 && experience !== 'new') return 'upper-lower-4d';
  return 'full-body-3d';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    computeBMR, computeTargets, computeWaterTarget, PHASE_DEFAULTS, ACTIVITY_FACTORS,
    BF_BANDS, BMI_BANDS, LBMI_BANDS, bandFor, recommendGoal, PHASE_LABELS,
    PROGRAM_LABELS, pickProgramId,
  };
}
