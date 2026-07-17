// Phase 57: monthly deep-dive tests (zero-dep).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../public/proactive-core.js");

function firstSunday(y, m) {
  for (let day = 1; day <= 7; day++) {
    const dt = new Date(`${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00`);
    if (dt.getDay() === 0) return dt.toISOString().slice(0, 10);
  }
}
function addDays(d, k) { const dt = new Date(d + "T12:00:00"); dt.setDate(dt.getDate() + k); return dt.toISOString().slice(0, 10); }

test("isFirstSundayOfMonth: true only for the first Sunday", () => {
  for (const [y, m] of [[2026, 3], [2026, 6], [2026, 11], [2027, 1]]) {
    const fsun = firstSunday(y, m);
    assert.equal(core.isFirstSundayOfMonth(fsun), true, `${fsun} should be first Sunday`);
    assert.equal(core.isFirstSundayOfMonth(addDays(fsun, 7)), false, "second Sunday is not first");
    assert.equal(core.isFirstSundayOfMonth(addDays(fsun, 1)), false, "Monday is not a Sunday");
  }
});

// Wiring guards (server TS isn't built in unit tests) —
const aicoach = fs.readFileSync(path.join(__dirname, "..", "server", "ai-coach.ts"), "utf8");
const cron = fs.readFileSync(path.join(__dirname, "..", "server", "cron.ts"), "utf8");
const pages = fs.readFileSync(path.join(__dirname, "..", "public", "pages.js"), "utf8");

test("generateMonthlyDeepDive exists and uses the Opus MODEL", () => {
  assert.ok(aicoach.includes("export async function generateMonthlyDeepDive"), "generator missing");
  const start = aicoach.indexOf("generateMonthlyDeepDive");
  const slice = aicoach.slice(start, start + 1500);
  assert.ok(/model:\s*MODEL/.test(slice), "monthly deep dive should use the Opus MODEL, not Haiku");
});

test("saveReport accepts a report type (weekly/monthly)", () => {
  assert.ok(aicoach.includes('type: string = "weekly"'), "saveReport must accept a type param");
  assert.ok(aicoach.includes('lastMonthlyDeepDiveAt'), "monthly must stamp its own timestamp, not the weekly clock");
});

test("cron schedules the monthly deep dive on the first Sunday, deduped", () => {
  assert.ok(cron.includes('"30 10 * * 0"'), "monthly cron schedule missing");
  assert.ok(cron.includes("isFirstSundayOfMonth"), "first-Sunday guard missing");
  assert.ok(cron.includes("lastMonthlyDeepDiveAt"), "monthly dedupe guard missing");
  assert.ok(cron.includes('saveReport(user.id, report, "monthly")'), "must save with monthly type");
});

test("coach feed renders the monthly report distinctly", () => {
  assert.ok(pages.includes("Monthly Deep Dive"), "distinct monthly card label missing");
});
