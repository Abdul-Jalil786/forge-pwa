import Anthropic from "@anthropic-ai/sdk";
import prisma from "./db";
import { decrypt } from "./crypto-util";

const MODEL = "claude-opus-4-7";
const MAX_TOKENS = 4000;

function ukToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function daysAgoUK(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

function summarizeFoodDay(items: any[]): { kcal: number; p: number; c: number; f: number } {
  let kcal = 0, p = 0, c = 0, f = 0;
  for (const it of items || []) {
    kcal += +it.cals || 0; p += +it.protein || 0; c += +it.carbs || 0; f += +it.fat || 0;
  }
  return { kcal: Math.round(kcal), p: Math.round(p), c: Math.round(c), f: Math.round(f) };
}

// Phase 27: Mifflin-St Jeor BMR + activity factor estimate
function estimateTDEE(personal: any, currentWeightKg: number | null): { bmr: number; tdee: number } | null {
  if (!personal || !personal.age || !personal.heightCm || !personal.sex || !currentWeightKg) return null;
  const w = currentWeightKg, h = personal.heightCm, a = personal.age;
  // Mifflin-St Jeor
  const bmr = personal.sex === "female"
    ? 10 * w + 6.25 * h - 5 * a - 161
    : 10 * w + 6.25 * h - 5 * a + 5; // 'male' and 'other' default to male formula
  const af = { sedentary: 1.2, light: 1.375, moderate: 1.55, "very-active": 1.725 }[personal.activityLevel as string] || 1.375;
  return { bmr: Math.round(bmr), tdee: Math.round(bmr * af) };
}

// Phase 29: body comp helpers
function latestBodyComp(state: any): { weight: number | null; bf: number | null; lbm: number | null; fatMass: number | null; muscleMass: number | null; visceral: number | null; hydration: number | null; date: string | null } {
  const wl: any[] = state.weightLog || [];
  const bl: any[] = state.bfLog || [];
  const bc: any = state.bodyComp || {};
  const cw  = wl.length ? wl[wl.length - 1].weight : null;
  const cbf = bl.length ? bl[bl.length - 1].bf     : null;
  const lbm = (cw && cbf) ? Math.round(cw * (1 - cbf / 100) * 100) / 100 : null;
  const fatMass = (cw && cbf) ? Math.round(cw * (cbf / 100) * 100) / 100 : null;
  const bcDates = Object.keys(bc).sort();
  let muscleMass: number | null = null, visceral: number | null = null, hydration: number | null = null;
  for (let i = bcDates.length - 1; i >= 0; i--) {
    const e = bc[bcDates[i]] || {};
    if (muscleMass == null && e.muscleMass != null) muscleMass = e.muscleMass;
    if (visceral   == null && e.visceralFat != null) visceral   = e.visceralFat;
    if (hydration  == null && e.hydration  != null) hydration  = e.hydration;
    if (muscleMass != null && visceral != null && hydration != null) break;
  }
  const date = wl.length ? wl[wl.length - 1].date : (bl.length ? bl[bl.length - 1].date : null);
  return { weight: cw, bf: cbf, lbm, fatMass, muscleMass, visceral, hydration, date };
}

// Phase 30: aggregate stats over a date range
function periodStats(state: any, fromDate: string, toDate: string): {
  daysWithWeight: number;
  avgWeight: number | null;
  avgBF: number | null;
  trainingSessions: number;
  avgSleepHrs: number | null;
  avgSteps: number | null;
  avgActiveCal: number | null;
  avgTotalCal: number | null;
  avgFoodKcal: number | null;
  avgProtein: number | null;
} {
  const wl: any[] = (state.weightLog || []).filter((e: any) => e.date >= fromDate && e.date <= toDate);
  const bl: any[] = (state.bfLog     || []).filter((e: any) => e.date >= fromDate && e.date <= toDate);
  const sleepLog = state.sleepLog || {};
  const stepsLog = state.stepsLog || {};
  const calorieLog = state.calorieLog || {};
  const exLog = state.exLog || {};
  const foods = state.foods || {};

  const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 10) / 10 : null;
  const sleepHrs: number[] = [];
  const stepDays: number[] = [];
  const activeCals: number[] = [];
  const totalCals: number[] = [];
  const foodKcals: number[] = [];
  const proteins: number[] = [];
  let trainingSessions = 0;

  // iterate dates in range
  for (let d = new Date(fromDate); d <= new Date(toDate); d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const sl = sleepLog[key];
    if (sl?.hours != null) sleepHrs.push(sl.hours);
    if (stepsLog[key] != null) stepDays.push(stepsLog[key]);
    if (calorieLog[key]?.active != null) activeCals.push(calorieLog[key].active);
    if (calorieLog[key]?.total != null) totalCals.push(calorieLog[key].total);
    const dayFoods = foods[key] || [];
    if (dayFoods.length > 0) {
      let kcal = 0, p = 0;
      for (const f of dayFoods) { kcal += +f.cals || 0; p += +f.protein || 0; }
      foodKcals.push(Math.round(kcal));
      proteins.push(Math.round(p));
    }
    const session = exLog[key];
    if (session && Object.values(session).some((ex: any) => ex?.done)) trainingSessions++;
  }

  return {
    daysWithWeight: wl.length,
    avgWeight: wl.length ? Math.round((wl.reduce((s, e) => s + e.weight, 0) / wl.length) * 10) / 10 : null,
    avgBF:     bl.length ? Math.round((bl.reduce((s, e) => s + e.bf, 0) / bl.length) * 10) / 10 : null,
    trainingSessions,
    avgSleepHrs: avg(sleepHrs),
    avgSteps: avg(stepDays),
    avgActiveCal: avg(activeCals),
    avgTotalCal: avg(totalCals),
    avgFoodKcal: avg(foodKcals),
    avgProtein: avg(proteins),
  };
}

function bodyCompAtDate(state: any, date: string): { weight: number | null; bf: number | null; lbm: number | null; fatMass: number | null } {
  const wl: any[] = state.weightLog || [];
  const bl: any[] = state.bfLog || [];
  // pick closest entry on or before `date`
  const wOnBefore = [...wl].filter(e => e.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0];
  const bOnBefore = [...bl].filter(e => e.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0];
  const w = wOnBefore?.weight ?? null;
  const b = bOnBefore?.bf ?? null;
  const lbm = (w && b) ? Math.round(w * (1 - b / 100) * 100) / 100 : null;
  const fatMass = (w && b) ? Math.round(w * (b / 100) * 100) / 100 : null;
  return { weight: w, bf: b, lbm, fatMass };
}

