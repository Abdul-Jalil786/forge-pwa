import "dotenv/config";
import express from "express";
import path from "path";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import authRouter from "./auth";
import stateRouter from "./state";
import prisma from "./db";

const PORT = parseInt(process.env.PORT || "3000", 10);

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.ouraring.com", "https://wbsapi.withings.net", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
}));

app.use(express.json({ limit: "6mb" }));

// Health check
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "ok", uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ ok: false, db: "error" });
  }
});

// Rate limiters for auth endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, try again in 15 minutes" },
  standardHeaders: true,
});
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Too many signup attempts, try again later" },
  standardHeaders: true,
});

app.post("/api/auth/login", loginLimiter, (_req, _res, next) => next());
app.post("/api/auth/signup", signupLimiter, (_req, _res, next) => next());

// API routes
app.use("/api/auth", authRouter);
app.use("/api/state", stateRouter);

import pushRouter from "./push";
app.use("/api/push", pushRouter);

import ouraRouter from "./oura-routes";
app.use("/api/oura", ouraRouter);

import withingsRouter from "./withings-routes";
app.use("/api/withings", withingsRouter);

import coachingRouter from "./coaching";
app.use("/api/coaching-reports", coachingRouter);

import coachSettingsRouter from "./coach-settings";
app.use("/api/coach", coachSettingsRouter);

import adminRouter from "./admin";
app.use("/api/admin", adminRouter);

// Static files — use process.cwd() so it works in both dev (tsx) and prod (dist/)
const publicDir = path.join(process.cwd(), "public");
app.use(express.static(publicDir));

// SPA catch-all
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

import { startCron, runWeeklyCoaching } from "./cron";

// Phase 22a: one-shot progress baseline migration for Jay
async function migrateJayProgress() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.profile?.progressMigrationApplied) return;
    if (!state.profile) state.profile = {};
    const bc: any = state.bodyComp || {};
    const vfDates = Object.keys(bc).filter(d => bc[d]?.visceralFat != null && d >= "2026-05-11").sort();
    const startVF = vfDates.length ? bc[vfDates[0]].visceralFat : null;
    // If no visceral on/after start, use latest + 0.1
    const allVF = Object.keys(bc).filter(d => bc[d]?.visceralFat != null).sort();
    const fallbackVF = allVF.length ? bc[allVF[allVF.length - 1]].visceralFat + 0.1 : null;

    state.profile.startDate = "2026-05-11";
    state.profile.startWeight = 113.5;
    state.profile.startBF = 32.1;
    state.profile.startLBM = Math.round(113.5 * (1 - 32.1 / 100) * 100) / 100;
    state.profile.startVisceralFat = startVF ?? fallbackVF;
    state.profile.targetWeight = 90;
    state.profile.targetBF = 15;
    state.profile.targetLBM = Math.round(90 * (1 - 15 / 100) * 100) / 100;
    state.profile.targetVisceralFat = 10;
    state.profile.progressMigrationApplied = true;

    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Jay progress baseline applied");
  } catch (err) {
    console.error("[migration] Jay progress baseline failed:", err);
  }
}

// Phase 26b: one-shot seed of Jay's locked meal plan (chicken / low-GI, exact items he wants)
async function seedJayMealPlan() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.mealPlanSeededV2) return;

    const plan = {
      name: "Cut V7 — Locked: Chicken & Low-GI",
      meals: [
        {
          id: "breakfast",
          name: "Breakfast: Eggs, Oats, Yogurt & Berries",
          time: "12:00",
          cals: 679, protein: 61, carbs: 54, fat: 23,
          ingredients: [
            { name: "3 whole eggs + 6 egg whites scrambled with 1 tsp olive oil", cals: 358, protein: 39, carbs: 2, fat: 20 },
            { name: "40g (dry) rolled oats with cinnamon", cals: 152, protein: 5, carbs: 26, fat: 3 },
            { name: "150g 0% Greek yogurt + 1 tsp honey", cals: 112, protein: 16, carbs: 12, fat: 0 },
            { name: "100g blueberries", cals: 57, protein: 1, carbs: 14, fat: 0 },
          ],
          supplements: [
            { id: "vit-d", name: "Vitamin D", dose: "4000 IU" },
            { id: "omega-3", name: "Omega 3", dose: "2 caps" },
            { id: "metformin-am", name: "Metformin", dose: "1000mg" },
          ],
        },
        {
          id: "pre-workout",
          name: "Pre-Workout: Chicken, Basmati & Veg",
          time: "14:30",
          cals: 602, protein: 56, carbs: 72, fat: 8,
          ingredients: [
            { name: "200g (raw) chicken breast grilled with salt, pepper, paprika", cals: 220, protein: 46, carbs: 0, fat: 2 },
            { name: "80g (dry) basmati rice boiled", cals: 280, protein: 6, carbs: 60, fat: 1 },
            { name: "100g broccoli + 100g mixed peppers roasted with 1 tsp olive oil. Eat fully by 15:00 to digest before training.", cals: 102, protein: 4, carbs: 12, fat: 5 },
          ],
          supplements: [],
        },
        {
          id: "post-workout",
          name: "Post-Workout Shake (Whey, Milk, Banana, Creatine)",
          time: "17:15",
          cals: 306, protein: 32, carbs: 35, fat: 6,
          ingredients: [
            { name: "Immediately after training. 1 scoop whey protein + 200ml semi-skimmed milk + 1 banana + 5g creatine — blend or shake.", cals: 306, protein: 32, carbs: 35, fat: 6 },
          ],
          supplements: [
            { id: "creatine", name: "Creatine", dose: "5g (in shake)" },
          ],
        },
        {
          id: "dinner",
          name: "Last Meal: Chicken & Tomato Stew + Side Salad",
          time: "17:50",
          cals: 488, protein: 54, carbs: 31, fat: 16,
          ingredients: [
            { name: "200g (raw) chicken breast diced, pan-fried with chopped onion + garlic + 1 tin chopped tomatoes (200g), simmer 10 min", cals: 295, protein: 49, carbs: 16, fat: 2 },
            { name: "1 tbsp olive oil for cooking", cals: 120, protein: 0, carbs: 0, fat: 14 },
            { name: "Side salad: 100g spinach + 1 sliced tomato + ½ cucumber + 1 tbsp lemon juice", cals: 73, protein: 5, carbs: 15, fat: 0 },
          ],
          supplements: [
            { id: "statin-pm", name: "Statin", dose: "current dose" },
          ],
        },
      ],
    };

    state.mealPlan = plan;
    state.mealPlanSeededV2 = true;
    state.lastMealPlanRegenAt = new Date().toISOString();
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Jay meal plan seeded (V7 locked chicken/low-GI)");
  } catch (err) {
    console.error("[migration] Jay meal plan seed failed:", err);
  }
}

