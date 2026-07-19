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
  // Cardio (Zone 2, upper-lower-5d-fixed)
  cardio_z2: 'Zone 2 Walk',
  // Shoulder rehab / physio (owner-configurable, category:'rehab')
  reh_1: 'Rehab 1',
  reh_2: 'Rehab 2',
  reh_3: 'Rehab 3',
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

// Per-exercise working rep range [lower, upper] for weighted lifts with a numeric
// range (mirrors public/data.js WORKOUTS; timed holds + "each side" moves omitted).
// Single source so server-side stall detection can judge "hit top of range".
var EXERCISE_REPS = {
  u1: [6, 8], u2: [8, 10], u3: [6, 8], u4: [6, 8], u5: [8, 10], u6: [10, 12], u7: [10, 12], u8: [12, 15],
  neck_ext: [12, 15], neck_front: [12, 15],
  l1: [6, 8], l2: [6, 8], l3: [10, 12], l4: [10, 12], l5: [8, 10], l6: [15, 20],
  h1: [10, 12], h2: [8, 15], h3: [8, 10], h4: [10, 12], h5: [12, 15],
};

// Human-readable programme id -> { name, pattern }. Single source for the split
// description (so the AI coach no longer hardcodes "Upper/Rest/Lower/Rest 4-day").
// Names match public/data.js PROGRAMS (enforced by the parity test).
var PROGRAMME_LABELS = {
  'upper-lower-4d': { name: 'Upper / Lower 4-Day', pattern: 'Upper / Rest / Lower / Rest (repeating 4-day cycle)' },
  'upper-lower-5d-fixed': { name: 'Upper / Lower 5-Day (fixed)', pattern: 'Mon Upper A · Tue Lower A · Wed rest · Thu Upper B · Fri Lower B · Sat Zone 2 walk · Sun rest (fixed weekdays)' },
  'full-body-3d': { name: 'Full Body 3-Day', pattern: 'Mon / Wed / Fri full-body' },
  'home-3d': { name: 'Home Full Body 3-Day', pattern: 'Mon / Wed / Fri full-body (dumbbells + bodyweight)' },
};
function programmeLabel(programId) {
  return PROGRAMME_LABELS[programId] || PROGRAMME_LABELS['upper-lower-4d'];
}

// Exercise ids per WORKOUTS session type (mirrors public/data.js WORKOUTS — the
// programme-shared parity test fails CI on drift). Lets the SERVER compute the
// weekly-report training completion the same way the client does (the client can
// also derive it from WORKOUTS, but this is the single cross-runtime source).
// rehab ids (reh_*) are included; callers drop them for showRehab===false users.
var SESSION_EXERCISE_IDS = {
  upper: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'core_pallof', 'neck_ext', 'neck_front', 'u9', 'core_dead_bug'],
  lower: ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'core_pallof', 'core_dead_bug', 'core_suitcase'],
  full: ['l1', 'u1', 'u3', 'u4', 'l4', 'u5', 'u6', 'u7', 'u9'],
  home: ['h1', 'h2', 'h3', 'h4', 'u4', 'h5', 'u6', 'u9', 'core_dead_bug'],
  upperA: ['u4', 'u1', 'u3', 'u5', 'h5', 'reh_1', 'reh_2', 'reh_3'],
  lowerA: ['h1', 'l1', 'l2', 'l6', 'core_pallof'],
  upperB: ['u2', 'h3', 'u4', 'u8', 'u6', 'core_dead_bug', 'reh_1', 'reh_2', 'reh_3'],
  lowerB: ['l5', 'l1', 'l4', 'core_suitcase'],
  zone2: ['cardio_z2'],
};

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

// Fixed 5-day split (upper-lower-5d-fixed): Mon UPPER_A, Tue LOWER_A, Wed rest,
// Thu UPPER_B, Fri LOWER_B, Sat ZONE2, Sun rest. `startDate` is the programme's
// own programmeStartDate — dates before it are NOT scheduled (so switching mid-
// week doesn't retro-schedule old days or offer spurious make-ups). Weekday-based
// (like full-body-3d), not a rolling cycle.
function _fixed5daySession(dateStr, startDate) {
  if (startDate && dateStr < startDate) return null;
  var dow = new Date(dateStr + 'T12:00:00').getDay();
  switch (dow) {
    case 1: return 'upperA';
    case 2: return 'lowerA';
    case 4: return 'upperB';
    case 5: return 'lowerB';
    case 6: return 'zone2';
    default: return null; // Wed (3), Sun (0)
  }
}

// programId + date (+ training anchor) -> WORKOUTS session key, or null (rest).
// Mirrors PROGRAMS[*].getSessionType in data.js exactly. Unknown ids fall back
// to the default upper-lower-4d, matching getProgram()'s fallback.
function sessionTypeForDate(programId, dateStr, startDate) {
  switch (programId) {
    case 'upper-lower-5d-fixed':
      return _fixed5daySession(dateStr, startDate);
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

// Scheduled deload: every 5th week of the programme cycle, anchored to the
// user's own programmeStartDate. weekInCycle = floor(daysSince(start)/7) % 5;
// week index 4 (the 5th week) is the deload. Returns { weekInCycle, isDeload },
// or null when there is no start date or the date precedes it. Pure — the anchor
// is passed in, never read from a global, so client + server + tests agree.
function deloadWeekInfo(programmeStartDate, dateStr) {
  if (!programmeStartDate || !dateStr || dateStr < programmeStartDate) return null;
  var start = new Date(programmeStartDate + 'T12:00:00');
  var target = new Date(dateStr + 'T12:00:00');
  var days = Math.floor((target - start) / 86400000);
  if (days < 0) return null;
  var weekInCycle = ((Math.floor(days / 7) % 5) + 5) % 5;
  return { weekInCycle: weekInCycle, isDeload: weekInCycle === 4 };
}

var FORGE_PROGRAMME = {
  EXERCISE_NAMES: EXERCISE_NAMES,
  deloadWeekInfo: deloadWeekInfo,
  LEGACY_EXERCISE_NAMES: LEGACY_EXERCISE_NAMES,
  EXERCISE_REPS: EXERCISE_REPS,
  exerciseName: exerciseName,
  PROGRAMME_LABELS: PROGRAMME_LABELS,
  programmeLabel: programmeLabel,
  trainingDayInCycle: trainingDayInCycle,
  sessionTypeForDate: sessionTypeForDate,
  SESSION_EXERCISE_IDS: SESSION_EXERCISE_IDS,
  DEFAULT_TRAINING_START: DEFAULT_TRAINING_START,
};

// Browser global (used by data.js / pages.js).
if (typeof window !== 'undefined') window.FORGE_PROGRAMME = FORGE_PROGRAMME;
// Node / tests / server loader.
if (typeof module !== 'undefined' && module.exports) module.exports = FORGE_PROGRAMME;