function buildContext(state: any): string {
  const today = ukToday();
  const cutoff14 = daysAgoUK(14);
  const cutoff7 = daysAgoUK(7);
  const profile = state.profile || {};
  const macros = profile.macros || {};
  const personal = profile.personal || {};
  const meds = Array.isArray(profile.medications) ? profile.medications : [];
  const bloodMarkers = Array.isArray(profile.bloodMarkers) ? profile.bloodMarkers : [];
  const recovery = state.recovery || {};
  const stepsLog = state.stepsLog || {};
  const calorieLog = state.calorieLog || {};
  const mealPlan = state.mealPlan;
  const bc = state.bodyComp || {};

  const wl = (state.weightLog || []).filter((e: any) => e.date >= cutoff14);
  const bl = (state.bfLog || []).filter((e: any) => e.date >= cutoff14);

  const foodDays: any[] = [];
  for (const date of Object.keys(state.foods || {}).sort()) {
    if (date < cutoff7) continue;
    foodDays.push({ date, ...summarizeFoodDay(state.foods[date]) });
  }

  // exLog[date][exerciseId] = { done: bool, sets: [{kg, reps, seconds, done?}, ...] }
  const exerciseDays: any[] = [];
  for (const date of Object.keys(state.exLog || {}).sort()) {
    if (date < cutoff7) continue;
    const exs = state.exLog[date] || {};
    const exercises = Object.values(exs) as any[];
    if (exercises.length === 0) continue;
    const doneExercises = exercises.filter((e) => e?.done).length;
    let setsLogged = 0;
    let totalVolume = 0;
    let timedSeconds = 0;
    for (const ex of exercises) {
      const sets = Array.isArray(ex?.sets) ? ex.sets : [];
      for (const s of sets) {
        const kg = parseFloat(s?.kg) || 0;
        const reps = parseInt(s?.reps, 10) || 0;
        const sec = parseInt(s?.seconds, 10) || 0;
        if (kg || reps || sec || s?.done) setsLogged++;
        if (kg && reps) totalVolume += kg * reps;
        if (sec) timedSeconds += sec;
      }
    }
    if (doneExercises === 0 && setsLogged === 0) continue;
    const parts = [`${doneExercises}/${exercises.length} exercises done`, `${setsLogged} sets`];
    if (totalVolume > 0) parts.push(`${Math.round(totalVolume)}kg volume`);
    if (timedSeconds > 0) parts.push(`${timedSeconds}s isometric`);
    exerciseDays.push({ date, summary: parts.join(", ") });
  }

  const sleepDays = Object.keys(state.sleepLog || {}).filter((d) => d >= cutoff7).sort().map((d) => {
    const s = state.sleepLog[d] || {};
    return {
      date: d,
      hours: s.totalHours ?? s.hours ?? null,
      score: s.score ?? null,
      remMin: s.remMin ?? null,
      deepMin: s.deepMin ?? null,
      lightMin: s.lightMin ?? null,
      awakeMin: s.awakeMin ?? null,
    };
  });

  const supps = state.supps || [];
  const suppLog = state.supplementLog || {};
  const suppAdherence: any[] = [];
  for (let i = 0; i < 7; i++) {
    const d = daysAgoUK(i);
    const day = suppLog[d] || {};
    const taken = supps.filter((s: any) => day[s.id]).length;
    suppAdherence.push({ date: d, taken, of: supps.length });
  }

  const currentWeight = wl.length ? wl[wl.length - 1].weight : profile.startWeight;
  const tdee = estimateTDEE(personal, currentWeight);

  const lines: string[] = [];
  lines.push(`Today (UK): ${today}`);
  lines.push("");
  lines.push("DEMOGRAPHICS + GOAL FRAMING:");
  lines.push(`  Age: ${personal.age ?? "(not set)"} · Height: ${personal.heightCm ?? "?"}cm · Sex (for BMR): ${personal.sex ?? "(not set)"} · Ethnicity: ${personal.ethnicity ?? "(not set)"}`);
  lines.push(`  Activity outside gym: ${personal.activityLevel ?? "(not set)"}`);
  lines.push(`  CURRENT PHASE: ${personal.phase ?? "(not specified — default behaviour: assume fat-loss cut)"}`);
  if (personal.targetLBMStretch) lines.push(`  STRETCH LBM GOAL: ${personal.targetLBMStretch}kg lean body mass (vs default target ${profile.targetLBM ?? "?"}kg). User wants to build muscle, not just lose fat — frame coaching toward the LBM ceiling.`);
  if (tdee) lines.push(`  Estimated BMR: ${tdee.bmr} kcal · TDEE (Mifflin-St Jeor × activity factor, excludes training): ${tdee.tdee} kcal/day`);
  else lines.push(`  TDEE estimate unavailable (demographics incomplete — coach should flag this if accuracy matters)`);
  lines.push("");
  lines.push("MEDICATIONS (factor these into interpretation):");
  if (meds.length === 0) lines.push("  (none recorded)");
  else for (const m of meds) lines.push(`  - ${m.name}${m.dose ? ` ${m.dose}` : ""}${m.schedule ? ` · ${m.schedule}` : ""}${m.notes ? ` · ${m.notes}` : ""}`);
  lines.push("");

  // Phase 29a: blood markers — clinical context for every coaching decision
  if (bloodMarkers.length > 0) {
    const latestDate = bloodMarkers.reduce((d: string, m: any) => m.date && m.date > d ? m.date : d, "");
    lines.push(`BLOOD MARKERS (most recent panel: ${latestDate || "unknown date"}):`);
    const flagged: any[] = [];
    const inRange: any[] = [];
    for (const m of bloodMarkers) {
      const v = m.value;
      if (v == null) continue;
      let status = "in range";
      if (m.refLow != null && v < m.refLow) status = "BELOW range";
      else if (m.refHigh != null && v > m.refHigh) status = "ABOVE range";
      if (status === "in range") inRange.push(m);
      else flagged.push({ ...m, status });
    }
    if (flagged.length > 0) {
      lines.push("  OUT OF RANGE (factor these into every recommendation):");
      for (const m of flagged) {
        const refStr = m.refLow != null && m.refHigh != null ? `${m.refLow}-${m.refHigh}` : m.refLow != null ? `>${m.refLow}` : m.refHigh != null ? `<${m.refHigh}` : "?";
        lines.push(`    - ${m.name}: ${m.value}${m.unit ? ` ${m.unit}` : ""} [${m.status}, ref ${refStr}]${m.notes ? ` — ${m.notes}` : ""}`);
      }
    }
    if (inRange.length > 0) {
      const names = inRange.slice(0, 30).map((m: any) => `${m.name} ${m.value}${m.unit ? m.unit : ""}`).join(", ");
      lines.push(`  IN RANGE: ${names}${inRange.length > 30 ? `, +${inRange.length - 30} more` : ""}`);
    }
    lines.push("");
  }
  lines.push("PLAN PROFILE:");
  lines.push(`  Goal: ${profile.startWeight ?? "?"}kg @ ${profile.startBF ?? "?"}% BF → ${profile.targetWeight ?? "?"}kg @ ${profile.targetBF ?? "?"}% BF (LBM target ${profile.targetLBM ?? "?"}kg, visceral target ${profile.targetVisceralFat ?? "?"})`);
  lines.push(`  Plan start: ${profile.startDate || profile.planStartDate || "?"}`);
  lines.push(`  Daily targets: gym=${profile.calsGym ?? "?"}kcal, rest=${profile.calsRest ?? "?"}kcal`);
  lines.push(`  Macros: P=${macros.protein ?? "?"}g, C=${macros.carbs ?? "?"}g, F=${macros.fat ?? "?"}g`);
  if (profile.eatingWindow) lines.push(`  Eating window: ${profile.eatingWindow}`);
  if (state.trainingStartDate) lines.push(`  Training anchor: ${state.trainingStartDate} (Upper/Rest/Lower/Rest 4-day cycle)`);
  lines.push("");

  lines.push("WEIGHT (last 14d):");
  if (wl.length === 0) lines.push("  (no entries)");
  else for (const e of wl) lines.push(`  ${e.date}: ${e.weight}kg${e.source ? ` (${e.source})` : ""}`);
  lines.push("");

  lines.push("BODY FAT (last 14d):");
  if (bl.length === 0) lines.push("  (no entries)");
  else for (const e of bl) lines.push(`  ${e.date}: ${e.bf}%${e.source ? ` (${e.source})` : ""}`);
  lines.push("");

  // Phase 29: body composition trends — most important section for LBM preservation
  const cur = latestBodyComp(state);
  const past7 = bodyCompAtDate(state, daysAgoUK(7));
  const past14 = bodyCompAtDate(state, daysAgoUK(14));
  lines.push("BODY COMPOSITION (current + deltas — CRITICAL for fat-loss-with-LBM-preservation goal):");
  lines.push(`  Current: ${cur.weight ?? "?"}kg total · ${cur.bf ?? "?"}% BF · ${cur.lbm ?? "?"}kg LBM · ${cur.fatMass ?? "?"}kg fat mass`);
  if (cur.muscleMass != null) lines.push(`  Muscle mass (Withings): ${cur.muscleMass}kg`);
  if (cur.visceral != null)   lines.push(`  Visceral fat: ${cur.visceral} (lower is better; user has South Asian threshold context if set)`);
  if (cur.hydration != null)  lines.push(`  Hydration: ${cur.hydration}kg (rough indicator only)`);
  if (past7.weight != null && cur.weight != null) {
    const dw = (cur.weight - past7.weight).toFixed(2);
    const dlbm = (past7.lbm != null && cur.lbm != null) ? (cur.lbm - past7.lbm).toFixed(2) : "?";
    const dfat = (past7.fatMass != null && cur.fatMass != null) ? (cur.fatMass - past7.fatMass).toFixed(2) : "?";
    lines.push(`  7-day delta: weight ${dw}kg · LBM ${dlbm}kg · fat mass ${dfat}kg`);
  }
  if (past14.weight != null && cur.weight != null) {
    const dw = (cur.weight - past14.weight).toFixed(2);
    const dlbm = (past14.lbm != null && cur.lbm != null) ? (cur.lbm - past14.lbm).toFixed(2) : "?";
    const dfat = (past14.fatMass != null && cur.fatMass != null) ? (cur.fatMass - past14.fatMass).toFixed(2) : "?";
    lines.push(`  14-day delta: weight ${dw}kg · LBM ${dlbm}kg · fat mass ${dfat}kg`);
  }
  lines.push("");

  lines.push("FOOD INTAKE (last 7d, daily totals):");
  if (foodDays.length === 0) lines.push("  (no entries)");
  else for (const d of foodDays) lines.push(`  ${d.date}: ${d.kcal}kcal P${d.p} C${d.c} F${d.f}`);
  lines.push("");

  lines.push("TRAINING (last 7d, exercise:done/total sets):");
  if (exerciseDays.length === 0) lines.push("  (no sessions)");
  else for (const d of exerciseDays) lines.push(`  ${d.date}: ${d.summary}`);
  lines.push("");

  lines.push("SLEEP (last 7d, stages in minutes — REM/deep matter more than total hours):");
  if (sleepDays.length === 0) lines.push("  (no entries)");
  else for (const s of sleepDays) {
    const stages = (s.remMin != null || s.deepMin != null)
      ? ` · REM ${s.remMin ?? "?"}m · deep ${s.deepMin ?? "?"}m · light ${s.lightMin ?? "?"}m · awake ${s.awakeMin ?? "?"}m`
      : " (stages not captured)";
    lines.push(`  ${s.date}: ${s.hours != null ? `${s.hours}h` : "?"}${s.score != null ? ` score=${s.score}` : ""}${stages}`);
  }
  lines.push("");

  lines.push("RECOVERY (Oura last 7d, scores 0-100; rising HRV + falling RHR = recovering well):");
  let anyRec = false;
  for (let i = 6; i >= 0; i--) {
    const d = daysAgoUK(i);
    const r = recovery[d];
    if (!r) continue;
    anyRec = true;
    const parts = [];
    if (r.readiness != null) parts.push(`readiness=${r.readiness}`);
    if (r.hrv != null) parts.push(`hrv=${r.hrv}`);
    if (r.restingHR != null) parts.push(`rhr=${r.restingHR}`);
    lines.push(`  ${d}: ${parts.join(" · ") || "(no data)"}`);
  }
  if (!anyRec) lines.push("  (no Oura recovery data)");
  lines.push("");

  lines.push("SUPPLEMENT ADHERENCE (last 7d, taken/total):");
  for (const a of suppAdherence) lines.push(`  ${a.date}: ${a.taken}/${a.of}`);
  lines.push("");

  // Phase 29 + 30: Oura activity. NOTE: total_calories ≈ TDEE (BMR + active);
  // active_calories alone is just movement burn above BMR. Use total for TDEE.
  lines.push("DAILY ACTIVITY (last 7d, Oura):");
  let totalCalSum = 0, totalCalDays = 0;
  let activeCalSum = 0, activeCalDays = 0;
  for (let i = 6; i >= 0; i--) {
    const d = daysAgoUK(i);
    const steps = stepsLog[d];
    const cals = calorieLog[d];
    const parts: string[] = [];
    if (steps != null) parts.push(`${steps} steps`);
    if (cals?.total != null) { parts.push(`${cals.total} total kcal (TDEE)`); totalCalSum += cals.total; totalCalDays++; }
    if (cals?.active != null) { parts.push(`${cals.active} active kcal`); activeCalSum += cals.active; activeCalDays++; }
    if (parts.length === 0) continue;
    lines.push(`  ${d}: ${parts.join(" · ")}`);
  }
  if (totalCalDays > 0)  lines.push(`  → 7-day avg TOTAL calories (= Oura TDEE estimate): ${Math.round(totalCalSum / totalCalDays)} kcal/day — use this as primary TDEE`);
  if (activeCalDays > 0) lines.push(`  → 7-day avg ACTIVE calories (movement above BMR only): ${Math.round(activeCalSum / activeCalDays)} kcal/day`);
  lines.push("");

  // Phase 30: SINCE START — current vs plan start absolute progress
  const startDate = profile.startDate || profile.planStartDate;
  if (startDate && profile.startWeight) {
    const cwNow = cur.weight;
    const cbfNow = cur.bf;
    const startW = profile.startWeight;
    const startBF = profile.startBF;
    const startLBM = profile.startLBM;
    const weeksIn = Math.max(0.1, (Date.now() - new Date(startDate + "T12:00:00").getTime()) / (7 * 86400000));
    const dW   = (cwNow != null && startW != null) ? cwNow - startW : null;
    const dBF  = (cbfNow != null && startBF != null) ? cbfNow - startBF : null;
    const dLBM = (cur.lbm != null && startLBM != null) ? cur.lbm - startLBM : null;
    lines.push(`SINCE PLAN START (${startDate}, ${weeksIn.toFixed(1)} weeks in):`);
    if (dW != null)  lines.push(`  Weight: ${startW}kg → ${cwNow}kg (${dW.toFixed(1)}kg, ${(dW / weeksIn).toFixed(2)}kg/wk)`);
    if (dBF != null) lines.push(`  Body fat: ${startBF}% → ${cbfNow}% (${dBF > 0 ? "+" : ""}${dBF.toFixed(1)}pp)`);
    if (dLBM != null) lines.push(`  LBM: ${startLBM}kg → ${cur.lbm}kg (${dLBM > 0 ? "+" : ""}${dLBM.toFixed(2)}kg) — preservation status: ${Math.abs(dLBM) < 0.5 ? "EXCELLENT" : dLBM > 0 ? "GAINING" : dLBM > -1 ? "minor loss" : "concerning loss"}`);
    lines.push("");
  }

  // Phase 30: WEEK-OVER-WEEK comparison — last 7 days vs the 7 days before
  const wk0From = daysAgoUK(6),  wk0To = ukToday();
  const wk1From = daysAgoUK(13), wk1To = daysAgoUK(7);
  const wk0 = periodStats(state, wk0From, wk0To);
  const wk1 = periodStats(state, wk1From, wk1To);
  lines.push("WEEK-OVER-WEEK (last 7d vs the 7d before — did the trend accelerate, hold, or slow?):");
  const wowRow = (label: string, k: keyof typeof wk0, unit: string) => {
    const a = wk0[k] as number | null;
    const b = wk1[k] as number | null;
    if (a == null && b == null) return;
    const delta = (a != null && b != null) ? a - b : null;
    const sign = delta != null ? (delta >= 0 ? "+" : "") : "";
    lines.push(`  ${label}: this week ${a ?? "—"}${unit}, last week ${b ?? "—"}${unit}${delta != null ? ` (Δ ${sign}${delta.toFixed(unit ? 1 : 0)})` : ""}`);
  };
  wowRow("Avg weight",          "avgWeight",        "kg");
  wowRow("Avg body fat",        "avgBF",            "%");
  wowRow("Training sessions",   "trainingSessions", "");
  wowRow("Avg sleep",           "avgSleepHrs",      "h");
  wowRow("Avg steps",           "avgSteps",         "");
  wowRow("Avg TDEE (total kcal)", "avgTotalCal",    " kcal");
  wowRow("Avg food intake",     "avgFoodKcal",      " kcal");
  wowRow("Avg protein",         "avgProtein",       "g");
  lines.push("");

  // Phase 30: MONTHLY ARC — last 30d vs prior 30d (only if data exists)
  const m0From = daysAgoUK(29), m0To = ukToday();
  const m1From = daysAgoUK(59), m1To = daysAgoUK(30);
  const m0 = periodStats(state, m0From, m0To);
  const m1 = periodStats(state, m1From, m1To);
  if (m1.daysWithWeight > 0 || m1.trainingSessions > 0) {
    lines.push("MONTHLY ARC (last 30d vs prior 30d — long-term momentum check):");
    const mowRow = (label: string, k: keyof typeof m0, unit: string) => {
      const a = m0[k] as number | null;
      const b = m1[k] as number | null;
      if (a == null && b == null) return;
      const delta = (a != null && b != null) ? a - b : null;
      const sign = delta != null ? (delta >= 0 ? "+" : "") : "";
      lines.push(`  ${label}: last 30d ${a ?? "—"}${unit}, prior 30d ${b ?? "—"}${unit}${delta != null ? ` (Δ ${sign}${delta.toFixed(unit ? 1 : 0)})` : ""}`);
    };
    mowRow("Avg weight",        "avgWeight",        "kg");
    mowRow("Avg body fat",      "avgBF",            "%");
    mowRow("Training sessions", "trainingSessions", "");
    mowRow("Avg sleep",         "avgSleepHrs",      "h");
    mowRow("Avg TDEE",          "avgTotalCal",      " kcal");
    mowRow("Avg food intake",   "avgFoodKcal",      " kcal");
    mowRow("Avg protein",       "avgProtein",       "g");
    lines.push("");
  }

  // Phase 29: meal-plan adherence
  if (mealPlan?.meals?.length) {
    lines.push("MEAL PLAN ADHERENCE (last 7d — % of planned meals + ingredients actually logged):");
    const plannedMeals = mealPlan.meals;
    for (let i = 6; i >= 0; i--) {
      const d = daysAgoUK(i);
      const dayFoods: any[] = (state.foods || {})[d] || [];
      let mealsLogged = 0, ingsLogged = 0, ingsPlanned = 0;
      for (const m of plannedMeals) {
        const ings = Array.isArray(m.ingredients) ? m.ingredients : [];
        ingsPlanned += ings.length;
        const granular = dayFoods.filter(f => f.mealId === m.id);
        const legacy = dayFoods.find(f => f.name === m.name && !f.mealId);
        if (granular.length > 0 || legacy) mealsLogged++;
        if (granular.length > 0) {
          const ln = new Set(granular.map(f => f.name));
          ingsLogged += ings.filter((ing: any) => ln.has(ing.name)).length;
        } else if (legacy) {
          ingsLogged += ings.length;
        }
      }
      const mealPct = plannedMeals.length ? Math.round((mealsLogged / plannedMeals.length) * 100) : 0;
      const ingPct  = ingsPlanned ? Math.round((ingsLogged / ingsPlanned) * 100) : 0;
      lines.push(`  ${d}: ${mealsLogged}/${plannedMeals.length} meals (${mealPct}%) · ${ingsLogged}/${ingsPlanned} ingredients (${ingPct}%)`);
    }
    lines.push("");
  }

  // Phase 29: training effort distribution
  lines.push("TRAINING EFFORT (last 7d, % of logged sets tagged easy/solid/tough):");
  let easyCount = 0, solidCount = 0, toughCount = 0, totalTagged = 0;
  for (const date of Object.keys(state.exLog || {}).sort()) {
    if (date < cutoff7) continue;
    const exs = state.exLog[date] || {};
    for (const ex of Object.values(exs) as any[]) {
      const sets = Array.isArray(ex?.sets) ? ex.sets : [];
      for (const s of sets) {
        if (s?.effort === "easy")  { easyCount++; totalTagged++; }
        else if (s?.effort === "solid") { solidCount++; totalTagged++; }
        else if (s?.effort === "tough") { toughCount++; totalTagged++; }
      }
    }
  }
  if (totalTagged === 0) lines.push("  (no effort tags in last 7d — user is not rating sets)");
  else {
    const p = (n: number) => Math.round((n / totalTagged) * 100);
    lines.push(`  ${totalTagged} tagged sets: easy ${p(easyCount)}% · solid ${p(solidCount)}% · tough ${p(toughCount)}%`);
    lines.push(`  → ${easyCount > toughCount * 2 ? "Skewed easy — could push harder" : toughCount > easyCount * 2 ? "Skewed tough — possible under-recovery or weight too high" : "Balanced effort distribution"}`);
  }
  lines.push("");

  // Phase 29: previous coaching reports (memory)
  const prevReports = (state.coachingReports || []).slice(0, 4);
  if (prevReports.length > 0) {
    lines.push("PREVIOUS REPORTS (your last 4 — reference them to build on advice, don't repeat yourself):");
    for (const r of prevReports) {
      const dt = (r.createdAt || "").slice(0, 10);
      lines.push(`  [${dt}] "${r.title}"`);
      // Trim content to a digestible summary
      const contentPreview = String(r.content || "").replace(/\s+/g, " ").slice(0, 400);
      lines.push(`    Content: ${contentPreview}${contentPreview.length >= 400 ? "..." : ""}`);
      if (Array.isArray(r.suggestions) && r.suggestions.length > 0) {
        const applied = r.suggestions.filter((s: any) => s.applied);
        const dismissed = r.suggestions.filter((s: any) => s.dismissed);
        const pending = r.suggestions.filter((s: any) => !s.applied && !s.dismissed);
        lines.push(`    Suggestions: ${applied.length} applied, ${dismissed.length} dismissed, ${pending.length} pending`);
        for (const s of applied)   lines.push(`      ✓ APPLIED  · ${s.type} · ${s.label}`);
        for (const s of dismissed) lines.push(`      ✕ DISMISSED · ${s.type} · ${s.label}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are Forge's weekly coach. You write concise, specific, actionable weekly reviews for a user on a structured fat-loss / recomp plan.

THE USER'S GOAL (read every report through this lens):
- Read the user's CURRENT PHASE from the DEMOGRAPHICS block:
  * cut          → fat loss with LBM preservation. Target LBM ≈ current LBM.
  * recomp       → simultaneous fat loss + small LBM gain. Slow deficit (~10-15%), high protein, hard training.
  * lean-bulk    → controlled surplus (~10-15%). Slow LBM gain (~0.3kg/month max for trained users past 50). Watch fat gain.
  * maintenance  → hold current. Recovery + small recomposition.
  * If phase not set: assume cut.
- If the user has a STRETCH LBM GOAL set, the long-arc objective is "maximum lean mass at target BF%", not just hitting weight + BF numbers. Frame multi-month strategy through this lens — current phase is one step toward the LBM ceiling.
- The single most important metric every week is the LBM delta. If LBM drops > 0.3kg/week for 2+ weeks running, flag it URGENTLY. Likely cause: deficit too aggressive, protein too low, or training stimulus too low.
- Never credit "weight loss" without checking LBM. "Down 1.1kg this week" is meaningless until you know fat-mass-delta vs LBM-delta. Report both.

DATA YOU NOW HAVE (Phase 29):
1. BODY COMPOSITION (current + 7d/14d deltas) — your primary lens
2. DEMOGRAPHICS (age, height, sex, ethnicity, activity level)
3. MEDICATIONS (with user notes) — factor into every interpretation
4. WEIGHT, BODY FAT logs (Withings sync)
5. FOOD INTAKE daily totals + MEAL PLAN ADHERENCE (% planned meals + ingredients logged per day)
6. TRAINING log + EFFORT DISTRIBUTION (% sets tagged easy/solid/tough across last 7d)
7. SLEEP with stages (REM/deep/light/awake minutes) — REM + deep matter more than total hours
8. OURA RECOVERY (readiness, HRV, RHR)
9. DAILY ACTIVITY (steps + Oura active calories — active cals is the most accurate TDEE input you have)
10. SUPPLEMENT ADHERENCE
11. PREVIOUS COACHING REPORTS (last 4 with their suggestions + apply/dismiss status) — your memory

INTERPRETATION RULES:
- Use Oura TOTAL calories (labelled "TDEE" in the data) as primary TDEE input. Mifflin-St Jeor is a fallback. ACTIVE calories alone is movement burn above BMR, NOT TDEE — never use active cals as TDEE.
- Reference SINCE PLAN START in every "This week" section ("X weeks in, Yg/kg down, LBM preservation status"). Frame the cut as a multi-month arc, not a week-to-week slog.
- Use WEEK-OVER-WEEK to characterise trend direction: rate "accelerated", "held", "slowed", or "stalled" relative to the previous 7 days. Cite both numbers.
- Use MONTHLY ARC (if present) to flag whether momentum is rising or fading over the longer arc.
- Sleep: deep < 45 min or REM < 60 min = poor quality even if hours are fine. Reference stages, not just totals.
- Effort tags: >50% easy + no tough = sandbagging (push harder). >40% tough = under-recovery or weights too high.
- Meal plan adherence: <70% on multiple days = the plan doesn't fit life, not a discipline problem. Suggest a swap, not a guilt trip.
- MEMORY: reference what you said in previous reports. If you suggested a change 2-4 weeks ago and the user applied it, explicitly evaluate whether it worked. If they dismissed it, don't suggest it again unless data has changed materially. DO NOT repeat advice from prior reports without acknowledging the prior recommendation.
- BLOOD MARKERS (use the latest panel as clinical ground truth):
  - HbA1c > 48 = pre-diabetic, > 48-58 = newly diagnosed type 2, > 58 = established diabetes. If HbA1c is diabetic-range, LOW-GI carbs are NON-NEGOTIABLE — frame it as essential, not a preference. Recommend re-test in 3 months. Acknowledge GLP-1 and Metformin are working together to bring this down.
  - ALT > 56 IU/L = elevated liver enzyme; commonly fatty liver / metabolic strain. Coach should expect ALT to drop as body fat falls. Recommend keeping alcohol minimal and re-check at next panel. Don't suggest extra protein supplements (whey/casein) at very high doses — let dietary protein lead.
  - Testosterone < 12 nmol/L (or below user's age-adjusted optimal) = sub-optimal. Coach should emphasize: protect LBM (do not lose it), prioritize sleep quality (Oura deep > 60 min target), maintain resistance training intensity. Lower T makes muscle preservation harder, so the LBM-watch rule applies double.
  - SHBG low = insulin resistance pattern, reinforces low-GI guidance.
  - Vitamin D < 50 nmol/L = insufficient. If user takes 4000 IU and still under 50, recommend 5000 IU until > 75 (with safety caveat to check with GP).
  - HDL < 1.0 mmol/L = low; usually rises with cardio + body comp improvement.
  - Triglycerides > 1.7 mmol/L = elevated; carb intake and alcohol-sensitive.
  - hsCRP > 1 mg/L = low-grade inflammation; chronic if persistent. Recommend re-check in 3 months and flag persistently > 3 as worth GP discussion.
  - Ferritin > 30 ng/mL = adequate iron; > 200 with elevated CRP = possible inflammation, not iron overload.
  - Always cite the date of the panel ("from your 08/05/2026 panel: ..."). If the panel is > 6 months old, recommend a re-test.
  - NEVER make a definitive medical diagnosis. Frame everything as "consistent with X, recommend GP discussion" not "you have X".
- MEDICATIONS (factor every week):
  - GLP-1 agonists (Mounjaro / Ozempic / Wegovy / semaglutide / tirzepatide): non-linear weight curves, plateau-then-re-accelerate on dose escalations. Injection-day weight differs systematically from mid-cycle. Don't credit week 1 or panic week 3.
  - Statins: muscle soreness common — factor into training feedback before suggesting volume bumps.
  - Metformin: GI tolerance, slight insulin sensitivity boost, mild appetite effect.
  - Other meds: read user notes carefully and apply common sense.
- Ethnicity: South Asian visceral fat threshold ≥ 7 = elevated risk (vs ≥ 10 for European baseline). Calibrate visceral commentary accordingly.
- Training split (Upper/Rest/Lower/Rest 4-day) is FIXED. Don't suggest split changes. Inside the split, you can suggest volume / intensity tweaks.

OUTPUT FORMAT:
1. Markdown REPORT under 450 words. Sections: ## This week, ## What's working, ## What to fix, ## Next week focus.
   - "This week" must include: weight delta, FAT MASS delta, LBM delta, plus standout numbers from sleep / training / adherence.
   - Always reference previous reports when relevant ("3 weeks ago I suggested X, you applied it, results: ...").
   - End with a realistic timeline ("at current rate you hit 90kg ≈ <month year>"). Compute this honestly from the 14-day weight trend.
2. Optional SUGGESTIONS — concrete one-tap changes. Only when clearly supported by data. If on track, output empty array. Never repeat a dismissed suggestion without new justification.

Suggestion types:
- "macros": adjust daily calorie/macro targets. Payload keys (any subset): calsGym, calsRest, protein, carbs, fat. Only suggest if 7-day average is off target rate by >0.2kg/wk AND it isn't explained by medication timing.
- "reminders": add/change a reminder. Payload: { action: "add" | "remove", reminder: { time: "HH:MM", text: string, days?: number[] } }.
- "note": directional nudge that doesn't change app state. Payload: {}.

Be direct. Cite the actual numbers. The user wants a coach, not a chatbot.`;

interface Suggestion {
  id: string;
  type: "macros" | "reminders" | "note";
  label: string;
  rationale: string;
  payload: any;
  applied: boolean;
  dismissed: boolean;
}

export interface GeneratedReport {
  title: string;
  content: string;
  dateRange: string;
  suggestions: Suggestion[];
}

export async function generateWeeklyReport(userId: string): Promise<GeneratedReport> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  const encKey = state.coachingKey as string | undefined;
  if (!encKey) throw new Error("No Anthropic API key configured. Set one in Forge settings.");

  let apiKey: string;
  try { apiKey = decrypt(encKey); }
  catch { throw new Error("Failed to decrypt stored API key — re-enter it in settings."); }

  const context = buildContext(state);
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [{
      name: "submit_report",
      description: "Submit the weekly coaching report and any suggestions.",
      input_schema: {
        type: "object" as const,
        properties: {
          title: { type: "string", description: "Short title for the report card (e.g. 'Week of May 11')" },
          content: { type: "string", description: "Markdown body of the report. Use ## headings." },
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["macros", "reminders", "note"] },
                label: { type: "string", description: "One-line summary shown on the Apply button row" },
                rationale: { type: "string", description: "1-2 sentence justification referencing the data" },
                payload: { type: "object", description: "Type-specific change payload, see system prompt" },
              },
              required: ["type", "label", "rationale", "payload"],
            },
          },
        },
        required: ["title", "content", "suggestions"],
      },
    }],
    tool_choice: { type: "tool", name: "submit_report" },
    messages: [{
      role: "user",
      content: `Here is the user's current state and the last 14 days of data. Write this week's coaching report.\n\n${context}`,
    }],
  });

  const toolBlock = response.content.find((b: any) => b.type === "tool_use") as any;
  if (!toolBlock) throw new Error("Model did not return a structured report");
  const input = toolBlock.input as { title: string; content: string; suggestions: any[] };

  const now = Date.now();
  const suggestions: Suggestion[] = (input.suggestions || []).map((s, i) => ({
    id: `sug_${now}_${i}`,
    type: s.type,
    label: String(s.label || ""),
    rationale: String(s.rationale || ""),
    payload: s.payload || {},
    applied: false,
    dismissed: false,
  }));

  const dateRange = `${daysAgoUK(6)} to ${ukToday()}`;
  return {
    title: input.title || `Week of ${ukToday()}`,
    content: input.content || "",
    dateRange,
    suggestions,
  };
}

