// Phase 64 verification (manual — needs a Postgres + a build):
//   npm run build && DATABASE_URL=postgresql://user@host/db_TEST node tests/_verify-state-merge.cjs
// Proves the race-safe state writers (server/state-merge.ts) preserve sibling
// keys/dates and survive concurrent writes — the whole point of the RMW fix.
// Skips (exit 0) when DATABASE_URL is unset so it never breaks a plain checkout.
// NOTE: point DATABASE_URL at a THROWAWAY database — it writes + deletes a user.
const assert = require("node:assert/strict");

if (!process.env.DATABASE_URL) {
  console.log("SKIPPED — set DATABASE_URL (a throwaway DB) + `npm run build` to run this.");
  process.exit(0);
}

const prisma = require("../dist/server/db.js").default;
const { mergeStateMap, setStateKey, casUpdateState } = require("../dist/server/state-merge.js");

let failures = 0;
async function t(name, fn) {
  try { await fn(); console.log("ok   -", name); }
  catch (e) { failures++; console.log("NOT ok -", name, "\n    ", e.message); }
}
const getState = async (id) => (await prisma.user.findUnique({ where: { id } })).state;

(async () => {
  await prisma.user.deleteMany({ where: { email: "statemerge-verify@forge.local" } });
  const u = await prisma.user.create({
    data: {
      email: "statemerge-verify@forge.local", passwordHash: "x",
      state: {
        sleepLog: { "2026-01-01": { hours: 8, source: "manual" } },
        foods: { "2026-01-01": ["egg"] },
        notifications: [{ id: "n1", read: false }],
      },
    },
  });
  const id = u.id;

  await t("mergeStateMap adds a date WITHOUT clobbering sibling dates or sibling keys", async () => {
    await mergeStateMap(id, "sleepLog", { "2026-01-02": { hours: 7, source: "oura" } });
    const s = await getState(id);
    assert.equal(s.sleepLog["2026-01-01"].source, "manual", "manual sibling date preserved");
    assert.equal(s.sleepLog["2026-01-02"].hours, 7, "new date merged in");
    assert.deepEqual(s.foods["2026-01-01"], ["egg"], "sibling KEY (foods) untouched");
  });

  await t("mergeStateMap overwrites only the given date", async () => {
    await mergeStateMap(id, "sleepLog", { "2026-01-02": { hours: 9, source: "oura" } });
    const s = await getState(id);
    assert.equal(s.sleepLog["2026-01-02"].hours, 9);
    assert.equal(s.sleepLog["2026-01-01"].source, "manual");
  });

  await t("mergeStateMap no-ops on empty partial", async () => {
    await mergeStateMap(id, "sleepLog", {});
    assert.equal(Object.keys((await getState(id)).sleepLog).length, 2);
  });

  await t("setStateKey overwrites one key, leaves others", async () => {
    await setStateKey(id, "mealPlan", { meals: [{ id: "m1" }] });
    const s = await getState(id);
    assert.equal(s.mealPlan.meals[0].id, "m1");
    assert.deepEqual(s.foods["2026-01-01"], ["egg"]);
  });

  await t("casUpdateState applies a mutation", async () => {
    assert.equal(await casUpdateState(id, (s) => { s.testFlag = 42; return s; }), true);
    assert.equal((await getState(id)).testFlag, 42);
  });

  await t("casUpdateState skips write when mutate returns null", async () => {
    const before = (await getState(id)).testFlag;
    assert.equal(await casUpdateState(id, () => null), false);
    assert.equal((await getState(id)).testFlag, before);
  });

  await t("concurrent CAS writes to different keys BOTH survive (race fixed)", async () => {
    await casUpdateState(id, (s) => { delete s.raceA; delete s.raceB; delete s.raceC; return s; });
    await Promise.all([
      casUpdateState(id, (s) => { s.raceA = "A"; return s; }),
      casUpdateState(id, (s) => { s.raceB = "B"; return s; }),
      casUpdateState(id, (s) => { s.raceC = "C"; return s; }),
    ]);
    const s = await getState(id);
    assert.equal(s.raceA, "A"); assert.equal(s.raceB, "B"); assert.equal(s.raceC, "C");
  });

  await t("sync (mergeStateMap) + concurrent notification-read (CAS) both survive", async () => {
    await Promise.all([
      mergeStateMap(id, "stepsLog", { "2026-01-03": 12000 }),
      casUpdateState(id, (s) => {
        const n = (s.notifications || []).find((x) => x.id === "n1");
        if (!n || n.read) return null;
        n.read = true; return s;
      }),
    ]);
    const s = await getState(id);
    assert.equal(s.stepsLog["2026-01-03"], 12000, "sync write survived");
    assert.equal(s.notifications.find((n) => n.id === "n1").read, true, "notification read survived");
  });

  await prisma.user.deleteMany({ where: { email: "statemerge-verify@forge.local" } });
  await prisma.$disconnect();
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
