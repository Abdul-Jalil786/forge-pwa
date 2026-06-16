// Phase 45: Ask Forge — owner-only Q&A about the user's own data.
// Lives outside ai-coach.ts deliberately (that file is big enough). Reuses the
// weekly report's buildContext (which now includes DEXA + tape) and adds a
// compact full-history aggregate so questions like "how much of my loss was
// fat vs muscle since the start?" are answerable. Haiku, structured output,
// no conversation memory.
import Anthropic from "@anthropic-ai/sdk";
import prisma from "./db";
import { decrypt } from "./crypto-util";
import { buildContext, HAIKU_MODEL } from "./ai-coach";

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

  // --- per-lift first vs current + relative strength ---
  const exLog: any = state.exLog || {};
  const dates = Object.keys(exLog).sort();
  const weightAt = (date: string): number | null => {
    let best: number | null = null;
    for (const e of weightLog) { if (e?.date && e.date <= date && e.weight != null) best = +e.weight; }
    return best ?? currentW;
  };
  type LiftAgg = { name: string; firstDate: string; firstKg: number; lastDate: string; lastKg: number; sessions: number; timed: boolean; firstSec?: number; bestSec?: number };
  const lifts: Record<string, LiftAgg> = {};
  for (const d of dates) {
    const day = exLog[d];
    if (!day || typeof day !== "object") continue;
    for (const [exId, ex] of Object.entries<any>(day)) {
      if (exId.startsWith("_") || !ex || !Array.isArray(ex.sets)) continue;
      const kgs = ex.sets.map((s: any) => parseFloat(s.kg)).filter((n: number) => n > 0);
      const secs = ex.sets.map((s: any) => parseFloat(s.seconds)).filter((n: number) => n > 0);
      if (!kgs.length && !secs.length) continue;
      const topKg = kgs.length ? Math.max(...kgs) : 0;
      const topSec = secs.length ? Math.max(...secs) : 0;
      if (!lifts[exId]) {
        lifts[exId] = { name: exId, firstDate: d, firstKg: topKg, lastDate: d, lastKg: topKg, sessions: 1, timed: !kgs.length && secs.length > 0, firstSec: topSec || undefined, bestSec: topSec || undefined };
      } else {
        const L = lifts[exId];
        L.sessions++; L.lastDate = d; if (topKg) L.lastKg = topKg;
        if (topSec) L.bestSec = Math.max(L.bestSec || 0, topSec);
      }
    }
  }
  const liftRows = Object.entries(lifts).filter(([, L]) => L.sessions >= 3).slice(0, 14);
  if (liftRows.length) {
    lines.push("  Lifts — first-ever vs current top set, with relative strength (kg lifted per kg bodyweight):");
    for (const [exId, L] of liftRows) {
      if (L.timed) {
        lines.push(`    ${exId}: first hold ${L.firstSec}s (${L.firstDate}) → longest ${L.bestSec}s · ${L.sessions} sessions`);
      } else {
        const bwFirst = weightAt(L.firstDate), bwLast = weightAt(L.lastDate);
        const relFirst = bwFirst ? r1(L.firstKg / bwFirst) : null;
        const relLast = bwLast ? r1(L.lastKg / bwLast) : null;
        lines.push(`    ${exId}: ${L.firstKg}kg (${L.firstDate}) → ${L.lastKg}kg (${L.lastDate}) · relative ${relFirst ?? "?"}→${relLast ?? "?"} kg/kg bw · ${L.sessions} sessions`);
      }
    }
  }

  // --- monthly training-day counts ---
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
- The user is on a fat-loss cut: the prime directive is losing fat while keeping lean mass (muscle).
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
