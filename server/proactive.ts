// Proactive coach — server orchestration (Phase 57).
// Phase 1: nightly deterministic correlation compute (no LLM). The pure maths
// live in public/proactive-core.js (shared with the zero-dep tests); this module
// loads it, feeds in the user's exercise rep-ranges + GLP-1 context, and caches
// the result on state.correlations for the weekly report + the daily scanner.
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import webpush from "web-push";
import prisma from "./db";
import { decrypt } from "./crypto-util";
import { chargeAiBudget, ukToday } from "./ai-budget";

export interface Correlation {
  key: string; label: string; n?: number; r?: number | null; insufficient: boolean;
  direction?: string | null; summary: string; nCycles?: number; deltaKcal?: number;
  strength?: string; r_abs?: number | null;
}
export interface CorrelationResult {
  minN: number; correlations: Correlation[]; stalls: Array<{ exId: string; sessions: number; kg: number }>;
}
interface ProactiveCore {
  computeCorrelations(state: any, opts: any): CorrelationResult;
  formatCorrelations(c: any): string;
  detectStalls(state: any, reps: any): Array<{ exId: string; sessions: number; kg: number }>;
  computeTriggers(state: any, opts: any): Array<{ type: string; severity: number; detail: string; data: any }>;
  selectNudge(history: any[], fired: any[], today: string, config: any): { type: string; severity: number; detail: string; data: any } | null;
  blendedLeanSeries(state: any, opts?: any): Array<{ date: string; lean: number; source: string; priority: number }>;
  leanTrendRate(state: any, opts?: any): { perWeek: number | null; source: string | null; n: number; points: any[]; first?: any; last?: any };
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const core: ProactiveCore = require(path.join(process.cwd(), "public", "proactive-core.js"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const shared = require(path.join(process.cwd(), "public", "programme-shared.js"));

export function onGlp1FromState(state: any): boolean {
  const meds = Array.isArray(state.profile?.medications) ? state.profile.medications : [];
  return meds.some((m: any) => /mounjaro|tirzepatide|ozempic|wegovy|semaglutide|glp-?1/i.test(m?.name || ""));
}

export function computeCorrelationsForUser(state: any): CorrelationResult {
  return core.computeCorrelations(state, {
    exerciseReps: shared.EXERCISE_REPS,
    onGlp1: onGlp1FromState(state),
    glp1InjectionDow: typeof state.profile?.glp1InjectionDow === "number" ? state.profile.glp1InjectionDow : null,
  });
}

export function formatCorrelations(c: any): string {
  return core.formatCorrelations(c);
}

// Phase 58: source-hierarchy lean blending (DEXA > Boditrax > Withings), shared
// with the frontend + tests. Re-exported so ai-coach reads one implementation.
export function blendedLeanSeries(state: any, opts?: any) {
  return core.blendedLeanSeries(state, opts);
}
export function leanTrendRate(state: any, opts?: any) {
  return core.leanTrendRate(state, opts);
}

// Re-export the pure first-Sunday check for the cron monthly deep-dive (keeps
// this module free of any ai-coach import, avoiding a circular dependency).
export function isFirstSundayOfMonth(dateStr: string): boolean {
  return (core as any).isFirstSundayOfMonth(dateStr);
}

// Nightly job — cheap, deterministic, no LLM. Caches on state.correlations via a
// single-field jsonb_set (no whole-state clobber).
export async function runNightlyCorrelations(): Promise<void> {
  const users = await prisma.user.findMany();
  for (const user of users) {
    try {
      const state: any = user.state || {};
      const result = computeCorrelationsForUser(state);
      const json = JSON.stringify({ ...result, computedAt: new Date().toISOString() });
      await prisma.$executeRaw`
        UPDATE "User" SET state = jsonb_set(COALESCE(state, '{}')::jsonb, '{correlations}', ${json}::jsonb, true),
        "updatedAt" = NOW() WHERE id = ${user.id}`;
    } catch (e) {
      console.error("[proactive] correlation compute failed for", user.id, e);
    }
  }
}

// ---- Phase 2: daily silent scanner ----
const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const SCANNER_SYSTEM = `You are Forge's proactive coach. A deterministic engine detected a pattern worth possibly flagging today. Your job:
1. Decide whether it genuinely warrants interrupting the user TODAY. If it's trivial, noisy, ambiguous, or not actionable right now, reply with exactly "SKIP" and nothing else.
2. Otherwise write ONE message, MAX 3 sentences: what happened, the likely why (cite a computed correlation from the CONTEXT if one is relevant), one specific action for today. Direct tone. No greeting, no sign-off, no emojis, no fluff. Use the user's real numbers from the context.
Output ONLY "SKIP" or the message — nothing else.`;

function _addDaysUK(d: string, k: number): string {
  const dt = new Date(d + "T12:00:00"); dt.setDate(dt.getDate() + k); return dt.toISOString().slice(0, 10);
}

async function scannerMessage(apiKey: string, state: any, chosen: any): Promise<string | null> {
  const corr = core.formatCorrelations(state.correlations);
  const ctx = ["FIRED TRIGGER: " + chosen.type + " — " + chosen.detail, corr].filter(Boolean).join("\n\n");
  const client = new Anthropic({ apiKey });
  const resp = await client.messages.create({
    model: HAIKU_MODEL, max_tokens: 200, system: SCANNER_SYSTEM,
    messages: [{ role: "user", content: ctx + "\n\nDecide: SKIP or write the message." }],
  });
  const text = (resp.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
  if (!text || /^skip[.!]?$/i.test(text)) return null;
  return text.slice(0, 400);
}

async function deliverNudge(userId: string, message: string): Promise<void> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { state: true } });
  const st: any = u?.state || {};
  const notifs = Array.isArray(st.notifications) ? st.notifications : [];
  notifs.unshift({
    id: "notif_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    type: "coach", title: "Coach", message, date: ukToday(), read: false,
    expiresAt: _addDaysUK(ukToday(), 3),
  });
  const trimmed = notifs.slice(0, 10);
  await prisma.$executeRaw`
    UPDATE "User" SET state = jsonb_set(COALESCE(state, '{}')::jsonb, '{notifications}', ${JSON.stringify(trimmed)}::jsonb, true),
    "updatedAt" = NOW() WHERE id = ${userId}`;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  const payload = JSON.stringify({ title: "Forge coach", body: message.slice(0, 140) });
  for (const sub of subs) {
    try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload); }
    catch (e: any) { if (e?.statusCode === 410 || e?.statusCode === 404) await prisma.pushSubscription.delete({ where: { id: sub.id } }); }
  }
}

