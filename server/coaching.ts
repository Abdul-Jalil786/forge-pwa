import { Router, Request, Response } from "express";
import prisma from "./db";
import { requireAccessToken } from "./auth";

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
    // Cap at 50 most recent
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

export default router;
