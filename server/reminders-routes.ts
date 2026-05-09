import { Router, Request, Response } from "express";
import prisma from "./db";
import { requireAccessToken } from "./auth";

const router = Router();

router.put("/", requireAccessToken, async (req: Request, res: Response) => {
  try {
    const { reminders } = req.body;
    if (!Array.isArray(reminders)) {
      res.status(400).json({ error: "reminders array required" }); return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const state: any = user.state || {};
    state.reminders = reminders;
    await prisma.user.update({ where: { id: req.userId }, data: { state } });
    res.json({ success: true, count: reminders.length });
  } catch (err) {
    console.error("Update reminders error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", requireAccessToken, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  const state: any = user?.state || {};
  res.json({ reminders: state.reminders || [] });
});

export default router;
