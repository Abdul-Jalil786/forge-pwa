import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "./db";

const router = Router();

// Phase 42f: fail fast on a missing secret instead of signing tokens with "undefined"
const JWT_SECRET = process.env.JWT_SECRET || "";
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set — refusing to start");
}
if (JWT_SECRET.length < 32) {
  console.error("[auth] WARNING: JWT_SECRET is shorter than 32 chars — use a longer random secret");
}
const JWT_EXPIRY = "30d";

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

// Email validation (basic but sufficient)
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Auth middleware
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

// Phase 37: owner-only gate — for personal features (skin care). Chain AFTER requireAuth.
export const OWNER_EMAIL = "jay@afjltd.co.uk";
export async function requireOwnerCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true } });
    if (!user || user.email.toLowerCase() !== OWNER_EMAIL) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  } catch {
    res.status(403).json({ error: "Forbidden" });
  }
}


// POST /api/auth/signup
// Phase 43 + 43.5: invite-only signup. The door is locked when EITHER the
// INVITE_CODE env var is set OR any one-time invite has ever been created
// (rows persist after use, so the lock never silently reopens). A signup
// passes with the shared env code or a valid unused one-time code. Neither
// gate configured = open signup, so local dev keeps working.
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { email, password, inviteCode } = req.body;

    if (!email || !isValidEmail(email)) {
      res.status(400).json({ error: "Valid email is required" });
      return;
    }
    if (!password || password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const supplied = typeof inviteCode === "string" ? inviteCode.trim() : "";
    const sharedCode = process.env.INVITE_CODE;
    const inviteRowsExist = (await prisma.inviteCode.count()) > 0;
    const gated = !!sharedCode || inviteRowsExist;
    let oneTimeCodeValid = false;
    if (gated) {
      const sharedOk = !!sharedCode && supplied === sharedCode;
      if (!sharedOk && supplied) {
        const row = await prisma.inviteCode.findUnique({ where: { code: supplied } });
        oneTimeCodeValid = !!row && !row.usedAt;
      }
      if (!sharedOk && !oneTimeCodeValid) {
        res.status(403).json({ error: "Invalid invite code — ask the person who invited you" });
        return;
      }
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    // Consume the one-time code atomically — a concurrent signup with the
    // same code loses the updateMany race and gets rejected.
    if (oneTimeCodeValid) {
      const consumed = await prisma.inviteCode.updateMany({
        where: { code: supplied, usedAt: null },
        data: { usedAt: new Date(), usedBy: email },
      });
      if (consumed.count === 0) {
        res.status(403).json({ error: "Invite code already used — ask for a new one" });
        return;
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash },
    });

    const token = signToken(user.id);
    res.status(201).json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Invalid email or password" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signToken(user.id);
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/auth/account
// Phase 43: requires the account password — a stolen/left-open session (30-day
// JWTs) can no longer irreversibly delete all data.
router.delete("/account", requireAuth, async (req: Request, res: Response) => {
  try {
    const { password } = req.body || {};
    if (typeof password !== "string" || !password) {
      res.status(400).json({ error: "Password required to delete account" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }
    await prisma.user.delete({ where: { id: req.userId } });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
