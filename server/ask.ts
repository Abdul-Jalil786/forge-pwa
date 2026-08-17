// Phase 45: Ask Forge — owner-only Q&A about the user's own data.
// Lives outside ai-coach.ts deliberately (that file is big enough). Reuses the
// weekly report's buildContext (which now includes DEXA + tape) and adds a
// compact full-history aggregate so questions like "how much of my loss was
// fat vs muscle since the start?" are answerable. Haiku, structured output,
// no conversation memory.
import Anthropic from "@anthropic-ai/sdk";
import prisma from "./db";
import { decrypt } from "./crypto-util";
import { buildContext, HAIKU_MODEL, MODEL } from "./ai-coach";

export interface AskAnswer {
  status: "green" | "amber" | "red";
  verdict: string;
  numbers: string[];
  meaning: string;
  action: string;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

// Whole-journey aggregates only — weekly buckets, never raw logs. Hard-capped
// to ~12k chars (≈3k tokens) so a long history can't blow up the request.
export function buildFullHistory(state: any): string {
  const lines: string[] = [];
  const profile = state.profile || {};
  const startDate: string = profile.startDate || (state.weightLog?.[0]?.date) || null;
  if (!startDate) return "";
  const today = new Date().toISOString().slice(0, 10);
  lines.push(`FULL HISTORY AGGREGATES (since plan start ${startDate}):`);

  // --- weekly buckets: weight / BF / lean / fat ---
  const weightLog: any[] = Array.isArray(state.weightLog) ? state.weightLog : [];
  const bfLog: any[] = Array.isArray(state.bfLog) ? state.bfLog : [];
  const foods: any = state.foods || {};
  const bucketOf = (date: string) => Math.floor((new Date(date + "T12:00:00").getTime() - new Date(startDate + "T12:00:00").getTime()) / (7 * 86400000));
  const maxBucket = Math.min(bucketOf(today), 51); // cap a year of weeks
  type Bucket = { w: number[]; bf: number[]; protein: number[]; kcal: number[] };
  const buckets: Bucket[] = Array.from({ length: maxBucket + 1 }, () => ({ w: [], bf: [], protein: [], kcal: [] }));
  const inRange = (d: string) => d >= startDate && bucketOf(d) >= 0 && bucketOf(d) <= maxBucket;
  for (const e of weightLog) if (e?.date && e.weight != null && inRange(e.date)) buckets[bucketOf(e.date)].w.push(+e.weight);
  for (const e of bfLog) if (e?.date && e.bf != null && inRange(e.date)) buckets[bucketOf(e.date)].bf.push(+e.bf);
  for (const [d, items] of Object.entries(foods)) {
    if (!inRange(d) || !Array.isArray(items)) continue;
    const p = (items as any[]).reduce((s, f) => s + (+f?.protein || 0), 0);
    const k = (items as any[]).reduce((s, f) => s + (+f?.cals || 0), 0);
    if (p > 0 || k > 0) { buckets[bucketOf(d)].protein.push(p); buckets[bucketOf(d)].kcal.push(k); }
  }
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  lines.push("  Weekly averages (week · weight kg · BF % · lean kg (muscle+water etc.) · fat kg · protein g/day):");
  const weekly: Array<{ wk: number; w: number | null; bf: number | null; lean: number | null; fat: number | null }> = [];
  for (let i = 0; i <= maxBucket; i++) {
    const b = buckets[i];
    const w = avg(b.w), bf = avg(b.bf);
    const lean = w != null && bf != null ? w * (1 - bf / 100) : null;
    const fat = w != null && bf != null ? w * (bf / 100) : null;
    weekly.push({ wk: i, w, bf, lean, fat });
    if (w == null && bf == null && !b.protein.length) continue;
    const p = avg(b.protein);
    lines.push(`    wk${i + 1}: ${w != null ? r1(w) : "—"}kg · ${bf != null ? r1(bf) : "—"}% · ${lean != null ? r1(lean) : "—"}kg lean · ${fat != null ? r1(fat) : "—"}kg fat · ${p != null ? Math.round(p) : "—"}g protein`);
  }

  // --- loss composition to date ---
  const firstFull = weekly.find((x) => x.lean != null);
  const lastFull = [...weekly].reverse().find((x) => x.lean != null);
  const currentW = weightLog.length ? +weightLog[weightLog.length - 1].weight : null;
  if (firstFull && lastFull && firstFull !== lastFull) {
    const dW = lastFull.w! - firstFull.w!;
    const dFat = lastFull.fat! - firstFull.fat!;
    const dLean = lastFull.lean! - firstFull.lean!;
    const fatShare = dW < 0 ? Math.round((dFat / dW) * 100) : null;
    lines.push(`  Loss composition (wk${firstFull.wk + 1} avg → wk${lastFull.wk + 1} avg, Withings BIA): weight ${r1(dW)}kg · fat ${r1(dFat)}kg · lean ${r1(dLean)}kg${fatShare != null ? ` → ~${fatShare}% of loss was fat` : ""}`);
  }

  // --- protein vs target, g/kg ---
  const recentP = avg(buckets[maxBucket]?.protein.length ? buckets[maxBucket].protein : (buckets[maxBucket - 1]?.protein || []));
  const targetP = profile.proteinTarget || profile.macros?.protein || null;
  if (recentP != null && currentW) {
    lines.push(`  Protein latest week: ${Math.round(recentP)}g/day = ${r1(recentP / currentW)}g/kg bodyweight${targetP ? ` (target ${targetP}g = ${r1(targetP / currentW)}g/kg)` : ""}`);
  }

  // Per-lift first-vs-current strength now lives in buildContext (buildStrengthBaseline,
  // Phase 78) so the weekly report gets it too — chat/ask prepend buildContext, so it's
  // covered here without duplicating it in this block.

  // --- monthly training-day counts ---
  const exLog: any = state.exLog || {};
  const dates = Object.keys(exLog).sort();
  const monthly: Record<string, number> = {};
  for (const d of dates) {
    const day = exLog[d];
    const worked = day && Object.entries<any>(day).some(([k, ex]) => !k.startsWith("_") && Array.isArray(ex?.sets) && ex.sets.some((s: any) => s.kg || s.reps || s.seconds));
    if (worked) monthly[d.slice(0, 7)] = (monthly[d.slice(0, 7)] || 0) + 1;
  }
  const months = Object.keys(monthly).sort();
  if (months.length) lines.push("  Training days per month: " + months.map((m) => `${m}: ${monthly[m]}`).join(" · "));

  // --- tape series (compact) ---
  const meas: any[] = Array.isArray(state.measLog) ? state.measLog.filter((m: any) => m?.date) : [];
  if (meas.length) {
    lines.push("  Tape series: " + meas.slice(-8).map((m: any) => `${m.date} waist ${m.waist ?? "?"}cm`).join(" · "));
  }

  // --- Phase 44 calibration stats ---
  const ov: any = state.recoveryOverrides || {};
  const ovDates = Object.keys(ov);
  if (ovDates.length) {
    let trained = 0, eased = 0; const scores: number[] = [];
    for (const d of ovDates) {
      if (ov[d]?.choice === "train") { trained++; const p = exLog[d]?._session?.score?.pct; if (p != null) scores.push(p); }
      if (ov[d]?.choice === "easy") eased++;
    }
    lines.push(`  Recovery gate firings: ${ovDates.length} (trained through ${trained}, eased ${eased}${scores.length ? `, avg score when training through ${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}%` : ""})`);
  }

  lines.push("");
  let out = lines.join("\n");
  if (out.length > 12000) out = out.slice(0, 12000) + "\n  [history truncated]";
  return out;
}

const ASK_SYSTEM = `You are Forge's data analyst. The user asks a question about THEIR OWN fitness data; you answer ONLY from the provided context — never invent numbers, never use outside knowledge about them. Cite real numbers and dates from the data. Use kg.

Rules:
- Read the user's current phase from the context (DEMOGRAPHICS → CURRENT PHASE; if unspecified, assume a fat-loss cut). On a cut, the prime directive is losing fat while keeping lean mass (muscle).
- Explain any jargon in brackets the first time you use it, e.g. "lean mass (muscle + water, everything that isn't fat)".
- Withings body composition is BIA (bioelectrical impedance — a bathroom-scale estimate): noisy day to day. Only trust 7-day averages, and say so when it's relevant to the answer.
- Tape measurements and DEXA outrank BIA when they disagree.
- Relative strength (kg lifted per kg of bodyweight) rising while bodyweight falls = muscle being preserved. Use this framing when asked about strength.
- status: "green" = on track / good news, "amber" = mixed, unclear, or the data can't fully answer, "red" = genuinely off track and needs action.
- If the data can't answer the question, set status "amber" and say so plainly in the verdict — do not guess.
- verdict: ONE plain-English sentence a non-technical person understands.
- numbers: up to 5 short "label: value" strings supporting the verdict.
- meaning: 2-3 sentences max. action: one specific doable thing, or empty string if none needed.`;

// Phase 49: estimate calories + macros for a food/meal the user types in plain
// language, so an ad-hoc extra (a snack, a coffee, something out) can be logged
// without entering macros by hand. Haiku, forced structured output, cheap.
export interface FoodEstimate {
  name: string;
  cals: number;
  protein: number;
  carbs: number;
  fat: number;
}

const FOOD_SYSTEM = `You estimate the nutrition of a food or a whole meal the user describes in plain language, so it can be logged in a food tracker.

Rules:
- Use the amounts the user gives ("200g chicken", "2 eggs", "a handful of almonds"). If no amount is given, assume ONE typical UK serving.
- The description may list several items ("2 dates and a flat white") — SUM them into a single total.
- Use realistic UK supermarket / restaurant values. Assume cooked weights unless stated.
- Return whole numbers, and keep them internally consistent: calories ≈ protein*4 + carbs*4 + fat*9.
- name: a short tidy label for the log (e.g. "2 dates + flat white"), max 60 chars.
- If the input is not a food, return all zeros and name "unknown".`;

export async function estimateFood(userId: string, description: string): Promise<FoodEstimate> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  if (!state.coachingKey) throw new Error("No Anthropic API key configured");
  let apiKey: string;
  try { apiKey = decrypt(state.coachingKey); }
  catch { throw new Error("Failed to decrypt stored API key"); }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 400,
    system: FOOD_SYSTEM,
    tools: [{
      name: "submit_food",
      description: "Submit the estimated nutrition for the described food.",
      input_schema: {
        type: "object" as const,
        properties: {
          name: { type: "string", description: "Short tidy label for the log, max 60 chars." },
          cals: { type: "number", description: "Total calories (kcal)." },
          protein: { type: "number", description: "Total protein in grams." },
          carbs: { type: "number", description: "Total carbohydrate in grams." },
          fat: { type: "number", description: "Total fat in grams." },
        },
        required: ["name", "cals", "protein", "carbs", "fat"],
      },
    }],
    tool_choice: { type: "tool", name: "submit_food" },
    messages: [{ role: "user", content: `Food: ${description}` }],
  });

  const toolBlock: any = response.content.find((b: any) => b.type === "tool_use" && b.name === "submit_food");
  if (!toolBlock) throw new Error("Model did not return an estimate");
  const f = toolBlock.input || {};
  const clamp = (n: any) => Math.max(0, Math.round(+n || 0));
  return {
    name: String(f.name || description).slice(0, 60),
    cals: clamp(f.cals),
    protein: clamp(f.protein),
    carbs: clamp(f.carbs),
    fat: clamp(f.fat),
  };
}

