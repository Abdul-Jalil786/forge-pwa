// Shared per-user AI-call budget. Extracted so BOTH the Express aiBudget
// middleware (coach-settings) and the cron paths charge the same counters —
// so proactive/cron spend is governed, not free.
//
// Phase 116: per-user LIMITS. The owner keeps the legacy 40/day; every other
// account gets NON_OWNER_AI_DEFAULTS unless the owner sets profile.aiLimits
// from Admin. Feature toggles gate whole features (a disabled feature is
// refused BEFORE it is charged); dailyCap / monthlyCap cap the count. Counters:
// state.aiCallLog[YYYY-MM-DD] (today only, pruned) and
// state.aiMonthLog[YYYY-MM] = { total, <feature>: n } (current month only).
import prisma from "./db";
import { OWNER_EMAIL } from "./auth";

export const AI_DAILY_LIMIT = 40;

export type AiFeature =
  | "weeklyReport" | "sessionBrief" | "sessionReflection" | "recomputeMacros"
  | "regeneratePlan" | "maxLbm" | "monthlyDeepDive" | "estimateFood" | "proactive"
  | "keyTest" | "owner";

export interface AiLimits {
  dailyCap: number;
  monthlyCap: number | null;
  weeklyReport: boolean;
  sessionBrief: boolean;
  sessionReflection: boolean;
  recomputeMacros: boolean;
  regeneratePlan: boolean;
  maxLbm: boolean;
  monthlyDeepDive: boolean;
  estimateFood: boolean;
  proactive: boolean;
}

export const AI_FEATURE_KEYS: Array<keyof AiLimits> = [
  "weeklyReport", "sessionBrief", "sessionReflection", "recomputeMacros",
  "regeneratePlan", "maxLbm", "monthlyDeepDive", "estimateFood", "proactive",
];

export const OWNER_AI_LIMITS: AiLimits = {
  dailyCap: AI_DAILY_LIMIT, monthlyCap: null,
  weeklyReport: true, sessionBrief: true, sessionReflection: true, recomputeMacros: true,
  regeneratePlan: true, maxLbm: true, monthlyDeepDive: true, estimateFood: true, proactive: true,
};

// A shared/borrowed key must not become a blank cheque: report + the cheap
// Haiku bookends + the weekly macro recompute on, the Opus one-offs off.
export const NON_OWNER_AI_DEFAULTS: AiLimits = {
  dailyCap: 4, monthlyCap: 60,
  weeklyReport: true, sessionBrief: true, sessionReflection: true, recomputeMacros: true,
  regeneratePlan: false, maxLbm: false, monthlyDeepDive: false, estimateFood: true, proactive: true,
};

export function ukToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}
export function ukMonth(): string { return ukToday().slice(0, 7); }

// Validate + normalise an owner-supplied limits object (partial allowed).
// Returns null when nothing valid is present.
export function sanitizeAiLimits(raw: any): Partial<AiLimits> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: any = {};
  if (raw.dailyCap != null && raw.dailyCap !== "") {
    const n = parseInt(raw.dailyCap, 10);
    if (Number.isFinite(n)) out.dailyCap = Math.max(0, Math.min(200, n));
  }
  if (raw.monthlyCap === null) out.monthlyCap = null;
  else if (raw.monthlyCap != null && raw.monthlyCap !== "") {
    const n = parseInt(raw.monthlyCap, 10);
    if (Number.isFinite(n)) out.monthlyCap = Math.max(0, Math.min(5000, n));
  }
  for (const k of AI_FEATURE_KEYS) if (typeof raw[k] === "boolean") out[k] = raw[k];
  return Object.keys(out).length ? out : null;
}

export function resolveAiLimits(state: any, email: string | null | undefined): AiLimits {
  const owner = !!email && email.toLowerCase() === OWNER_EMAIL;
  const base = owner ? OWNER_AI_LIMITS : NON_OWNER_AI_DEFAULTS;
  const custom = sanitizeAiLimits(state?.profile?.aiLimits) || {};
  return { ...base, ...custom };
}

