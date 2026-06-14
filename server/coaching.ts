import { Router, Request, Response } from "express";
import prisma from "./db";
import { requireAuth } from "./auth";

const router = Router();

// --- Phase 23: suggestion apply / dismiss (user-driven, JWT-auth) ---

function applyMacros(state: any, payload: any) {
  if (!state.profile) state.profile = {};
  if (!state.profile.macros) state.profile.macros = {};
  for (const k of ["calsGym", "calsRest"] as const) {
    if (typeof payload[k] === "number" && payload[k] >= 800 && payload[k] <= 6000) state.profile[k] = payload[k];
  }
  for (const k of ["protein", "carbs", "fat"] as const) {
    if (typeof payload[k] === "number" && payload[k] >= 0 && payload[k] <= 800) state.profile.macros[k] = payload[k];
  }
}

function applySkincare(state: any, payload: any) {
  const validFreq = ["daily", "every-2-days", "every-3-days", "every-4-days", "weekly"];
  if (!payload?.productId || !validFreq.includes(payload?.frequency)) {
    throw new Error("skincare payload needs productId + valid frequency");
  }
  const products = state.skinCare?.products;
  if (!Array.isArray(products)) throw new Error("no skin care products");
  const p = products.find((x: any) => x.id === payload.productId);
  if (!p) throw new Error("product not found");
  p.frequency = payload.frequency;
  p.frequencyStartedAt = new Date().toISOString().slice(0, 10);
}

const PHASE_FREQ: Record<number, string> = { 1: "every-4-days", 2: "every-3-days", 3: "every-2-days", 4: "5x-week", 5: "daily", 6: "daily" };
function applySkincarePhase(state: any, payload: any) {
  const newPhase = payload?.newPhase;
  if (typeof newPhase !== "number" || newPhase < 1 || newPhase > 6) {
    throw new Error("skincare-phase payload needs newPhase 1-6");
  }
  const sc = state.skinCare;
  if (!sc || !Array.isArray(sc.products)) throw new Error("no skin care routine");
  sc.phase = Math.round(newPhase);
  sc.phaseStartDate = new Date().toISOString().slice(0, 10);
  const freq = PHASE_FREQ[sc.phase];
  for (const p of sc.products) {
    if (p.type === "retinol" || p.id === "skn-cicaplast") {
      p.frequency = freq;
      p.frequencyStartedAt = sc.phaseStartDate;
    }
  }
}

// --- Phase 40: notification helper + new suggestion handlers ---
function pushNotification(state: any, notif: any) {
  if (!Array.isArray(state.notifications)) state.notifications = [];
  const today = new Date().toISOString().slice(0, 10);
  const expires = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  state.notifications.unshift({
    id: "notif_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    read: false,
    date: today,
    expiresAt: expires,
    ...notif,
  });
  if (state.notifications.length > 10) state.notifications = state.notifications.slice(0, 10);
}

// Phase 48: apply the adaptive carb change. Shifts the calorie + carb TARGETS
// (protein/fat untouched), then bumps the QUANTITY of the meal plan's
// carb-dominant ingredients to match — never swaps or removes a food.
function applyNutritionAdjust(state: any, payload: any) {
  const calorieDelta = Math.round(+payload?.calorieDelta || 0);
  const carbDelta = Math.round(+payload?.carbDelta || 0);
  if (!calorieDelta && !carbDelta) return;
  if (!state.profile) state.profile = {};
  const p = state.profile;
  if (p.dynamicTargets && typeof p.dynamicTargets === "object") {
    for (const key of ["rest", "upper", "lower"]) {
      const t = p.dynamicTargets[key];
      if (t && typeof t === "object") {
        if (t.calories != null) t.calories = Math.max(0, t.calories + calorieDelta);
        if (t.carbs != null) t.carbs = Math.max(0, t.carbs + carbDelta);
      }
    }
    p.dynamicTargets.adaptiveAdjustedAt = new Date().toISOString();
    if (p.dynamicTargets.rest) {
      p.calsRest = p.dynamicTargets.rest.calories;
      p.carbsTarget = p.dynamicTargets.rest.carbs;
      if (!p.macros) p.macros = {};
      p.macros.carbs = p.dynamicTargets.rest.carbs;
    }
    if (p.dynamicTargets.upper && p.dynamicTargets.lower) {
      p.calsGym = Math.round((p.dynamicTargets.upper.calories + p.dynamicTargets.lower.calories) / 2);
    }
  } else {
    p.calsRest = Math.max(0, (p.calsRest || 0) + calorieDelta);
    p.calsGym = Math.max(0, (p.calsGym || 0) + calorieDelta);
    p.carbsTarget = Math.max(0, (p.carbsTarget || 0) + carbDelta);
    if (!p.macros) p.macros = {};
    p.macros.carbs = Math.max(0, (p.macros.carbs || 0) + carbDelta);
  }
  redistributeMealPlanCarbs(state, carbDelta);
}

