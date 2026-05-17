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

function buildContext(state: any): string {
  const today = ukToday();
  const cutoff14 = daysAgoUK(14);
  const cutoff7 = daysAgoUK(7);
  const profile = state.profile || {};
  const macros = profile.macros || {};

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
    return { date: d, hours: s.totalHours ?? s.hours ?? null, score: s.score ?? null };
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

  const lines: string[] = [];
  lines.push(`Today (UK): ${today}`);
  lines.push("");
  lines.push("PROFILE:");
  lines.push(`  Goal: ${profile.startWeight ?? "?"}kg @ ${profile.startBF ?? "?"}% BF → ${profile.targetWeight ?? "?"}kg @ ${profile.targetBF ?? "?"}% BF`);
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

  lines.push("FOOD INTAKE (last 7d, daily totals):");
  if (foodDays.length === 0) lines.push("  (no entries)");
  else for (const d of foodDays) lines.push(`  ${d.date}: ${d.kcal}kcal P${d.p} C${d.c} F${d.f}`);
  lines.push("");

  lines.push("TRAINING (last 7d, exercise:done/total sets):");
  if (exerciseDays.length === 0) lines.push("  (no sessions)");
  else for (const d of exerciseDays) lines.push(`  ${d.date}: ${d.summary}`);
  lines.push("");

  lines.push("SLEEP (last 7d):");
  if (sleepDays.length === 0) lines.push("  (no entries)");
  else for (const s of sleepDays) lines.push(`  ${s.date}: ${s.hours != null ? `${s.hours}h` : "?"}${s.score != null ? ` score=${s.score}` : ""}`);
  lines.push("");

  lines.push("SUPPLEMENT ADHERENCE (last 7d, taken/total):");
  for (const a of suppAdherence) lines.push(`  ${a.date}: ${a.taken}/${a.of}`);

  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are Forge's weekly coach. You write concise, specific, actionable weekly reviews for a user on a structured fat-loss / recomp plan.

Forge is a personal fitness tracker. The user logs weight, body fat, food (per ingredient), training (per set), sleep, and supplements. You see the last 7-14 days of their data.

Your output goes into two places:
1. A markdown REPORT — what happened, what's working, what to change. Under 350 words. Use ## section headings: "This week", "What's working", "What to fix", "Next week focus". Reference actual numbers from the data. Be direct — the user wants a coach, not a chatbot.
2. Optional SUGGESTIONS — concrete changes the user can apply with one tap. Only suggest changes that are clearly supported by the data (e.g. 7-day food intake consistently 200kcal over target → suggest dropping calories). If the plan is on track, output an empty suggestions array.

Suggestion types:
- "macros": adjust daily calorie/macro targets. Payload must include exactly these keys (omit any you don't want to change): calsGym, calsRest, protein, carbs, fat. Only suggest if weekly average rate is off target by >0.2kg/wk or food intake is consistently mismatched.
- "reminders": add/change a reminder. Payload: { action: "add" | "remove", reminder: { time: "HH:MM", text: string, days?: number[] } }. Use sparingly.
- "note": a directional nudge that doesn't change app state (e.g. "consider a deload week", "drop alcohol Friday"). Payload: {}.

Be specific with rationale — cite the data. Don't recommend changes "just to look busy". A report with zero suggestions is fine.`;

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
