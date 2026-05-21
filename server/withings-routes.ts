import { Router, Request, Response } from "express";
import crypto from "crypto";
import prisma from "./db";
import { requireAuth } from "./auth";
import { getAuthUrl, exchangeCodeForToken, syncWithingsForUser } from "./withings";
import { writeToken } from "./token-crypto";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // OAuth state valid for 10 minutes

const router = Router();
const APP_URL = process.env.APP_URL || "http://localhost:3000";
const REDIRECT_URI = `${APP_URL}/api/withings/callback`;

// Initiate OAuth — generates state, returns auth URL
router.get("/auth-url", requireAuth, async (req: Request, res: Response) => {
  try {
    const oauthState = crypto.randomBytes(24).toString("hex");
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const stateData: any = user?.state || {};
    stateData.withingsOAuthState = { state: oauthState, userId: req.userId, createdAt: Date.now() };
    await prisma.user.update({ where: { id: req.userId }, data: { state: stateData } });
    res.json({ authUrl: getAuthUrl(REDIRECT_URI, oauthState) });
  } catch (err) {
    console.error("Auth-url error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// OAuth callback (no auth — Withings redirects user here)
router.get("/callback", async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };
    // Withings probes the callback URL on registration with no params — return 200 OK
    if (!code && !state) {
      res.status(200).type("text/plain").send("Forge Withings callback OK");
      return;
    }
    if (!code || !state) {
      res.redirect(`/?withings=missing_params`);
      return;
    }
    // Find user by state
    const users = await prisma.user.findMany();
    let matchedUser = null;
    for (const u of users) {
      const s: any = u.state;
      if (s?.withingsOAuthState?.state === state) {
        matchedUser = u;
        break;
      }
    }
    if (!matchedUser) {
      res.redirect(`/?withings=invalid_state`);
      return;
    }
    // Reject expired OAuth sessions (state older than 10 minutes)
    const oauthCreatedAt = (matchedUser.state as any)?.withingsOAuthState?.createdAt || 0;
    if (Date.now() - oauthCreatedAt > OAUTH_STATE_TTL_MS) {
      const expiredState: any = matchedUser.state;
      delete expiredState.withingsOAuthState;
      await prisma.user.update({ where: { id: matchedUser.id }, data: { state: expiredState } });
      res.redirect(`/?withings=expired`);
      return;
    }

    const tokens = await exchangeCodeForToken(code, REDIRECT_URI);
    const userState: any = matchedUser.state;
    delete userState.withingsOAuthState;
    userState.withings = {
      accessToken: writeToken(tokens.access_token),  // encrypted at rest
      refreshToken: writeToken(tokens.refresh_token),
      expiresAt: Date.now() + tokens.expires_in * 1000,
      withingsUserId: tokens.userid,
      scope: tokens.scope,
      connectedAt: new Date().toISOString(),
    };
    await prisma.user.update({ where: { id: matchedUser.id }, data: { state: userState } });

    // Trigger initial sync
    syncWithingsForUser(matchedUser.id).catch(e => console.error("Initial sync:", e));

    res.redirect(`/?withings=connected`);
  } catch (err: any) {
    console.error("Callback error:", err);
    res.redirect(`/?withings=error`);
  }
});

router.get("/status", requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  const state: any = user?.state || {};
  const w = state.withings;
  res.json({
    connected: !!w?.accessToken,
    connectedAt: w?.connectedAt || null,
    lastSync: w?.lastSync || null,
  });
});

router.post("/sync", requireAuth, async (req: Request, res: Response) => {
  const result = await syncWithingsForUser(req.userId!);
  res.json(result);
});

router.delete("/disconnect", requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  const state: any = user?.state || {};
  delete state.withings;
  await prisma.user.update({ where: { id: req.userId }, data: { state } });
  res.json({ success: true });
});

export default router;
