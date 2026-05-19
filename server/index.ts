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

import tokensRouter from "./tokens";
import exportRouter from "./export";
app.use("/api/tokens", tokensRouter);
app.use("/api/export", exportRouter);

import mealPlanRouter from "./mealplan";
import pushRouter from "./push";
app.use("/api/meal-plan", mealPlanRouter);
app.use("/api/push", pushRouter);

import ouraRouter from "./oura-routes";
app.use("/api/oura", ouraRouter);

import withingsRouter from "./withings-routes";
app.use("/api/withings", withingsRouter);

import coachingRouter from "./coaching";
app.use("/api/coaching-reports", coachingRouter);

import profileRouter from "./profile-routes";
app.use("/api/profile", profileRouter);

import remindersRouter from "./reminders-routes";
app.use("/api/reminders", remindersRouter);

import coachSettingsRouter from "./coach-settings";
app.use("/api/coach", coachSettingsRouter);

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

const server = app.listen(PORT, () => {
  console.log(`Forge server running on port ${PORT}`);
  startCron();
  migrateJayProgress();
  seedJayMealPlan();
  fixJayVisceralTarget();
  seedJayBloodMarkers();
  fixJayPostWorkoutBerries();
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