function redistributeMealPlanCarbs(state: any, carbDelta: number) {
  const plan = state.mealPlan;
  if (!plan || !Array.isArray(plan.meals) || !carbDelta) return;
  // carb-dominant ingredients = carbs are the biggest macro by calories
  const targets: any[] = [];
  for (const m of plan.meals) {
    for (const ing of (m.ingredients || [])) {
      const c = +ing.carbs || 0, pr = +ing.protein || 0, f = +ing.fat || 0;
      if (c >= 10 && c * 4 > pr * 4 && c * 4 > f * 9) targets.push(ing);
    }
  }
  if (!targets.length) return;
  const totalCarbs = targets.reduce((s, i) => s + (+i.carbs || 0), 0) || 1;
  let applied = 0;
  for (let i = 0; i < targets.length; i++) {
    const ing = targets[i];
    const share = i === targets.length - 1 ? carbDelta - applied : Math.round(carbDelta * ((+ing.carbs || 0) / totalCarbs));
    applied += share;
    const oldCarbs = +ing.carbs || 0;
    if (oldCarbs <= 0) continue;
    const factor = Math.max(0, (oldCarbs + share) / oldCarbs); // scale the portion
    ing.carbs = Math.round((oldCarbs + share) * 10) / 10;
    ing.cals = Math.round((+ing.cals || 0) * factor);
    if (ing.protein != null) ing.protein = Math.round((+ing.protein) * factor * 10) / 10;
    if (ing.fat != null) ing.fat = Math.round((+ing.fat) * factor * 10) / 10;
    if (ing.quantity != null) ing.quantity = Math.round((+ing.quantity || 1) * factor * 100) / 100;
    ing.edited = true;
  }
  // recompute meal totals from ingredient sums
  for (const m of plan.meals) {
    if (!Array.isArray(m.ingredients)) continue;
    const sum = (k: string) => m.ingredients.reduce((s: number, i: any) => s + (+i[k] || 0), 0);
    m.cals = Math.round(sum("cals")); m.protein = Math.round(sum("protein"));
    m.carbs = Math.round(sum("carbs")); m.fat = Math.round(sum("fat"));
  }
}

function applyTrainingSwap(state: any, payload: any) {
  if (!payload?.exerciseId) throw new Error("training-swap payload needs exerciseId");
  if (!state.exerciseNotes || typeof state.exerciseNotes !== "object" || Array.isArray(state.exerciseNotes)) {
    state.exerciseNotes = {};
  }
  const swap = payload.suggestedExercise ? `swap toward ${payload.suggestedExercise}` : "consider an alternative";
  state.exerciseNotes[payload.exerciseId] = {
    note: `Coach: ${swap} — ${payload.reason || "see weekly report"}`,
    addedAt: new Date().toISOString(),
  };
}

function applyInjuryFlag(state: any, payload: any) {
  if (!payload?.exerciseId) throw new Error("injury-flag payload needs exerciseId");
  if (!state.injuries || typeof state.injuries !== "object" || Array.isArray(state.injuries)) {
    state.injuries = {};
  }
  const action = payload.action === "resolve" ? "resolve" : "flag";
  if (action === "resolve") {
    let found = false;
    for (const j of Object.values(state.injuries) as any[]) {
      if (j && j.status !== "resolved" && Array.isArray(j.affectedExercises) && j.affectedExercises.includes(payload.exerciseId)) {
        j.status = "resolved";
        j.resolvedAt = new Date().toISOString().slice(0, 10);
        found = true;
      }
    }
    if (!found) throw new Error("no active injury found for that exercise");
  } else {
    const id = "inj_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    const sev = ["mild", "moderate", "severe"].includes(payload.severity) ? payload.severity : "mild";
    state.injuries[id] = {
      id,
      name: (payload.notes ? String(payload.notes).slice(0, 60) : "Coach-flagged injury"),
      bodyPart: "",
      severity: sev,
      affectedExercises: [String(payload.exerciseId)],
      status: "active",
      notes: String(payload.notes || "").slice(0, 400),
      createdAt: new Date().toISOString().slice(0, 10),
      resolvedAt: null,
    };
  }
}