// Phase 94: "Eating Out" — estimate a restaurant/takeaway meal from a plain-text
// description. Distinct from estimateFood (the everyday auto-fill): eating-out
// portions run bigger, desi/takeaway food carries restaurant-level oil, and we
// deliberately round UP when torn (a treat meal is better over- than under-counted).
// Also returns a confidence + a one-line assumptions note so the user can sanity-
// check the guess, and so the entry can be flagged `estimated` for the coach.
export interface MealOutEstimate {
  name: string;
  cals: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: "high" | "medium" | "low";
  assumptions: string;
}

const MEALOUT_SYSTEM = `You estimate the nutrition of a RESTAURANT or TAKEAWAY meal the user describes in plain language, so it can be logged in a food tracker. This is a meal OUT, not home cooking — lean toward realistic eating-out values.

Rules:
- UK portions. Assume British takeaway / chippy / restaurant serving sizes, NOT US. "A big bag of chips" is a large UK chip-shop portion; "a doner in naan" is a full takeaway portion.
- Desi / South Asian food: you know karahi, naan, biryani, doner, kebab, samosa, pakora, daal, curry, etc. Assume RESTAURANT-level oil and ghee — roughly 1.3x the fat of the same dish cooked at home.
- The description may list several items — SUM them into a single total.
- When you are torn between two plausible estimates, choose the HIGHER one.
- Keep the macros internally consistent: kcal ≈ protein*4 + carbs*4 + fat*9. Whole numbers.
- confidence: "high" when the items and portions are clear; "medium" when you are inferring the portion size; "low" when the description is vague.
- assumptions: ONE short line naming the portion sizes / oil level you assumed (e.g. "large chippy chips ~350g, full doner in naan, restaurant oil").
- name: a short tidy label for the log, max 60 chars.
- If the input is not a food, return all zeros, confidence "low", and name "unknown".`;

