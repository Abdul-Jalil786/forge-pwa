// Phase 48: adaptive nutrition engine — PURE, deterministic, testable.
// Works out the user's REAL energy burn (TDEE) from what they actually ate vs
// how their weight actually moved — not a formula. Training + walking are
// already baked in because the scale integrates all of it. Recommends ONE small
// weekly change, always via carbs, governed by muscle-preservation signals.
// No AI here — the weekly report's AI only narrates these numbers.

const KCAL_PER_KG = 7700;     // approx energy per kg of body mass change
const WINDOW_DAYS = 14;       // trailing window for intake + weight trend
const MAX_STEP_KCAL = 150;    // max change to the calorie target per week
const RATE_FLOOR = 0.35;      // kg/week — ease target when muscle is at risk
const RATE_TARGET = 0.5;      // kg/week — default fat-loss pace
const RATE_CAP = 0.6;         // kg/week — never push faster, even when green

export interface NutritionAnalysis {
  ready: boolean;                 // false until enough data to say anything
  observedTDEE: number | null;
  ouraTDEE: number | null;
  avgIntake: number | null;
  loggedDays: number;
  rateKgPerWk: number | null;     // positive = losing
  confidence: "high" | "low";
  confidenceReason: string;
  muscle: { strength: string; tape: string; verdict: "green" | "amber" | "red" | "unknown" };
  recommendation: null | {
    direction: "up" | "down" | "hold";
    calorieDelta: number;         // signed kcal applied to the rest-day target
    carbDelta: number;            // signed grams (the whole change is carbs)
    newRestCalories: number;
    newCarbs: number;
    reasons: string[];
  };
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(a + "T12:00:00").getTime() - new Date(b + "T12:00:00").getTime()) / 86400000);
}

// least-squares slope of weight vs day-index → kg per day
function trendKgPerDay(points: Array<{ date: string; w: number }>, asOf: string): number | null {
  if (points.length < 3) return null;
  const xs = points.map((p) => daysBetween(p.date, asOf)); // negative offsets
  const ys = points.map((p) => p.w);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  if (den === 0) return null;
  return num / den; // kg per day (day-index increases toward asOf, so loss → negative)
}

// best working top-set weight for an exercise within [fromOffset, toOffset] days of asOf
function bestTopSet(exLog: any, exId: string, asOf: string, fromOff: number, toOff: number): number | null {
  let best: number | null = null;
  for (const d of Object.keys(exLog)) {
    const off = daysBetween(d, asOf); // <= 0
    if (off < fromOff || off > toOff) continue;
    const sets = exLog[d]?.[exId]?.sets;
    if (!Array.isArray(sets)) continue;
    for (const s of sets) {
      const kg = parseFloat(s?.kg);
      if (kg && (best === null || kg > best)) best = kg;
    }
  }
  return best;
}

function assessStrength(exLog: any, asOf: string): "green" | "amber" | "red" | "unknown" {
  const ids = new Set<string>();
  for (const d of Object.keys(exLog)) {
    const off = daysBetween(d, asOf);
    if (off < -35 || off > 0) continue;
    for (const k of Object.keys(exLog[d] || {})) if (!k.startsWith("_")) ids.add(k);
  }
  let up = 0, down = 0, compared = 0;
  for (const id of ids) {
    const recent = bestTopSet(exLog, id, asOf, -13, 0);
    const older = bestTopSet(exLog, id, asOf, -35, -14);
    if (recent === null || older === null) continue;
    compared++;
    if (recent >= older) up++; else if (recent < older - 0.1) down++;
  }
  if (compared < 2) return "unknown";
  // bodyweight is falling on a cut, so absolute weights holding = relative strength rising
  if (down > up) return "red";
  if (up >= compared * 0.6) return "green";
  return "amber";
}