// Phase 29a: seed Jay's blood markers from 08/05/2026 panel.
// Source: Bloodwork Group "Gold Performance Profile + Additional Markers", sample date 2026-05-08.
async function seedJayBloodMarkers() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.profile?.bloodMarkersSeededV1) return;
    if (!state.profile) state.profile = {};
    const date = "2026-05-08";
    const markers = [
      // Cholesterol
      { id: "chol-total",    name: "Total Cholesterol",     value: 4.92, unit: "mmol/L", refLow: null, refHigh: 5.18, category: "cholesterol", date },
      { id: "hdl",           name: "HDL Cholesterol",       value: 1.01, unit: "mmol/L", refLow: 1.04, refHigh: null, category: "cholesterol", date, notes: "Slightly low — protective marker, would prefer >1.04" },
      { id: "ldl",           name: "LDL Cholesterol",       value: 1.85, unit: "mmol/L", refLow: 0.5,  refHigh: 3.0,  category: "cholesterol", date },
      { id: "non-hdl",       name: "Non-HDL Cholesterol",   value: 2.75, unit: "mmol/L", refLow: null, refHigh: 4.0,  category: "cholesterol", date },
      { id: "vldl",          name: "VLDL Calculated",       value: 0.90, unit: "mmol/L", refLow: null, refHigh: 0.78, category: "cholesterol", date },
      { id: "triglycerides", name: "Triglycerides",         value: 1.99, unit: "mmol/L", refLow: null, refHigh: 2.0,  category: "cholesterol", date, notes: "Borderline — diet/carbs/alcohol/body comp sensitive" },
      { id: "hdl-pct",       name: "HDL Percentage",        value: 27,   unit: "%",      refLow: 20,   refHigh: null, category: "cholesterol", date },

      // Diabetes — critical
      { id: "hba1c",         name: "HbA1c",                 value: 72,   unit: "mmol/mol", refLow: null, refHigh: 42, category: "diabetes", date, notes: "DIABETIC RANGE. Reason for Mounjaro + Metformin. Low-GI carbs are non-negotiable." },

      // Liver — elevated ALT
      { id: "alt",           name: "ALT (Alanine Transaminase)", value: 93, unit: "IU/L", refLow: null, refHigh: 56, category: "liver", date, notes: "Elevated — consistent with fatty liver / metabolic strain. Should improve as bodyfat drops." },
      { id: "ast",           name: "AST",                   value: 36,   unit: "u/L",    refLow: 13,   refHigh: 45,  category: "liver", date },
      { id: "ggt",           name: "GGT",                   value: 49,   unit: "u/L",    refLow: 4,    refHigh: 73,  category: "liver", date },
      { id: "alp",           name: "Alkaline Phosphatase",  value: 74,   unit: "u/L",    refLow: 46,   refHigh: 116, category: "liver", date },
      { id: "bilirubin",     name: "Total Bilirubin",       value: 5,    unit: "umol/L", refLow: 5,    refHigh: 21,  category: "liver", date },
      { id: "albumin",       name: "Albumin",               value: 44,   unit: "g/L",    refLow: 34,   refHigh: 50,  category: "liver", date },
      { id: "globulin",      name: "Globulin",              value: 25,   unit: "g/L",    refLow: 18,   refHigh: 36,  category: "liver", date },
      { id: "total-protein", name: "Total Protein",         value: 69,   unit: "g/L",    refLow: 57,   refHigh: 82,  category: "liver", date },

      // Kidney
      { id: "creatinine",    name: "Creatinine",            value: 94,   unit: "umol/L", refLow: 65,   refHigh: 104, category: "kidney", date },
      { id: "urea",          name: "Urea",                  value: 7.6,  unit: "mmol/L", refLow: 3.2,  refHigh: 8.2, category: "kidney", date },
      { id: "egfr",          name: "eGFR",                  value: 90,   unit: "mL/min/1.73m²", refLow: 60, refHigh: null, category: "kidney", date, notes: "Reported as >90 — good." },

      // Hormones — low testosterone, low SHBG
      { id: "testosterone",  name: "Testosterone (Total)",  value: 9.55, unit: "nmol/L", refLow: 8.4,  refHigh: 28.7, category: "hormones", date, notes: "Bottom of range. Affects muscle preservation and recovery." },
      { id: "free-test",     name: "Free Testosterone",     value: 0.25, unit: "nmol/L", refLow: 0.13, refHigh: 1.04, category: "hormones", date },
      { id: "shbg",          name: "SHBG",                  value: 16.2, unit: "nmol/L", refLow: 17.3, refHigh: 65.8, category: "hormones", date, notes: "Slightly low — insulin-resistance pattern." },
      { id: "fai",           name: "Free Androgen Index",   value: 59,   unit: "",       refLow: 30,   refHigh: 100,  category: "hormones", date },
      { id: "lh",            name: "Luteinizing Hormone",   value: 4.1,  unit: "mIU/mL", refLow: 1.5,  refHigh: 9.3,  category: "hormones", date },
      { id: "fsh",           name: "FSH",                   value: 4.8,  unit: "mIU/mL", refLow: 1.4,  refHigh: 18.1, category: "hormones", date },
      { id: "prolactin",     name: "Prolactin",             value: 248,  unit: "ulU/mL", refLow: 45,   refHigh: 375,  category: "hormones", date },
      { id: "oestradiol",    name: "Oestradiol",            value: 119,  unit: "pmol/L", refLow: null, refHigh: 146.1, category: "hormones", date },

      // Thyroid — normal
      { id: "tsh",           name: "TSH",                   value: 2.13, unit: "mIU/L",  refLow: 0.55, refHigh: 4.78, category: "thyroid", date },
      { id: "free-t4",       name: "Free T4",               value: 15.6, unit: "pmol/L", refLow: 11.5, refHigh: 22.7, category: "thyroid", date },
      { id: "free-t3",       name: "Free T3",               value: 4.4,  unit: "pmol/L", refLow: 2.6,  refHigh: 7.1,  category: "thyroid", date },

      // Vitamins + inflammation
      { id: "vit-d",         name: "Vitamin D (25-OH)",     value: 47,   unit: "nmol/L", refLow: 50,   refHigh: 250,  category: "vitamins", date, notes: "Insufficient (<50). Bump supplement to 5000 IU/day until >75." },
      { id: "vit-b12",       name: "Vitamin B12",           value: 362,  unit: "pmol/L", refLow: 37.5, refHigh: null, category: "vitamins", date },
      { id: "hs-crp",        name: "hsCRP",                 value: 4.92, unit: "mg/L",   refLow: null, refHigh: 1.0,  category: "inflammation", date, notes: "Chronic low-grade inflammation. Re-check in 3 months." },

      // Iron
      { id: "ferritin",      name: "Ferritin",              value: 149,  unit: "ng/mL",  refLow: 22,   refHigh: 322, category: "iron", date },

      // Gout
      { id: "uric-acid",     name: "Uric Acid",             value: 249,  unit: "umol/L", refLow: 220,  refHigh: 547, category: "gout", date },

      // Prostate
      { id: "psa",           name: "PSA",                   value: 1.51, unit: "ug/L",   refLow: null, refHigh: 2.5,  category: "prostate", date },

      // Full blood count (key ones)
      { id: "hb",            name: "Haemoglobin",           value: 137,  unit: "g/L",    refLow: 130,  refHigh: 170, category: "fbc", date },
      { id: "wbc",           name: "White Cell Count",      value: 9.9,  unit: "X10^9/L", refLow: 4,   refHigh: 10,  category: "fbc", date, notes: "High-normal; lymphs slightly elevated — common post-viral or low-grade inflammation." },
      { id: "lymphs",        name: "Lymphocytes",           value: 2.79, unit: "X10^9/L", refLow: 1,   refHigh: 3,   category: "fbc", date },
      { id: "neutrophils",   name: "Neutrophils",           value: 3.9,  unit: "X10^9/L", refLow: 2,   refHigh: 7,   category: "fbc", date },
      { id: "platelets",     name: "Platelets",             value: 255,  unit: "X10^9/L", refLow: 150, refHigh: 410, category: "fbc", date },
      { id: "rbc",           name: "Red Cell Count",        value: 4.52, unit: "X10^12/L", refLow: 4.5, refHigh: 5.5, category: "fbc", date },
      { id: "haematocrit",   name: "Haematocrit",           value: 0.4,  unit: "L/L",    refLow: 0.4,  refHigh: 0.5, category: "fbc", date },
    ];
    state.profile.bloodMarkers = markers;
    state.profile.bloodMarkersSeededV1 = true;
    state.profile.bloodMarkersDate = date;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log(`[migration] Jay blood markers seeded (${markers.length} markers from ${date})`);
  } catch (err) {
    console.error("[migration] Jay blood markers seed failed:", err);
  }
}

// Phase 37: full skin care routine overhaul — replace all products with Jay's real 9-product routine.
async function seedJaySkinCareV1() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.profile?.skinCareSeededV1) return;
    const START = "2026-05-21";
    state.skinCare = {
      phase: 1,
      phaseStartDate: START,
      tretinoinReady: false,
      weeklyCheckIn: {},
      products: [
        { id: "skn-cleanser", order: 1, name: "CeraVe Hydrating Cleanser", type: "cleanser", concentration: null, slot: "both", frequency: "daily", startedDate: START,
          notes: "Use morning and evening. Replaces Elemis completely. Gentle — no exfoliating enzymes. Essential on retinol nights." },
        { id: "skn-ceferulic", order: 2, name: "SkinCeuticals CE Ferulic", type: "vitamin-c", concentration: "15%", slot: "am", frequency: "daily", startedDate: START,
          notes: "Gold standard Vitamin C. Apply after cleanser before moisturiser. Never use same time as niacinamide or retinol. Morning only always." },
        { id: "skn-moisturizer", order: 3, name: "CeraVe Moisturising Cream", type: "moisturizer", concentration: null, slot: "both", frequency: "daily", startedDate: START,
          notes: "Core barrier moisturiser. Use morning and evening. On retinol nights apply thin layer before retinol and generous layer after — sandwich method." },
        { id: "skn-spf", order: 4, name: "La Roche-Posay UVMune 400 SPF50+", type: "spf", concentration: "SPF50+", slot: "am", frequency: "daily", startedDate: START,
          notes: "Always the absolute last step every morning. Never skip. Retinol and CE Ferulic both increase sun sensitivity significantly." },
        { id: "skn-arbutin", order: 5, name: "The Ordinary Alpha Arbutin 2% + HA", type: "serum", concentration: "2%", slot: "pm", frequency: "daily", startedDate: START,
          notes: "Targets pigmentation and uneven skin tone. PM only. NEVER use on retinol nights — skip completely. Apply before niacinamide — thinnest first." },
        { id: "skn-niacinamide", order: 6, name: "The Ordinary Niacinamide 10% + Zinc", type: "serum", concentration: "10%", slot: "pm", frequency: "daily", startedDate: START,
          notes: "Evens skin tone, reduces pigmentation and pores. PM only. NEVER use on retinol nights. NEVER use same session as CE Ferulic. Apply after Alpha Arbutin." },
        { id: "skn-retinol", order: 7, name: "SkinCeuticals Retinol 0.3", type: "retinol", concentration: "0.3%", slot: "pm", frequency: "every-4-days", startedDate: START, frequencyStartedAt: START,
          notes: "Encapsulated retinol. Currently Phase 1 — every 4 days. Use sandwich method always — moisturiser before and after. Pea size for entire face. Progress frequency only when zero redness for full phase duration." },
        { id: "skn-cicaplast", order: 8, name: "La Roche-Posay Cicaplast Baume B5+", type: "other", concentration: null, slot: "pm", frequency: "every-4-days", startedDate: START,
          notes: "Barrier repair. Use ONLY on retinol nights — apply over final moisturiser layer on any dry or peeling areas especially forehead. Auto-shown only when retinol is due that day." },
        { id: "skn-honeymask", order: 9, name: "Sidr Honey Mask", type: "other", concentration: null, slot: "pm", frequency: "every-3-days", startedDate: START,
          notes: "Natural antibacterial and brightening mask. Apply to face for 15 minutes then rinse. Use 2x per week on non-retinol nights only. Follow with normal PM routine after rinsing." },
      ],
    };
    if (!state.profile) state.profile = {};
    state.profile.skinCareSeededV1 = true;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Jay skin care routine seeded — 9 products, phase 1");
  } catch (err) {
    console.error("[migration] skin care seed failed:", err);
  }
}