export async function estimateMealOut(userId: string, description: string): Promise<MealOutEstimate> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  if (!state.coachingKey) throw new Error("No Anthropic API key configured");
  let apiKey: string;
  try { apiKey = decrypt(state.coachingKey); }
  catch { throw new Error("Failed to decrypt stored API key"); }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 500,
    system: MEALOUT_SYSTEM,
    tools: [{
      name: "submit_meal_out",
      description: "Submit the estimated nutrition for the described meal out.",
      input_schema: {
        type: "object" as const,
        properties: {
          name: { type: "string", description: "Short tidy label for the log, max 60 chars." },
          kcal: { type: "number", description: "Total calories." },
          protein_g: { type: "number", description: "Total protein in grams." },
          carbs_g: { type: "number", description: "Total carbohydrate in grams." },
          fat_g: { type: "number", description: "Total fat in grams." },
          confidence: { type: "string", enum: ["high", "medium", "low"], description: "How sure you are of the estimate." },
          assumptions: { type: "string", description: "One short line on the portions / oil level assumed." },
        },
        required: ["name", "kcal", "protein_g", "carbs_g", "fat_g", "confidence", "assumptions"],
      },
    }],
    tool_choice: { type: "tool", name: "submit_meal_out" },
    messages: [{ role: "user", content: `Meal out: ${description}` }],
  });

  const toolBlock: any = response.content.find((b: any) => b.type === "tool_use" && b.name === "submit_meal_out");
  if (!toolBlock) throw new Error("Model did not return an estimate");
  const f = toolBlock.input || {};
  const clamp = (n: any) => Math.max(0, Math.round(+n || 0));
  const conf = ["high", "medium", "low"].includes(f.confidence) ? f.confidence : "low";
  return {
    name: String(f.name || description).slice(0, 60),
    cals: clamp(f.kcal),
    protein: clamp(f.protein_g),
    carbs: clamp(f.carbs_g),
    fat: clamp(f.fat_g),
    confidence: conf,
    assumptions: String(f.assumptions || "").slice(0, 200),
  };
}