export async function saveReport(userId: string, report: GeneratedReport): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  const reports = state.coachingReports || [];
  const id = "rpt_" + Date.now();
  reports.unshift({
    id,
    createdAt: new Date().toISOString(),
    type: "weekly",
    title: report.title,
    content: report.content,
    dateRange: report.dateRange,
    suggestions: report.suggestions,
    generatedBy: "forge-byok",
  });
  if (reports.length > 50) reports.length = 50;
  state.coachingReports = reports;
  state.lastCoachingReportAt = new Date().toISOString();
  await prisma.user.update({ where: { id: userId }, data: { state } });
  return id;
}

export function hoursSinceLastReport(state: any): number {
  const last = state.lastCoachingReportAt;
  if (!last) return Infinity;
  return (Date.now() - new Date(last).getTime()) / 3600000;
}

export function hoursSinceLastPlanRegen(state: any): number {
  const last = state.lastMealPlanRegenAt;
  if (!last) return Infinity;
  return (Date.now() - new Date(last).getTime()) / 3600000;
}

// --- Phase 26: meal plan generation ---

const PLAN_SYSTEM_PROMPT = `You generate weekly meal plans for Forge users on a structured fat-loss / recomp plan.

HARD RULES (violations = rejected by server):
- Respect the user's exclusion list literally — if a food is excluded, do NOT include it in any form (e.g. excluded "beef" → no beef, no steak, no mince, no burger)
- If the user notes say "low-GI", carbs MUST be low-GI only: oats, brown rice, sweet potato, lentils, beans, chickpeas, quinoa, wholegrain pasta, barley. NEVER white rice, white bread, sugar, fruit juice, regular potato, corn flakes
- Items stay STABLE across the week — same ingredients each day (the user has a chef who batch-preps). Portions can vary by day, but the item list is constant
- Hit the daily calorie + macro targets within ±150 kcal and ±15g per macro
- Each ingredient MUST include exact macro estimates (cals, protein, carbs, fat)
- Ingredient macros MUST sum to the meal's totals within ±5 kcal / ±2g per macro

STRUCTURE:
- 5 meals across the eating window (default 12:00 to 18:00 UK)
- Use stable kebab-case meal ids: breakfast, mid-meal, pre-workout, dinner, evening
- Place supplements (from the user's supplement list) into the appropriate meals
- Name meals descriptively: "Breakfast: Eggs & Oats", "Pre-workout: Chicken & Sweet Potato", etc.

Aim for variety in textures/flavors across the 5 meals while keeping items stable through the week. Use foods the user has logged before when possible — they evidently like them.`;

