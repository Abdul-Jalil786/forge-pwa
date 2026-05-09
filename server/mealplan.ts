import { Router, Request, Response } from "express";
import prisma from "./db";
import { requireAccessToken } from "./auth";

const router = Router();

router.put("/", requireAccessToken, async (req: Request, res: Response) => {
  try {
    const { mealPlan } = req.body;
    if (!mealPlan || typeof mealPlan !== "object") {
      res.status(400).json({ error: "Invalid mealPlan" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const newState = { ...(user.state as any), mealPlan };
    await prisma.user.update({
      where: { id: req.userId },
      data: { state: newState },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Set meal plan error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
