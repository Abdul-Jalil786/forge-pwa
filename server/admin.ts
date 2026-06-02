// Phase 41j — admin-only aggregate stats (owner-gated to jay@afjltd.co.uk).
// Returns counts + per-user breakdown for the founder. Never includes
// individual app state (foods, weights, etc.) — only metadata + flags.
import { Router, Request, Response } from "express";
import prisma from "./db";
import { requireAuth } from "./auth";

const router = Router();
const OWNER_EMAIL = "jay@afjltd.co.uk";

router.get("/stats", requireAuth, async (req: Request, res: Response) => {
  try {
    const requester = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { email: true },
    });
    if (!requester || requester.email !== OWNER_EMAIL) {
      res.status(403).json({ error: "Owner only" });
      return;
    }

    const users = await prisma.user.findMany({
      select: { id: true, email: true, createdAt: true, updatedAt: true, state: true },
    });
    const pushSubs = await prisma.pushSubscription.findMany({ select: { userId: true } });

    const now = Date.now();
    const day = 86400000;
    let active7d = 0, active30d = 0;
    let hasCoachingKey = 0, hasOura = 0, hasWithings = 0;
    let firstSignup: Date | null = null;
    let latestSignup: Date | null = null;
    const userBreakdown: Array<{
      email: string;
      createdAt: string;
      daysSinceUpdate: number;
      hasKey: boolean;
      hasOura: boolean;
      hasWithings: boolean;
    }> = [];

    for (const u of users) {
      const ago = now - u.updatedAt.getTime();
      if (ago < 7 * day) active7d++;
      if (ago < 30 * day) active30d++;
      const state: any = u.state || {};
      const hasKey = !!state.coachingKey;
      const hasO = !!state.ouraToken;
      const hasW = !!state.withings?.accessToken;
      if (hasKey) hasCoachingKey++;
      if (hasO) hasOura++;
      if (hasW) hasWithings++;
      if (!firstSignup || u.createdAt < firstSignup) firstSignup = u.createdAt;
      if (!latestSignup || u.createdAt > latestSignup) latestSignup = u.createdAt;
      userBreakdown.push({
        email: u.email,
        createdAt: u.createdAt.toISOString().slice(0, 10),
        daysSinceUpdate: Math.floor(ago / day),
        hasKey,
        hasOura: hasO,
        hasWithings: hasW,
      });
    }

    // Sort users by most recently active
    userBreakdown.sort((a, b) => a.daysSinceUpdate - b.daysSinceUpdate);

    const pushDevices = pushSubs.length;
    const usersWithPush = new Set(pushSubs.map((p) => p.userId)).size;

    res.json({
      total: users.length,
      active7d,
      active30d,
      hasCoachingKey,
      hasOura,
      hasWithings,
      pushDevices,
      usersWithPush,
      firstSignup: firstSignup?.toISOString() || null,
      latestSignup: latestSignup?.toISOString() || null,
      users: userBreakdown,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