export interface GeneratedMealPlan {
  name: string;
  meals: Array<{
    id: string;
    name: string;
    time: string;
    cals: number; protein: number; carbs: number; fat: number;
    ingredients: Array<{ name: string; cals: number; protein: number; carbs: number; fat: number }>;
    supplements?: Array<{ id: string; name: string; dose?: string }>;
  }>;
}

export function validateMealPlanAgainstExclusions(plan: any, excluded: string[]): { ok: boolean; error?: string } {
  if (!plan || typeof plan !== "object") return { ok: false, error: "plan must be an object" };
  if (!Array.isArray(plan.meals) || plan.meals.length === 0) return { ok: false, error: "plan.meals must be a non-empty array" };
  const exLower = (excluded || []).map((e) => String(e).toLowerCase().trim()).filter(Boolean);
  for (const m of plan.meals) {
    if (!Array.isArray(m.ingredients)) return { ok: false, error: `meal "${m.name || m.id}" missing ingredients[]` };
    for (const ing of m.ingredients) {
      const name = String(ing.name || "").toLowerCase();
      for (const ex of exLower) {
        if (name.includes(ex)) return { ok: false, error: `excluded food "${ex}" appears in ingredient "${ing.name}"` };
      }
    }
  }
  return { ok: true };
}

function buildPlanContext(state: any): string {
  const profile = state.profile || {};
  const macros = profile.macros || {};
  const prefs = profile.foodPrefs || {};
  const supps = state.supps || [];
  const cutoff14 = (() => { const d = new Date(); d.setDate(d.getDate() - 14); return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d); })();

  // Recent intake patterns — what does the user actually eat?
  const ingredientFreq: Record<string, number> = {};
  for (const date of Object.keys(state.foods || {}).sort()) {
    if (date < cutoff14) continue;
    for (const f of (state.foods[date] || [])) {
      const key = String(f.name || "").trim();
      if (key) ingredientFreq[key] = (ingredientFreq[key] || 0) + 1;
    }
  }
  const topFoods = Object.entries(ingredientFreq).sort((a, b) => b[1] - a[1]).slice(0, 20);

  const lines: string[] = [];
  lines.push("USER PROFILE:");
  lines.push(`  Daily target: gym day=${profile.calsGym ?? "?"}kcal, rest day=${profile.calsRest ?? "?"}kcal`);
  lines.push(`  Macros (daily): P=${macros.protein ?? "?"}g, C=${macros.carbs ?? "?"}g, F=${macros.fat ?? "?"}g`);
  lines.push(`  Eating window: ${profile.eatingWindow || "12:00 to 18:00 UK"}`);
  lines.push("");
  lines.push("FOOD PREFERENCES:");
  const excl = prefs.excluded || [];
  lines.push(`  EXCLUDED (do NOT include any of these): ${excl.length ? excl.join(", ") : "(none specified)"}`);
  lines.push(`  Notes from user: ${prefs.notes || "(none)"}`);
  lines.push("");
  lines.push("SUPPLEMENTS (place in appropriate meals):");
  if (supps.length === 0) lines.push("  (none configured)");
  else for (const s of supps) lines.push(`  - ${s.id}: ${s.name}${s.dose ? ` (${s.dose})` : ""}${s.time ? ` @ ${s.time}` : ""}${s.mealId ? ` [linked to ${s.mealId}]` : ""}`);
  lines.push("");
  lines.push("FOODS THE USER ACTUALLY EATS (last 14 days, by frequency — reuse where possible):");
  if (topFoods.length === 0) lines.push("  (no logged intake yet)");
  else for (const [name, n] of topFoods) lines.push(`  ${n}× ${name}`);
  lines.push("");
  lines.push("CURRENT PLAN (for reference — keep what's working, change what isn't):");
  const cur = state.mealPlan;
  if (!cur) lines.push("  (no plan yet)");
  else {
    lines.push(`  Name: ${cur.name || "?"}`);
    for (const m of (cur.meals || [])) {
      lines.push(`  ${m.time || "?"} · ${m.name} · ${m.cals}kcal P${m.protein} C${m.carbs} F${m.fat}`);
      for (const ing of (m.ingredients || [])) lines.push(`    - ${ing.name}`);
    }
  }

  return lines.join("\n");
}

