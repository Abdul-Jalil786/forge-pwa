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

// Phase 26a: user edits to the meal plan (add/remove/edit ingredients)
router.put("/meal-plan", requireAuth, async (req: Request, res: Response) => {
  try {
    const { mealPlan } = req.body;
    if (!mealPlan || typeof mealPlan !== "object") { res.status(400).json({ error: "mealPlan must be an object" }); return; }
    if (!Array.isArray(mealPlan.meals)) { res.status(400).json({ error: "mealPlan.meals must be an array" }); return; }
    if (mealPlan.meals.length > 20) { res.status(400).json({ error: "max 20 meals" }); return; }
    // Validate against exclusions
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { state: true } });
    const st: any = user?.state || {};
    const excluded = (st.profile?.foodPrefs?.excluded || []).map((e: string) => String(e).toLowerCase().trim()).filter(Boolean);
    for (const m of mealPlan.meals) {
      if (!Array.isArray(m.ingredients)) continue;
      for (const ing of m.ingredients) {
        const name = String(ing?.name || "").toLowerCase();
        for (const ex of excluded) {
          if (name.includes(ex)) { res.status(400).json({ error: `Excluded food "${ex}" found in "${ing.name}"` }); return; }
        }
      }
    }
    const valueJson = JSON.stringify(mealPlan);
    if (valueJson.length > 200000) { res.status(413).json({ error: "Meal plan too large" }); return; }
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(COALESCE(state, '{}')::jsonb, '{mealPlan}', ${valueJson}::jsonb, true),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true });
  } catch (err) {
    console.error("Put meal-plan error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 35: skin care — products config + daily routine log
router.put("/skin-care", requireAuth, async (req: Request, res: Response) => {
  try {
    const { skinCare } = req.body || {};
    if (!skinCare || typeof skinCare !== "object") { res.status(400).json({ error: "skinCare object required" }); return; }
    if (!Array.isArray(skinCare.products)) { res.status(400).json({ error: "skinCare.products must be an array" }); return; }
    if (skinCare.products.length > 40) { res.status(400).json({ error: "max 40 products" }); return; }
    const valueJson = JSON.stringify(skinCare);
    if (valueJson.length > 60000) { res.status(413).json({ error: "skinCare too large" }); return; }
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(COALESCE(state, '{}')::jsonb, '{skinCare}', ${valueJson}::jsonb, true),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true });
  } catch (err) {
    console.error("Put skin-care error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/skin-care-log/:date", requireAuth, async (req: Request, res: Response) => {
  try {
    const date = req.params.date as string;
    if (!DATE_RE.test(date)) { res.status(400).json({ error: "Invalid date" }); return; }
    const valueJson = JSON.stringify(req.body.value ?? {});
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(
        jsonb_set(COALESCE(state, '{}')::jsonb, '{skinCareLog}', COALESCE(state->'skinCareLog', '{}'), true),
        ARRAY['skinCareLog', ${date}],
        ${valueJson}::jsonb,
        true
      ),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true });
  } catch (err) {
    console.error("Put skin-care-log error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 27 + 32: personal demographics (subfield of profile)
router.put("/profile/personal", requireAuth, async (req: Request, res: Response) => {
  try {
    const { age, heightCm, sex, ethnicity, activityLevel, phase, targetLBMStretch } = req.body || {};
    const out: any = {};
    if (age != null) {
      if (typeof age !== "number" || age < 10 || age > 120) { res.status(400).json({ error: "age must be 10-120" }); return; }
      out.age = Math.round(age);
    }
    if (heightCm != null) {
      if (typeof heightCm !== "number" || heightCm < 100 || heightCm > 250) { res.status(400).json({ error: "heightCm must be 100-250" }); return; }
      out.heightCm = Math.round(heightCm);
    }
    if (sex != null) {
      if (!["male", "female", "other"].includes(sex)) { res.status(400).json({ error: "sex must be male|female|other" }); return; }
      out.sex = sex;
    }
    if (ethnicity != null) {
      const valid = ["south-asian", "white", "black", "east-asian", "mixed", "other", "prefer-not-to-say"];
      if (!valid.includes(ethnicity)) { res.status(400).json({ error: "invalid ethnicity" }); return; }
      out.ethnicity = ethnicity;
    }
    if (activityLevel != null) {
      const valid = ["sedentary", "light", "moderate", "very-active"];
      if (!valid.includes(activityLevel)) { res.status(400).json({ error: "invalid activityLevel" }); return; }
      out.activityLevel = activityLevel;
    }
    if (phase != null) {
      const valid = ["cut", "recomp", "lean-bulk", "maintenance"];
      if (!valid.includes(phase)) { res.status(400).json({ error: "invalid phase" }); return; }
      out.phase = phase;
    }
    if (targetLBMStretch != null) {
      if (typeof targetLBMStretch !== "number" || targetLBMStretch < 30 || targetLBMStretch > 150) {
        res.status(400).json({ error: "targetLBMStretch must be 30-150" }); return;
      }
      out.targetLBMStretch = Math.round(targetLBMStretch * 10) / 10;
    }
    out.updatedAt = new Date().toISOString();
    const valueJson = JSON.stringify(out);
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(
        jsonb_set(COALESCE(state, '{}')::jsonb, '{profile}', COALESCE(state->'profile', '{}'), true),
        '{profile,personal}',
        ${valueJson}::jsonb,
        true
      ),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true });
  } catch (err) {
    console.error("Put personal error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 29a: blood markers (subfield of profile)
router.put("/profile/blood-markers", requireAuth, async (req: Request, res: Response) => {
  try {
    const { bloodMarkers } = req.body || {};
    if (!Array.isArray(bloodMarkers)) { res.status(400).json({ error: "bloodMarkers must be an array" }); return; }
    if (bloodMarkers.length > 100) { res.status(400).json({ error: "max 100 markers" }); return; }
    const clean = bloodMarkers.map((m: any) => {
      if (!m || typeof m !== "object") return null;
      const name = String(m.name || "").trim().slice(0, 120);
      if (!name) return null;
      const value = typeof m.value === "number" ? m.value : (m.value != null ? Number(m.value) : null);
      if (value != null && !Number.isFinite(value)) return null;
      const refLow = typeof m.refLow === "number" ? m.refLow : (m.refLow != null ? Number(m.refLow) : null);
      const refHigh = typeof m.refHigh === "number" ? m.refHigh : (m.refHigh != null ? Number(m.refHigh) : null);
      return {
        id: String(m.id || "").trim().slice(0, 80) || ("blm_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6)),
        name,
        value,
        unit: String(m.unit || "").trim().slice(0, 30),
        refLow: refLow != null && Number.isFinite(refLow) ? refLow : null,
        refHigh: refHigh != null && Number.isFinite(refHigh) ? refHigh : null,
        date: String(m.date || "").trim().slice(0, 10),
        category: String(m.category || "").trim().slice(0, 40),
        notes: String(m.notes || "").trim().slice(0, 400),
      };
    }).filter(Boolean);
    const valueJson = JSON.stringify(clean);
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(
        jsonb_set(COALESCE(state, '{}')::jsonb, '{profile}', COALESCE(state->'profile', '{}'), true),
        '{profile,bloodMarkers}',
        ${valueJson}::jsonb,
        true
      ),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true, count: clean.length });
  } catch (err) {
    console.error("Put blood-markers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 27: medications (subfield of profile)
router.put("/profile/medications", requireAuth, async (req: Request, res: Response) => {
  try {
    const { medications } = req.body || {};
    if (!Array.isArray(medications)) { res.status(400).json({ error: "medications must be an array" }); return; }
    if (medications.length > 30) { res.status(400).json({ error: "max 30 medications" }); return; }
    const clean = medications.map((m: any) => {
      if (!m || typeof m !== "object") return null;
      const name = String(m.name || "").trim().slice(0, 120);
      if (!name) return null;
      return {
        id: String(m.id || "").trim().slice(0, 80) || ("med_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6)),
        name,
        dose: String(m.dose || "").trim().slice(0, 60),
        schedule: String(m.schedule || "").trim().slice(0, 120),
        notes: String(m.notes || "").trim().slice(0, 400),
      };
    }).filter(Boolean);
    const valueJson = JSON.stringify(clean);
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(
        jsonb_set(COALESCE(state, '{}')::jsonb, '{profile}', COALESCE(state->'profile', '{}'), true),
        '{profile,medications}',
        ${valueJson}::jsonb,
        true
      ),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true, count: clean.length });
  } catch (err) {
    console.error("Put medications error:", err);
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
