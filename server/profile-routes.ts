import { Router, Request, Response } from "express";
import prisma from "./db";
import { requireAccessToken } from "./auth";

const router = Router();

const ALLOWED_FIELDS = [
  "calsGym",
  "calsRest",
  "proteinTarget",
  "fatTarget",
  "carbsTarget",
  "targetWeight",
  "targetBF",
  "name",
  "age",
  "height",
];

router.put("/", requireAccessToken, async (req: Request, res: Response) => {
  try {
    const updates = req.body || {};
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const state: any = user.state || {};
    if (!state.profile) state.profile = {};
    const applied: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (!ALLOWED_FIELDS.includes(key)) continue;
      state.profile[key] = value;
      applied[key] = value;
    }
    state.profile.updatedAt = new Date().toISOString();
    state.profile.updatedBy = "cowork";
    await prisma.user.update({ where: { id: req.userId }, data: { state } });
    res.json({ success: true, applied });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", requireAccessToken, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const state: any = user?.state || {};
    res.json({ profile: state.profile || null });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