export async function generateMealPlan(userId: string): Promise<GeneratedMealPlan> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  const encKey = state.coachingKey as string | undefined;
  if (!encKey) throw new Error("No Anthropic API key configured");
  let apiKey: string;
  try { apiKey = decrypt(encKey); }
  catch { throw new Error("Failed to decrypt stored API key"); }

  const context = buildPlanContext(state);
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: PLAN_SYSTEM_PROMPT,
    tools: [{
      name: "submit_meal_plan",
      description: "Submit the new weekly meal plan.",
      input_schema: {
        type: "object" as const,
        properties: {
          name: { type: "string", description: "Short plan name, e.g. 'Cut V8 — Low GI Chicken/Plant'" },
          meals: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "Stable kebab-case id: breakfast, mid-meal, pre-workout, dinner, evening" },
                name: { type: "string" },
                time: { type: "string", description: "HH:MM 24h, within user's eating window" },
                cals: { type: "number" }, protein: { type: "number" }, carbs: { type: "number" }, fat: { type: "number" },
                ingredients: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      cals: { type: "number" }, protein: { type: "number" }, carbs: { type: "number" }, fat: { type: "number" },
                    },
                    required: ["name", "cals", "protein", "carbs", "fat"],
                  },
                },
                supplements: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" }, name: { type: "string" }, dose: { type: "string" },
                    },
                    required: ["id", "name"],
                  },
                },
              },
              required: ["id", "name", "time", "cals", "protein", "carbs", "fat", "ingredients"],
            },
          },
        },
        required: ["name", "meals"],
      },
    }],
    tool_choice: { type: "tool", name: "submit_meal_plan" },
    messages: [{ role: "user", content: `Generate a new weekly meal plan based on this profile and recent intake.\n\n${context}` }],
  });

  const toolBlock = response.content.find((b: any) => b.type === "tool_use") as any;
  if (!toolBlock) throw new Error("Model did not return a structured plan");
  const plan = toolBlock.input as GeneratedMealPlan;

  const excluded = (state.profile?.foodPrefs?.excluded) || [];
  const v = validateMealPlanAgainstExclusions(plan, excluded);
  if (!v.ok) throw new Error("Generated plan failed validation: " + v.error);

  return plan;
}

