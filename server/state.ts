import { Router, Request, Response } from "express";
import prisma from "./db";
import { requireAuth, requireOwnerCheck } from "./auth";

const router = Router();

// Phase 43: server-only secrets. Never sent to the client (GET strips them) and
// never client-writable (full PUT copies them back from the DB row). The
// frontend never reads these fields — it uses the status endpoints instead.
//   coachingKey       — AES-256-GCM-encrypted Anthropic API key
//   ouraToken         — Oura PAT (encrypted, v1: prefix; legacy plaintext during migration)
//   withings          — { accessToken, refreshToken (both encrypted), expiresAt, … }
//   withingsOAuthState — short-lived OAuth state secret
export const SERVER_ONLY_FIELDS = ["coachingKey", "ouraToken", "withings", "withingsOAuthState"] as const;

export function stripServerOnlyFields(state: any): any {
  if (!state || typeof state !== "object") return state;
  const clean = JSON.parse(JSON.stringify(state));
  for (const f of SERVER_ONLY_FIELDS) delete clean[f];
  return clean;
}

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { state: true, updatedAt: true },
    });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ state: stripServerOnlyFields(user.state), updatedAt: user.updatedAt });
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
    // Phase 43: secrets survive any full-state write — whatever the client sent
    // for these fields is discarded and the stored values carried over.
    const existing = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { state: true },
    });
    if (!existing) { res.status(404).json({ error: "User not found" }); return; }
    const existingState: any = existing.state || {};
    for (const f of SERVER_ONLY_FIELDS) {
      if (existingState[f] !== undefined) state[f] = existingState[f];
      else delete state[f];
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

// Phase 35 + 37: skin care — products config + daily routine log (owner-only)
router.put("/skin-care", requireAuth, requireOwnerCheck, async (req: Request, res: Response) => {
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

router.put("/skin-care-log/:date", requireAuth, requireOwnerCheck, async (req: Request, res: Response) => {
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

// Phase 37: weekly skin journal entry (Sunday check-in)
router.put("/skin-care-weekly/:date", requireAuth, requireOwnerCheck, async (req: Request, res: Response) => {
  try {
    const date = req.params.date as string;
    if (!DATE_RE.test(date)) { res.status(400).json({ error: "Invalid date" }); return; }
    const { score, trend, notes } = req.body || {};
    const entry = {
      score: typeof score === "number" ? Math.max(1, Math.min(10, Math.round(score))) : null,
      trend: ["better", "same", "worse"].includes(trend) ? trend : null,
      notes: typeof notes === "string" ? notes.slice(0, 200) : "",
      date,
    };
    const valueJson = JSON.stringify(entry);
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(
        jsonb_set(
          jsonb_set(COALESCE(state, '{}')::jsonb, '{skinCare}', COALESCE(state->'skinCare', '{}'), true),
          '{skinCare,weeklyCheckIn}', COALESCE(state->'skinCare'->'weeklyCheckIn', '{}'), true
        ),
        ARRAY['skinCare', 'weeklyCheckIn', ${date}],
        ${valueJson}::jsonb,
        true
      ),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true, entry });
  } catch (err) {
    console.error("Put skin-care-weekly error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 37: retinol phase update. Advancing phase also re-frequencies the retinol + cicaplast
// products to match. One atomic write of the whole skinCare object.
const PHASE_FREQ: Record<number, string> = { 1: "every-4-days", 2: "every-3-days", 3: "every-2-days", 4: "5x-week", 5: "daily", 6: "daily" };
router.put("/skin-care-phase", requireAuth, requireOwnerCheck, async (req: Request, res: Response) => {
  try {
    const { phase, tretinoinReady } = req.body || {};
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { state: true } });
    const st: any = user?.state || {};
    const sc = st.skinCare || { products: [] };
    if (phase != null) {
      if (typeof phase !== "number" || phase < 1 || phase > 6) { res.status(400).json({ error: "phase must be 1-6" }); return; }
      sc.phase = Math.round(phase);
      sc.phaseStartDate = new Date().toISOString().slice(0, 10);
      const freq = PHASE_FREQ[sc.phase];
      if (freq && Array.isArray(sc.products)) {
        for (const p of sc.products) {
          if (p.type === "retinol" || p.id === "skn-cicaplast") {
            p.frequency = freq;
            p.frequencyStartedAt = sc.phaseStartDate;
          }
        }
      }
    }
    if (tretinoinReady != null) sc.tretinoinReady = !!tretinoinReady;
    const valueJson = JSON.stringify(sc);
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(COALESCE(state, '{}')::jsonb, '{skinCare}', ${valueJson}::jsonb, true),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true, skinCare: sc });
  } catch (err) {
    console.error("Put skin-care-phase error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 27 + 32: personal demographics (subfield of profile)
router.put("/profile/personal", requireAuth, async (req: Request, res: Response) => {
  try {
    const { age, heightCm, sex, ethnicity, activityLevel, phase, targetLBMStretch, dateOfBirth } = req.body || {};
    const out: any = {};
    if (age != null) {
      if (typeof age !== "number" || age < 10 || age > 120) { res.status(400).json({ error: "age must be 10-120" }); return; }
      out.age = Math.round(age);
    }
    if (dateOfBirth != null) {
      if (typeof dateOfBirth !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || isNaN(new Date(dateOfBirth + "T12:00:00").getTime())) {
        res.status(400).json({ error: "dateOfBirth must be YYYY-MM-DD" }); return;
      }
      out.dateOfBirth = dateOfBirth;
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
    // Phase 57: MERGE into existing personal (was a wholesale replace, which would
    // drop any field not included in the request — e.g. the seeded dateOfBirth).
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(
        jsonb_set(COALESCE(state, '{}')::jsonb, '{profile}', COALESCE(state->'profile', '{}'), true),
        '{profile,personal}',
        COALESCE(state->'profile'->'personal', '{}'::jsonb) || ${valueJson}::jsonb,
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

// Phase 57: coach-config — the profile-level fields that de-hardcode the AI-coach
// prompts (health conditions, coach targets, GLP-1 injection day, eating window),
// so they're editable from state rather than baked into prompt text.
router.put("/profile/coach-config", requireAuth, async (req: Request, res: Response) => {
  try {
    const body: any = req.body || {};
    let did = false;

    // Health conditions — full-array replace (the list IS the whole value).
    if (body.healthConditions != null) {
      if (!Array.isArray(body.healthConditions) || body.healthConditions.length > 40) { res.status(400).json({ error: "healthConditions must be an array (max 40)" }); return; }
      const clean = body.healthConditions.map((c: any) => ({ key: String(c?.key || "").slice(0, 40), label: String(c?.label || c?.key || "").slice(0, 120), notes: c?.notes ? String(c.notes).slice(0, 300) : undefined }));
      const json = JSON.stringify(clean);
      await prisma.$executeRaw`
        UPDATE "User" SET state = jsonb_set(
          jsonb_set(COALESCE(state, '{}')::jsonb, '{profile}', COALESCE(state->'profile', '{}'), true),
          '{profile,healthConditions}', ${json}::jsonb, true
        ), "updatedAt" = NOW() WHERE id = ${req.userId}`;
      did = true;
    }

    // Coach targets — validated per-field ranges, MERGED into existing so a
    // partial update never drops the other target keys.
    if (body.coachTargets != null) {
      if (typeof body.coachTargets !== "object") { res.status(400).json({ error: "coachTargets must be an object" }); return; }
      const RANGES: Record<string, [number, number]> = {
        proteinFloorDaily: [100, 350], proteinPerMeal: [20, 80],
        waterRestMl: [1000, 6000], waterGymMl: [1000, 6000],
        deficitKcal: [0, 1200], trainingBonusUpper: [0, 1000], trainingBonusLower: [0, 1000],
      };
      const ct: any = {};
      for (const k of Object.keys(RANGES)) {
        if (body.coachTargets[k] != null) {
          const n = Number(body.coachTargets[k]); const [lo, hi] = RANGES[k];
          if (!Number.isFinite(n) || n < lo || n > hi) { res.status(400).json({ error: `coachTargets.${k} must be ${lo}-${hi}` }); return; }
          ct[k] = Math.round(n);
        }
      }
      const json = JSON.stringify(ct);
      await prisma.$executeRaw`
        UPDATE "User" SET state = jsonb_set(
          jsonb_set(COALESCE(state, '{}')::jsonb, '{profile}', COALESCE(state->'profile', '{}'), true),
          '{profile,coachTargets}', COALESCE(state->'profile'->'coachTargets', '{}'::jsonb) || ${json}::jsonb, true
        ), "updatedAt" = NOW() WHERE id = ${req.userId}`;
      did = true;
    }

    // GLP-1 injection day — scalar replace (0-6).
    if (body.glp1InjectionDow != null) {
      const d = Number(body.glp1InjectionDow);
      if (!Number.isInteger(d) || d < 0 || d > 6) { res.status(400).json({ error: "glp1InjectionDow must be 0-6" }); return; }
      const json = JSON.stringify(d);
      await prisma.$executeRaw`
        UPDATE "User" SET state = jsonb_set(
          jsonb_set(COALESCE(state, '{}')::jsonb, '{profile}', COALESCE(state->'profile', '{}'), true),
          '{profile,glp1InjectionDow}', ${json}::jsonb, true
        ), "updatedAt" = NOW() WHERE id = ${req.userId}`;
      did = true;
    }

    // Eating window — clamped, MERGED into existing.
    if (body.eatingWindow != null) {
      const e: any = body.eatingWindow;
      const ew = { enabled: e.enabled !== false, start: Math.max(0, Math.min(23, Math.round(Number(e.start) || 12))), end: Math.max(1, Math.min(24, Math.round(Number(e.end) || 20))) };
      const json = JSON.stringify(ew);
      await prisma.$executeRaw`
        UPDATE "User" SET state = jsonb_set(
          jsonb_set(COALESCE(state, '{}')::jsonb, '{profile}', COALESCE(state->'profile', '{}'), true),
          '{profile,eatingWindow}', COALESCE(state->'profile'->'eatingWindow', '{}'::jsonb) || ${json}::jsonb, true
        ), "updatedAt" = NOW() WHERE id = ${req.userId}`;
      did = true;
    }

    // Proactive coach kill switch (boolean).
    if (body.coachProactive != null) {
      const json = JSON.stringify(body.coachProactive === true);
      await prisma.$executeRaw`
        UPDATE "User" SET state = jsonb_set(
          jsonb_set(COALESCE(state, '{}')::jsonb, '{profile}', COALESCE(state->'profile', '{}'), true),
          '{profile,coachProactive}', ${json}::jsonb, true
        ), "updatedAt" = NOW() WHERE id = ${req.userId}`;
      did = true;
    }

    if (!did) { res.status(400).json({ error: "no valid fields" }); return; }
    res.json({ success: true });
  } catch (err) {
    console.error("Put coach-config error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 54: active-phase editor — sets the canonical profile.activePhase record and
// syncs the derived fields the rest of the app reads (phase, targetWeight, targetBF)
// in one statement so a concurrent profile write can't half-apply.
router.put("/profile/active-phase", requireAuth, async (req: Request, res: Response) => {
  try {
    const b: any = req.body || {};
    const PHASES = ["Cut", "Recomp", "Maintenance", "Lean-bulk"];
    const phase = String(b.phase || "").trim();
    if (!PHASES.includes(phase)) { res.status(400).json({ error: "phase must be one of " + PHASES.join("|") }); return; }
    const num = (v: any, lo: number, hi: number): number | null => {
      const n = Number(v);
      return (isFinite(n) && n >= lo && n <= hi) ? Math.round(n * 10) / 10 : null;
    };
    const calorieTarget = num(b.calorieTarget, 800, 6000);
    const goalWeight = num(b.goalWeight, 30, 400);
    if (calorieTarget == null) { res.status(400).json({ error: "calorieTarget must be 800-6000" }); return; }
    if (goalWeight == null) { res.status(400).json({ error: "goalWeight must be 30-400" }); return; }
    const proteinFloor = num(b.proteinFloor, 0, 500) ?? 0;
    const calorieFloor = num(b.calorieFloor, 0, 6000) ?? 0;
    const startWeight = num(b.startWeight, 30, 400);
    const targetBFLow = num(b.targetBFLow, 3, 60);
    const targetBFHigh = num(b.targetBFHigh, 3, 60);
    const startDate = (typeof b.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.startDate)) ? b.startDate : new Date().toISOString().slice(0, 10);

    const ap = { phase, startDate, calorieTarget, proteinFloor, calorieFloor, startWeight, goalWeight, targetBFLow, targetBFHigh, updatedAt: new Date().toISOString() };
    const apJson = JSON.stringify(ap);
    const phaseLower = JSON.stringify(phase.toLowerCase());
    const gw = JSON.stringify(goalWeight);
    const tbf = JSON.stringify(targetBFHigh != null ? targetBFHigh : null);

    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(COALESCE(state,'{}')::jsonb, '{profile}', COALESCE(state->'profile','{}'), true),
              '{profile,activePhase}', ${apJson}::jsonb, true
            ),
            '{profile,phase}', ${phaseLower}::jsonb, true
          ),
          '{profile,targetWeight}', ${gw}::jsonb, true
        ),
        '{profile,targetBF}', ${tbf}::jsonb, true
      ),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true, activePhase: ap });
  } catch (err) {
    console.error("Put active-phase error:", err);
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

// Phase 38: injury flags — object keyed by injury id
router.put("/injuries", requireAuth, async (req: Request, res: Response) => {
  try {
    const { injuries } = req.body || {};
    if (!injuries || typeof injuries !== "object" || Array.isArray(injuries)) {
      res.status(400).json({ error: "injuries must be an object" }); return;
    }
    const keys = Object.keys(injuries);
    if (keys.length > 100) { res.status(400).json({ error: "max 100 injuries" }); return; }
    const validSev = ["mild", "moderate", "severe"];
    const clean: Record<string, any> = {};
    for (const k of keys) {
      const j = injuries[k];
      if (!j || typeof j !== "object") continue;
      const id = String(j.id || k).trim().slice(0, 80) || ("inj_" + Date.now());
      clean[id] = {
        id,
        name: String(j.name || "Injury").trim().slice(0, 120),
        bodyPart: String(j.bodyPart || "").trim().slice(0, 80),
        severity: validSev.includes(j.severity) ? j.severity : "mild",
        affectedExercises: Array.isArray(j.affectedExercises)
          ? j.affectedExercises.map((e: any) => String(e).slice(0, 40)).slice(0, 40)
          : [],
        status: j.status === "resolved" ? "resolved" : "active",
        notes: String(j.notes || "").trim().slice(0, 400),
        createdAt: String(j.createdAt || "").slice(0, 10),
        resolvedAt: j.resolvedAt ? String(j.resolvedAt).slice(0, 10) : null,
      };
    }
    const valueJson = JSON.stringify(clean);
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(COALESCE(state, '{}')::jsonb, '{injuries}', ${valueJson}::jsonb, true),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true, count: Object.keys(clean).length });
  } catch (err) {
    console.error("Put injuries error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 38: per day-of-week training session times (subfield of profile)
router.put("/profile/session-times", requireAuth, async (req: Request, res: Response) => {
  try {
    const { sessionTimes } = req.body || {};
    if (!sessionTimes || typeof sessionTimes !== "object" || Array.isArray(sessionTimes)) {
      res.status(400).json({ error: "sessionTimes must be an object" }); return;
    }
    const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
    const clean: Record<string, string | null> = {};
    for (let d = 0; d < 7; d++) {
      const v = sessionTimes[String(d)];
      if (v == null || v === "") { clean[String(d)] = null; continue; }
      if (typeof v !== "string" || !TIME_RE.test(v)) {
        res.status(400).json({ error: `invalid time for day ${d} (use HH:MM)` }); return;
      }
      clean[String(d)] = v;
    }
    const valueJson = JSON.stringify(clean);
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(
        jsonb_set(COALESCE(state, '{}')::jsonb, '{profile}', COALESCE(state->'profile', '{}'), true),
        '{profile,sessionTimes}',
        ${valueJson}::jsonb,
        true
      ),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true });
  } catch (err) {
    console.error("Put session-times error:", err);
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

// --- Phase 39: nutrition system field-scoped endpoints ---

// Generic date-keyed jsonb_set helper for the new nutrition logs
function dateKeyedRoute(path: string, stateKey: string) {
  router.put(path, requireAuth, async (req: Request, res: Response) => {
    try {
      const date = req.params.date as string;
      if (!DATE_RE.test(date)) { res.status(400).json({ error: "Invalid date" }); return; }
      const valueJson = JSON.stringify(req.body.value ?? {});
      if (valueJson.length > 60000) { res.status(413).json({ error: "Value too large" }); return; }
      await prisma.$executeRaw`
        UPDATE "User"
        SET state = jsonb_set(
          jsonb_set(COALESCE(state, '{}')::jsonb, ARRAY[${stateKey}], COALESCE(state->${stateKey}, '{}'), true),
          ARRAY[${stateKey}, ${date}],
          ${valueJson}::jsonb,
          true
        ),
        "updatedAt" = NOW()
        WHERE id = ${req.userId}
      `;
      res.json({ success: true });
    } catch (err) {
      console.error(`Put ${stateKey} error:`, err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
dateKeyedRoute("/fasting-log/:date", "fastingLog");
dateKeyedRoute("/mounjaro-log/:date", "mounjaroLog");
dateKeyedRoute("/water-log/:date", "waterLog");
dateKeyedRoute("/supplement-log/:date", "supplementLog");
dateKeyedRoute("/stretch-log/:date", "stretchLog"); // Phase 41 (owner-only feature, but endpoint is per-user data)
dateKeyedRoute("/cardio-log/:date", "cardioLog"); // Phase 41i (zone-2 cardio sessions, any user)
dateKeyedRoute("/food-complete/:date", "foodComplete"); // Phase 48a ("that's everything I ate today")
dateKeyedRoute("/session-feel/:date", "sessionFeel"); // Phase 44 (pre-session feel tap)
dateKeyedRoute("/recovery-overrides/:date", "recoveryOverrides"); // Phase 44 (advisory gate choices)

// Phase 47: per-exercise running notes — whole-object atomic write (jsonb_set)
router.put("/exercise-notes", requireAuth, async (req: Request, res: Response) => {
  try {
    const v = req.body?.value;
    if (typeof v !== "object" || v === null || Array.isArray(v)) { res.status(400).json({ error: "object required" }); return; }
    const json = JSON.stringify(v);
    if (json.length > 40000) { res.status(413).json({ error: "too large" }); return; }
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(COALESCE(state, '{}')::jsonb, '{exerciseNotes}', ${json}::jsonb, true),
          "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true });
  } catch (err) {
    console.error("Put exercise-notes error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 41o: DEXA body-composition scans (full-array PUT pattern, like bp-log)
router.put("/dexa-scans", requireAuth, async (req: Request, res: Response) => {
  try {
    const { dexaScans } = req.body || {};
    if (!Array.isArray(dexaScans)) { res.status(400).json({ error: "dexaScans must be an array" }); return; }
    if (dexaScans.length > 200) { res.status(400).json({ error: "max 200 scans" }); return; }
    const num = (v: any, lo: number, hi: number) => {
      if (v == null || v === "") return null;
      const n = +v;
      if (!Number.isFinite(n) || n < lo || n > hi) return null;
      return n;
    };
    const clean = dexaScans.map((s: any) => {
      if (!s || typeof s !== "object") return null;
      return {
        id: String(s.id || "").slice(0, 60) || ("dexa_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6)),
        date: String(s.date || "").slice(0, 10),
        provider: String(s.provider || "").slice(0, 80),
        weight: num(s.weight, 30, 300),
        bodyFatPct: num(s.bodyFatPct, 1, 70),
        fatMass: num(s.fatMass, 0, 200),
        leanMass: num(s.leanMass, 10, 200),
        boneMass: num(s.boneMass, 0.5, 10),
        vatCm2: num(s.vatCm2, 0, 500),
        bmdTotal: num(s.bmdTotal, 0.3, 2.5),
        tScore: num(s.tScore, -6, 6),
        zScore: num(s.zScore, -6, 6),
        lmi: num(s.lmi, 5, 40),
        almi: num(s.almi, 3, 20),
        fmi: num(s.fmi, 0, 30),
        androidFatPct: num(s.androidFatPct, 1, 80),
        gynoidFatPct: num(s.gynoidFatPct, 1, 80),
        muscleSymmetryPct: num(s.muscleSymmetryPct, 0, 100),
        longevityIndex: num(s.longevityIndex, 0, 100),
        notes: String(s.notes || "").slice(0, 400),
        loggedAt: String(s.loggedAt || new Date().toISOString()).slice(0, 30),
      };
    }).filter(Boolean);
    const valueJson = JSON.stringify(clean);
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(COALESCE(state, '{}')::jsonb, '{dexaScans}', ${valueJson}::jsonb, true),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true, count: clean.length });
  } catch (err) {
    console.error("Put dexa-scans error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 58: Boditrax scans — trusted multi-frequency BIA (source:"boditrax").
// Reliability sits below DEXA, above Withings; the blending engine consumes this
// array. Range validation mirrors public/proactive-core.js BODITRAX_FIELDS.
router.put("/boditrax-log", requireAuth, async (req: Request, res: Response) => {
  try {
    const { boditraxLog } = req.body || {};
    if (!Array.isArray(boditraxLog)) { res.status(400).json({ error: "boditraxLog must be an array" }); return; }
    if (boditraxLog.length > 500) { res.status(400).json({ error: "max 500 scans" }); return; }
    const RANGES: Record<string, [number, number, boolean]> = {
      weight: [30, 300, true], muscle: [5, 200, true], fat: [0, 200, true], visceral: [1, 60, true],
      water: [5, 150, false], bone: [0.3, 15, false], ffm: [10, 250, false], cellular: [0, 20, false],
      bmr: [500, 5000, false], metabolicAge: [5, 120, false], physique: [1, 9, false],
      legMuscle: [0, 150, false], boditraxScore: [0, 1000, false], proteinPct: [5, 40, false],
    };
    const num = (v: any, lo: number, hi: number) => {
      if (v == null || v === "") return null;
      const n = +v;
      if (!Number.isFinite(n) || n < lo || n > hi) return null;
      return n;
    };
    const clean = boditraxLog.map((s: any) => {
      if (!s || typeof s !== "object") return null;
      const date = String(s.date || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null; // date is required
      const out: any = {
        id: String(s.id || "").slice(0, 60) || ("bdx_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6)),
        source: "boditrax", date,
        time: /^\d{2}:\d{2}$/.test(String(s.time || "")) ? String(s.time).slice(0, 5) : null,
        loggedAt: String(s.loggedAt || new Date().toISOString()).slice(0, 30),
      };
      for (const f in RANGES) out[f] = num(s[f], RANGES[f][0], RANGES[f][1]);
      // Required numerics must survive validation, else drop the row.
      if (out.weight == null || out.muscle == null || out.fat == null || out.visceral == null) return null;
      return out;
    }).filter(Boolean);
    const valueJson = JSON.stringify(clean);
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(COALESCE(state, '{}')::jsonb, '{boditraxLog}', ${valueJson}::jsonb, true),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true, count: clean.length });
  } catch (err) {
    console.error("Put boditrax-log error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 55: Health Records — document metadata + source text for the Body-page
// timeline. The extracted numbers live in profile.bloodMarkers / state.dexaScans
// (which the coach reads); this just holds the source markdown + provider/title.
router.put("/health-records", requireAuth, requireOwnerCheck, async (req: Request, res: Response) => {
  try {
    const { healthRecords } = req.body || {};
    if (!Array.isArray(healthRecords)) { res.status(400).json({ error: "healthRecords must be an array" }); return; }
    if (healthRecords.length > 200) { res.status(400).json({ error: "max 200 records" }); return; }
    const clean = healthRecords.slice(0, 200).map((r: any) => {
      if (!r || typeof r !== "object") return null;
      return {
        id: String(r.id || ("hr_" + Math.random().toString(36).slice(2))).slice(0, 40),
        type: r.type === "dexa" ? "dexa" : "bloods",
        date: (typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) ? r.date : "",
        provider: String(r.provider || "").slice(0, 120),
        title: String(r.title || "").slice(0, 160),
        sourceText: String(r.sourceText || "").slice(0, 20000),
        addedAt: String(r.addedAt || new Date().toISOString()).slice(0, 40),
      };
    }).filter(Boolean);
    const valueJson = JSON.stringify(clean);
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(COALESCE(state, '{}')::jsonb, '{healthRecords}', ${valueJson}::jsonb, true),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true, count: clean.length });
  } catch (err) {
    console.error("Put health-records error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 41l: blood pressure log (array of readings, full-array PUT pattern)
router.put("/bp-log", requireAuth, async (req: Request, res: Response) => {
  try {
    const { bpLog } = req.body || {};
    if (!Array.isArray(bpLog)) { res.status(400).json({ error: "bpLog must be an array" }); return; }
    if (bpLog.length > 5000) { res.status(400).json({ error: "max 5000 readings" }); return; }
    // Validate each entry
    const clean = bpLog.map((r: any) => {
      if (!r || typeof r !== "object") return null;
      const sys = parseInt(r.systolic, 10);
      const dia = parseInt(r.diastolic, 10);
      if (!sys || sys < 60 || sys > 250) return null;
      if (!dia || dia < 30 || dia > 200) return null;
      const pulse = r.pulse ? parseInt(r.pulse, 10) : null;
      return {
        id: String(r.id || "").slice(0, 60) || ("bp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6)),
        date: String(r.date || "").slice(0, 10),
        time: String(r.time || "").slice(0, 5),
        systolic: sys,
        diastolic: dia,
        pulse: pulse && pulse >= 30 && pulse <= 220 ? pulse : null,
        arm: ["left", "right"].includes(r.arm) ? r.arm : "left",
        position: ["sitting", "standing", "lying"].includes(r.position) ? r.position : "sitting",
        notes: String(r.notes || "").slice(0, 200),
        loggedAt: String(r.loggedAt || new Date().toISOString()).slice(0, 30),
      };
    }).filter(Boolean);
    const valueJson = JSON.stringify(clean);
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(COALESCE(state, '{}')::jsonb, '{bpLog}', ${valueJson}::jsonb, true),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true, count: clean.length });
  } catch (err) {
    console.error("Put bp-log error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 39: dynamic calorie/macro targets (subfield of profile)
router.put("/profile/dynamic-targets", requireAuth, async (req: Request, res: Response) => {
  try {
    const { dynamicTargets } = req.body || {};
    if (!dynamicTargets || typeof dynamicTargets !== "object" || Array.isArray(dynamicTargets)) {
      res.status(400).json({ error: "dynamicTargets object required" }); return;
    }
    const valueJson = JSON.stringify(dynamicTargets);
    if (valueJson.length > 20000) { res.status(413).json({ error: "dynamicTargets too large" }); return; }
    await prisma.$executeRaw`
      UPDATE "User"
      SET state = jsonb_set(
        jsonb_set(COALESCE(state, '{}')::jsonb, '{profile}', COALESCE(state->'profile', '{}'), true),
        '{profile,dynamicTargets}',
        ${valueJson}::jsonb,
        true
      ),
      "updatedAt" = NOW()
      WHERE id = ${req.userId}
    `;
    res.json({ success: true });
  } catch (err) {
    console.error("Put dynamic-targets error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 40: notifications
router.put("/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const state: any = user.state || {};
    if (Array.isArray(state.notifications)) {
      const n = state.notifications.find((x: any) => x && x.id === id);
      if (n) n.read = true;
    }
    await prisma.user.update({ where: { id: req.userId }, data: { state } });
    res.json({ success: true });
  } catch (err) {
    console.error("Mark notification read error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/notifications/expired", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const state: any = user.state || {};
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    if (Array.isArray(state.notifications)) {
      state.notifications = state.notifications.filter((n: any) => n && (!n.expiresAt || n.expiresAt >= today));
    }
    await prisma.user.update({ where: { id: req.userId }, data: { state } });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete expired notifications error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
