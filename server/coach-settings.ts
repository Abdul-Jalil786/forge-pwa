import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "./db";
import { requireAuth } from "./auth";
import { encrypt, decrypt } from "./crypto-util";
import { generateWeeklyReport, saveReport, hoursSinceLastReport, generateMealPlan, saveMealPlan, hoursSinceLastPlanRegen, recomputeMealPlanMacros } from "./ai-coach";

const router = Router();

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
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const state: any = user.state || {};
    state.coachingKey = enc;
    await prisma.user.update({ where: { id: req.userId }, data: { state } });
    res.json({ success: true });
  } catch (err) {
    console.error("Set coach key error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/key", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const state: any = user.state || {};
    delete state.coachingKey;
    await prisma.user.update({ where: { id: req.userId }, data: { state } });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete coach key error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/test", requireAuth, async (req: Request, res: Response) => {
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

router.post("/generate-now", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { state: true } });
    const st: any = user?.state || {};
    if (!st.coachingKey) { res.status(400).json({ error: "No API key configured" }); return; }
    const hrs = hoursSinceLastReport(st);
    const minSinceLast = hrs * 60;
    if (minSinceLast < 1) {
      res.status(429).json({ error: `Slow down — last report was ${Math.round(minSinceLast * 60)}s ago. Try again in ${Math.ceil(60 - minSinceLast * 60)}s.` });
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

router.post("/recompute-macros", requireAuth, async (req: Request, res: Response) => {
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

router.post("/regenerate-plan", requireAuth, async (req: Request, res: Response) => {
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

export default router;