// --- Phase 33: per-session AI brief + post-session reflection (Haiku 4.5) ---

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

const SESSION_BRIEF_SYSTEM = `You write a pre-workout brief for someone about to start training.

Output (via submit_brief tool):
1. "strategy" — 2-3 sentences setting today's tone. Reference the most signal-rich 1-2 items from today's recovery, last night's sleep, or yesterday's protein. Tie it to the user's phase + goal.
2. "perExercise" — one short cue per exercise. ONE SENTENCE. Form cue, rep target focus, or push/pull-back guidance.

CRITICAL RULES:
- The kg/reps prescriptions come from a separate progression formula. DO NOT change them. Your job is to add the WHY and HOW, not new numbers.
- Use the user's exId values exactly as given.
- Reference specific data — last session's reps, last night's hours, today's HRV. Never generic "stay hydrated" platitudes.
- Direct tone, like a knowledgeable training partner. No motivational fluff.
- Mention medications (GLP-1, statin) only when relevant to today.
- Keep total output under 200 words.`;

const SESSION_REFLECTION_SYSTEM = `You write ONE short sentence acknowledging what the user just completed in their training session.

Compare what was completed to recent norms. Call out PRs, missed sets, surprises. Direct, no fluff. 1 sentence only. No emojis.`;

interface SessionBrief {
  strategy: string;
  perExercise: Array<{ exId: string; cue: string }>;
}