// Phase 55: Health Records — one-time AI extraction of a pasted lab report / DEXA
// scan into structured items, EACH with the verbatim source snippet it was read
// from (so the user verifies before saving) + a confidence flag, and conflicts
// surfaced (never auto-picked) when the source disagrees with itself.
export interface HealthExtraction {
  recordType: "bloods" | "dexa";
  date: string | null;
  provider: string | null;
  items: Array<{ name: string; key?: string; value: string; unit: string; refLow: number | null; refHigh: number | null; category: string; snippet: string; confidence: "high" | "low" }>;
  conflicts: Array<{ name: string; candidates: Array<{ value: string; unit: string; snippet: string }>; note: string }>;
}

const EXTRACT_SYSTEM = `You extract EXACT medical values from a pasted lab report or DEXA scan into structured data for a health-records tracker. This is medical data — accuracy and verifiability matter more than completeness.

HARD RULES:
- Extract values EXACTLY as written. Never invent, round, or infer a value that isn't in the text. Keep symbols like ">90" or "<0.78" verbatim in value.
- For EVERY item, "snippet" must be the VERBATIM phrase or line from the source you read the value from (copy it exactly, max ~120 chars). The user verifies each number against this snippet, so it must be a real quote, not a paraphrase.
- Set "confidence":"low" if the value is ambiguous, hard to read, split across lines, unlabelled, or you are inferring/converting. Otherwise "high".
- CONFLICTS: if the SAME marker/field appears with DIFFERENT values in the source (e.g. a summary table and a doctor's letter disagree), DO NOT pick one. OMIT it from "items" and add it to "conflicts" with EVERY candidate value and each one's verbatim snippet. The user chooses.
- Extract the sample/scan "date" (YYYY-MM-DD) and "provider" if present.

BLOODS: each item = one lab marker — name, value, unit, refLow/refHigh (reference-range numbers, null if one-sided/absent), category (e.g. "Liver","Diabetes","Hormones","Lipids","FBC"), snippet, confidence.
DEXA: each item is a body-composition figure. Set "key" from this set where it applies: bodyFatPct, fatMass, leanMass, boneMass, vatCm2, bmdTotal, tScore, zScore, lmi, almi, fmi, androidFatPct, gynoidFatPct, weight. "name" = human label.`;