// Phase 36a: record Jay's accurate omega-3 potency. Product: Bare Biology Life & Soul,
// 2 caps/day = 1,700mg omega-3 (1,100mg EPA + 500mg DHA). System only had "2 caps".
async function fixJayOmega3Dose() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.profile?.omega3DoseFixedV1) return;
    const DOSE = "2 caps · 1,700mg omega-3 (1,100 EPA / 500 DHA)";
    const isOmega = (s: any) => s && ((s.id === "omega-3") || (String(s.name || "").toLowerCase().includes("omega")));
    let changed = 0;
    // Meal plan per-meal supplements
    for (const m of (state.mealPlan?.meals || [])) {
      for (const s of (m.supplements || [])) {
        if (isOmega(s)) { s.dose = DOSE; changed++; }
      }
    }
    // Phase 19 standalone supplements tracker
    for (const s of (state.supplements || [])) {
      if (isOmega(s)) { s.dose = DOSE; changed++; }
    }
    // Legacy supps array
    for (const s of (state.supps || [])) {
      if (isOmega(s)) { s.dose = DOSE; changed++; }
    }
    if (!state.profile) state.profile = {};
    state.profile.omega3DoseFixedV1 = true;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log(`[migration] Jay omega-3 dose updated in ${changed} place(s)`);
  } catch (err) {
    console.error("[migration] omega-3 dose fix failed:", err);
  }
}

// Phase 32a: swap banana → 100g blueberries in Jay's post-workout shake meal.
// User doesn't take banana in the shake; macros recomputed for blueberries.
async function fixJayPostWorkoutBerries() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.profile?.postWorkoutBerriesV1) return;
    if (!state.mealPlan?.meals?.length) return;
    const meal = state.mealPlan.meals.find((m: any) => m.id === "post-workout");
    if (!meal) return;
    meal.name = "Post-Workout Shake (Whey, Milk, Blueberries, Creatine)";
    meal.ingredients = [
      {
        name: "Immediately after training. 1 scoop whey protein + 200ml semi-skimmed milk + 100g blueberries + 5g creatine — blend or shake.",
        cals: 273, protein: 32, carbs: 27, fat: 6,
        edited: true,
      },
    ];
    meal.cals = 273; meal.protein = 32; meal.carbs = 27; meal.fat = 6;
    if (!state.profile) state.profile = {};
    state.profile.postWorkoutBerriesV1 = true;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Jay post-workout shake updated: banana → 100g blueberries");
  } catch (err) {
    console.error("[migration] Post-workout berry swap failed:", err);
  }
}

// Phase 29: fix Jay's visceral target — his current visceral (~6.3) is already in healthy range,
// the previous target of 10 was regression-encouraging. Reset to a maintenance/improvement target of 6.
async function fixJayVisceralTarget() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.profile?.visceralTargetFixedV1) return;
    if (!state.profile) state.profile = {};
    state.profile.targetVisceralFat = 6;
    state.profile.visceralTargetFixedV1 = true;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Jay visceral target reset to 6 (was 10, current ~6.3)");
  } catch (err) {
    console.error("[migration] Jay visceral target fix failed:", err);
  }
}

// Phase 38: seed Jay's known lower-back niggle on RDL as a mild injury
async function seedJayInjuryV1() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.injurySeededV1) return;
    if (!state.injuries || typeof state.injuries !== "object" || Array.isArray(state.injuries)) {
      state.injuries = {};
    }
    const id = "inj_seed_lowerback";
    if (!state.injuries[id]) {
      state.injuries[id] = {
        id,
        name: "Lower back niggle",
        bodyPart: "Lower Back",
        severity: "mild",
        affectedExercises: ["l2", "l7_cable_pull", "l8_rev_hyper"],
        status: "active",
        notes: "Pre-existing flag — keep RDL and hip-hinge work conservative; stop on any sharp pain.",
        createdAt: new Date().toISOString().slice(0, 10),
        resolvedAt: null,
      };
    }
    state.injurySeededV1 = true;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Jay lower-back injury seeded (mild, affects RDL + hip-hinge accessories)");
  } catch (err) {
    console.error("[migration] Jay injury seed failed:", err);
  }
}

// Phase 55: clear active injuries — user confirmed no current injuries. The
// Phase 38 seeded lower-back flag was still active and cutting RDL + hip-hinge
// load to 80% (mild ×0.80). Mark every active injury resolved (keeps the record
// for history; stops the progression penalty). One-shot; the user re-flags any
// real injury via More → Injury Management afterwards.
async function clearAbdulInjuriesV1() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.abdulInjuriesClearedV1) return;
    const today = new Date().toISOString().slice(0, 10);
    if (state.injuries && typeof state.injuries === "object" && !Array.isArray(state.injuries)) {
      for (const inj of Object.values(state.injuries) as any[]) {
        if (inj && inj.status !== "resolved") { inj.status = "resolved"; inj.resolvedAt = today; }
      }
    }
    state.abdulInjuriesClearedV1 = true;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Abdul injuries cleared — all active flags resolved (no current injuries)");
  } catch (err) {
    console.error("[migration] clearAbdulInjuriesV1 failed:", err);
  }
}

// Phase 39: enhance Jay's supplement list with timing + critical metadata.
// Merges canonical 9 into the existing list: backfills metadata onto matching ids,
// adds any missing, and leaves custom supplements untouched (no data loss).
async function seedJayNutritionSuppsV1() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.nutritionSuppsV1) return;
    const canonical: any[] = [
      { id: "supp-sidr-honey", name: "Sidr Honey", dose: "1 tsp in warm water", time: "07:30", mealId: "", timing: "on-waking", withFood: false, critical: true, notes: "Morning ritual" },
      { id: "vit-d", name: "Vitamin D3", dose: "4,000 IU", time: "12:00", mealId: "", timing: "meal-1", withFood: true, critical: true, notes: "Fat-soluble — take with food" },
      { id: "omega-3", name: "Omega 3", dose: "2 capsules", time: "15:00", mealId: "", timing: "meal-2", withFood: true, critical: true, notes: "Anti-inflammatory" },
      { id: "supp-omega3-2", name: "Omega 3 (2nd dose)", dose: "2 capsules", time: "17:30", mealId: "", timing: "meal-3", withFood: true, critical: true, notes: "Anti-inflammatory" },
      { id: "supp-magnesium", name: "Magnesium Glycinate", dose: "300mg", time: "22:00", mealId: "", timing: "bedtime", withFood: false, critical: true, notes: "Sleep support" },
      { id: "metformin-am", name: "Metformin", dose: "1000mg", time: "12:00", mealId: "", timing: "with-food", withFood: true, critical: true, notes: "Medication — take with food" },
      { id: "supp-mounjaro", name: "Mounjaro", dose: "5mg", time: "15:00", mealId: "", timing: "wednesday-meal-2", withFood: true, critical: true, frequency: "weekly-wednesday", notes: "GLP-1 — Wednesday injection after meal 2" },
      { id: "supp-zinc", name: "Zinc", dose: "30mg", time: "12:00", mealId: "", timing: "meal-1", withFood: true, critical: false, notes: "With meal 1 — testosterone + immune support" },
      { id: "supp-coq10", name: "CoQ10", dose: "2 caps (200mg total)", time: "15:00", mealId: "pre-workout", timing: "meal-2", withFood: true, critical: false, notes: "Fat-soluble · statin-induced CoQ10 depletion support · with pre-workout meal" },
    ];
    const existing: any[] = Array.isArray(state.supplements) ? state.supplements : [];
    const byId = new Map(existing.map((s: any) => [s.id, s]));
    for (const c of canonical) {
      const e = byId.get(c.id);
      if (e) {
        e.timing = c.timing;
        e.withFood = c.withFood;
        e.critical = c.critical;
        if (c.frequency) e.frequency = c.frequency;
        if (!e.dose) e.dose = c.dose;
      } else {
        existing.push(c);
      }
    }
    state.supplements = existing;
    state.nutritionSuppsV1 = true;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Jay supplements enhanced with Phase 39 timing/critical metadata");
  } catch (err) {
    console.error("[migration] Jay nutrition supplements seed failed:", err);
  }
}