export async function generateSessionBrief(
  userId: string,
  sessionType: string,
  prescriptions: Array<{ exId: string; name: string; kg?: number; reps?: number | string; seconds?: number; deload?: boolean; recovery?: string }>,
): Promise<SessionBrief> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  const encKey = state.coachingKey as string | undefined;
  if (!encKey) throw new Error("No Anthropic API key configured");
  let apiKey: string;
  try { apiKey = decrypt(encKey); }
  catch { throw new Error("Failed to decrypt API key"); }

  const today = ukToday();
  const yesterday = daysAgoUK(1);
  const profile = state.profile || {};
  const personal = profile.personal || {};
  const recovery = state.recovery || {};
  const sleepLog = state.sleepLog || {};
  const exLog = state.exLog || {};
  const todayRec = recovery[today] || {};
  const lastSleep = sleepLog[today] || sleepLog[yesterday] || {};
  const yFoods = (state.foods || {})[yesterday] || [];
  const yProtein = yFoods.reduce((s: number, f: any) => s + (+f.protein || 0), 0);
  const yKcal = yFoods.reduce((s: number, f: any) => s + (+f.cals || 0), 0);

  // Last 2 sessions of the same type (compact summary)
  const sameTypeDates = Object.keys(exLog).filter((d) => d < today).sort().reverse().slice(0, 5);
  const recentSessions: string[] = [];
  for (const d of sameTypeDates) {
    const dayLog = exLog[d] || {};
    const ids = Object.keys(dayLog);
    if (ids.length === 0) continue;
    // Only include if it looks like the same body region (check if any prescribed exId appears)
    const presIds = new Set(prescriptions.map((p) => p.exId));
    if (!ids.some((id) => presIds.has(id))) continue;
    const exSummaries = ids
      .filter((id) => dayLog[id]?.sets?.length > 0 && presIds.has(id))
      .slice(0, 8)
      .map((id) => {
        const sets = (dayLog[id].sets || []).filter((s: any) => s.kg || s.reps || s.seconds);
        const txt = sets.map((s: any) => s.seconds ? `${s.seconds}s` : `${s.kg || '-'}×${s.reps || '-'}`).join(',');
        return `${id}:${txt}`;
      })
      .join(' · ');
    recentSessions.push(`${d}: ${exSummaries}`);
    if (recentSessions.length >= 2) break;
  }

  const lines: string[] = [];
  lines.push(`SESSION: ${sessionType.toUpperCase()} BODY · ${today}`);
  lines.push("");
  lines.push("USER:");
  if (personal.age) lines.push(`  ${personal.age}yo ${personal.sex || ''}, phase: ${personal.phase || 'cut'}`);
  if (profile.targetWeight && profile.targetBF) lines.push(`  Goal: ${profile.targetWeight}kg @ ${profile.targetBF}% BF${personal.targetLBMStretch ? ` (stretch LBM target ${personal.targetLBMStretch}kg)` : ''}`);
  const meds = (profile.medications || []).map((m: any) => m.name).filter(Boolean);
  if (meds.length > 0) lines.push(`  Medications: ${meds.join(', ')}`);
  // Highlight notable blood markers
  const bm = profile.bloodMarkers || [];
  const flagged = bm.filter((m: any) => m.value != null && ((m.refHigh != null && m.value > m.refHigh) || (m.refLow != null && m.value < m.refLow)))
    .slice(0, 5).map((m: any) => `${m.name} ${m.value}${m.unit || ''}`).join(', ');
  if (flagged) lines.push(`  Out-of-range markers: ${flagged}`);
  lines.push("");

  lines.push("TODAY:");
  const rcv: string[] = [];
  if (todayRec.readiness != null) rcv.push(`readiness ${todayRec.readiness}`);
  if (todayRec.hrv != null) rcv.push(`HRV ${todayRec.hrv}`);
  if (todayRec.restingHR != null) rcv.push(`RHR ${todayRec.restingHR}`);
  if (rcv.length) lines.push(`  Recovery: ${rcv.join(' · ')}`);
  if (lastSleep.hours != null) {
    const stages = (lastSleep.remMin != null || lastSleep.deepMin != null) ? ` (REM ${lastSleep.remMin ?? '?'}m, deep ${lastSleep.deepMin ?? '?'}m)` : '';
    lines.push(`  Sleep last night: ${lastSleep.hours}h${stages}`);
  }
  if (yProtein > 0) lines.push(`  Yesterday's intake: ${yKcal}kcal, ${yProtein}g protein`);
  lines.push("");

  lines.push("TODAY'S PRESCRIPTIONS (formula-computed — DO NOT change):");
  for (const p of prescriptions) {
    const target = p.seconds ? `${p.seconds}s` : (p.kg != null ? `${p.kg}kg × ${p.reps} reps` : '—');
    const flags: string[] = [];
    if (p.deload) flags.push('DELOAD');
    if (p.recovery === 'low') flags.push('HOLD (low recovery)');
    lines.push(`  ${p.exId} ${p.name}: ${target}${flags.length ? ' [' + flags.join(', ') + ']' : ''}`);
  }
  lines.push("");

  if (recentSessions.length > 0) {
    lines.push("RECENT SAME-TYPE SESSIONS (for context):");
    for (const r of recentSessions) lines.push(`  ${r}`);
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 1500,
    system: SESSION_BRIEF_SYSTEM,
    tools: [{
      name: "submit_brief",
      description: "Submit the session brief.",
      input_schema: {
        type: "object" as const,
        properties: {
          strategy: { type: "string", description: "2-3 sentences setting today's tone" },
          perExercise: {
            type: "array",
            items: {
              type: "object",
              properties: {
                exId: { type: "string", description: "Must match an exId from the prescriptions list" },
                cue: { type: "string", description: "One short sentence cue" },
              },
              required: ["exId", "cue"],
            },
          },
        },
        required: ["strategy", "perExercise"],
      },
    }],
    tool_choice: { type: "tool", name: "submit_brief" },
    messages: [{ role: "user", content: lines.join("\n") }],
  });

  const toolBlock = response.content.find((b: any) => b.type === "tool_use") as any;
  if (!toolBlock) throw new Error("Model did not return a structured brief");
  return toolBlock.input as SessionBrief;
}

export async function generateSessionReflection(
  userId: string,
  sessionType: string,
  completedSession: Record<string, any>,
): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  const encKey = state.coachingKey as string | undefined;
  if (!encKey) throw new Error("No Anthropic API key configured");
  let apiKey: string;
  try { apiKey = decrypt(encKey); }
  catch { throw new Error("Failed to decrypt API key"); }

  const summary = Object.entries(completedSession || {}).map(([exId, log]: [string, any]) => {
    const sets = ((log && log.sets) || []).filter((s: any) => s.kg || s.reps || s.seconds);
    if (sets.length === 0) return null;
    const txt = sets.map((s: any) => s.seconds ? `${s.seconds}s` : `${s.kg || '-'}×${s.reps || '-'}${s.effort ? `(${s.effort})` : ''}`).join(', ');
    return `${exId}: ${txt}`;
  }).filter(Boolean).join('\n');

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 200,
    system: SESSION_REFLECTION_SYSTEM,
    messages: [{ role: "user", content: `Session type: ${sessionType.toUpperCase()}\n\nCompleted:\n${summary || '(nothing logged)'}` }],
  });

  const textBlock = response.content.find((b: any) => b.type === "text") as any;
  return (textBlock?.text || "Session complete.").trim();
}

