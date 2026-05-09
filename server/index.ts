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
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.ouraring.com", "https://wbsapi.withings.net"],
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

// Static files — use process.cwd() so it works in both dev (tsx) and prod (dist/)
const publicDir = path.join(process.cwd(), "public");
app.use(express.static(publicDir));

// SPA catch-all
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

import { startCron } from "./cron";

const server = app.listen(PORT, () => {
  console.log(`Forge server running on port ${PORT}`);
  startCron();
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