// Phase 41b: Jay's V8 recomp meal plan (8h window 12-20, 5 meals, training 16:00).
// Replaces V7. Casein-rich evening meal (Greek yoghurt 0% + whey) for overnight LBM
// preservation; lower-sodium choice than cottage cheese (LVH-aware). Items locked.
async function seedJayMealPlanV8() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.mealPlanV8Seeded) return;
    const plan = {
      name: "Recomp V8 — 8h window, locked items",
      meals: [
        {
          id: "breakfast",
          name: "Breakfast: Eggs, Yoghurt & Oats",
          time: "12:00",
          cals: 634, protein: 61, carbs: 55, fat: 19,
          ingredients: [
            { name: "3 whole eggs boiled + 4 egg whites", cals: 284, protein: 33, carbs: 2, fat: 15 },
            { name: "200g Greek yoghurt 0%", cals: 110, protein: 20, carbs: 8, fat: 1 },
            { name: "50g rolled oats", cals: 190, protein: 7, carbs: 33, fat: 3 },
            { name: "100g mixed berries", cals: 50, protein: 1, carbs: 12, fat: 0 },
          ],
          supplements: [
            { id: "omega-3", name: "Omega 3", dose: "2 caps (1,700mg)" },
            { id: "metformin-am", name: "Metformin", dose: "1000mg" },
            { id: "supp-zinc", name: "Zinc", dose: "25mg" },
            { id: "vit-d", name: "Vitamin D3", dose: "4,000 IU" },
          ],
        },
        {
          id: "mid-meal",
          name: "Mid-meal: Chicken & Sweet Potato",
          time: "13:30",
          cals: 406, protein: 51, carbs: 25, fat: 14,
          ingredients: [
            { name: "200g chicken breast grilled", cals: 220, protein: 47, carbs: 0, fat: 5 },
            { name: "100g cooked sweet potato", cals: 86, protein: 2, carbs: 20, fat: 0 },
            { name: "Side salad with 1 tsp olive oil", cals: 100, protein: 2, carbs: 5, fat: 9 },
          ],
          supplements: [],
        },
        {
          id: "pre-workout",
          name: "Pre-workout: Chicken & Basmati",
          time: "15:00",
          cals: 490, protein: 54, carbs: 47, fat: 10,
          ingredients: [
            { name: "200g chicken breast grilled", cals: 220, protein: 47, carbs: 0, fat: 5 },
            { name: "150g cooked basmati rice", cals: 200, protein: 4, carbs: 42, fat: 0 },
            { name: "100g steamed broccoli", cals: 35, protein: 3, carbs: 7, fat: 0 },
            { name: "1 tsp olive oil", cals: 35, protein: 0, carbs: 0, fat: 5 },
          ],
          supplements: [
            { id: "supp-coq10", name: "CoQ10", dose: "2 caps (200mg)" },
          ],
        },
        {
          id: "dinner",
          name: "Post-workout dinner: Shake, Chicken & Basmati",
          time: "17:30",
          cals: 700, protein: 87, carbs: 57, fat: 14,
          ingredients: [
            { name: "Protein shake: 2 scoops whey + 200ml semi-skim milk + 100g blueberries + 5g creatine (drink immediately on entering kitchen)", cals: 320, protein: 47, carbs: 24, fat: 5 },
            { name: "150g chicken breast or salmon grilled", cals: 200, protein: 35, carbs: 0, fat: 6 },
            { name: "100g cooked basmati rice", cals: 130, protein: 3, carbs: 28, fat: 0 },
            { name: "Side salad", cals: 50, protein: 2, carbs: 5, fat: 3 },
          ],
          supplements: [],
        },
        {
          id: "evening",
          name: "Evening: Greek Yoghurt + Whey & Almonds",
          time: "19:30",
          cals: 485, protein: 45, carbs: 41, fat: 16,
          ingredients: [
            { name: "300g Greek yoghurt 0%", cals: 165, protein: 27, carbs: 12, fat: 0 },
            { name: "15g whey isolate mixed into yoghurt (slow + fast casein/whey blend for overnight LBM)", cals: 60, protein: 12, carbs: 1, fat: 1 },
            { name: "30g almonds", cals: 180, protein: 6, carbs: 6, fat: 15 },
            { name: "1 medium apple", cals: 80, protein: 0, carbs: 22, fat: 0 },
          ],
          supplements: [],
        },
      ],
    };
    state.mealPlan = plan;
    state.mealPlanV8Seeded = true;
    state.lastMealPlanRegenAt = new Date().toISOString();
    state.eatingWindow = "12:00 to 20:00 UK";
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Jay meal plan V8 seeded (8h recomp window, Greek yoghurt evening)");
  } catch (err) {
    console.error("[migration] Jay meal plan V8 seed failed:", err);
  }
}

// Phase 49: Jay meal plan V9 — drops the 13:30 mid-meal he never eats (too close
// to his 12:00 breakfast for a GLP-1 appetite), shifts ~33g carbs into healthy
// fat (avocado, more almonds, olive oil) for his low T + high HbA1c, adds fibre
// (chia + broccoli + a proper big salad) so Mounjaro doesn't constipate him, and
// renumbers the 4 remaining meals 1-4. Carbs kept around training (meals 2 & 3),
// pulled from the non-training meals. Also widens the eating window to 12:00-20:00
// so the 19:30 evening meal stops being flagged as outside the window.
async function seedJayMealPlanV9() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.mealPlanV9Seeded) return;
    const plan = {
      name: "V9 — higher-fat, more fibre · 8h window",
      meals: [
        {
          id: "breakfast",
          name: "Meal 1 · Breakfast: Eggs, Avocado, Yoghurt & Oats",
          time: "12:00",
          cals: 682, protein: 61, carbs: 40, fat: 31,
          ingredients: [
            { name: "3 whole eggs boiled + 4 egg whites", cals: 282, protein: 33, carbs: 2, fat: 15 },
            { name: "200g Greek yoghurt 0%", cals: 118, protein: 20, carbs: 8, fat: 0 },
            { name: "25g rolled oats", cals: 72, protein: 3, carbs: 13, fat: 1 },
            { name: "80g mixed berries", cals: 30, protein: 1, carbs: 6, fat: 0 },
            { name: "½ avocado", cals: 120, protein: 2, carbs: 6, fat: 11 },
            { name: "1 tbsp chia seeds (stir into yoghurt)", cals: 60, protein: 2, carbs: 5, fat: 4 },
          ],
          supplements: [
            { id: "metformin-am", name: "Metformin", dose: "1000mg" },
            { id: "vit-d", name: "Vitamin D3", dose: "4,000 IU" },
            { id: "omega-3", name: "Omega 3", dose: "2 caps (1,700mg)" },
            { id: "supp-zinc", name: "Zinc", dose: "25mg" },
          ],
        },
        {
          id: "pre-workout",
          name: "Meal 2 · Pre-workout: Chicken, Basmati & Broccoli",
          time: "15:00",
          cals: 569, protein: 69, carbs: 42, fat: 15,
          ingredients: [
            { name: "200g chicken breast grilled", cals: 330, protein: 62, carbs: 0, fat: 8 },
            { name: "150g cooked basmati rice", cals: 149, protein: 3, carbs: 32, fat: 1 },
            { name: "150g broccoli", cals: 50, protein: 4, carbs: 10, fat: 1 },
            { name: "1 tsp olive oil", cals: 40, protein: 0, carbs: 0, fat: 5 },
          ],
          supplements: [
            { id: "supp-coq10", name: "CoQ10", dose: "2 caps (200mg)" },
          ],
        },
        {
          id: "dinner",
          name: "Meal 3 · Post-workout: Shake, Chicken & Big Salad",
          time: "17:30",
          cals: 695, protein: 105, carbs: 55, fat: 11,
          ingredients: [
            { name: "Protein shake: 2 scoops whey + 200ml semi-skim milk + 100g blueberries + 5g creatine (drink immediately on entering kitchen)", cals: 318, protein: 53, carbs: 27, fat: 4 },
            { name: "150g chicken breast grilled", cals: 248, protein: 47, carbs: 0, fat: 6 },
            { name: "50g cooked basmati rice", cals: 49, protein: 1, carbs: 11, fat: 0 },
            { name: "Big salad: 60g mixed leaves + 100g cucumber + 100g cherry tomatoes + 50g grated carrot + 50g pepper, balsamic + lemon (no oil)", cals: 80, protein: 4, carbs: 17, fat: 1 },
          ],
          supplements: [],
        },
        {
          id: "evening",
          name: "Meal 4 · Evening: Greek Yoghurt, Whey & Almonds",
          time: "19:30",
          cals: 488, protein: 55, carbs: 21, fat: 20,
          ingredients: [
            { name: "300g Greek yoghurt 0%", cals: 177, protein: 30, carbs: 12, fat: 0 },
            { name: "20g whey isolate mixed into yoghurt (slow + fast casein/whey blend for overnight LBM)", cals: 79, protein: 17, carbs: 1, fat: 0 },
            { name: "40g almonds", cals: 232, protein: 8, carbs: 8, fat: 20 },
          ],
          supplements: [],
        },
      ],
    };
    state.mealPlan = plan;
    state.mealPlanV9Seeded = true;
    state.lastMealPlanRegenAt = new Date().toISOString();
    state.eatingWindow = "12:00 to 20:00 UK";
    // Widen the fasting window to match when he actually eats (Meal 4 at 19:30).
    if (!state.profile || typeof state.profile !== "object") state.profile = {};
    state.profile.eatingWindow = { enabled: true, start: 12, end: 20 };
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Jay meal plan V9 seeded (4 meals, higher-fat/more-fibre, window 12-20)");
  } catch (err) {
    console.error("[migration] Jay meal plan V9 seed failed:", err);
  }
}

