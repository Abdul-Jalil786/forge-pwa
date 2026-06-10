// Phase 41j — admin-only aggregate stats (owner-gated to jay@afjltd.co.uk).
// Returns counts + per-user breakdown for the founder. Never includes
// individual app state (foods, weights, etc.) — only metadata + flags.
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "./db";
import { requireAuth, OWNER_EMAIL } from "./auth";

const router = Router();
const APP_URL = process.env.APP_URL || "http://localhost:3000";

async function isOwnerRequest(req: Request): Promise<boolean> {
  const requester = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { email: true },
  });
  return !!requester && requester.email.toLowerCase() === OWNER_EMAIL;
}

// Readable one-time codes: no ambiguous chars (i/l/o/0/1)
function genInviteCode(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(10);
  let s = "";
  for (let i = 0; i < 10; i++) s += chars[bytes[i] % chars.length];
  return s;
}

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

// Phase 43.5: one-time invite links. Creating the FIRST invite locks signup to
// invite-only (see auth.ts) — used rows are kept as the audit trail and door lock.
router.post("/invites", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!(await isOwnerRequest(req))) { res.status(403).json({ error: "Owner only" }); return; }
    const note = typeof req.body?.note === "string" ? req.body.note.slice(0, 60) : null;
    const code = genInviteCode();
    const invite = await prisma.inviteCode.create({ data: { code, note } });
    res.status(201).json({
      id: invite.id,
      code,
      url: `${APP_URL}/login.html?invite=${code}`,
    });
  } catch (err) {
    console.error("Create invite error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/invites", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!(await isOwnerRequest(req))) { res.status(403).json({ error: "Owner only" }); return; }
    const invites = await prisma.inviteCode.findMany({ orderBy: { createdAt: "desc" } });
    res.json({
      invites: invites.map(i => ({
        id: i.id,
        code: i.code,
        note: i.note,
        createdAt: i.createdAt.toISOString(),
        usedAt: i.usedAt ? i.usedAt.toISOString() : null,
        usedBy: i.usedBy,
        url: `${APP_URL}/login.html?invite=${i.code}`,
      })),
    });
  } catch (err) {
    console.error("List invites error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Revoke an UNUSED invite. Used invites are kept — they're the audit trail,
// and deleting the last row would silently reopen signup if INVITE_CODE is unset.
router.delete("/invites/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!(await isOwnerRequest(req))) { res.status(403).json({ error: "Owner only" }); return; }
    const result = await prisma.inviteCode.deleteMany({
      where: { id: req.params.id as string, usedAt: null },
    });
    if (result.count === 0) { res.status(404).json({ error: "Invite not found or already used" }); return; }
    res.json({ success: true });
  } catch (err) {
    console.error("Revoke invite error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 42f: owner-run password reset — for locked-out family members.
// No email infrastructure: the owner sets a temporary password and tells
// the family member, who should change it after logging in.
router.post("/reset-password", requireAuth, async (req: Request, res: Response) => {
  try {
    const requester = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { email: true },
    });
    if (!requester || requester.email.toLowerCase() !== OWNER_EMAIL) {
      res.status(403).json({ error: "Owner only" });
      return;
    }
    const { email, newPassword } = req.body || {};
    if (typeof email !== "string" || !email.includes("@")) {
      res.status(400).json({ error: "Valid email required" });
      return;
    }
    if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 100) {
      res.status(400).json({ error: "Password must be 8-100 characters" });
      return;
    }
    const target = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!target) {
      res.status(404).json({ error: "No user with that email" });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: target.id }, data: { passwordHash } });
    console.log(`[admin] password reset for ${target.email} by owner`);
    res.json({ success: true });
  } catch (err) {
    console.error("Admin password reset error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
