// Phase 108: Kettlebell Swing EMOM progression — PURE + deterministic. This is the
// LIVE KB experience again (the Phase 106 density model is kept dormant).
//
// Model (owner-specified): every-minute-on-the-minute. Do R swings inside each 60s
// minute, rest the remainder of the minute, repeat for M minutes. Progression, per load:
//   • Start at 5 minutes × 15 reps.
//   • Complete all M minutes cleanly → +1 minute next session, up to a 10-minute cap.
//   • Once you complete 10 minutes → bump reps +5 (15 → 20 → 25…) and RESET minutes to 5,
//     then climb the minutes again.
//   • A low-readiness day (Oura < 60) holds instead of climbing; null/no-Oura skips it.
// Weight is HELD (minutes then reps are the driver); the load param only scopes history,
// so 20kg and 24kg keep independent ladders. No AI, no I/O. UMD (require or <script>).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KB_EMOM = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var START_MIN = 5, CAP_MIN = 10, START_REPS = 15, REP_STEP = 5;

  function _num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function _int(v, d) { var n = parseInt(v, 10); return isFinite(n) ? n : (d == null ? 0 : d); }

  // One day's kb_swing log → the EMOM session it holds, or null. EMOM sets are written by
  // logKbEmomSet as {emom:true, load, roundsTarget, rounds, repsPerMin, outcome}. Old
  // Phase-1 3×10 sets and Phase-106 density sets are ignored (this engine is EMOM-only).
  function normalizeSession(date, kbLog) {
    if (!kbLog || typeof kbLog !== "object") return null;
    var sets = Array.isArray(kbLog.sets) ? kbLog.sets : [];
    var e = sets.find(function (s) { return s && s.emom; });
    if (!e) return null;
    var minutes = _int(e.roundsTarget, 0);
    var rounds = _int(e.rounds, 0);
    var outcome = e.outcome || (rounds >= minutes && minutes > 0 ? "FULL" : rounds > 0 ? "PARTIAL" : "SKIPPED");
    return { date: date, load: _num(e.load), minutes: minutes, rounds: rounds, reps: _int(e.repsPerMin, START_REPS), outcome: outcome };
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

  // Suggested target for the NEXT session at `load`. opts.readiness (<60 → hold, don't
  // climb); null / no Oura skips the guard.
  function suggest(exLog, load, opts) {
    opts = opts || {};
    var sessions = allSessions(exLog).filter(function (s) { return s.load === load; });
    var last = sessions.length ? sessions[sessions.length - 1] : null;

    if (!last) {
      return { load: load, type: "emom", sets: 1, minutes: START_MIN, reps: START_REPS,
        lever: "start", capped: false, cleared: false,
        reason: "Start — EMOM " + START_MIN + " min × " + START_REPS };
    }

    var minutes = last.minutes, reps = last.reps;
    var cleared = last.outcome === "FULL";
    var lowReady = opts.readiness != null && opts.readiness < 60;
    var lever, reason;

    if (cleared && !lowReady) {
      if (minutes < CAP_MIN) {
        minutes += 1; lever = "minutes";
        reason = "+1 min → " + minutes + " min × " + reps;
      } else {
        reps += REP_STEP; minutes = START_MIN; lever = "reps";
        reason = CAP_MIN + " min done — reps up to " + reps + ", back to " + START_MIN + " min";
      }
    } else {
      lever = "hold";
      if (lowReady) reason = "Readiness " + opts.readiness + " — hold " + minutes + " min × " + reps;
      else reason = "Repeat " + minutes + " min × " + reps + " (last " + last.rounds + "/" + minutes + ")";
    }

    return { load: load, type: "emom", sets: 1, minutes: minutes, reps: reps,
      lever: lever, capped: lowReady && cleared, cleared: cleared, reason: reason };
  }

  // Best completed EMOM per load → { "20": "10 min × 15" }. Best = most reps, then most minutes.
  function pbsByLoad(exLog) {
    var pb = {};
    allSessions(exLog).forEach(function (s) {
      if (s.outcome !== "FULL" || s.load == null) return;
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