function applyFastingNote(state: any, payload: any) {
  pushNotification(state, {
    type: "nutrition",
    title: "Fasting reminder",
    message: String(payload?.suggestion || payload?.message || "Keep your eating window 12:00-18:00.").slice(0, 240),
  });
}

function applySupplementReminder(state: any, payload: any) {
  pushNotification(state, {
    type: "medication",
    title: `Don't miss ${String(payload?.supplementName || "your supplement").slice(0, 60)}`,
    message: String(payload?.message || "Critical supplement flagged by your coach — log it every day.").slice(0, 240),
  });
}

function applyReminders(state: any, payload: any) {
  if (!Array.isArray(state.reminders)) state.reminders = [];
  if (payload?.action === "add" && payload.reminder?.time && payload.reminder?.text) {
    const r = payload.reminder;
    state.reminders.push({
      id: "rem_" + Date.now(),
      time: String(r.time).slice(0, 5),
      text: String(r.text).slice(0, 200),
      days: Array.isArray(r.days) ? r.days.filter((d: any) => Number.isInteger(d) && d >= 0 && d <= 6) : [0,1,2,3,4,5,6],
      enabled: true,
    });
  } else if (payload?.action === "remove" && payload.reminder?.id) {
    state.reminders = state.reminders.filter((r: any) => r.id !== payload.reminder.id);
  }
}

router.post("/:rid/apply/:sid", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const state: any = user.state || {};
    const reports = state.coachingReports || [];
    const report = reports.find((r: any) => r.id === req.params.rid);
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }
    const sug = (report.suggestions || []).find((s: any) => s.id === req.params.sid);
    if (!sug) { res.status(404).json({ error: "Suggestion not found" }); return; }
    if (sug.applied || sug.dismissed) { res.status(409).json({ error: "Already actioned" }); return; }

    try {
      switch (sug.type) {
        case "macros": applyMacros(state, sug.payload || {}); break;
        case "reminders": applyReminders(state, sug.payload || {}); break;
        case "skincare": applySkincare(state, sug.payload || {}); break;
        case "skincare-phase": applySkincarePhase(state, sug.payload || {}); break;
        case "training-swap": applyTrainingSwap(state, sug.payload || {}); break;
        case "injury-flag": applyInjuryFlag(state, sug.payload || {}); break;
        case "fasting-note": applyFastingNote(state, sug.payload || {}); break;
        case "supplement-reminder": applySupplementReminder(state, sug.payload || {}); break;
        case "nutrition-adjust": applyNutritionAdjust(state, sug.payload || {}); break;
        case "note": break;
        default: res.status(400).json({ error: "Unknown suggestion type" }); return;
      }
    } catch (e: any) {
      res.status(400).json({ error: "Invalid suggestion payload: " + (e?.message || "error") });
      return;
    }

    sug.applied = true;
    sug.appliedAt = new Date().toISOString();
    state.coachingReports = reports;
    await prisma.user.update({ where: { id: req.userId }, data: { state } });
    res.json({ success: true, state });
  } catch (err) {
    console.error("Apply suggestion error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:rid/dismiss/:sid", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const state: any = user.state || {};
    const reports = state.coachingReports || [];
    const report = reports.find((r: any) => r.id === req.params.rid);
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }
    const sug = (report.suggestions || []).find((s: any) => s.id === req.params.sid);
    if (!sug) { res.status(404).json({ error: "Suggestion not found" }); return; }
    sug.dismissed = true;
    sug.dismissedAt = new Date().toISOString();
    state.coachingReports = reports;
    await prisma.user.update({ where: { id: req.userId }, data: { state } });
    res.json({ success: true });
  } catch (err) {
    console.error("Dismiss suggestion error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