export async function extractHealthRecord(userId: string, text: string, type: "bloods" | "dexa"): Promise<HealthExtraction> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  if (!state.coachingKey) throw new Error("No Anthropic API key configured");
  let apiKey: string;
  try { apiKey = decrypt(state.coachingKey); } catch { throw new Error("Failed to decrypt stored API key"); }

  const numOrNull = { type: ["number", "null"] as any };
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODEL, // Opus 4.8 — accuracy + verbatim quoting on medical extraction
    max_tokens: 4000,
    system: EXTRACT_SYSTEM,
    tools: [{
      name: "submit_extraction",
      description: "Submit the extracted record.",
      input_schema: {
        type: "object" as const,
        properties: {
          recordType: { type: "string", enum: ["bloods", "dexa"] },
          date: { type: "string", description: "Sample/scan date YYYY-MM-DD, or empty." },
          provider: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                key: { type: "string", description: "DEXA field key, if applicable." },
                value: { type: "string", description: "Value exactly as written (keep > or < symbols)." },
                unit: { type: "string" },
                refLow: numOrNull,
                refHigh: numOrNull,
                category: { type: "string" },
                snippet: { type: "string", description: "Verbatim source text, max ~120 chars." },
                confidence: { type: "string", enum: ["high", "low"] },
              },
              required: ["name", "value", "unit", "snippet", "confidence"],
            },
          },
          conflicts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                candidates: { type: "array", items: { type: "object", properties: { value: { type: "string" }, unit: { type: "string" }, snippet: { type: "string" } }, required: ["value", "snippet"] } },
                note: { type: "string" },
              },
              required: ["name", "candidates"],
            },
          },
        },
        required: ["recordType", "items", "conflicts"],
      },
    }],
    tool_choice: { type: "tool", name: "submit_extraction" },
    messages: [{ role: "user", content: `Record type: ${type}\n\nSOURCE:\n${text.slice(0, 24000)}` }],
  });

  const toolBlock: any = response.content.find((b: any) => b.type === "tool_use" && b.name === "submit_extraction");
  if (!toolBlock) throw new Error("Model did not return an extraction");
  const x = toolBlock.input || {};
  const s = (v: any, n: number) => String(v == null ? "" : v).slice(0, n);
  const items = Array.isArray(x.items) ? x.items.slice(0, 120).map((it: any) => ({
    name: s(it.name, 120),
    key: it.key ? s(it.key, 40) : undefined,
    value: s(it.value, 40),
    unit: s(it.unit, 30),
    refLow: typeof it.refLow === "number" ? it.refLow : null,
    refHigh: typeof it.refHigh === "number" ? it.refHigh : null,
    category: s(it.category, 40),
    snippet: s(it.snippet, 160),
    confidence: it.confidence === "low" ? "low" as const : "high" as const,
  })) : [];
  const conflicts = Array.isArray(x.conflicts) ? x.conflicts.slice(0, 40).map((c: any) => ({
    name: s(c.name, 120),
    candidates: Array.isArray(c.candidates) ? c.candidates.slice(0, 6).map((cd: any) => ({ value: s(cd.value, 40), unit: s(cd.unit, 30), snippet: s(cd.snippet, 160) })) : [],
    note: s(c.note, 200),
  })) : [];
  return {
    recordType: x.recordType === "dexa" ? "dexa" : "bloods",
    date: (typeof x.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x.date)) ? x.date : null,
    provider: x.provider ? s(x.provider, 120) : null,
    items, conflicts,
  };
}

