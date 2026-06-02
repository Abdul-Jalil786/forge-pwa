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

import { startCron } from "./cron";

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
          cals: 630, protein: 52, carbs: 54, fat: 24,
          ingredients: [
            { name: "4 whole eggs boiled", cals: 280, protein: 24, carbs: 1, fat: 20 },
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

const server = app.listen(PORT, () => {
  console.log(`Forge server running on port ${PORT}`);
  startCron();
  migrateJayProgress();
  seedJayMealPlan();
  fixJayVisceralTarget();
  seedJayBloodMarkers();
  fixJayPostWorkoutBerries();
  fixJayOmega3Dose();
  seedJaySkinCareV1();
  seedJayInjuryV1();
  seedJayNutritionSuppsV1();
  seedJayZincCoQ10();
  removeJayCreatine();
  seedJayMealPlanV8();
  updateJaySupplementsV8();
  fixJayBreakfastEggsBoiled();
  patchJaySupplementsAndMealsV8c();
  purgeJayMultivitamin();
  purgeJayProteinSupplement();
  purgeJayProteinSupplementV2();
  setJaySkinPhase3();
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