// Phase 49b: split the post-workout meal in two — Jay drinks the shake straight
// after training, then eats the chicken/rice/salad when he gets home. Operates on
// the LIVE plan (preserves current per-ingredient macros) instead of reseeding,
// then renumbers the "Meal N ·" prefixes to match the new order.
async function seedJayMealPlanV10() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.mealPlanV10Seeded) return;
    const plan: any = state.mealPlan;
    const mark = async () => { state.mealPlanV10Seeded = true; await prisma.user.update({ where: { id: user.id }, data: { state } }); };
    if (!plan || !Array.isArray(plan.meals)) { await mark(); return; }
    const idx = plan.meals.findIndex((m: any) => m.id === "dinner" || /post-?workout/i.test(m.name || ""));
    if (idx === -1) { await mark(); return; }
    const dinner = plan.meals[idx];
    const ings: any[] = Array.isArray(dinner.ingredients) ? dinner.ingredients : [];
    const shakeIng = ings.find((i: any) => /shake|whey/i.test(i.name || ""));
    if (!shakeIng) { await mark(); return; } // already split or no shake present
    const rest = ings.filter((i: any) => i !== shakeIng);
    if (typeof shakeIng.name === "string") shakeIng.name = shakeIng.name.replace(/drink immediately on entering kitchen/i, "drink immediately after training");
    const sum = (arr: any[], k: string) => Math.round(arr.reduce((s, i) => s + (+i[k] || 0), 0));
    const shakeMeal = {
      id: "post-shake",
      name: "Post-workout shake — straight after training",
      time: "17:00",
      cals: sum([shakeIng], "cals"), protein: sum([shakeIng], "protein"), carbs: sum([shakeIng], "carbs"), fat: sum([shakeIng], "fat"),
      ingredients: [shakeIng],
      supplements: [],
    };
    const dinnerMeal = {
      ...dinner,
      id: "dinner",
      name: "Post-workout dinner: Chicken, Rice & Big Salad",
      time: dinner.time || "17:30",
      cals: sum(rest, "cals"), protein: sum(rest, "protein"), carbs: sum(rest, "carbs"), fat: sum(rest, "fat"),
      ingredients: rest,
    };
    plan.meals.splice(idx, 1, shakeMeal, dinnerMeal);
    plan.meals.forEach((m: any, i: number) => {
      const base = String(m.name || "").replace(/^Meal\s*\d+\s*·\s*/, "");
      m.name = `Meal ${i + 1} · ${base}`;
    });
    state.mealPlan = plan;
    state.mealPlanV10Seeded = true;
    state.lastMealPlanRegenAt = new Date().toISOString();
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Jay meal plan V10 — split post-workout shake into its own meal");
  } catch (err) {
    console.error("[migration] Jay meal plan V10 split failed:", err);
  }
}

// Phase 54: Abdul's CUT — 5-meal plan (~2,200 kcal / 244P/145C/77F) + a structured
// active-phase record on the profile (the single source of truth for the current
// programming, shown in a banner and editable later). Targets jay@afjltd.co.uk
// (the owner account, displayed as "Abdul").
async function seedAbdulCutV1() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.abdulCutV1Seeded) return;

    const L = "low", M = "moderate"; // GI bands (explicit per spec)
    const plan = {
      name: "Cut — 2,200 kcal · 244P/145C/77F",
      meals: [
        {
          id: "breakfast", name: "Breakfast: Eggs, Avocado, Yoghurt & Oats", time: "12:00",
          cals: 710, protein: 59, carbs: 41, fat: 35,
          ingredients: [
            { name: "3 whole eggs boiled + 4 egg whites", cals: 283, protein: 32, carbs: 1, fat: 15, gi: L },
            { name: "200g Greek yoghurt 0%", cals: 114, protein: 20, carbs: 8, fat: 0, gi: L },
            { name: "15g rolled oats", cals: 57, protein: 2, carbs: 10, fat: 1, gi: M },
            { name: "80g mixed berries", cals: 38, protein: 1, carbs: 8, fat: 0, gi: L },
            { name: "1/2 avocado", cals: 160, protein: 2, carbs: 9, fat: 15, gi: L },
            { name: "1 tbsp chia seeds", cals: 58, protein: 2, carbs: 5, fat: 4, gi: L },
          ],
          supplements: [],
        },
        {
          id: "pre-workout", name: "Pre-workout: Chicken, Basmati & Broccoli", time: "15:00",
          cals: 551, protein: 69, carbs: 38, fat: 13,
          ingredients: [
            { name: "200g chicken breast grilled", cals: 330, protein: 62, carbs: 0, fat: 7, gi: L },
            { name: "100g cooked basmati rice", cals: 130, protein: 3, carbs: 28, fat: 0, gi: M },
            { name: "150g broccoli", cals: 51, protein: 4, carbs: 10, fat: 1, gi: L },
            { name: "1 tsp olive oil", cals: 40, protein: 0, carbs: 0, fat: 5, gi: L },
          ],
          supplements: [{ id: "supp-coq10", name: "CoQ10", dose: "2 caps (200mg)" }],
        },
        {
          id: "post-shake", name: "Post-workout shake", time: "17:00",
          cals: 179, protein: 20, carbs: 18, fat: 3,
          ingredients: [
            { name: "1 scoop whey + water + 100g blueberries + 5g creatine", cals: 179, protein: 20, carbs: 18, fat: 3, gi: L },
          ],
          supplements: [],
        },
        {
          id: "dinner", name: "Post-workout dinner: Chicken, Rice & Big Salad", time: "17:30",
          cals: 432, protein: 52, carbs: 30, fat: 11,
          ingredients: [
            { name: "150g chicken breast grilled", cals: 248, protein: 47, carbs: 0, fat: 5, gi: L },
            { name: "50g cooked basmati rice", cals: 65, protein: 1, carbs: 14, fat: 0, gi: M },
            { name: "Big salad: 60g mixed leaves + 100g cucumber + 100g cherry tomatoes + 50g grated carrot + 50g pepper, balsamic + lemon (no oil)", cals: 79, protein: 4, carbs: 16, fat: 1, gi: L },
            { name: "1 tsp olive oil on salad", cals: 40, protein: 0, carbs: 0, fat: 5, gi: L },
          ],
          supplements: [],
        },
        {
          id: "evening", name: "Evening: Greek Yoghurt & Almonds", time: "19:30",
          cals: 344, protein: 36, carbs: 18, fat: 15,
          ingredients: [
            { name: "300g Greek yoghurt 0%", cals: 171, protein: 30, carbs: 12, fat: 0, gi: L },
            { name: "30g almonds", cals: 173, protein: 6, carbs: 6, fat: 15, gi: L },
          ],
          supplements: [],
        },
      ],
    };

    // Pull starting weight from the latest body entry (fallback 112).
    const wl: any[] = Array.isArray(state.weightLog) ? state.weightLog : [];
    const latestW = wl.length ? (parseFloat(wl[wl.length - 1].weight) || 112) : 112;
    const startW = Math.round(latestW * 10) / 10;
    const TODAY = "2026-06-18";

    const pf: any = state.profile || (state.profile = {});
    // Canonical active-phase record — source of truth for the banner + future edits.
    pf.activePhase = {
      phase: "Cut",
      startDate: TODAY,
      calorieTarget: 2200,
      proteinFloor: 200,
      calorieFloor: 1900,
      startWeight: startW,
      goalWeight: 93,
      targetBFLow: 15,
      targetBFHigh: 18,
      updatedAt: new Date().toISOString(),
    };
    // Sync the fields the rest of the app already reads, so nothing diverges.
    pf.phase = "cut";
    pf.personal = pf.personal || {};
    pf.personal.phase = "cut";
    pf.targetWeight = 93;
    pf.startWeight = startW;
    pf.targetBF = 18;
    pf.proteinFloor = 200;
    pf.targetOverrides = pf.targetOverrides || {};
    pf.targetOverrides.calorieFloor = 1900;
    // Display targets so the Today page matches the cut (plan macros, calories at the 2,200 target).
    const dt = { calories: 2200, protein: 244, carbs: 145, fat: 77 };
    pf.dynamicTargets = { rest: { ...dt }, upper: { ...dt }, lower: { ...dt } };
    pf.calsRest = 2200; pf.calsGym = 2200;
    pf.macros = { protein: 244, carbs: 145, fat: 77 };

    state.mealPlan = plan;
    state.lastMealPlanRegenAt = new Date().toISOString();
    state.eatingWindow = "12:00 to 20:00 UK";
    pf.eatingWindow = { enabled: true, start: 12, end: 20 };
    state.abdulCutV1Seeded = true;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Abdul CUT seeded — 5-meal plan (~2,200 kcal) + activePhase record");
  } catch (err) {
    console.error("[migration] Abdul CUT seed failed:", err);
  }
}