// --- Phase 32: realistic max LBM projection ---

const MAX_LBM_SYSTEM = `You are a sports physiologist analysing a single user's realistic upper bound for lean body mass (LBM).

Your job:
1. Compute a HONEST, evidence-based projection of this user's realistic LBM ceiling over 24 months.
2. Account for: age (sarcopenia), sex, current LBM + training tier, blood markers (especially testosterone, HbA1c), medications (especially GLP-1 agonists which can blunt lean mass gain), training history.
3. Give three scenarios — conservative, realistic, optimistic — with kg LBM targets and resulting body weight at 15% BF.
4. Be honest about constraints. Older lifters past 50 gain LBM at ~0.3-0.5kg/month MAX during dedicated build phases. Low testosterone slows this further. GLP-1 medications during weight loss can cause modest lean mass loss.
5. Recommend a phase sequence (cut → recomp → lean bulk → cut again, or similar).
6. Cite numbers from the user's data — do not generalise.`;

export interface MaxLBMProjection {
  conservativeLBM: number;
  realisticLBM: number;
  optimisticLBM: number;
  conservativeWeightAt15: number;
  realisticWeightAt15: number;
  optimisticWeightAt15: number;
  timelineMonths: number;
  phaseSequence: string;
  rationale: string;
  keyConstraints: string[];
}

export async function computeMaxLBM(userId: string): Promise<MaxLBMProjection> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  const encKey = state.coachingKey as string | undefined;
  if (!encKey) throw new Error("No Anthropic API key configured");
  let apiKey: string;
  try { apiKey = decrypt(encKey); }
  catch { throw new Error("Failed to decrypt API key"); }

  const context = buildContext(state);
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: MAX_LBM_SYSTEM,
    tools: [{
      name: "submit_max_lbm",
      description: "Submit the realistic LBM projection.",
      input_schema: {
        type: "object" as const,
        properties: {
          conservativeLBM: { type: "number", description: "LBM kg in 'preservation-only' scenario" },
          realisticLBM:    { type: "number", description: "LBM kg in 'realistic best-case' scenario with good adherence" },
          optimisticLBM:   { type: "number", description: "LBM kg in 'optimistic scenario' — best case without unrealistic assumptions" },
          conservativeWeightAt15: { type: "number", description: "Total weight at 15% BF in conservative scenario" },
          realisticWeightAt15:    { type: "number" },
          optimisticWeightAt15:   { type: "number" },
          timelineMonths: { type: "number", description: "Months from now to reach realistic scenario" },
          phaseSequence: { type: "string", description: "Recommended phase sequence, e.g. 'Cut 6mo → recomp 3mo → lean bulk 6mo → mini-cut 2mo'" },
          rationale: { type: "string", description: "1-paragraph explanation citing the user's specific data" },
          keyConstraints: { type: "array", items: { type: "string" }, description: "3-5 specific factors limiting this user's ceiling" },
        },
        required: ["conservativeLBM", "realisticLBM", "optimisticLBM", "conservativeWeightAt15", "realisticWeightAt15", "optimisticWeightAt15", "timelineMonths", "phaseSequence", "rationale", "keyConstraints"],
      },
    }],
    tool_choice: { type: "tool", name: "submit_max_lbm" },
    messages: [{ role: "user", content: `Analyse this user's data and project their realistic LBM ceiling.\n\n${context}` }],
  });

  const toolBlock = response.content.find((b: any) => b.type === "tool_use") as any;
  if (!toolBlock) throw new Error("Model did not return a structured projection");
  return toolBlock.input as MaxLBMProjection;
}

export async function saveMealPlan(userId: string, plan: GeneratedMealPlan): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  state.mealPlan = plan;
  state.lastMealPlanRegenAt = new Date().toISOString();
  await prisma.user.update({ where: { id: userId }, data: { state } });
}

// --- Phase 26a: recompute macros for existing items (keeps items, fills correct macros) ---

const MACRO_RECOMPUTE_SYSTEM = `You are a nutrition database. For each food item provided, return accurate macro estimates using standard UK supermarket / USDA reference values.

Rules:
- For mixed items ("3 eggs + 6 egg whites scrambled with 1 tsp olive oil"), compute the TOTAL for the combined portion as written.
- For raw weights ("200g raw chicken breast"), use raw values.
- For cooked weights, use cooked values.
- For prepared dishes, sum the components.
- Be precise to within ±5% of canonical reference values.
- Round to whole numbers.`;

export async function recomputeMealPlanMacros(userId: string): Promise<{ updated: number; total: number; skipped: number }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  if (!state.mealPlan?.meals?.length) throw new Error("No meal plan to update");
  const encKey = state.coachingKey as string | undefined;
  if (!encKey) throw new Error("No Anthropic API key configured");
  let apiKey: string;
  try { apiKey = decrypt(encKey); }
  catch { throw new Error("Failed to decrypt API key"); }

  // Collect all non-edited ingredients across all meals
  type Slot = { mealIdx: number; ingIdx: number; name: string };
  const slots: Slot[] = [];
  let skipped = 0;
  state.mealPlan.meals.forEach((m: any, mi: number) => {
    if (!Array.isArray(m.ingredients)) return;
    m.ingredients.forEach((ing: any, ii: number) => {
      if (ing.edited) { skipped++; return; }
      if (!ing.name) return;
      slots.push({ mealIdx: mi, ingIdx: ii, name: String(ing.name) });
    });
  });

  if (slots.length === 0) return { updated: 0, total: 0, skipped };

  const client = new Anthropic({ apiKey });
  const itemsList = slots.map((s, i) => `${i + 1}. ${s.name}`).join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: MACRO_RECOMPUTE_SYSTEM,
    tools: [{
      name: "submit_macros",
      description: "Submit per-item macros, one entry per input item.",
      input_schema: {
        type: "object" as const,
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                index: { type: "number", description: "1-based input index, must match the prompt numbering" },
                cals: { type: "number" },
                protein: { type: "number" },
                carbs: { type: "number" },
                fat: { type: "number" },
              },
              required: ["index", "cals", "protein", "carbs", "fat"],
            },
          },
        },
        required: ["items"],
      },
    }],
    tool_choice: { type: "tool", name: "submit_macros" },
    messages: [{ role: "user", content: `Compute exact macros per item:\n\n${itemsList}` }],
  });

  const toolBlock = response.content.find((b: any) => b.type === "tool_use") as any;
  if (!toolBlock) throw new Error("Model did not return structured macros");
  const result = toolBlock.input as { items: Array<{ index: number; cals: number; protein: number; carbs: number; fat: number }> };

  const newPlan = JSON.parse(JSON.stringify(state.mealPlan));
  let updated = 0;
  for (const item of result.items) {
    const slot = slots[item.index - 1];
    if (!slot) continue;
    const ing = newPlan.meals[slot.mealIdx].ingredients[slot.ingIdx];
    if (ing.edited) continue;
    ing.cals    = Math.max(0, Math.round(item.cals    || 0));
    ing.protein = Math.max(0, Math.round(item.protein || 0));
    ing.carbs   = Math.max(0, Math.round(item.carbs   || 0));
    ing.fat     = Math.max(0, Math.round(item.fat     || 0));
    updated++;
  }

  // Recompute meal totals from ingredients
  for (const meal of newPlan.meals) {
    if (!Array.isArray(meal.ingredients)) continue;
    meal.cals    = meal.ingredients.reduce((s: number, i: any) => s + (i.cals    || 0), 0);
    meal.protein = meal.ingredients.reduce((s: number, i: any) => s + (i.protein || 0), 0);
    meal.carbs   = meal.ingredients.reduce((s: number, i: any) => s + (i.carbs   || 0), 0);
    meal.fat     = meal.ingredients.reduce((s: number, i: any) => s + (i.fat     || 0), 0);
  }

  state.mealPlan = newPlan;
  state.lastMealPlanRegenAt = new Date().toISOString();
  await prisma.user.update({ where: { id: userId }, data: { state } });

  return { updated, total: slots.length, skipped };
}
