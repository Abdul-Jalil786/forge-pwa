import { Router, Request, Response, NextFunction } from "express";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "./db";
import { requireAuth, requireOwnerCheck } from "./auth";
import { encrypt, decrypt } from "./crypto-util";
import { generateWeeklyReport, saveReport, hoursSinceLastReport, generateMealPlan, saveMealPlan, hoursSinceLastPlanRegen, recomputeMealPlanMacros, computeMaxLBM, generateSessionBrief, generateSessionReflection, buildContext } from "./ai-coach";
import { answerQuestion, estimateFood, extractHealthRecord } from "./ask";

const router = Router();

// Phase 43: daily AI budget — applied to every route that spends Anthropic
// tokens. Counter lives in state.aiCallLog["YYYY-MM-DD"] (UK date, so it
// resets at UK midnight) and is incremented via jsonb_set in a single UPDATE,
// so concurrent requests can't lose increments to a read-modify-write race.
// Increment-then-check: once over the limit every further attempt 429s.
const AI_DAILY_LIMIT = 40;

function ukToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

function aiBudget() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const day = ukToday();
      const rows = await prisma.$queryRaw<Array<{ count: number }>>`
        UPDATE "User"
        SET state = jsonb_set(
          jsonb_set(COALESCE(state, '{}')::jsonb, '{aiCallLog}', COALESCE(state->'aiCallLog', '{}'), true),
          ARRAY['aiCallLog', ${day}],
          to_jsonb(COALESCE((state->'aiCallLog'->>${day})::int, 0) + 1),
          true
        )
        WHERE id = ${req.userId}
        RETURNING (state->'aiCallLog'->>${day})::int AS count
      `;
      const count = rows[0]?.count ?? 1;
      if (count === 1) {
        // First call of a new day — prune old day keys so aiCallLog never grows
        await prisma.$executeRaw`
          UPDATE "User"
          SET state = jsonb_set(state, '{aiCallLog}', jsonb_build_object(${day}::text, state->'aiCallLog'->${day}))
          WHERE id = ${req.userId}
        `;
      }
      if (count > AI_DAILY_LIMIT) {
        res.status(429).json({ error: `Daily AI limit reached (${AI_DAILY_LIMIT}/day) — resets at midnight UK time. Your Sunday report still runs automatically.` });
        return;
      }
      next();
    } catch (err) {
      // Budget bookkeeping must never take the coach down — fail open
      console.error("aiBudget error:", err);
      next();
    }
  };
}

