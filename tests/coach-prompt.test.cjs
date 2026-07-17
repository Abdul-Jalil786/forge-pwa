// Phase 57: guards the AI-coach prompt de-hardcode. Fails CI if any user-specific
// fact creeps back into the system-prompt text, or if a dynamic reference is lost.
// Text-based (the prompts live in .ts files that can't be required directly).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const coach = fs.readFileSync(path.join(__dirname, "..", "server", "ai-coach.ts"), "utf8");
const ask = fs.readFileSync(path.join(__dirname, "..", "server", "ask.ts"), "utf8");
const both = coach + "\n" + ask;

// Stale, user-specific strings that MUST NOT appear anywhere in the coach code.
const STALE = [
  "HbA1c 72", "ALT 93", "CRP 4.92", "9.55", "Vitamin D 47", // literal lab values
  "08/05/2026",                                             // literal panel date
  "User has LVH context", "User smokes —",                  // conditions as fixed facts
  "the user has a chef",                                    // lifestyle assumption
  "at 52, each meal", "target 3L (3.5L", "minus 500 deficit", // fixed numbers
  "4-day) is FIXED",                                        // hardcoded split description
  "MOUNJARO (Wednesday injection)", "Wednesday = Mounjaro injection day", // hardcoded weekday
  "The user is on a fat-loss cut",                          // hardcoded phase (ask.ts)
  "getDay() === 3",                                         // hardcoded injection weekday
];
for (const s of STALE) {
  test(`no hardcoded fact: ${JSON.stringify(s)}`, () => {
    assert.ok(!both.includes(s), `stale hardcoded string still present: ${s}`);
  });
}

// Dynamic references that MUST be present (the data now flows from state/context).
const DYNAMIC = [
  "BLOOD MARKERS block", "COACH TARGETS", "HEALTH CONDITIONS", "EXISTING REMINDERS",
  "glp1InjectionDow", "programmeLabel", "ageFromDob", "dateOfBirth",
];
for (const s of DYNAMIC) {
  test(`dynamic reference present: ${s}`, () => {
    assert.ok(both.includes(s), `expected dynamic reference missing: ${s}`);
  });
}

// The persona / structural rules the user asked to KEEP must still be there.
const KEEP = [
  "PIN THE NUMBERS", "COACHING PRINCIPLES", "Priority actions", "Lean mass:",
];
for (const s of KEEP) {
  test(`kept persona/structure: ${s}`, () => {
    assert.ok(coach.includes(s), `expected retained prompt element missing: ${s}`);
  });
}
