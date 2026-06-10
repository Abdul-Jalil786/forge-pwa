// Phase 45 verification (run manually, not part of npm test):
// proves the DEXA + tape blocks render in buildContext and buildFullHistory
// aggregates correctly. Requires `npx tsc` first (uses dist/).
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "a".repeat(64);
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://x:x@localhost:5432/x";
process.env.JWT_SECRET = process.env.JWT_SECRET || "x".repeat(40);

const { buildContext } = require("../dist/server/ai-coach.js");
const { buildFullHistory } = require("../dist/server/ask.js");

const state = {
  profile: {
    startDate: "2026-05-11", startWeight: 113.5, targetWeight: 90,
    personal: { age: 52, heightCm: 180, sex: "male", phase: "cut" },
    proteinTarget: 200,
  },
  weightLog: [
    { date: "2026-05-11", weight: 113.5, source: "manual" },
    { date: "2026-06-01", weight: 110.5, source: "withings" },
    { date: "2026-06-09", weight: 110.1, source: "withings" },
  ],
  bfLog: [
    { date: "2026-05-11", bf: 32.1, source: "manual" },
    { date: "2026-06-01", bf: 31.6, source: "withings" },
  ],
  dexaScans: [{
    id: "d1", date: "2026-06-02", provider: "BodyView Edgbaston",
    weight: 113.8, bodyFatPct: 29.9, fatMass: 34.0, leanMass: 76.8,
    vatCm2: 197, tScore: 0.4, almi: 10.8,
  }],
  measLog: [
    { date: "2026-05-12", waist: 118, chest: 122, neck: 43 },
    { date: "2026-06-08", waist: 114.5, chest: 121, neck: 42.5, larm: 38, rarm: 38.5 },
  ],
  exLog: {
    "2026-05-12": { u1: { sets: [{ kg: 80, reps: 8, effort: "solid" }] } },
    "2026-05-20": { u1: { sets: [{ kg: 85, reps: 8 }] } },
    "2026-06-05": { u1: { sets: [{ kg: 90, reps: 8 }] }, _session: { score: { pct: 104, volume: 5000 } } },
  },
  recoveryOverrides: { "2026-06-05": { readiness: 55, choice: "train", feel: "strong" } },
  foods: { "2026-06-08": [{ protein: 210, cals: 2400 }] },
};

const ctx = buildContext(state);
const hist = buildFullHistory(state);

const checks = [
  ["DEXA block header", ctx.includes("DEXA SCANS (gold standard")],
  ["DEXA scan line", ctx.includes("2026-06-02 (BodyView Edgbaston)") && ctx.includes("BF 29.9%") && ctx.includes("VAT) 197cm")],
  ["Withings offset vs DEXA", ctx.includes("BIA offset near this scan") && ctx.includes("Withings BF 31.6% (2026-06-01) = +1.7pp vs DEXA")],
  ["Tape block header", ctx.includes("TAPE MEASUREMENTS (immune to hydration noise")],
  ["Tape deltas since first", ctx.includes("Since first entry (2026-05-12): waist -3.5cm")],
  ["Waist-to-height ratio", ctx.includes("Waist-to-height ratio: 0.64") && ctx.includes("ABOVE the 0.5")],
  ["US Navy estimate", ctx.includes("US Navy BF estimate")],
  ["History weekly buckets", hist.includes("FULL HISTORY AGGREGATES (since plan start 2026-05-11)") && hist.includes("wk1:")],
  ["History lift first vs current", hist.includes("u1: 80kg (2026-05-12) → 90kg (2026-06-05)")],
  ["History calibration stats", hist.includes("Recovery gate firings: 1 (trained through 1, eased 0, avg score when training through 104%)")],
];

let fail = 0;
for (const [name, ok] of checks) {
  console.log((ok ? "✔" : "✘ FAIL"), name);
  if (!ok) fail++;
}
if (fail) {
  console.log("\n--- context ---\n" + ctx.slice(0, 6000));
  console.log("\n--- history ---\n" + hist);
  process.exit(1);
}
console.log(`\nAll ${checks.length} checks passed. Context ${ctx.length} chars, history ${hist.length} chars.`);