// Phase 54a: correct the whey scoop to 20g protein (was 28g) in the live meal plan
// and re-derive that ingredient's calories + the meal totals from the ingredients.
async function fixAbdulWheyV1() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.abdulWheyFixedV1) return;
    const meals = state.mealPlan?.meals;
    if (!Array.isArray(meals)) {
      state.abdulWheyFixedV1 = true;
      await prisma.user.update({ where: { id: user.id }, data: { state } });
      return;
    }
    for (const m of meals) {
      for (const ing of (m.ingredients || [])) {
        if (/whey/i.test(ing.name || "") && (+ing.protein || 0) > 20) {
          ing.protein = 20;
          ing.cals = Math.round(20 * 4 + (+ing.carbs || 0) * 4 + (+ing.fat || 0) * 9); // re-derive from macros
        }
      }
      const sum = (k: string) => Math.round((m.ingredients || []).reduce((s: number, i: any) => s + (+i[k] || 0), 0));
      m.cals = sum("cals"); m.protein = sum("protein"); m.carbs = sum("carbs"); m.fat = sum("fat");
    }
    state.abdulWheyFixedV1 = true;
    state.lastMealPlanRegenAt = new Date().toISOString();
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Abdul whey corrected to 20g/scoop; meal totals re-derived");
  } catch (err) {
    console.error("[migration] fixAbdulWheyV1 failed:", err);
  }
}

// Phase 54b: fix Abdul's activePhase.startDate — seedAbdulCutV1 stamped the
// migration-run date (2026-06-18) but the cut started 2026-05-08.
async function fixAbdulPhaseStartV1() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state = (user as any).state || {};
    if (state.abdulPhaseStartFixedV1) return;
    const ap = state.profile?.activePhase;
    if (ap) ap.startDate = "2026-05-08";
    state.abdulPhaseStartFixedV1 = true;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Abdul activePhase.startDate corrected to 2026-05-08");
  } catch (err) {
    console.error("[migration] fixAbdulPhaseStartV1 failed:", err);
  }
}

// Phase 54c: Abdul graduated off SkinCeuticals Retinol 0.3% onto prescription
// tretinoin 0.025%, restarting the frequency ladder at every-other-day for the
// stronger product (5+ clean applications, no irritation). Rename the retinoid
// slot, drop it to every-2-days, and reset the tolerance clock to phase 3 so the
// Retinol Journey guides EOD → 5x/wk → nightly as his skin stays clear.
async function switchAbdulToTretinoinV1() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state = (user as any).state || {};
    if (state.abdulTretinoinV1) return;
    const sc = state.skinCare;
    if (!sc || !Array.isArray(sc.products)) return;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    const ret = sc.products.find((p: any) => p && p.type === "retinol");
    if (ret) {
      ret.name = "Tretinoin 0.025%";
      ret.concentration = "0.025%";
      ret.frequency = "every-2-days";
      ret.frequencyStartedAt = today;
      ret.notes =
        "Prescription tretinoin — started every other day off SkinCeuticals Retinol 0.3%. Step up to 5x/wk then nightly only after a clear stretch with zero irritation.";
    }
    sc.phase = 3; // every-other-day rung
    sc.phaseStartDate = today; // resets the 3-week + 14-day tolerance clocks
    sc.tretinoinReady = true;
    state.abdulTretinoinV1 = true;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Abdul retinoid switched to Tretinoin 0.025% every-other-day (phase 3)");
  } catch (err) {
    console.error("[migration] switchAbdulToTretinoinV1 failed:", err);
  }
}

// Fix Abdul's startWeight — seedAbdulCutV1 overwrote the correct 113.5
// (from progress baseline) with the latest weightLog entry (~109.8).
async function fixAbdulStartWeightV1() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state = (user as any).state || {};
    if (state.abdulStartWeightFixedV1) return;
    const pf = state.profile || {};
    pf.startWeight = 113.5;
    if (pf.activePhase) pf.activePhase.startWeight = 113.5;
    state.abdulStartWeightFixedV1 = true;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Abdul startWeight corrected to 113.5");
  } catch (err) {
    console.error("[migration] fixAbdulStartWeightV1 failed:", err);
  }
}

// Phase 54d: bump Abdul's post-workout shake to 40g protein (1 scoop → 2 scoops
// whey). Operates on the LIVE plan; re-derives the ingredient's calories and the
// meal totals using the plan's cal formula (P*4 + C*4 + F*9).
async function fixAbdulShakeProteinV1() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.abdulShakeProteinV1) return;
    const meals = state.mealPlan?.meals;
    const mark = async () => { state.abdulShakeProteinV1 = true; await prisma.user.update({ where: { id: user.id }, data: { state } }); };
    if (!Array.isArray(meals)) { await mark(); return; }
    const shakeMeal = meals.find((m: any) => m.id === "post-shake" || /post-?workout shake/i.test(m.name || ""));
    if (!shakeMeal || !Array.isArray(shakeMeal.ingredients)) { await mark(); return; }
    const shake = shakeMeal.ingredients.find((i: any) => /shake|whey/i.test(i.name || ""));
    if (!shake) { await mark(); return; }
    // Target 40g protein via a second whey scoop (+20g protein, +1g carb, +1g fat).
    shake.protein = 40;
    shake.carbs = (+shake.carbs || 0) + 1;
    shake.fat = (+shake.fat || 0) + 1;
    if (typeof shake.name === "string") shake.name = shake.name.replace(/\b1 scoop whey\b/i, "2 scoops whey");
    shake.cals = Math.round((+shake.protein || 0) * 4 + (+shake.carbs || 0) * 4 + (+shake.fat || 0) * 9);
    const sum = (k: string) => Math.round((shakeMeal.ingredients || []).reduce((s: number, i: any) => s + (+i[k] || 0), 0));
    shakeMeal.cals = sum("cals"); shakeMeal.protein = sum("protein"); shakeMeal.carbs = sum("carbs"); shakeMeal.fat = sum("fat");
    state.abdulShakeProteinV1 = true;
    state.lastMealPlanRegenAt = new Date().toISOString();
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Abdul post-workout shake bumped to 40g protein (2 scoops whey); meal totals re-derived");
  } catch (err) {
    console.error("[migration] fixAbdulShakeProteinV1 failed:", err);
  }
}

// Phase 55: fibre + macro rebalance on Abdul's live plan (user-directed).
//  - Pre-workout: broccoli → 80g garden peas (broccoli was hard to tolerate;
//    peas give more fibre, less bloat), chicken 200g→150g, basmati 100g→85g.
//  - Dinner: chicken 150g→120g.
//  - Evening: add 1 tbsp psyllium husk (fibre, ~zero-cal lever for GLP-1 gut).
// Chicken trimmed (not carbs/fat) so carbs+fat stay near target while calories
// land ~2,200 at 233g protein (~2.2g/kg, well above the 200g floor). Re-derives
// each touched meal's totals from its ingredient sums.
async function fixAbdulPeasFibreRebalanceV1() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.abdulPeasFibreRebalanceV1) return;
    const meals = state.mealPlan?.meals;
    const mark = async () => { state.abdulPeasFibreRebalanceV1 = true; await prisma.user.update({ where: { id: user.id }, data: { state } }); };
    if (!Array.isArray(meals)) { await mark(); return; }

    const findMeal = (id: string, re: RegExp) => meals.find((m: any) => m.id === id || re.test(m.name || ""));
    const sum = (ings: any[], k: string) => Math.round((ings || []).reduce((s: number, i: any) => s + (+i[k] || 0), 0));
    const recompute = (m: any) => { m.cals = sum(m.ingredients, "cals"); m.protein = sum(m.ingredients, "protein"); m.carbs = sum(m.ingredients, "carbs"); m.fat = sum(m.ingredients, "fat"); };

    // Pre-workout meal
    const pre = findMeal("pre-workout", /pre-?workout/i);
    if (pre && Array.isArray(pre.ingredients)) {
      for (const ing of pre.ingredients) {
        const n = String(ing.name || "");
        if (/broccoli/i.test(n)) { ing.name = "80g garden peas"; ing.cals = 67; ing.protein = 5; ing.carbs = 11; ing.fat = 0; ing.gi = "moderate"; }
        else if (/chicken/i.test(n)) { ing.name = "150g chicken breast grilled"; ing.cals = 248; ing.protein = 47; ing.carbs = 0; ing.fat = 5; }
        else if (/basmati|rice/i.test(n)) { ing.name = "85g cooked basmati rice"; ing.cals = 111; ing.protein = 3; ing.carbs = 24; ing.fat = 0; }
      }
      recompute(pre);
    }

    // Dinner meal
    const dinner = findMeal("dinner", /dinner/i);
    if (dinner && Array.isArray(dinner.ingredients)) {
      const chick = dinner.ingredients.find((i: any) => /chicken/i.test(i.name || ""));
      if (chick) { chick.name = "120g chicken breast grilled"; chick.cals = 198; chick.protein = 38; chick.carbs = 0; chick.fat = 4; }
      recompute(dinner);
    }

    // Evening meal — add psyllium husk once
    const eve = findMeal("evening", /evening/i);
    if (eve && Array.isArray(eve.ingredients) && !eve.ingredients.some((i: any) => /psyllium/i.test(i.name || ""))) {
      eve.ingredients.push({ name: "1 tbsp psyllium husk (stir into yoghurt, drink with a big glass of water)", cals: 25, protein: 0, carbs: 7, fat: 0, gi: "low" });
      recompute(eve);
    }

    state.mealPlan = state.mealPlan; // keep reference explicit
    state.abdulPeasFibreRebalanceV1 = true;
    state.lastMealPlanRegenAt = new Date().toISOString();
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Abdul plan rebalanced — broccoli→peas, chicken trims, +psyllium; totals re-derived");
  } catch (err) {
    console.error("[migration] fixAbdulPeasFibreRebalanceV1 failed:", err);
  }
}

