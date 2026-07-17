// Shared per-user daily AI-call budget. Extracted so BOTH the Express aiBudget
// middleware (coach-settings) and the cron proactive scanner charge the same
// counter — so proactive spend is governed, not free.
import prisma from "./db";

export const AI_DAILY_LIMIT = 40;

export function ukToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

// Atomic increment-then-check of state.aiCallLog[UK-date]. Returns whether this
// call is within budget + the running count. Prunes old day-keys on the first
// call of a new day. Never throws to callers — on error it fails OPEN (allowed).
export async function chargeAiBudget(userId: string): Promise<{ allowed: boolean; count: number }> {
  try {
    const day = ukToday();
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      UPDATE "User"
      SET state = jsonb_set(
        jsonb_set(COALESCE(state, '{}')::jsonb, '{aiCallLog}', COALESCE(state->'aiCallLog', '{}'), true),
        ARRAY['aiCallLog', ${day}],
        to_jsonb(COALESCE((state->'aiCallLog'->>${day})::int, 0) + 1),
        true
      )
      WHERE id = ${userId}
      RETURNING (state->'aiCallLog'->>${day})::int AS count
    `;
    const count = rows[0]?.count ?? 1;
    if (count === 1) {
      await prisma.$executeRaw`
        UPDATE "User"
        SET state = jsonb_set(state, '{aiCallLog}', jsonb_build_object(${day}::text, state->'aiCallLog'->${day}))
        WHERE id = ${userId}
      `;
    }
    return { allowed: count <= AI_DAILY_LIMIT, count };
  } catch (err) {
    console.error("chargeAiBudget error (failing open):", err);
    return { allowed: true, count: 0 };
  }
}