export function aiFeatureAllowed(limits: AiLimits, feature: AiFeature | undefined): boolean {
  if (!feature || feature === "owner" || feature === "keyTest") return true;
  return !!(limits as any)[feature];
}

export interface ChargeResult {
  allowed: boolean;
  count: number;
  monthCount: number;
  reason?: "disabled" | "daily" | "monthly";
  limits: AiLimits;
}

// Atomic increment-then-check of the day + month counters. A feature the user's
// limits turn off is refused WITHOUT charging. `enforceCaps:false` (cron paths)
// counts the call but never blocks on caps — the Sunday report is promised to
// run regardless. Never throws to callers — on error it fails OPEN (allowed).
export async function chargeAiBudget(
  userId: string,
  feature?: AiFeature,
  opts: { enforceCaps?: boolean } = {},
): Promise<ChargeResult> {
  const enforceCaps = opts.enforceCaps !== false;
  let limits: AiLimits = OWNER_AI_LIMITS;
  try {
    const rows = await prisma.$queryRaw<Array<{ email: string; limits: any }>>`
      SELECT email, state->'profile'->'aiLimits' AS limits FROM "User" WHERE id = ${userId}
    `;
    const row = rows[0];
    limits = resolveAiLimits({ profile: { aiLimits: row?.limits } }, row?.email);
    if (!aiFeatureAllowed(limits, feature)) {
      return { allowed: false, count: 0, monthCount: 0, reason: "disabled", limits };
    }
    const day = ukToday();
    const month = ukMonth();
    const featKey = feature || "other";
    const counts = await prisma.$queryRaw<Array<{ count: number; month_count: number }>>`
      UPDATE "User"
      SET state = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(COALESCE(state, '{}')::jsonb, '{aiCallLog}', COALESCE(state->'aiCallLog', '{}'), true),
                '{aiMonthLog}', COALESCE(state->'aiMonthLog', '{}'), true
              ),
              ARRAY['aiCallLog', ${day}],
              to_jsonb(COALESCE((state->'aiCallLog'->>${day})::int, 0) + 1), true
            ),
            ARRAY['aiMonthLog', ${month}], COALESCE(state->'aiMonthLog'->${month}, '{}'), true
          ),
          ARRAY['aiMonthLog', ${month}, 'total'],
          to_jsonb(COALESCE((state->'aiMonthLog'->${month}->>'total')::int, 0) + 1), true
        ),
        ARRAY['aiMonthLog', ${month}, ${featKey}],
        to_jsonb(COALESCE((state->'aiMonthLog'->${month}->>${featKey})::int, 0) + 1), true
      )
      WHERE id = ${userId}
      RETURNING (state->'aiCallLog'->>${day})::int AS count,
                (state->'aiMonthLog'->${month}->>'total')::int AS month_count
    `;
    const count = counts[0]?.count ?? 1;
    const monthCount = counts[0]?.month_count ?? 1;
    if (count === 1) {
      // first call of a new day: keep only today; first call of a new month: keep only this month
      await prisma.$executeRaw`
        UPDATE "User"
        SET state = jsonb_set(
          jsonb_set(state, '{aiCallLog}', jsonb_build_object(${day}::text, state->'aiCallLog'->${day})),
          '{aiMonthLog}', jsonb_build_object(${month}::text, state->'aiMonthLog'->${month})
        )
        WHERE id = ${userId}
      `;
    }
    if (enforceCaps) {
      if (count > limits.dailyCap) return { allowed: false, count, monthCount, reason: "daily", limits };
      if (limits.monthlyCap != null && monthCount > limits.monthlyCap) return { allowed: false, count, monthCount, reason: "monthly", limits };
    }
    return { allowed: true, count, monthCount, limits };
  } catch (err) {
    console.error("chargeAiBudget error (failing open):", err);
    return { allowed: true, count: 0, monthCount: 0, limits };
  }
}
