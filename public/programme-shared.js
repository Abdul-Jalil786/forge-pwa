// ============================================================
// SHARED PROGRAMME MODULE — single source of truth
// ============================================================
// The ONE place that defines:
//   (a) exercise id -> display name
//   (b) the schedule (which session type a given date maps to)
//
// Consumed by BOTH sides, same UMD pattern as targets.js:
//   - Browser: loaded as a <script> before data.js -> global FORGE_PROGRAMME.
//   - Server:  require()'d via server/programme-shared.ts (reads this file from
//              process.cwd()/public, where public/ is already served statically).
//   - Tests:   require()'d directly (node --test).
//
// Keep this file DEPENDENCY-FREE and SIDE-EFFECT-FREE (no globals read at load,
// no STATE, no window access beyond the export shim at the bottom). The schedule
// functions take the training-start anchor as a parameter instead of reading it
// from global STATE, so the same code runs on the client and the server.
//
// NOTE: EXERCISE_NAMES must stay in lock-step with public/data.js WORKOUTS.
// tests/programme-shared.test.cjs parses WORKOUTS and fails CI on any drift.

// Canonical exercise id -> name. Mirrors every exercise across all WORKOUTS
// templates (upper / lower / full / home), deduped by id.
var EXERCISE_NAMES = {
  // Upper
  u1: 'Chest Press',
  u2: 'Incline Dumbbell Press',
  u3: 'Seated Row',
  u4: 'Shoulder Press',
  u5: 'Lat Pulldown',
  u6: 'Bicep Curl',
  u7: 'Tricep Pushdown',
  u8: 'Face Pull',
  u9: 'Plank',
  core_pallof: 'Pallof Press',
  neck_ext: 'Cable Neck Extension (back)',
  neck_front: 'Cable Neck Flexion (front)',
  core_dead_bug: 'Dead Bug',
  // Lower
  l1: 'Leg Press',
  l2: 'Romanian Deadlift',
  l3: 'Leg Extension',
  l4: 'Leg Curl',
  l5: 'Hip Thrust',
  l6: 'Calf Raise',
  core_suitcase: 'Suitcase Carry',
  // Home
  h1: 'Goblet Squat',
  h2: 'Push-Up',
  h3: 'One-Arm Dumbbell Row',
  h4: 'Dumbbell Romanian Deadlift',
  h5: 'Lateral Raise',
};

// Retired exercise ids that are no longer in ANY current programme, kept ONLY so
// historical logged data (exLog) still resolves to a readable name instead of a
// raw id. Do not add current exercises here.
var LEGACY_EXERCISE_NAMES = {
  l7: 'Back Extension',
  l8: 'Ab Crunch',
  l7_cable_pull: 'Cable Pull Through',
  l8_rev_hyper: 'Reverse Hyperextension',
};

// Returns the display name for an id (current, then legacy), or null if unknown.
function exerciseName(id) {
  return EXERCISE_NAMES[id] || LEGACY_EXERCISE_NAMES[id] || null;
}

// ---- Schedule (session-type) logic ----------------------------------------
// Pure: the training-start anchor is passed in, never read from a global.

// Human-readable programme id -> { name, pattern }. Single source for the split
// description (so the AI coach no longer hardcodes "Upper/Rest/Lower/Rest 4-day").
// Names match public/data.js PROGRAMS (enforced by the parity test).
var PROGRAMME_LABELS = {
  'upper-lower-4d': { name: 'Upper / Lower 4-Day', pattern: 'Upper / Rest / Lower / Rest (repeating 4-day cycle)' },
  'full-body-3d': { name: 'Full Body 3-Day', pattern: 'Mon / Wed / Fri full-body' },
  'home-3d': { name: 'Home Full Body 3-Day', pattern: 'Mon / Wed / Fri full-body (dumbbells + bodyweight)' },
};
function programmeLabel(programId) {
  return PROGRAMME_LABELS[programId] || PROGRAMME_LABELS['upper-lower-4d'];
}

var DEFAULT_TRAINING_START = '2026-05-08';

// 4-day pattern: Day 0 = Upper, Day 1 = Rest, Day 2 = Lower, Day 3 = Rest.
// Returns 0..3, or -1 for dates before the anchor.
function trainingDayInCycle(dateStr, startDate) {
  var start = new Date((startDate || DEFAULT_TRAINING_START) + 'T12:00:00');
  var target = new Date(dateStr + 'T12:00:00');
  var diffDays = Math.floor((target - start) / 86400000);
  if (diffDays < 0) return -1;
  return ((diffDays % 4) + 4) % 4;
}

// Mon/Wed/Fri weekday programmes (full-body-3d, home-3d).
function _weekdaySession(dateStr, sessionType) {
  var dow = new Date(dateStr + 'T12:00:00').getDay();
  return (dow === 1 || dow === 3 || dow === 5) ? sessionType : null;
}

// programId + date (+ training anchor) -> WORKOUTS session key, or null (rest).
// Mirrors PROGRAMS[*].getSessionType in data.js exactly. Unknown ids fall back
// to the default upper-lower-4d, matching getProgram()'s fallback.
function sessionTypeForDate(programId, dateStr, startDate) {
  switch (programId) {
    case 'full-body-3d':
      return _weekdaySession(dateStr, 'full');
    case 'home-3d':
      return _weekdaySession(dateStr, 'home');
    case 'upper-lower-4d':
    default: {
      var c = trainingDayInCycle(dateStr, startDate);
      if (c === 0) return 'upper';
      if (c === 2) return 'lower';
      return null;
    }
  }
}

var FORGE_PROGRAMME = {
  EXERCISE_NAMES: EXERCISE_NAMES,
  LEGACY_EXERCISE_NAMES: LEGACY_EXERCISE_NAMES,
  exerciseName: exerciseName,
  PROGRAMME_LABELS: PROGRAMME_LABELS,
  programmeLabel: programmeLabel,
  trainingDayInCycle: trainingDayInCycle,
  sessionTypeForDate: sessionTypeForDate,
  DEFAULT_TRAINING_START: DEFAULT_TRAINING_START,
};

// Browser global (used by data.js / pages.js).
if (typeof window !== 'undefined') window.FORGE_PROGRAMME = FORGE_PROGRAMME;
// Node / tests / server loader.
if (typeof module !== 'undefined' && module.exports) module.exports = FORGE_PROGRAMME;