router.get("/key", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { state: true } });
    const st: any = user?.state || {};
    res.json({
      hasKey: !!st.coachingKey,
      lastReportAt: st.lastCoachingReportAt || null,
    });
  } catch (err) {
    console.error("Get coach key error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/key", requireAuth, async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    if (typeof apiKey !== "string" || !apiKey.startsWith("sk-ant-")) {
      res.status(400).json({ error: "Invalid Anthropic API key format" }); return;
    }
    if (apiKey.length > 256) {
      res.status(400).json({ error: "Key too long" }); return;
    }
    const enc = encrypt(apiKey);
    // Phase 43: field-scoped write — no whole-state read-modify-write race
    const affected = await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(COALESCE(state, '{}')::jsonb, '{coachingKey}', ${JSON.stringify(enc)}::jsonb, true),
          "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    if (!affected) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    console.error("Set coach key error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/key", requireAuth, async (req: Request, res: Response) => {
  try {
    // Phase 43: field-scoped delete — no whole-state read-modify-write race
    const affected = await prisma.$executeRaw`
      UPDATE "User"
      SET state = (COALESCE(state, '{}')::jsonb) - 'coachingKey',
          "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    if (!affected) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    console.error("Delete coach key error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/test", requireAuth, aiBudget(), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { state: true } });
    const st: any = user?.state || {};
    if (!st.coachingKey) { res.status(400).json({ error: "No key configured" }); return; }
    let apiKey: string;
    try { apiKey = decrypt(st.coachingKey); }
    catch { res.status(500).json({ error: "Failed to decrypt key" }); return; }
    const client = new Anthropic({ apiKey });
    await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8,
      messages: [{ role: "user", content: "Reply with the word OK." }],
    });
    res.json({ success: true });
  } catch (err: any) {
    const msg = err?.message || "Unknown error";
    if (msg.includes("authentication") || msg.includes("invalid")) {
      res.status(401).json({ error: "Invalid API key" }); return;
    }
    console.error("Coach key test error:", err);
    res.status(500).json({ error: "Test failed: " + msg.slice(0, 120) });
  }
});

router.post("/generate-now", requireAuth, aiBudget(), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { state: true } });
    const st: any = user?.state || {};
    if (!st.coachingKey) { res.status(400).json({ error: "No API key configured" }); return; }
    const hrs = hoursSinceLastReport(st);
    const minSinceLast = hrs * 60;
    // Phase 43: cooldown raised 60s -> 30min (a full report is the most expensive call)
    if (minSinceLast < 30) {
      res.status(429).json({ error: `Last report was ${Math.round(minSinceLast)} min ago. Try again in ${Math.ceil(30 - minSinceLast)} min.` });
      return;
    }
    const report = await generateWeeklyReport(req.userId as string);
    const id = await saveReport(req.userId as string, report);
    res.json({ success: true, id, suggestions: report.suggestions.length });
  } catch (err: any) {
    console.error("Coach generate-now error:", err);
    res.status(500).json({ error: err?.message?.slice(0, 200) || "Failed to generate report" });
  }
});

router.post("/recompute-macros", requireAuth, aiBudget(), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { state: true } });
    const st: any = user?.state || {};
    if (!st.coachingKey) { res.status(400).json({ error: "No API key configured" }); return; }
    if (!st.mealPlan?.meals?.length) { res.status(400).json({ error: "No meal plan yet — add items first or regenerate" }); return; }
    const hrs = hoursSinceLastPlanRegen(st);
    if (hrs < 1/60) {
      res.status(429).json({ error: `Just recomputed ${Math.round(hrs * 3600)}s ago. Wait a minute.` });
      return;
    }
    const result = await recomputeMealPlanMacros(req.userId as string);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("Recompute macros error:", err);
    res.status(500).json({ error: err?.message?.slice(0, 200) || "Failed to recompute macros" });
  }
});

router.post("/session-brief", requireAuth, aiBudget(), async (req: Request, res: Response) => {
  try {
    const { sessionType, prescriptions } = req.body || {};
    if (!sessionType || !Array.isArray(prescriptions)) {
      res.status(400).json({ error: "sessionType + prescriptions[] required" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { state: true } });
    const st: any = user?.state || {};
    if (!st.coachingKey) { res.status(400).json({ error: "No API key configured" }); return; }
    const brief = await generateSessionBrief(req.userId as string, sessionType, prescriptions);
    res.json({ success: true, brief });
  } catch (err: any) {
    console.error("Session brief error:", err);
    res.status(500).json({ error: err?.message?.slice(0, 200) || "Failed to generate brief" });
  }
});

router.post("/session-reflection", requireAuth, aiBudget(), async (req: Request, res: Response) => {
  try {
    const { sessionType, completedSession } = req.body || {};
    if (!sessionType || !completedSession) {
      res.status(400).json({ error: "sessionType + completedSession required" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { state: true } });
    const st: any = user?.state || {};
    if (!st.coachingKey) { res.status(400).json({ error: "No API key configured" }); return; }
    const reflection = await generateSessionReflection(req.userId as string, sessionType, completedSession);
    res.json({ success: true, reflection });
  } catch (err: any) {
    console.error("Session reflection error:", err);
    res.status(500).json({ error: err?.message?.slice(0, 200) || "Failed to generate reflection" });
  }
});

router.post("/max-lbm", requireAuth, aiBudget(), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { state: true } });
    const st: any = user?.state || {};
    if (!st.coachingKey) { res.status(400).json({ error: "No API key configured" }); return; }
    const projection = await computeMaxLBM(req.userId as string);
    // Phase 43: field-scoped save — no whole-state read-modify-write race
    const projJson = JSON.stringify({ ...projection, computedAt: new Date().toISOString() });
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(COALESCE(state, '{}')::jsonb, '{maxLBMProjection}', ${projJson}::jsonb, true),
          "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true, projection });
  } catch (err: any) {
    console.error("Max LBM error:", err);
    res.status(500).json({ error: err?.message?.slice(0, 200) || "Failed to compute" });
  }
});

router.post("/regenerate-plan", requireAuth, aiBudget(), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { state: true } });
    const st: any = user?.state || {};
    if (!st.coachingKey) { res.status(400).json({ error: "No API key configured" }); return; }
    const hrs = hoursSinceLastPlanRegen(st);
    if (hrs < 1) {
      res.status(429).json({ error: `Plan was just regenerated ${Math.round(hrs * 60)} min ago. Try again later.` });
      return;
    }
    const plan = await generateMealPlan(req.userId as string);
    await saveMealPlan(req.userId as string, plan);
    res.json({ success: true, meals: plan.meals.length, name: plan.name });
  } catch (err: any) {
    console.error("Regenerate plan error:", err);
    res.status(500).json({ error: err?.message?.slice(0, 200) || "Failed to regenerate plan" });
  }
});

// Phase 45: Ask Forge — owner-only structured Q&A about own data
router.post("/ask", requireAuth, requireOwnerCheck, aiBudget(), async (req: Request, res: Response) => {
  try {
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    if (!question) { res.status(400).json({ error: "Question required" }); return; }
    if (question.length > 500) { res.status(400).json({ error: "Keep questions under 500 characters" }); return; }
    const answer = await answerQuestion(req.userId as string, question);
    res.json({ success: true, answer });
  } catch (err: any) {
    console.error("Ask Forge error:", err);
    res.status(500).json({ error: err?.message?.slice(0, 200) || "Failed to answer" });
  }
});

// Phase 49: estimate macros for an ad-hoc food the user types (auto-fill the
// Add Food form). Any user with their own key — no owner gate. aiBudget applies.
router.post("/estimate-food", requireAuth, aiBudget(), async (req: Request, res: Response) => {
  try {
    const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
    if (!description) { res.status(400).json({ error: "Food description required" }); return; }
    if (description.length > 200) { res.status(400).json({ error: "Keep it under 200 characters" }); return; }
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { state: true } });
    const st: any = user?.state || {};
    if (!st.coachingKey) { res.status(400).json({ error: "No API key configured" }); return; }
    const estimate = await estimateFood(req.userId as string, description);
    res.json({ success: true, estimate });
  } catch (err: any) {
    console.error("Estimate food error:", err);
    res.status(500).json({ error: err?.message?.slice(0, 200) || "Failed to estimate" });
  }
});

// Phase 55: Health Records — one-time AI extraction of a pasted lab/DEXA record.
// Returns structured items w/ verbatim snippets + confidence + surfaced conflicts.
router.post("/extract-record", requireAuth, requireOwnerCheck, aiBudget(), async (req: Request, res: Response) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    const type = req.body?.type === "dexa" ? "dexa" : "bloods";
    if (text.trim().length < 20) { res.status(400).json({ error: "Paste the record text first (at least 20 characters)" }); return; }
    if (text.length > 30000) { res.status(400).json({ error: "Record too long (max 30,000 characters)" }); return; }
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { state: true } });
    const st: any = user?.state || {};
    if (!st.coachingKey) { res.status(400).json({ error: "No API key configured — add it in More" }); return; }
    const extraction = await extractHealthRecord(req.userId as string, text, type);
    res.json({ success: true, extraction });
  } catch (err: any) {
    console.error("Extract record error:", err);
    res.status(500).json({ error: err?.message?.slice(0, 200) || "Failed to extract" });
  }
});

// Phase 45: debug view — exactly what the weekly coach sees. No AI call.
router.get("/context-preview", requireAuth, requireOwnerCheck, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.type("text/plain").send(buildContext((user.state as any) || {}));
  } catch (err) {
    console.error("Context preview error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
