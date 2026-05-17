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

const server = app.listen(PORT, () => {
  console.log(`Forge server running on port ${PORT}`);
  startCron();
  migrateJayProgress();
  seedJayMealPlan();
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