// Phase 41g: advance Jay to retinol Phase 3 (every-2-days = every other day).
// Mirrors data.js setSkinPhase(3). Re-frequencies retinol + cicaplast products
// and stamps a fresh phaseStartDate so the 3-week tolerance clock starts today.
async function setJaySkinPhase3() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.skinPhase3SetAt) return;
    if (!state.skinCare) return;
    const today = new Date().toISOString().slice(0, 10);
    state.skinCare.phase = 3;
    state.skinCare.phaseStartDate = today;
    if (Array.isArray(state.skinCare.products)) {
      for (const p of state.skinCare.products) {
        if (p?.type === "retinol" || p?.id === "skn-cicaplast") {
          p.frequency = "every-2-days";
          p.frequencyStartedAt = today;
        }
      }
    }
    state.skinPhase3SetAt = today;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log(`[migration] Jay skin Phase 3 set (every-2-days) starting ${today}`);
  } catch (err) {
    console.error("[migration] setJaySkinPhase3 failed:", err);
  }
}

// Phase 41f: harder-purge the legacy Protein supplement — the previous Phase 41e
// migration used strict exact-match filters and missed name variants (e.g.
// "Protein 20g") and slug suffixes ("protein-2"). This catches any id or name
// containing "protein"/"whey" (case-insensitive substring). Safe because there
// is no legitimate stand-alone protein/whey supplement in the canonical list —
// protein flows through the M4 shake as a meal ingredient.
async function purgeJayProteinSupplementV2() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.proteinSuppPurgedV2) return;
    if (Array.isArray(state.supplements)) {
      const before = state.supplements.length;
      const removed: any[] = [];
      state.supplements = state.supplements.filter((s: any) => {
        if (!s) return false;
        const id = String(s.id || "").toLowerCase();
        const name = String(s.name || "").toLowerCase();
        if (id.includes("protein") || id.includes("whey")) { removed.push({ id: s.id, name: s.name }); return false; }
        if (name.includes("protein") || name.includes("whey")) { removed.push({ id: s.id, name: s.name }); return false; }
        return true;
      });
      const n = before - state.supplements.length;
      state.proteinSuppPurgedV2 = true;
      await prisma.user.update({ where: { id: user.id }, data: { state } });
      console.log(`[migration] Jay protein/whey supplement V2 purge: removed ${n} entries — ${JSON.stringify(removed)}`);
    }
  } catch (err) {
    console.error("[migration] purgeJayProteinSupplementV2 failed:", err);
  }
}

// Phase 41e: purge legacy standalone "Protein" entry from supplement list.
// Protein for Jay comes through the M4 post-workout shake as a meal ingredient,
// not as a tracked supplement. The entry was likely a manual add at some point.
async function purgeJayProteinSupplement() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.proteinSuppPurged) return;
    if (Array.isArray(state.supplements)) {
      const before = state.supplements.length;
      state.supplements = state.supplements.filter((s: any) => {
        if (!s) return false;
        // Exact id matches first (avoid catching things like supp-omega3 etc.)
        if (s.id === "protein" || s.id === "supp-protein" || s.id === "whey" || s.id === "supp-whey") return false;
        // Exact name match (case-insensitive). DO NOT regex-match — would catch "Protein shake" if it existed as a supp.
        const n = String(s.name || "").trim().toLowerCase();
        if (n === "protein" || n === "whey protein" || n === "whey") return false;
        return true;
      });
      const removed = before - state.supplements.length;
      state.proteinSuppPurged = true;
      await prisma.user.update({ where: { id: user.id }, data: { state } });
      console.log(`[migration] Jay standalone Protein supplement purged (${removed} entries removed)`);
    }
  } catch (err) {
    console.error("[migration] purgeJayProteinSupplement failed:", err);
  }
}

// Phase 41d: harder purge of Multivitamin — earlier patch only caught the
// canonical id `supp-multivitamin`, but the user's manual entry may use the
// slugified id `multivitamin`. Match by both ids AND name pattern.
async function purgeJayMultivitamin() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.multivitaminPurged) return;
    if (Array.isArray(state.supplements)) {
      const before = state.supplements.length;
      state.supplements = state.supplements.filter((s: any) => {
        if (!s) return false;
        if (s.id === "supp-multivitamin" || s.id === "multivitamin") return false;
        if (typeof s.name === "string" && /multi.?vitamin/i.test(s.name)) return false;
        return true;
      });
      const removed = before - state.supplements.length;
      state.multivitaminPurged = true;
      await prisma.user.update({ where: { id: user.id }, data: { state } });
      console.log(`[migration] Jay Multivitamin purged (${removed} entries removed)`);
    }
  } catch (err) {
    console.error("[migration] purgeJayMultivitamin failed:", err);
  }
}

// Phase 41c: remove multivitamin (Jay doesn't take it), update CoQ10 dose spec,
// and link CoQ10 to M3 pre-workout in the existing meal plan.
async function patchJaySupplementsAndMealsV8c() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.supplementsV8cPatched) return;

    // Remove Multivitamin from supplements list (user doesn't take it)
    if (Array.isArray(state.supplements)) {
      state.supplements = state.supplements.filter((s: any) => s?.id !== "supp-multivitamin");
      // Update CoQ10 dose + mealId on existing entry
      for (const s of state.supplements) {
        if (s?.id === "supp-coq10") {
          s.dose = "2 caps (200mg total)";
          s.mealId = "pre-workout";
          s.notes = "Fat-soluble · statin-induced CoQ10 depletion support · with pre-workout meal";
        }
      }
    }

    // Add CoQ10 to M3 pre-workout meal's supplement array (only if not already there)
    if (state.mealPlan && Array.isArray(state.mealPlan.meals)) {
      const pw = state.mealPlan.meals.find((m: any) => m.id === "pre-workout");
      if (pw) {
        if (!Array.isArray(pw.supplements)) pw.supplements = [];
        if (!pw.supplements.some((x: any) => x?.id === "supp-coq10")) {
          pw.supplements.push({ id: "supp-coq10", name: "CoQ10", dose: "2 caps (200mg)" });
        }
      }
    }

    state.supplementsV8cPatched = true;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Jay: removed Multivitamin, linked CoQ10 to M3 pre-workout");
  } catch (err) {
    console.error("[migration] patchJaySupplementsAndMealsV8c failed:", err);
  }
}

// Phase 41o: seed Jay's first DEXA scan (BodyView Edgbaston, 2 June 2026).
// One-shot; user can add future scans via the modal.
async function seedJayDexa20260602() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.dexa20260602Seeded) return;
    if (!Array.isArray(state.dexaScans)) state.dexaScans = [];
    const entry = {
      id: "dexa_seed_2026_06_02",
      date: "2026-06-02",
      provider: "BodyView Edgbaston",
      weight: 113.8,
      bodyFatPct: 29.9,
      fatMass: 34.0,
      leanMass: 76.8,
      boneMass: 2.94,
      vatCm2: 197,
      bmdTotal: 1.235,
      tScore: 0.4,
      zScore: 0.5,
      lmi: 24.1,
      almi: 10.8,
      fmi: 10.7,
      androidFatPct: 34.9,
      gynoidFatPct: 33.4,
      muscleSymmetryPct: 9.06,
      longevityIndex: 50.5,
      notes: "First DEXA. BMD normal/above-average despite low T. Visceral fat HIGH band — primary focus for cut. LBM 93rd percentile.",
      loggedAt: new Date().toISOString(),
    };
    if (!state.dexaScans.some((s: any) => s?.id === entry.id)) state.dexaScans.push(entry);
    state.dexa20260602Seeded = true;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Jay DEXA scan 2026-06-02 seeded (BodyView Edgbaston)");
  } catch (err) {
    console.error("[migration] seedJayDexa20260602 failed:", err);
  }
}

// Phase 41n: swap breakfast eggs from "4 whole boiled" to "3 whole boiled +
// 4 egg whites" (what Jay actually eats). Adds 9g protein, saves 5g fat,
// virtually the same calories. Meal totals updated to reflect the swap.
async function swapJayBreakfastEggsToWhites() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.eggsSwap34Done) return;
    const plan = state.mealPlan;
    if (!plan || !Array.isArray(plan.meals)) return;
    const breakfast = plan.meals.find((m: any) => m.id === "breakfast");
    if (!breakfast || !Array.isArray(breakfast.ingredients)) return;
    let swapped = false;
    for (const ing of breakfast.ingredients) {
      if (typeof ing?.name === "string" && /eggs?\b/i.test(ing.name) && !/white/i.test(ing.name)) {
        ing.name = "3 whole eggs boiled + 4 egg whites";
        ing.cals = 284;
        ing.protein = 33;
        ing.carbs = 2;
        ing.fat = 15;
        swapped = true;
        break;
      }
    }
    if (swapped) {
      // Recompute meal totals from ingredients
      const sum = (k: string) => breakfast.ingredients.reduce((s: number, i: any) => s + (+i[k] || 0), 0);
      breakfast.cals = Math.round(sum("cals"));
      breakfast.protein = Math.round(sum("protein"));
      breakfast.carbs = Math.round(sum("carbs"));
      breakfast.fat = Math.round(sum("fat"));
    }
    state.eggsSwap34Done = true;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log(`[migration] Jay breakfast eggs swapped to 3 whole + 4 whites (${swapped ? "patched, totals=" + breakfast.cals + "/" + breakfast.protein + "/" + breakfast.carbs + "/" + breakfast.fat : "no match"})`);
  } catch (err) {
    console.error("[migration] swapJayBreakfastEggsToWhites failed:", err);
  }
}

