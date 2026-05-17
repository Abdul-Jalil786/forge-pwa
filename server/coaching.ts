import { Router, Request, Response } from "express";
import prisma from "./db";
import { requireAuth, requireAccessToken } from "./auth";

const router = Router();

router.post("/", requireAccessToken, async (req: Request, res: Response) => {
  try {
    const { type, title, content, dateRange } = req.body;
    if (!content || typeof content !== "string") {
      res.status(400).json({ error: "content required" }); return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const state: any = user.state || {};
    const reports = state.coachingReports || [];
    reports.unshift({
      id: "rpt_" + Date.now(),
      createdAt: new Date().toISOString(),
      type: type || "weekly",
      title: title || "Coaching Report",
      content,
      dateRange: dateRange || null,
    });
    if (reports.length > 50) reports.length = 50;
    state.coachingReports = reports;
    await prisma.user.update({ where: { id: req.userId }, data: { state } });
    res.json({ success: true, total: reports.length });
  } catch (err) {
    console.error("Push coaching report error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAccessToken, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const state: any = user.state || {};
    const reports = (state.coachingReports || []).filter((r: any) => r.id !== req.params.id);
    state.coachingReports = reports;
    await prisma.user.update({ where: { id: req.userId }, data: { state } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- Phase 23: suggestion apply / dismiss (user-driven, JWT-auth) ---

function applyMacros(state: any, payload: any) {
  if (!state.profile) state.profile = {};
  if (!state.profile.macros) state.profile.macros = {};
  for (const k of ["calsGym", "calsRest"] as const) {
    if (typeof payload[k] === "number" && payload[k] >= 800 && payload[k] <= 6000) state.profile[k] = payload[k];
  }
  for (const k of ["protein", "carbs", "fat"] as const) {
    if (typeof payload[k] === "number" && payload[k] >= 0 && payload[k] <= 800) state.profile.macros[k] = payload[k];
  }
}

function applyReminders(state: any, payload: any) {
  if (!Array.isArray(state.reminders)) state.reminders = [];
  if (payload?.action === "add" && payload.reminder?.time && payload.reminder?.text) {
    const r = payload.reminder;
    state.reminders.push({
      id: "rem_" + Date.now(),
      time: String(r.time).slice(0, 5),
      text: String(r.text).slice(0, 200),
      days: Array.isArray(r.days) ? r.days.filter((d: any) => Number.isInteger(d) && d >= 0 && d <= 6) : [0,1,2,3,4,5,6],
      enabled: true,
    });
  } else if (payload?.action === "remove" && payload.reminder?.id) {
    state.reminders = state.reminders.filter((r: any) => r.id !== payload.reminder.id);
  }
}

router.post("/:rid/apply/:sid", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const state: any = user.state || {};
    const reports = state.coachingReports || [];
    const report = reports.find((r: any) => r.id === req.params.rid);
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }
    const sug = (report.suggestions || []).find((s: any) => s.id === req.params.sid);
    if (!sug) { res.status(404).json({ error: "Suggestion not found" }); return; }
    if (sug.applied || sug.dismissed) { res.status(409).json({ error: "Already actioned" }); return; }

    try {
      switch (sug.type) {
        case "macros": applyMacros(state, sug.payload || {}); break;
        case "reminders": applyReminders(state, sug.payload || {}); break;
        case "note": break;
        default: res.status(400).json({ error: "Unknown suggestion type" }); return;
      }
    } catch (e: any) {
      res.status(400).json({ error: "Invalid suggestion payload: " + (e?.message || "error") });
      return;
    }

    sug.applied = true;
    sug.appliedAt = new Date().toISOString();
    state.coachingReports = reports;
    await prisma.user.update({ where: { id: req.userId }, data: { state } });
    res.json({ success: true, state });
  } catch (err) {
    console.error("Apply suggestion error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:rid/dismiss/:sid", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const state: any = user.state || {};
    const reports = state.coachingReports || [];
    const report = reports.find((r: any) => r.id === req.params.rid);
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }
    const sug = (report.suggestions || []).find((s: any) => s.id === req.params.sid);
    if (!sug) { res.status(404).json({ error: "Suggestion not found" }); return; }
    sug.dismissed = true;
    sug.dismissedAt = new Date().toISOString();
    state.coachingReports = reports;
    await prisma.user.update({ where: { id: req.userId }, data: { state } });
    res.json({ success: true });
  } catch (err) {
    console.error("Dismiss suggestion error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
