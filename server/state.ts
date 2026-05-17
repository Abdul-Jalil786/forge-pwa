import { Router, Request, Response } from "express";
import prisma from "./db";
import { requireAuth } from "./auth";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { state: true, updatedAt: true },
    });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ state: user.state, updatedAt: user.updatedAt });
  } catch (err) {
    console.error("Get state error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/", requireAuth, async (req: Request, res: Response) => {
  console.warn(`[state] Full PUT from user ${req.userId} — prefer field-scoped endpoints`);
  try {
    const { state } = req.body;
    if (typeof state !== "object" || state === null) {
      res.status(400).json({ error: "Invalid state object" }); return;
    }
    if (JSON.stringify(state).length > 5 * 1024 * 1024) {
      res.status(413).json({ error: "State too large (max 5MB)" }); return;
    }
    await prisma.user.update({ where: { id: req.userId }, data: { state } });
    res.json({ success: true });
  } catch (err) {
    console.error("Put state error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- Field-scoped atomic updates (Phase 16a) ---
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.put("/foods/:date", requireAuth, async (req: Request, res: Response) => {
  try {
    const date = req.params.date as string;
    if (!DATE_RE.test(date)) { res.status(400).json({ error: "Invalid date" }); return; }
    const valueJson = JSON.stringify(req.body.value ?? []);
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(
        jsonb_set(COALESCE(state, '{}')::jsonb, '{foods}', COALESCE(state->'foods', '{}'), true),
        ARRAY['foods', ${date}],
        ${valueJson}::jsonb
      ),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true });
  } catch (err) {
    console.error("Put foods error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/exLog/:date", requireAuth, async (req: Request, res: Response) => {
  try {
    const date = req.params.date as string;
    if (!DATE_RE.test(date)) { res.status(400).json({ error: "Invalid date" }); return; }
    const valueJson = JSON.stringify(req.body.value ?? {});
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(
        jsonb_set(COALESCE(state, '{}')::jsonb, '{exLog}', COALESCE(state->'exLog', '{}'), true),
        ARRAY['exLog', ${date}],
        ${valueJson}::jsonb
      ),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true });
  } catch (err) {
    console.error("Put exLog error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/water/:date", requireAuth, async (req: Request, res: Response) => {
  try {
    const date = req.params.date as string;
    if (!DATE_RE.test(date)) { res.status(400).json({ error: "Invalid date" }); return; }
    const cupsJson = JSON.stringify(req.body.cups ?? 0);
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(COALESCE(state, '{}')::jsonb, '{water}', COALESCE(state->'water', '{}'), true),
            '{waterClicked}', COALESCE(state->'waterClicked', '{}'), true
          ),
          ARRAY['water', ${date}],
          ${cupsJson}::jsonb
        ),
        ARRAY['waterClicked', ${date}],
        'true'::jsonb
      ),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true });
  } catch (err) {
    console.error("Put water error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/weight", requireAuth, async (req: Request, res: Response) => {
  try {
    const { date, weight } = req.body;
    if (!date || typeof weight !== "number") { res.status(400).json({ error: "Invalid weight data" }); return; }
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(
        COALESCE(state, '{}')::jsonb,
        '{weightLog}',
        (
          COALESCE(
            (SELECT jsonb_agg(e) FROM jsonb_array_elements(COALESCE(state->'weightLog', '[]'::jsonb)) e WHERE e->>'date' != ${date}),
            '[]'::jsonb
          ) || jsonb_build_array(jsonb_build_object('date', ${date}::text, 'weight', ${weight}::numeric))
        )
      ),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true });
  } catch (err) {
    console.error("Put weight error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 24: food preferences (subfield of profile)
router.put("/profile/food-prefs", requireAuth, async (req: Request, res: Response) => {
  try {
    const { excluded, notes, refreshCadence } = req.body || {};
    if (!Array.isArray(excluded)) { res.status(400).json({ error: "excluded must be an array" }); return; }
    if (excluded.some((e) => typeof e !== "string" || e.length > 60)) { res.status(400).json({ error: "excluded items must be strings <= 60 chars" }); return; }
    if (excluded.length > 50) { res.status(400).json({ error: "max 50 excluded items" }); return; }
    if (notes != null && (typeof notes !== "string" || notes.length > 2000)) { res.status(400).json({ error: "notes must be a string <= 2000 chars" }); return; }
    const validCadences = ["weekly-sunday", "biweekly", "manual"];
    if (refreshCadence != null && !validCadences.includes(refreshCadence)) { res.status(400).json({ error: "invalid refreshCadence" }); return; }
    const valueJson = JSON.stringify({
      excluded: excluded.map((s: string) => s.trim().toLowerCase()).filter(Boolean),
      notes: typeof notes === "string" ? notes : "",
      refreshCadence: refreshCadence || "weekly-sunday",
      updatedAt: new Date().toISOString(),
    });
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(
        jsonb_set(COALESCE(state, '{}')::jsonb, '{profile}', COALESCE(state->'profile', '{}'), true),
        '{profile,foodPrefs}',
        ${valueJson}::jsonb,
        true
      ),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true });
  } catch (err) {
    console.error("Put food-prefs error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/sleep/:date", requireAuth, async (req: Request, res: Response) => {
  try {
    const date = req.params.date as string;
    if (!DATE_RE.test(date)) { res.status(400).json({ error: "Invalid date" }); return; }
    const valueJson = JSON.stringify(req.body.value ?? {});
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(
        jsonb_set(COALESCE(state, '{}')::jsonb, '{sleepLog}', COALESCE(state->'sleepLog', '{}'), true),
        ARRAY['sleepLog', ${date}],
        ${valueJson}::jsonb
      ),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true });
  } catch (err) {
    console.error("Put sleep error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