// Phase 41b patch: change breakfast eggs from scrambled to boiled (Jay's preference).
// Idempotent — runs once, only updates if the name still contains "scrambled".
async function fixJayBreakfastEggsBoiled() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.eggsBoiledFixed) return;
    const plan = state.mealPlan;
    let changed = false;
    if (plan && Array.isArray(plan.meals)) {
      const breakfast = plan.meals.find((m: any) => m.id === "breakfast");
      if (breakfast && Array.isArray(breakfast.ingredients)) {
        for (const ing of breakfast.ingredients) {
          if (typeof ing?.name === "string" && /scrambled/i.test(ing.name)) {
            ing.name = ing.name.replace(/scrambled/gi, "boiled");
            changed = true;
          }
        }
      }
    }
    state.eggsBoiledFixed = true;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log(`[migration] Jay breakfast eggs: scrambled → boiled (${changed ? "patched" : "no change"})`);
  } catch (err) {
    console.error("[migration] fixJayBreakfastEggsBoiled failed:", err);
  }
}

// Phase 41b: update Jay's existing supplement list to match V8 spec.
// - Zinc dose 30mg → 25mg
// - Omega 3 consolidated: drop supp-omega3-2 entirely, move omega-3 to meal-1 12:00 with Bare Biology 1,700mg dose
// - Mounjaro time 15:00 → 18:00 (post-workout injection)
async function updateJaySupplementsV8() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.suppsV8Updated) return;
    if (!Array.isArray(state.supplements)) state.supplements = [];

    // Remove supp-omega3-2 entirely (second dose dropped — Bare Biology is high-strength)
    state.supplements = state.supplements.filter((s: any) => s?.id !== "supp-omega3-2");

    // Patch existing entries by id
    for (const s of state.supplements) {
      if (s?.id === "omega-3") {
        s.dose = "2 caps (Bare Biology, 1,700mg total)";
        s.time = "12:00";
        s.timing = "meal-1";
        s.notes = "Anti-inflammatory · therapeutic dose for CRP + ALT";
      } else if (s?.id === "supp-zinc") {
        s.dose = "25mg";
      } else if (s?.id === "supp-mounjaro") {
        s.time = "18:00";
        s.notes = "GLP-1 — Wednesday injection post-workout";
      }
    }
    state.suppsV8Updated = true;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Jay supplements updated to V8 (zinc 25mg, omega-3 consolidated to M1, Mounjaro 18:00)");
  } catch (err) {
    console.error("[migration] Jay supplements V8 update failed:", err);
  }
}

// Remove creatine from Jay's supplement list — it's in the post-workout shake,
// tracking it separately double-counts. Historical supplementLog entries remain.
async function removeJayCreatine() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.creatineRemoved) return;
    const before = Array.isArray(state.supplements) ? state.supplements.length : 0;
    if (Array.isArray(state.supplements)) {
      state.supplements = state.supplements.filter((s: any) => s?.id !== "creatine");
    }
    state.creatineRemoved = true;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log(`[migration] Jay creatine removed from supplements (${before} -> ${(state.supplements || []).length})`);
  } catch (err) {
    console.error("[migration] removeJayCreatine failed:", err);
  }
}

// Add Zinc + CoQ10 to Jay's supplement list (idempotent — merges by id).
async function seedJayZincCoQ10() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.suppsZincCoQ10Added) return;
    const additions: any[] = [
      { id: "supp-zinc",  name: "Zinc",  dose: "30mg",  time: "12:00", mealId: "", timing: "meal-1", withFood: true, critical: false, notes: "With meal 1 — testosterone + immune support" },
      { id: "supp-coq10", name: "CoQ10", dose: "2 caps (200mg total)", time: "15:00", mealId: "pre-workout", timing: "meal-2", withFood: true, critical: false, notes: "Fat-soluble · statin-induced CoQ10 depletion support · with pre-workout meal" },
    ];
    const existing: any[] = Array.isArray(state.supplements) ? state.supplements : [];
    const ids = new Set(existing.map((s: any) => s?.id));
    let added = 0;
    for (const a of additions) {
      if (!ids.has(a.id)) { existing.push(a); added++; }
    }
    state.supplements = existing;
    state.suppsZincCoQ10Added = true;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log(`[migration] Jay supplements: added ${added} (Zinc + CoQ10)`);
  } catch (err) {
    console.error("[migration] Jay Zinc/CoQ10 seed failed:", err);
  }
}

// Phase 42a: legacy users keep their exact pre-42 targets — the new phase-driven
// engine reads profile.targetOverrides first, and this seeds Jay's current numbers
// (fixed 350 deficit, LBM-based protein with 200g floor, 2400 floor, 3.0/3.5L water).
async function seedJayTargetOverridesV1() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.targetOverridesSeededV1) return;
    if (!state.profile) state.profile = {};
    state.profile.targetOverrides = {
      deficitFixed: 350,
      proteinPerKgLBM: 2.2,
      proteinMin: 200,
      calorieFloor: 2400,
      activityFactor: 1.55,
      waterRest: 3000,
      waterGym: 3500,
    };
    if (!state.profile.personal) state.profile.personal = {};
    if (!state.profile.personal.phase) state.profile.personal.phase = "cut";
    if (!state.profile.eatingWindow) state.profile.eatingWindow = { enabled: true, start: 12, end: 20 };
    state.targetOverridesSeededV1 = true;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Jay target overrides seeded (pre-42 parity)");
  } catch (err) {
    console.error("[migration] seedJayTargetOverridesV1 failed:", err);
  }
}

// Phase 45: weekly tape-measurement reminder for the owner — Saturday 11:00 UK
// (he wakes late). Tape trends are the most hydration-immune signal the coach has.
async function seedJayTapeReminderV1() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "jay@afjltd.co.uk" } });
    if (!user) return;
    const state: any = user.state || {};
    if (state.tapeReminderSeededV1) return;
    if (!Array.isArray(state.reminders)) state.reminders = [];
    if (!state.reminders.some((r: any) => r?.id === "rem_tape_weekly")) {
      state.reminders.push({
        id: "rem_tape_weekly",
        title: "📏 Tape measurements",
        body: "Waist, chest, arms, thighs, neck — 2 minutes, same conditions each week.",
        time: "11:00",
        daysOfWeek: [6], // Saturday
      });
    }
    state.tapeReminderSeededV1 = true;
    await prisma.user.update({ where: { id: user.id }, data: { state } });
    console.log("[migration] Jay weekly tape reminder seeded (Sat 11:00)");
  } catch (err) {
    console.error("[migration] seedJayTapeReminderV1 failed:", err);
  }
}

const server = app.listen(PORT, async () => {
  console.log(`Forge server running on port ${PORT}`);
  startCron();
  // Migrations run sequentially — they all read-modify-write the same state row,
  // so concurrent execution can lose writes. Each is individually try/caught.
  await migrateJayProgress();
  await seedJayMealPlan();
  await fixJayVisceralTarget();
  await seedJayBloodMarkers();
  await fixJayPostWorkoutBerries();
  await fixJayOmega3Dose();
  await seedJaySkinCareV1();
  await seedJayInjuryV1();
  await clearAbdulInjuriesV1();
  await seedJayNutritionSuppsV1();
  await seedJayZincCoQ10();
  await removeJayCreatine();
  await seedJayMealPlanV8();
  await updateJaySupplementsV8();
  await fixJayBreakfastEggsBoiled();
  await swapJayBreakfastEggsToWhites();
  await seedJayDexa20260602();
  await patchJaySupplementsAndMealsV8c();
  await purgeJayMultivitamin();
  await purgeJayProteinSupplement();
  await purgeJayProteinSupplementV2();
  await setJaySkinPhase3();
  await seedJayTargetOverridesV1();
  await seedJayTapeReminderV1();
  await seedJayMealPlanV9();
  await seedJayMealPlanV10();
  await seedAbdulCutV1();
  await fixAbdulWheyV1();
  await fixAbdulPhaseStartV1();
  await fixAbdulStartWeightV1();
  await fixAbdulShakeProteinV1();
  await fixAbdulPeasFibreRebalanceV1();
  await switchAbdulToTretinoinV1();
  // Phase 46: heal a fully-missed Sunday report (process was down across the
  // 09:00 tick). Fire-and-forget; 150h threshold means it only generates when
  // ~a week has elapsed with no report, never a spurious mid-week one.
  runWeeklyCoaching(150, "startup").catch((e) => console.error("startup coaching catch-up failed:", e));
});

const shutdown = async (signal: string) => {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log("Cleanup complete, exiting");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 25000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
