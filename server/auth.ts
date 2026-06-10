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
// Phase 43: invite-only — INVITE_CODE env gates signups (family app, not a
// public service). Unset env = open signup, so local dev keeps working.
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { email, password, inviteCode } = req.body;

    const requiredCode = process.env.INVITE_CODE;
    if (requiredCode && inviteCode !== requiredCode) {
      res.status(403).json({ error: "Invalid invite code — ask the person who invited you" });
      return;
    }
    if (!email || !isValidEmail(email)) {
      res.status(400).json({ error: "Valid email is required" });
      return;
    }
    if (!password || password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "Email already in use" });
      return;
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
