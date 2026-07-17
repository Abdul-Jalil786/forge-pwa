// Proactive coach — server orchestration (Phase 57).
// Phase 1: nightly deterministic correlation compute (no LLM). The pure maths
// live in public/proactive-core.js (shared with the zero-dep tests); this module
// loads it, feeds in the user's exercise rep-ranges + GLP-1 context, and caches
// the result on state.correlations for the weekly report + the daily scanner.
import path from "path";
import prisma from "./db";

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
