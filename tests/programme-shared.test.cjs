// Phase 57: programme-shared single-source tests — run with `npm test` (node --test, no deps).
// Guards the refactor that made public/programme-shared.js the ONE source for
// exercise id->name and the schedule logic. Fails CI on any drift vs WORKOUTS or
// any behaviour change vs the pre-refactor schedule formula.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const shared = require("../public/programme-shared.js");

// --- Parse WORKOUTS out of data.js as text (data.js has browser side effects at
// load, so it cannot be require()'d). We slice just the WORKOUTS object literal. ---
function workoutsNamesFromDataJs() {
  const src = fs.readFileSync(path.join(__dirname, "..", "public", "data.js"), "utf8");
  const startIdx = src.indexOf("const WORKOUTS = {");
  assert.ok(startIdx >= 0, "WORKOUTS declaration not found in data.js");
  // WORKOUTS is the first top-level object; it closes at the first `\n};` after it.
  const endIdx = src.indexOf("\n};", startIdx);
  assert.ok(endIdx > startIdx, "end of WORKOUTS block not found");
  const block = src.slice(startIdx, endIdx);
  const names = {};
  const re = /id:\s*'([^']+)'\s*,\s*name:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(block)) !== null) names[m[1]] = m[2];
  return names;
}

test("EXERCISE_NAMES matches every id/name in WORKOUTS exactly", () => {
  const workouts = workoutsNamesFromDataJs();
  assert.ok(Object.keys(workouts).length >= 25, "expected >=25 exercise entries parsed");
  for (const [id, name] of Object.entries(workouts)) {
    assert.equal(
      shared.EXERCISE_NAMES[id],
      name,
      `name drift for ${id}: shared="${shared.EXERCISE_NAMES[id]}" vs WORKOUTS="${name}"`
    );
  }
});

test("EXERCISE_NAMES has no phantom ids (every id exists in WORKOUTS)", () => {
  const workouts = workoutsNamesFromDataJs();
  for (const id of Object.keys(shared.EXERCISE_NAMES)) {
    assert.ok(id in workouts, `phantom id in EXERCISE_NAMES not present in WORKOUTS: ${id}`);
  }
});

test("exerciseName resolves current, legacy, and unknown ids", () => {
  assert.equal(shared.exerciseName("u1"), "Chest Press");
  assert.equal(shared.exerciseName("h5"), "Lateral Raise");
  // legacy (retired) ids still resolve so historical exLog stays readable
  assert.equal(shared.exerciseName("l8"), "Ab Crunch");
  assert.equal(shared.exerciseName("l8_rev_hyper"), "Reverse Hyperextension");
  assert.equal(shared.exerciseName("l7_cable_pull"), "Cable Pull Through");
  // truly unknown -> null (callers fall back to the raw id)
  assert.equal(shared.exerciseName("nope_xyz"), null);
});

// --- Schedule behaviour parity: reference reimplementation of the PRE-refactor
// data.js logic. sessionTypeForDate must match it for every programme. ---
const ANCHOR = "2026-05-08";
function legacyUpperLower(dateStr, startDate) {
  const start = new Date((startDate || ANCHOR) + "T12:00:00");
  const target = new Date(dateStr + "T12:00:00");
  const diffDays = Math.floor((target - start) / 86400000);
  if (diffDays < 0) return null;
  const cycle = ((diffDays % 4) + 4) % 4;
  if (cycle === 0) return "upper";
  if (cycle === 2) return "lower";
  return null;
}
function legacyWeekday(dateStr, type) {
  const dow = new Date(dateStr + "T12:00:00").getDay();
  return (dow === 1 || dow === 3 || dow === 5) ? type : null;
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

test("upper-lower-4d schedule matches legacy formula across a 90-day span", () => {
  for (let i = -10; i < 90; i++) {
    const date = addDays(ANCHOR, i);
    assert.equal(
      shared.sessionTypeForDate("upper-lower-4d", date, ANCHOR),
      legacyUpperLower(date, ANCHOR),
      `mismatch at ${date}`
    );
  }
});

test("known anchor days: 05-08 upper, 05-09 rest, 05-10 lower, 05-11 rest", () => {
  assert.equal(shared.sessionTypeForDate("upper-lower-4d", "2026-05-08", ANCHOR), "upper");
  assert.equal(shared.sessionTypeForDate("upper-lower-4d", "2026-05-09", ANCHOR), null);
  assert.equal(shared.sessionTypeForDate("upper-lower-4d", "2026-05-10", ANCHOR), "lower");
  assert.equal(shared.sessionTypeForDate("upper-lower-4d", "2026-05-11", ANCHOR), null);
});

test("full-body-3d and home-3d match Mon/Wed/Fri weekday map across 30 days", () => {
  for (let i = 0; i < 30; i++) {
    const date = addDays(ANCHOR, i);
    assert.equal(shared.sessionTypeForDate("full-body-3d", date, ANCHOR), legacyWeekday(date, "full"), `full @ ${date}`);
    assert.equal(shared.sessionTypeForDate("home-3d", date, ANCHOR), legacyWeekday(date, "home"), `home @ ${date}`);
  }
});

test("unknown programId falls back to upper-lower-4d (matches getProgram fallback)", () => {
  const date = "2026-05-10";
  assert.equal(
    shared.sessionTypeForDate("something-else", date, ANCHOR),
    shared.sessionTypeForDate("upper-lower-4d", date, ANCHOR)
  );
});

test("dates before the training anchor are rest (null) for upper-lower", () => {
  assert.equal(shared.sessionTypeForDate("upper-lower-4d", "2026-05-01", ANCHOR), null);
  assert.equal(shared.trainingDayInCycle("2026-05-01", ANCHOR), -1);
});
