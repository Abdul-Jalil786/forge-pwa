import { Router, Request, Response } from "express";
import crypto from "crypto";
import prisma from "./db";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing token" });
      return;
    }
    const token = auth.slice(7);
    if (!token.startsWith("forge_pat_")) {
      res.status(401).json({ error: "Invalid token format" });
      return;
    }
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const accessToken = await prisma.accessToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { email: true, state: true, updatedAt: true } } },
    });
    if (!accessToken) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    await prisma.accessToken.update({
      where: { id: accessToken.id },
      data: { lastUsedAt: new Date() },
    });
    res.json({
      user: { email: accessToken.user.email },
      state: accessToken.user.state,
      updatedAt: accessToken.user.updatedAt,
    });
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