function assessTape(measLog: any[], asOf: string): "green" | "amber" | "unknown" {
  if (!Array.isArray(measLog)) return "unknown";
  const withWaist = measLog.filter((m) => m && m.date && m.waist != null);
  if (withWaist.length < 2) return "unknown";
  const sorted = [...withWaist].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const latest = sorted[sorted.length - 1];
  // nearest entry ~28 days before latest
  let ref = sorted[0];
  for (const m of sorted) if (daysBetween(latest.date, m.date) >= 21) ref = m;
  if (ref === latest) return "unknown";
  return (latest.waist < ref.waist - 0.2) ? "green" : "amber"; // waist falling = fat moving
}

export function analyzeNutrition(state: any, asOf?: string): NutritionAnalysis {
  const profile = state.profile || {};
  const foods = state.foods || {};
  const weightLog: any[] = Array.isArray(state.weightLog) ? state.weightLog : [];
  const calorieLog = state.calorieLog || {};
  const exLog = state.exLog || {};

  // reference "today" = caller's UK date, or the latest data point we have
  const allDates = [
    ...Object.keys(foods),
    ...weightLog.map((w) => w?.date).filter(Boolean),
  ].filter(Boolean).sort();
  const today = asOf || allDates[allDates.length - 1];
  const empty: NutritionAnalysis = {
    ready: false, observedTDEE: null, ouraTDEE: null, avgIntake: null, loggedDays: 0,
    rateKgPerWk: null, confidence: "low", confidenceReason: "Not enough data yet.",
    muscle: { strength: "unknown", tape: "unknown", verdict: "unknown" }, recommendation: null,
  };
  if (!today) return empty;
  const cutoff = ymd(new Date(new Date(today + "T12:00:00").getTime() - WINDOW_DAYS * 86400000));

  // --- average logged intake over the window ---
  let intakeSum = 0, loggedDays = 0;
  for (const d of Object.keys(foods)) {
    if (d <= cutoff || d > today) continue;
    const items = foods[d];
    if (!Array.isArray(items) || !items.length) continue;
    const kcal = items.reduce((s: number, f: any) => s + (+f?.cals || 0), 0);
    if (kcal > 0) { intakeSum += kcal; loggedDays++; }
  }
  const avgIntake = loggedDays ? Math.round(intakeSum / loggedDays) : null;

  // --- weight trend over the window ---
  const wPts = weightLog
    .filter((w) => w?.date && w.weight != null && w.date > cutoff && w.date <= today)
    .map((w) => ({ date: w.date, w: +w.weight }));
  const perDay = trendKgPerDay(wPts, today);
  const rateKgPerWk = perDay != null ? Math.round(-perDay * 7 * 100) / 100 : null; // positive = losing

  // --- Oura TDEE cross-check ---
  let ouraSum = 0, ouraDays = 0;
  for (const d of Object.keys(calorieLog)) {
    if (d <= cutoff || d > today) continue;
    const t = calorieLog[d]?.total;
    if (t != null) { ouraSum += +t; ouraDays++; }
  }
  const ouraTDEE = ouraDays ? Math.round(ouraSum / ouraDays) : null;

  // --- observed TDEE ---
  const observedTDEE = (avgIntake != null && perDay != null)
    ? Math.round(avgIntake - perDay * KCAL_PER_KG)
    : null;

  // --- confidence ---
  let confidence: "high" | "low" = "low";
  let confidenceReason = "";
  if (loggedDays < 10) {
    confidenceReason = `Only ${loggedDays}/14 days of food logged — log more and I'll adjust next week.`;
  } else if (observedTDEE == null) {
    confidenceReason = "Not enough weight readings to read a trend yet.";
  } else if (ouraTDEE != null && Math.abs(observedTDEE - ouraTDEE) / ouraTDEE > 0.12) {
    confidenceReason = `Your food maths and Oura disagree by a lot this week — holding off rather than guessing.`;
  } else {
    confidence = "high";
    confidenceReason = "Clean week — confident in these numbers.";
  }

  const strength = assessStrength(exLog, today);
  const tape = assessTape(state.measLog, today);
  let verdict: "green" | "amber" | "red" | "unknown" = "unknown";
  if (strength === "red") verdict = "red";
  else if (strength === "green" && (tape === "green" || tape === "unknown")) verdict = "green";
  else if (strength === "unknown" && tape === "unknown") verdict = "unknown";
  else verdict = "amber";

  const analysis: NutritionAnalysis = {
    ready: observedTDEE != null,
    observedTDEE, ouraTDEE, avgIntake, loggedDays, rateKgPerWk,
    confidence, confidenceReason,
    muscle: { strength, tape, verdict },
    recommendation: null,
  };
  if (confidence !== "high" || observedTDEE == null) return analysis;

  // --- rate governor (muscle-preservation first) ---
  let desiredRate: number;
  if (verdict === "red") desiredRate = RATE_FLOOR;                    // muscle at risk → ease, eat more
  else if (verdict === "green") desiredRate = RATE_CAP;               // safe → push, capped
  else desiredRate = RATE_TARGET;                                     // amber/unknown → steady default

  const sex = profile.personal?.sex;
  const floorCal = profile.targetOverrides?.calorieFloor ?? (sex === "female" ? 1400 : 1600);
  const dt = profile.dynamicTargets || {};
  const curCal = (dt.rest && dt.rest.calories) || profile.calsRest || (observedTDEE - 400);
  const curCarbs = (dt.rest && dt.rest.carbs) || profile.carbsTarget || 0;

  const desiredDeficitPerDay = (desiredRate * KCAL_PER_KG) / 7;
  const rawTarget = Math.max(floorCal, Math.round(observedTDEE - desiredDeficitPerDay));
  let delta = rawTarget - curCal;
  if (delta > MAX_STEP_KCAL) delta = MAX_STEP_KCAL;
  if (delta < -MAX_STEP_KCAL) delta = -MAX_STEP_KCAL;
  // the entire change is carbs, so the calorie change IS exactly carbDelta × 4
  let carbDelta = Math.round(delta / 4);
  let calorieDelta = carbDelta * 4;
  let newTarget = curCal + calorieDelta;
  if (newTarget < floorCal) { carbDelta += 1; calorieDelta = carbDelta * 4; newTarget = curCal + calorieDelta; }
  const direction = calorieDelta > 20 ? "up" : calorieDelta < -20 ? "down" : "hold";

  const reasons: string[] = [];
  reasons.push(`Your real burn is about ${observedTDEE} kcal/day${ouraTDEE != null ? ` (Oura agrees: ${ouraTDEE})` : ""}.`);
  if (rateKgPerWk != null) reasons.push(`You're losing about ${rateKgPerWk} kg/week.`);
  if (verdict === "red") reasons.push("Strength has dipped — easing off to protect muscle, so eat a bit more.");
  else if (verdict === "green") reasons.push("Strength is holding and waist is moving — muscle looks safe, so we can press a little.");
  else if (verdict === "amber") reasons.push("Mixed muscle signals — keeping a steady, safe pace.");
  else reasons.push("Not enough training/tape history yet — keeping a steady, safe pace.");
  if (direction === "up") reasons.push(`Add ~${Math.abs(carbDelta)}g carbs (e.g. a bit more rice). New target ${newTarget} kcal.`);
  else if (direction === "down") reasons.push(`Trim ~${Math.abs(carbDelta)}g carbs. New target ${newTarget} kcal.`);
  else if (rateKgPerWk != null && rateKgPerWk < RATE_TARGET - 0.05 && newTarget <= floorCal + 1) {
    // honest floor-bound case: he's already at minimum calories and losing slowly
    reasons.push("You're at your minimum calories and losing slowly — to speed up, add steps or a little cardio rather than eat less. Dropping food further would risk muscle.");
  } else reasons.push("You're in the right place — no change this week.");

  analysis.recommendation = (direction === "hold")
    ? { direction, calorieDelta: 0, carbDelta: 0, newRestCalories: curCal, newCarbs: curCarbs, reasons }
    : { direction, calorieDelta, carbDelta, newRestCalories: newTarget, newCarbs: curCarbs + carbDelta, reasons };
  return analysis;
}
