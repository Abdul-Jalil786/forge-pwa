import { Router, Request, Response } from "express";
import webpush from "web-push";
import prisma from "./db";
import { requireAuth } from "./auth";

const router = Router();

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:jay@afjltd.co.uk";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

router.get("/public-key", (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC });
});

router.post("/subscribe", requireAuth, async (req: Request, res: Response) => {
  try {
    const { endpoint, keys, name } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: "Invalid subscription" });
      return;
    }
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId: req.userId!, endpoint, p256dh: keys.p256dh, auth: keys.auth, name: name || null },
      update: { userId: req.userId!, p256dh: keys.p256dh, auth: keys.auth, name: name || null },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/subscribe", requireAuth, async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.userId } });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/test", requireAuth, async (req: Request, res: Response) => {
  try {
    const subs = await prisma.pushSubscription.findMany({ where: { userId: req.userId } });
    if (subs.length === 0) {
      res.status(404).json({ error: "No subscriptions found" });
      return;
    }
    let sent = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: "Forge — Test Reminder", body: "Push notifications are working" })
        );
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 410 || e?.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: s.id } });
        }
      }
    }
    res.json({ sent });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