export async function answerQuestion(userId: string, question: string): Promise<AskAnswer> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  if (!state.coachingKey) throw new Error("No Anthropic API key configured");
  let apiKey: string;
  try { apiKey = decrypt(state.coachingKey); }
  catch { throw new Error("Failed to decrypt stored API key"); }

  const context = buildContext(state);
  const history = buildFullHistory(state);

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 1000,
    system: ASK_SYSTEM,
    tools: [{
      name: "submit_answer",
      description: "Submit the structured answer to the user's question.",
      input_schema: {
        type: "object" as const,
        properties: {
          status: { type: "string", enum: ["green", "amber", "red"] },
          verdict: { type: "string", description: "One plain-English sentence." },
          numbers: { type: "array", items: { type: "string" }, maxItems: 5, description: "Short 'label: value' strings." },
          meaning: { type: "string", description: "2-3 sentences max." },
          action: { type: "string", description: "One specific thing to do, or empty string." },
        },
        required: ["status", "verdict", "numbers", "meaning", "action"],
      },
    }],
    tool_choice: { type: "tool", name: "submit_answer" },
    messages: [{
      role: "user",
      content: `${context}\n${history}\nQUESTION: ${question}`,
    }],
  });

  const toolBlock: any = response.content.find((b: any) => b.type === "tool_use" && b.name === "submit_answer");
  if (!toolBlock) throw new Error("Model did not return a structured answer");
  const a = toolBlock.input || {};
  return {
    status: ["green", "amber", "red"].includes(a.status) ? a.status : "amber",
    verdict: String(a.verdict || "").slice(0, 300),
    numbers: Array.isArray(a.numbers) ? a.numbers.slice(0, 5).map((n: any) => String(n).slice(0, 120)) : [],
    meaning: String(a.meaning || "").slice(0, 600),
    action: String(a.action || "").slice(0, 300),
  };
}

// Phase 65: conversational coach — a threaded, advisory chat over the SAME
// assembled context as the weekly report + Ask Forge. Multi-turn (memory),
// plain-text reply, Haiku. No structured Apply actions in v1 (those stay in the
// weekly report). The big, identical-per-turn context goes in `system`.
export type ChatTurn = { role: "user" | "assistant"; content: string };

const CHAT_SYSTEM = `You are Forge, {name}'s personal fitness & nutrition coach, talking with them directly in a chat.

Below you have their real training, nutrition, sleep, recovery, body-composition and (if present) blood-marker data. Use it.

How to talk:
- Like a knowledgeable coach texting a client: warm, direct, concise. Usually 2-5 sentences; go longer only when they ask for detail.
- Ground every answer in THEIR actual numbers — cite the real figures and dates from the data. Never invent data you don't have; if the answer isn't in the context, say so plainly.
- It's a conversation: use the earlier messages, answer follow-ups naturally.
- Put jargon in plain English, e.g. "HRV (overnight recovery signal)".

Boundaries:
- You give ADVICE only — you can't change their plan, targets or reminders from chat. If they want a change actually applied, tell them it'll come through in their weekly report's Apply buttons (or they can set it in the app).
- Never give a definitive medical diagnosis; frame any health flag as "consistent with X — worth raising with your GP".`;

export async function chatAnswer(userId: string, messages: ChatTurn[]): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  if (!state.coachingKey) throw new Error("No Anthropic API key configured");
  let apiKey: string;
  try { apiKey = decrypt(state.coachingKey); }
  catch { throw new Error("Failed to decrypt stored API key"); }

  const name = (state.profile && state.profile.name) || "the user";
  const context = buildContext(state);
  const history = buildFullHistory(state);
  const system = `${CHAT_SYSTEM.replace("{name}", name)}\n\n===== THEIR DATA =====\n${context}\n${history}`;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 800,
    // Prompt caching (Phase 65a): the system prefix (CHAT_SYSTEM + full context +
    // history) is byte-identical across turns of a thread, so cache it. Follow-up
    // turns within the 5-min ephemeral TTL read it at ~0.1x instead of reprocessing
    // the whole context. Haiku's min cacheable prefix is 4096 tokens; below that
    // this is a silent no-op (no error), above it's a real hit — the owner's rich
    // context clears it comfortably. Message history stays after the breakpoint.
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  const text = response.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();
  return text || "Sorry — I couldn't put a reply together just now. Try asking again?";
}

