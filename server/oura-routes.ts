import { Router, Request, Response } from "express";
import prisma from "./db";
import { requireAuth } from "./auth";
import { syncOuraForUser } from "./oura";

const router = Router();

router.put("/token", requireAuth, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (typeof token !== "string" || !token.trim()) {
      res.status(400).json({ error: "Invalid token" }); return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const state: any = user.state || {};
    state.ouraToken = token.trim();
    await prisma.user.update({ where: { id: req.userId }, data: { state } });
    res.json({ success: true });
  } catch (err) {
    console.error("Set Oura token error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/token", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const state: any = user.state || {};
    delete state.ouraToken;
    delete state.ouraLastSync;
    await prisma.user.update({ where: { id: req.userId }, data: { state } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/sync", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await syncOuraForUser(req.userId!);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/status", requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  const state: any = user?.state || {};
  res.json({
    connected: !!state.ouraToken,
    lastSync: state.ouraLastSync || null,
  });
});

export default router;
