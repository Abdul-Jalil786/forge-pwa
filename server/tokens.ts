import { Router, Request, Response } from "express";
import crypto from "crypto";
import prisma from "./db";
import { requireAuth } from "./auth";

const router = Router();

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const tokens = await prisma.accessToken.findMany({
      where: { userId: req.userId },
      select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ tokens });
  } catch (err) {
    console.error("List tokens error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { name } = req.body || {};
    const plaintext = "forge_pat_" + crypto.randomBytes(24).toString("hex");
    const tokenHash = hashToken(plaintext);
    const prefix = plaintext.slice(0, 14) + "...";
    await prisma.accessToken.create({
      data: { userId: req.userId!, tokenHash, prefix, name: name || null },
    });
    res.status(201).json({ token: plaintext });
  } catch (err) {
    console.error("Create token error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await prisma.accessToken.deleteMany({
      where: { id: req.params.id as string, userId: req.userId },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete token error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