// Phase 80 (Medium): on-demand DEEP ANALYSIS — a single Opus pass over the full
// context that names the 3 biggest levers right now + one 2-week n-of-1 experiment.
// Owner-only, BYOK, aiBudget-gated at the route. Deliberately NOT a background agent
// (cost/redundancy) — the user pulls it when they want a step-back review.
const DEEP_ANALYSIS_SYSTEM = `You are Forge's deep-analysis analyst. The user pressed "Deep Analysis" for an on-demand, step-back review of everything. You get the SAME rich context as the weekly report (trends, correlations, DISCOVERED PATTERNS, RECENT CHANGES, blood markers, training, sleep, nutrition) plus FULL HISTORY AGGREGATES.

Output EXACTLY these two sections in markdown, nothing else:

## The 3 biggest levers right now
Rank the THREE changes that would most move the needle on their current goal (read CURRENT PHASE — on a cut the prime directive is losing fat while keeping muscle). For each: **bold one-line lever**, then 1-2 sentences citing the SPECIFIC numbers/dates from their data that justify it, then a concrete action. Prefer levers backed by trends + correlations over guesses.

## One experiment to run (next 2 weeks)
Design a SINGLE, measurable n-of-1 experiment: exactly what to change, what you'll measure, the expected direction, and how you'll know in 2 weeks if it worked. Make it something the app can actually track.

RULES:
- Cite real figures/dates verbatim from the data — never invent numbers.
- Reference RECENT CHANGES (what they already changed) so you don't re-recommend something in flight, and note whether recent changes are working.
- DISCOVERED PATTERNS are exploratory — you may use one as the experiment hypothesis, but frame it as a test, not a fact.
- Be direct and specific. No preamble, no filler, no restating their whole dataset back.
- NEVER give a medical diagnosis. If a blood marker or symptom needs it, say "worth a GP conversation" and move on.
- Escape nothing; plain markdown.`;

// Phase 87 (Layer 2, owner-only): "What should I eat?" — a food-level nutrition
// review. Reads the SAME rich context (actual food log, meal-plan adherence, week-
// over-week, weight trend, maintenance, phase, meds, flagged bloods) and returns
// CONCRETE food changes, weight-aware. One Opus pass on the user's own key.
const EATING_ADVICE_SYSTEM = `You are Forge's nutrition analyst. The user pressed "What should I eat?" — they want a concrete, food-level review of what they've ACTUALLY been logging, compared to before, taking their weight trend into account.

Output EXACTLY these markdown sections, nothing else:

## What your logging shows
2-3 bullets on what they're actually eating now vs the previous period — protein, carbs, calories, meal timing, and meal-plan adherence — citing the SPECIFIC numbers from the context (this-week vs last-week, maintenance, weight rate).

## What to change
The 2-3 highest-impact, SPECIFIC food changes. Name real foods, meals and timing (e.g. "add 2 eggs at breakfast", "move the dates to pre-workout", "the honey's adding up — 3 tsp this week"). NOT abstract macros. Read CURRENT PHASE + maintenance + weight trend so the direction (eat more / less / redistribute) is right; on a cut, protect muscle.

## Why
One line tying it to their goal and the numbers.

RULES:
- Cite real figures/dates verbatim from the data — never invent numbers.
- Concrete foods, not "eat more protein" in the abstract.
- Reference what they already eat (from the food log + meal plan) so swaps are realistic.
- NEVER give a medical diagnosis; if a marker needs it, say "worth a GP conversation".
- No preamble or filler. Plain markdown, escape nothing.`;

export async function eatingAdvice(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  if (!state.coachingKey) throw new Error("No Anthropic API key configured");
  let apiKey: string;
  try { apiKey = decrypt(state.coachingKey); }
  catch { throw new Error("Failed to decrypt stored API key"); }

  const context = buildContext(state);
  const history = buildFullHistory(state);
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: EATING_ADVICE_SYSTEM,
    messages: [{ role: "user", content: `Here is all my data. Review my eating and recommend what to change.\n\n===== CONTEXT =====\n${context}\n${history}` }],
  });
  const text = response.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();
  return text || "Couldn't complete the review just now — try again in a moment.";
}

export async function deepAnalysis(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  if (!state.coachingKey) throw new Error("No Anthropic API key configured");
  let apiKey: string;
  try { apiKey = decrypt(state.coachingKey); }
  catch { throw new Error("Failed to decrypt stored API key"); }

  const context = buildContext(state);
  const history = buildFullHistory(state);
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: DEEP_ANALYSIS_SYSTEM,
    messages: [{ role: "user", content: `Here is all my data. Do the deep analysis.\n\n===== CONTEXT =====\n${context}\n${history}` }],
  });
  const text = response.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();
  return text || "Couldn't complete the analysis just now — try again in a moment.";
}