// Daily scanner: deterministic checks first (free); LLM only when a governed
// trigger fires; may SKIP. Silent (no LLM, no cost) is the common path.
export async function runDailyScanner(): Promise<{ scanned: number; fired: number; nudged: number }> {
  const today = ukToday();
  const users = await prisma.user.findMany();
  let firedCount = 0, nudged = 0;
  for (const user of users) {
    try {
      const state: any = user.state || {};
      if (state.profile?.coachProactive === false) continue; // kill switch
      const programId = state.profile?.programId || "upper-lower-4d";
      const scheduledDays: string[] = [];
      for (let i = 1; i <= 10; i++) { const d = _addDaysUK(today, -i); if (shared.sessionTypeForDate(programId, d, state.profile?.programmeStartDate || state.trainingStartDate)) scheduledDays.push(d); }
      // Phase 60: deload-week-starting — fire on the FIRST day of a scheduled
      // deload week (today is deload, yesterday was not).
      let deloadStarting = false;
      const pStart = state.profile?.programmeStartDate;
      if (programId === "upper-lower-5d-fixed" && pStart) {
        const todayDl = shared.deloadWeekInfo(pStart, today);
        const yDl = shared.deloadWeekInfo(pStart, _addDaysUK(today, -1));
        deloadStarting = !!(todayDl && todayDl.isDeload && (!yDl || !yDl.isDeload));
      }
      const fired = core.computeTriggers(state, {
        today, exerciseReps: shared.EXERCISE_REPS,
        proteinFloor: state.profile?.coachTargets?.proteinFloorDaily,
        phase: state.profile?.personal?.phase || state.profile?.phase,
        scheduledDays, deloadStarting,
      });
      const history = Array.isArray(state.proactiveNudges) ? state.proactiveNudges : [];
      const chosen = core.selectNudge(history, fired, today, { maxPerWeek: 3, cooldownDays: 5 });
      if (!chosen) continue; // silent — the common case: NO LLM, NO cost
      firedCount++;
      if (!state.coachingKey) continue; // no BYOK key → can't run the judge
      const { allowed } = await chargeAiBudget(user.id); // route proactive spend through the budget
      if (!allowed) continue;
      let apiKey: string; try { apiKey = decrypt(state.coachingKey); } catch { continue; }
      const message = await scannerMessage(apiKey, state, chosen);
      const entry = { type: chosen.type, date: today, message: message || null, delivered: !!message };
      const nudges = [entry, ...history].slice(0, 50);
      await prisma.$executeRaw`
        UPDATE "User" SET state = jsonb_set(COALESCE(state, '{}')::jsonb, '{proactiveNudges}', ${JSON.stringify(nudges)}::jsonb, true),
        "updatedAt" = NOW() WHERE id = ${user.id}`;
      if (message) { await deliverNudge(user.id, message); nudged++; }
    } catch (e) {
      console.error("[proactive] scanner failed for", user.id, e);
    }
  }
  return { scanned: users.length, fired: firedCount, nudged };
}
