// Phase 108a: Kettlebell Swing EMOM progression — PURE + deterministic. Live KB model
// (the Phase 106 density code is kept dormant).
//
// Model (owner-specified): every-minute-on-the-minute, OPEN-ENDED. Do R swings inside each
// 60s minute, rest the remainder, and keep going minute after minute until you STOP — then
// rate it easy / solid / tough. Progression, per load ("beat your minutes"):
//   • Start: aim 5 minutes × 15.
//   • Rated easy or solid → next time BEAT it: target = minutes you did + 1.
//   • Rated tough (or a low-readiness day) → HOLD: repeat the minutes you managed.
//   • Reach 10+ minutes rated easy/solid → reps +5 (15 → 20 …) and the target RESETS to 5,
//     then you climb the minutes again.
// Weight is HELD (minutes then reps are the driver); the load param only scopes history, so
// 20kg and 24kg keep independent ladders. No AI, no I/O. UMD (require or <script>).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KB_EMOM = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var START_MIN = 5, CAP_MIN = 10, START_REPS = 15, REP_STEP = 5;

  function _num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function _int(v, d) { var n = parseInt(v, 10); return isFinite(n) ? n : (d == null ? 0 : d); }

  // One day's kb_swing log → the EMOM session it holds, or null. EMOM sets are written by
  // logKbEmomSet as {emom:true, load, rounds (minutes DONE), roundsTarget (the target that
  // was chased), repsPerMin, effort}. Old sets without `effort` default to 'solid'; density
  // sets and old 3×10 sets are ignored (this engine is EMOM-only).
  function normalizeSession(date, kbLog) {
    if (!kbLog || typeof kbLog !== "object") return null;
    var sets = Array.isArray(kbLog.sets) ? kbLog.sets : [];
    var e = sets.find(function (s) { return s && s.emom; });
    if (!e) return null;
    return {
      date: date, load: _num(e.load),
      minutes: _int(e.rounds, 0),                 // minutes actually completed
      target: _int(e.roundsTarget, 0),            // the beat-target that was shown
      reps: _int(e.repsPerMin, START_REPS),
      effort: e.effort || "solid",
    };
  }

  // All EMOM sessions across the log, date-ordered.
  function allSessions(exLog) {
    var out = [];
    Object.keys(exLog || {}).sort().forEach(function (d) {
      var s = normalizeSession(d, (exLog[d] || {}).kb_swing);
      if (s) out.push(s);
    });
    return out;
  }

  // Suggested target for the NEXT session at `load` — the minutes to BEAT, plus the reps
  // and the last session's effort (for the start-screen "last: easy"). opts.readiness (<60 →
  // hold, don't climb); null / no Oura skips the guard.
  function suggest(exLog, load, opts) {
    opts = opts || {};
    var sessions = allSessions(exLog).filter(function (s) { return s.load === load; });
    var last = sessions.length ? sessions[sessions.length - 1] : null;

    if (!last) {
      return { load: load, type: "emom", minutes: START_MIN, reps: START_REPS, lastEffort: null,
        lever: "start", capped: false, cleared: false,
        reason: "Start — aim " + START_MIN + " min × " + START_REPS };
    }

    var achieved = last.minutes, reps = last.reps, E = last.effort;
    var good = E !== "tough";                       // easy or solid → climb
    var lowReady = opts.readiness != null && opts.readiness < 60;
    var minutes, lever, reason;

    if (good && !lowReady) {
      if (achieved >= CAP_MIN) {
        reps += REP_STEP; minutes = START_MIN; lever = "reps";
        reason = CAP_MIN + " min done — reps up to " + reps + ", back to " + START_MIN + " min";
      } else {
        minutes = achieved + 1; lever = "beat";
        reason = "Beat " + minutes + " min — last felt " + E;
      }
    } else {
      minutes = Math.max(START_MIN, achieved); lever = "hold";
      reason = lowReady
        ? "Readiness " + opts.readiness + " — repeat " + minutes + " min × " + reps
        : "Repeat " + minutes + " min × " + reps + " — last felt " + E;
    }

    return { load: load, type: "emom", minutes: minutes, reps: reps, lastEffort: E,
      lever: lever, capped: lowReady && good, cleared: good, reason: reason };
  }

  // Best EMOM per load → { "20": "8 min × 15" }. Best = most reps, then most minutes done.
  function pbsByLoad(exLog) {
    var pb = {};
    allSessions(exLog).forEach(function (s) {
      if (s.load == null || s.minutes <= 0) return;
      var key = String(s.load), cur = pb[key];
      var better = !cur || s.reps > cur.reps || (s.reps === cur.reps && s.minutes > cur.minutes);
      if (better) pb[key] = { reps: s.reps, minutes: s.minutes };
    });
    var out = {};
    Object.keys(pb).forEach(function (k) { out[k] = pb[k].minutes + " min × " + pb[k].reps; });
    return out;
  }

  return {
    normalizeSession: normalizeSession, allSessions: allSessions, suggest: suggest, pbsByLoad: pbsByLoad,
    _c: { START_MIN: START_MIN, CAP_MIN: CAP_MIN, START_REPS: START_REPS, REP_STEP: REP_STEP },
  };
});
