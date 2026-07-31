import prisma from "./db";

// ============================================================================
// Race-safe state writers (Phase 64)
// ----------------------------------------------------------------------------
// All Forge user data lives in one `User.state` jsonb column. The naive pattern
// — findUnique -> mutate the whole JS object -> update({data:{state}}) — reads a
// snapshot and writes the WHOLE object back, silently clobbering any concurrent
// write to a *different* key (e.g. the hourly Oura/Withings sync overwriting a
// meal the user just logged). These helpers each write only the key(s) they own,
// atomically, reading the LIVE column at execution time — mirroring the
// field-scoped jsonb_set pattern already used throughout server/state.ts.
// ============================================================================

// Shallow-merge a PARTIAL map into a top-level date-keyed map (sleepLog, stepsLog,
// recovery, bodyComp, calorieLog, vo2maxLog, …). Postgres `jsonb ||` is a shallow
// top-level merge against the LIVE column, so sibling dates/keys are preserved and
// only the days present in `partial` are replaced. Each value in `partial` MUST be
// a COMPLETE entry (the whole day object / value), never a partial of a day.
export async function mergeStateMap(
  userId: string,
  key: string,
  partial: Record<string, any>,
): Promise<void> {
  if (!partial || typeof partial !== "object" || Array.isArray(partial)) return;
  if (Object.keys(partial).length === 0) return; // nothing to write
  const json = JSON.stringify(partial);
  await prisma.$executeRaw`
    UPDATE "User"
    SET state = jsonb_set(
      COALESCE(state, '{}')::jsonb,
      ARRAY[${key}],
      COALESCE(state->${key}, '{}'::jsonb) || ${json}::jsonb,
      true
    ),
    "updatedAt" = NOW()
    WHERE id = ${userId}
  `;
}

// Overwrite a single TOP-LEVEL key with a whole value (scalar, object, or array).
// Only single-level keys — writing whole objects at the top avoids jsonb_set's
// "intermediate parent must exist" limitation. For nested state (e.g. withings),
// write the whole parent object here rather than a deep path.
export async function setStateKey(
  userId: string,
  key: string,
  value: any,
): Promise<void> {
  const json = JSON.stringify(value === undefined ? null : value);
  await prisma.$executeRaw`
    UPDATE "User"
    SET state = jsonb_set(COALESCE(state, '{}')::jsonb, ARRAY[${key}], ${json}::jsonb, true),
        "updatedAt" = NOW()
    WHERE id = ${userId}
  `;
}

// Compare-and-swap on updatedAt for the genuinely multi-key / same-array paths
// (coaching apply/dismiss touches a runtime-variable set of keys; notifications
// are one array with several writers). Reads state + updatedAt, runs `mutate` in
// JS, then writes the whole object ONLY IF updatedAt is unchanged since the read;
// on a lost race it re-reads and retries. `mutate` returns the new state to write,
// or null/undefined to signal "no write needed" (skips the write, returns false).
// Returns true if a write landed, false if skipped or all retries were lost.
// updatedAt is TIMESTAMP(3) (ms precision) so the JS Date round-trips exactly.
export async function casUpdateState(
  userId: string,
  mutate: (state: any) => any,
  opts: { retries?: number } = {},
): Promise<boolean> {
  const retries = opts.retries ?? 3;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { state: true, updatedAt: true },
    });
    if (!row) return false;
    const state: any = row.state || {};
    const next = mutate(state);
    if (next === null || next === undefined) return false; // caller: nothing to do
    const json = JSON.stringify(next);
    const affected: number = await prisma.$executeRaw`
      UPDATE "User"
      SET state = ${json}::jsonb, "updatedAt" = NOW()
      WHERE id = ${userId} AND "updatedAt" = ${row.updatedAt}
    `;
    if (affected > 0) return true;
    // Lost the race (someone wrote between our read and update) — retry with a fresh read.
  }
  return false;
}
