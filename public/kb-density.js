// Phase 106: Kettlebell Swing DENSITY (conditioning) progression — PURE + deterministic.
// The self-paced "beat your sets" model the owner co-designed: at a fixed reps-per-set
// and fixed rest, you do as many sets as you can before you stop. The engine reads the
// LAST density session at a given load and prescribes the next target. Per-load (20kg and
// 24kg keep independent ladders), no AI, no I/O. UMD so tests can require() it and the
// browser can load it as a <script> (mirrors kb-emom.js / proactive-core.js).
//
// Progression lever order (VO2 / conditioning bias — density first, not load):
//   1. ADD A SET   — cleared → targetSets + 1, up to SET_CAP.
//   2. CUT REST    — at the set cap → restSec − REST_STEP, down to REST_FLOOR.
//   3. ADD A REP   — at the rest floor → reps + 1, rest resets to DEFAULT_REST (fresh block).
// "cleared" = you hit your target set count, your last set was clean (full reps), AND you
// rated it easy or solid. Tough, a short last set, or a low-readiness day → HOLD (repeat).
//
// This SUPERSEDES the Phase 92 minute-EMOM engine (kb-emom.js) as the live KB experience;
// the EMOM code is kept dormant but unwired. Density sessions log a distinct set shape
// ({density:true, ...}) so the two histories never collide.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KB_DENSITY = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DEFAULT_REPS = 15;   // swings per set
  var DEFAULT_REST = 60;   // seconds between sets
  var DEFAULT_SETS = 3;    // starting target set count
  var SET_CAP = 8;         // stop adding sets here — switch to cutting rest
  var REST_FLOOR = 20;     // don't cut rest below this — switch to adding reps
  var REST_STEP = 5;       // seconds shaved per cleared session at the cap

  function _num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function _int(v, d) { var n = parseInt(v, 10); return isFinite(n) ? n : (d == null ? 0 : d); }

  // One day's kb_swing log → a normalized density session, or null if it holds no
  // density set (e.g. only old Phase-1 normal sets or an EMOM set).
  function normalizeSession(date, kbLog) {
    if (!kbLog || typeof kbLog !== "object") return null;
    var sets = Array.isArray(kbLog.sets) ? kbLog.sets : [];
    var d = sets.find(function (s) { return s && s.density; });
    if (!d) return null;
    var setsCompleted = _int(d.setsCompleted, 0);
    var targetSets = _int(d.targetSets, 0);
    var clean = !!d.cleanLastSet;
    var outcome = d.outcome || (setsCompleted === 0 ? "SKIPPED" : (setsCompleted >= targetSets && clean) ? "FULL" : "PARTIAL");
    return {
      date: date,
      load: _num(d.load),
      reps: _int(d.reps, DEFAULT_REPS),
      restSec: _int(d.restSec, DEFAULT_REST),
      targetSets: targetSets,
      setsCompleted: setsCompleted,
      cleanLastSet: clean,
      effort: d.effort || "solid",
      outcome: outcome,
    };
  }

  // All normalized density sessions across the log, date-ordered.
  function allSessions(exLog) {
    var out = [];
    Object.keys(exLog || {}).sort().forEach(function (day) {
      var s = normalizeSession(day, (exLog[day] || {}).kb_swing);
      if (s) out.push(s);
    });
    return out;
  }

  // Did this session clear its target (earn a step up)?
  function _cleared(s) {
    return s.setsCompleted >= s.targetSets && s.targetSets > 0 &&
      s.cleanLastSet && (s.effort === "easy" || s.effort === "solid");
  }

  // Public: the target for the NEXT session at `load`, with a reason string.
  // opts.readiness (0-100, optional) — a low-readiness day never advances (HOLD);
  // null readiness / no Oura skips the guard.
  function suggest(exLog, load, opts) {
    opts = opts || {};
    var sessions = allSessions(exLog).filter(function (s) { return s.load === load; });
    var last = sessions.length ? sessions[sessions.length - 1] : null;

    if (!last) {
      return {
        load: load, reps: DEFAULT_REPS, restSec: DEFAULT_REST, targetSets: DEFAULT_SETS,
        lever: "start", capReached: false, restFloorReached: false, cleared: false,
        reason: "Start — " + DEFAULT_SETS + " sets × " + DEFAULT_REPS + " swings, " + DEFAULT_REST + "s rest",
      };
    }

    var reps = last.reps, restSec = last.restSec, targetSets = last.targetSets;
    var cleared = _cleared(last);
    var lowReady = opts.readiness != null && opts.readiness < 60;
    var lever, reason;

    if (cleared && !lowReady) {
      if (targetSets < SET_CAP) {
        targetSets += 1; lever = "sets";
        reason = "+1 set → " + targetSets + " × " + reps + " (last " + last.setsCompleted + " felt " + last.effort + ")";
      } else if (restSec > REST_FLOOR) {
        restSec = Math.max(REST_FLOOR, restSec - REST_STEP); lever = "rest";
        reason = "At " + SET_CAP + " sets — cut rest to " + restSec + "s (same " + targetSets + " × " + reps + ")";
      } else {
        reps += 1; restSec = DEFAULT_REST; lever = "reps";
        reason = "Rest floored — reps up to " + reps + ", rest back to " + DEFAULT_REST + "s";
      }
    } else {
      lever = "hold";
      if (lowReady) reason = "Readiness " + opts.readiness + " — hold " + targetSets + " × " + reps;
      else if (last.effort === "tough") reason = "Last felt tough — repeat " + targetSets + " × " + reps + " to own it";
      else if (!last.cleanLastSet) reason = "Last set was short — repeat " + targetSets + " × " + reps;
      else reason = "Last " + last.setsCompleted + "/" + targetSets + " — repeat " + targetSets + " × " + reps;
    }

    return {
      load: load, reps: reps, restSec: restSec, targetSets: targetSets,
      lever: lever, capReached: targetSets >= SET_CAP, restFloorReached: restSec <= REST_FLOOR,
      cleared: cleared, reason: reason,
    };
  }

  // Best density session per load → { "20": "6×15 @45s", ... }. "Best" = most total
  // swings (sets × reps) among FULL sessions, tie-break to the shorter rest.
  function pbsByLoad(exLog) {
    var pb = {};
    allSessions(exLog).forEach(function (s) {
      if (s.outcome !== "FULL" || s.load == null) return;
      var swings = s.setsCompleted * s.reps;
      var key = String(s.load);
      var cur = pb[key];
      var better = !cur || swings > cur.swings || (swings === cur.swings && s.restSec < cur.restSec);
      if (better) pb[key] = { swings: swings, sets: s.setsCompleted, reps: s.reps, restSec: s.restSec };
    });
    var out = {};
    Object.keys(pb).forEach(function (k) { out[k] = pb[k].sets + "×" + pb[k].reps + " @" + pb[k].restSec + "s"; });
    return out;
  }

  return {
    normalizeSession: normalizeSession, allSessions: allSessions, suggest: suggest,
    pbsByLoad: pbsByLoad,
    _c: { DEFAULT_REPS: DEFAULT_REPS, DEFAULT_REST: DEFAULT_REST, DEFAULT_SETS: DEFAULT_SETS, SET_CAP: SET_CAP, REST_FLOOR: REST_FLOOR, REST_STEP: REST_STEP },
  };
});
