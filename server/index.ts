import "dotenv/config";
import express from "express";
import path from "path";
import authRouter from "./auth";
import stateRouter from "./state";

const PORT = parseInt(process.env.PORT || "3000", 10);

const app = express();

app.use(express.json({ limit: "6mb" }));

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

// Static files — use process.cwd() so it works in both dev (tsx) and prod (dist/)
const publicDir = path.join(process.cwd(), "public");
app.use(express.static(publicDir));

// SPA catch-all
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

import { startCron } from "./cron";

app.listen(PORT, () => {
  console.log(`Forge server running on port ${PORT}`);
  startCron();
});
