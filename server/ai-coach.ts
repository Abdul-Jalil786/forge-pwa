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
  lines.push("DEMOGRAPHICS:");
  lines.push(`  Age: ${personal.age ?? "(not set)"} · Height: ${personal.heightCm ?? "?"}cm · Sex (for BMR): ${personal.sex ?? "(not set)"} · Ethnicity: ${personal.ethnicity ?? "(not set)"}`);
  lines.push(`  Activity outside gym: ${personal.activityLevel ?? "(not set)"}`);
  if (tdee) lines.push(`  Estimated BMR: ${tdee.bmr} kcal · TDEE (Mifflin-St Jeor × activity factor, excludes training): ${tdee.tdee} kcal/day`);
  else lines.push(`  TDEE estimate unavailable (demographics incomplete — coach should flag this if accuracy matters)`);
  lines.push("");
  lines.push("MEDICATIONS (factor these into interpretation):");
  if (meds.length === 0) lines.push("  (none recorded)");
  else for (const m of meds) lines.push(`  - ${m.name}${m.dose ? ` ${m.dose}` : ""}${m.schedule ? ` · ${m.schedule}` : ""}${m.notes ? ` · ${m.notes}` : ""}`);
  lines.push("");
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

  // Phase 29: Oura activity (steps + active calories) — primary TDEE signal
  lines.push("DAILY ACTIVITY (last 7d, Oura — active calories is the most accurate TDEE input):");
  let activeCalSum = 0, activeCalDays = 0;
  for (let i = 6; i >= 0; i--) {
    const d = daysAgoUK(i);
    const steps = stepsLog[d];
    const cals = calorieLog[d];
    const parts: string[] = [];
    if (steps != null) parts.push(`${steps} steps`);
    if (cals?.active != null) { parts.push(`${cals.active} active kcal`); activeCalSum += cals.active; activeCalDays++; }
    if (cals?.total != null) parts.push(`${cals.total} total kcal`);
    if (parts.length === 0) continue;
    lines.push(`  ${d}: ${parts.join(" · ")}`);
  }
  if (activeCalDays > 0) lines.push(`  → 7-day avg active calories: ${Math.round(activeCalSum / activeCalDays)} kcal/day (use this for TDEE — more accurate than Mifflin estimate)`);
  lines.push("");

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
- This is a FAT LOSS WITH LBM PRESERVATION cut, not generic weight loss.
- Target LBM ≈ current LBM. Weight loss should come almost entirely from fat mass.
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
- Use Oura active calories as primary TDEE input. Mifflin-St Jeor is a fallback. If both available, average them and explain the range.
- Sleep: deep < 45 min or REM < 60 min = poor quality even if hours are fine. Reference stages, not just totals.
- Effort tags: >50% easy + no tough = sandbagging (push harder). >40% tough = under-recovery or weights too high.
- Meal plan adherence: <70% on multiple days = the plan doesn't fit life, not a discipline problem. Suggest a swap, not a guilt trip.
- MEMORY: reference what you said in previous reports. If you suggested a change 2-4 weeks ago and the user applied it, explicitly evaluate whether it worked. If they dismissed it, don't suggest it again unless data has changed materially. DO NOT repeat advice from prior reports without acknowledging the prior recommendation.
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
