import { Router, Request, Response } from "express";
import prisma from "./db";
import { requireAuth } from "./auth";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { state: true, updatedAt: true },
    });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ state: user.state, updatedAt: user.updatedAt });
  } catch (err) {
    console.error("Get state error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { state } = req.body;
    if (typeof state !== "object" || state === null) {
      res.status(400).json({ error: "Invalid state object" }); return;
    }
    if (JSON.stringify(state).length > 5 * 1024 * 1024) {
      res.status(413).json({ error: "State too large (max 5MB)" }); return;
    }
    await prisma.user.update({ where: { id: req.userId }, data: { state } });
    res.json({ success: true });
  } catch (err) {
    console.error("Put state error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
