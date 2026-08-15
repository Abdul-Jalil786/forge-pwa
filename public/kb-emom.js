// Phase 92 (Part 3): Kettlebell Swing EMOM progression engine — PURE + deterministic.
// Per-profile (reads that profile's own exLog) and PER-LOAD: the ladder is derived
// from the sessions logged AT a given weight, so 20kg and 24kg keep independent
// ladders and histories. No AI, no I/O. UMD so tests can require() it and the
// browser can load it as a <script> (mirrors proactive-core.js).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KB_EMOM = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ----- constants (the spec's ladder) -----
  var P1_SETS = 3, P1_REPS = 10;        // Phase 1: 3×10 normal sets
  var P2_ENTRY_MIN = 5, P2_REPS = 12;   // Phase 2 entry: EMOM 5min × 12
  var P2_TOP_MIN = 8;                   // Phase 2 tops out at 8min before →3
  var P3_REPS = 15, P3_TOP_MIN = 10;    // Phase 3: 15 reps, ladder 8→10
  var P1_TO_P2_FULLS = 4;               // 4 consecutive FULL 3×10 → Phase 2
  var P2_TO_P3_FULLS = 3;               // 3 consecutive FULL at 8×12 → Phase 3

  function _num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }

  // Classify one day's kb_swing log into a normalized session at its load.
  // Phase-1 (normal) sets: {kg,reps,done}. EMOM set: {emom, load, rounds, roundsTarget, repsPerMin}.
  function normalizeSession(date, kbLog) {
    if (!kbLog || typeof kbLog !== "object") return null;
    var sets = Array.isArray(kbLog.sets) ? kbLog.sets : [];
    var emom = sets.find(function (s) { return s && s.emom; });
    if (emom) {
      var rounds = _num(emom.rounds) || 0;
      var target = _num(emom.roundsTarget) || 0;
      var outcome = emom.outcome || (rounds >= target && target > 0 ? "FULL" : rounds > 0 ? "PARTIAL" : "SKIPPED");
      return {
        date: date, isEmom: true, load: _num(emom.load),
        rounds: rounds, roundsTarget: target, reps: _num(emom.repsPerMin) || P2_REPS, outcome: outcome,
      };
    }
    // Phase 1 normal: modal kg across done sets, FULL = 3+ done sets at ≥10 reps.
    var done = sets.filter(function (s) { return s && s.done && _num(s.reps) != null; });
    if (!done.length) return null;
    var counts = {};
    done.forEach(function (s) { var k = String(_num(s.kg)); counts[k] = (counts[k] || 0) + 1; });
    var modal = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || _num(b) - _num(a); })[0];
    var load = _num(modal);
    var atLoad = done.filter(function (s) { return _num(s.kg) === load; });
    var full = atLoad.length >= P1_SETS && atLoad.slice(0, P1_SETS).every(function (s) { return _num(s.reps) >= P1_REPS; });
    return { date: date, isEmom: false, load: load, reps: P1_REPS, outcome: full ? "FULL" : "PARTIAL" };
  }

  // All normalized kb_swing sessions across the log, date-ordered.
  function allSessions(exLog) {
    var out = [];
    Object.keys(exLog || {}).sort().forEach(function (d) {
      var s = normalizeSession(d, (exLog[d] || {}).kb_swing);
      if (s) out.push(s);
    });
    return out;
  }

  // Replay the sessions AT ONE LOAD to derive the current ladder state → the target
  // for the NEXT session. Implements the spec's rules exactly (see comments).
  function ladderForLoad(sessions) {
    var st = {
      phase: 1, reps: P1_REPS, target: null,   // target = EMOM minutes (null in phase 1)
      floor: null,            // highest FULL minutes reached — never suggest below it
      p1Fulls: 0,             // consecutive FULL 3×10 (phase 1)
      at8Fulls: 0,            // consecutive FULL at 8×12 (phase 2 → 3 gate)
      partialsAtTarget: 0,    // consecutive PARTIALs landing on the current target
      consolidateLeft: 0,     // sessions to HOLD at the current target
      lastOutcome: null, lastRounds: null,
    };
    sessions.forEach(function (s) {
      st.lastOutcome = s.outcome; st.lastRounds = s.rounds != null ? s.rounds : null;
      if (st.phase === 1) {
        if (s.outcome === "FULL") {
          st.p1Fulls++;
          if (st.p1Fulls >= P1_TO_P2_FULLS) { st.phase = 2; st.reps = P2_REPS; st.target = P2_ENTRY_MIN; st.floor = null; st.p1Fulls = 0; st.partialsAtTarget = 0; st.consolidateLeft = 0; }
        } else st.p1Fulls = 0;
        return;
      }
      // Phase 2 / 3 (EMOM). The session was attempted at `attempted` minutes.
      var attempted = s.roundsTarget || st.target;
      if (s.outcome === "FULL") {
        st.floor = Math.max(st.floor || 0, attempted);
        st.partialsAtTarget = 0; st.consolidateLeft = 0;
        if (st.phase === 2 && attempted >= P2_TOP_MIN && st.reps === P2_REPS) {
          st.at8Fulls++;
          if (st.at8Fulls >= P2_TO_P3_FULLS) { st.phase = 3; st.reps = P3_REPS; st.target = P2_TOP_MIN; st.floor = P2_TOP_MIN; st.at8Fulls = 0; }
          else st.target = P2_TOP_MIN; // hold at 8 until 3 consecutive FULL
        } else if (st.phase === 3) {
          st.target = Math.min(P3_TOP_MIN, attempted + 1); // ladder 8→10, then hold
          st.at8Fulls = 0;
        } else {
          st.target = attempted + 1; // phase 2 climb 5→6→7→8
          st.at8Fulls = 0;
        }
      } else if (s.outcome === "PARTIAL") {
        st.at8Fulls = 0;
        var phaseFloorMin = st.phase === 3 ? P2_TOP_MIN : P2_ENTRY_MIN;
        var reduced = Math.max(s.rounds || 0, st.floor || phaseFloorMin);
        if (st.consolidateLeft > 0) {
          st.consolidateLeft--; // holding — target unchanged
        } else if (reduced === st.target) {
          st.partialsAtTarget++;
          if (st.partialsAtTarget >= 2) st.consolidateLeft = 2; // two PARTIALs same target → consolidate
        } else {
          st.target = reduced;         // drop to rounds-completed (never below floor)
          st.partialsAtTarget = 1;
        }
      } else {
        // SKIPPED — no ladder change
        st.at8Fulls = 0;
      }
    });
    return st;
  }

  // Sessions grouped by load.
  function _byLoad(exLog) {
    var m = {};
    allSessions(exLog).forEach(function (s) { if (s.load != null) (m[s.load] = m[s.load] || []).push(s); });
    return m;
  }
  // Has this profile unlocked EMOM at ANY load (finished Phase 1)? Once unlocked, a
  // NEW/changed load re-enters at EMOM 5×12 rather than back at Phase 1 3×10.
  function emomUnlocked(exLog) {
    var m = _byLoad(exLog);
    return Object.keys(m).some(function (L) { return ladderForLoad(m[L]).phase >= 2; });
  }

  // Public: the suggested target for the NEXT session at `load`, with a reason.
  // opts.readiness (0-100, optional) — Phase 92 point 12: <60 caps at the last FULL
  // level. opts.hasOura=false skips the guard (e.g. Naveed with no Oura connected).
  function suggest(exLog, load, opts) {
    opts = opts || {};
    var sessions = allSessions(exLog).filter(function (s) { return s.load === load; });
    // Point 18: a load with no history, once EMOM is unlocked elsewhere, re-enters
    // conservatively at 5 min × 12 (its own fresh ladder) — never carries a position.
    if (!sessions.length && emomUnlocked(exLog)) {
      return { load: load, phase: 2, reps: P2_REPS, type: "emom", sets: 1, minutes: P2_ENTRY_MIN,
        consolidating: false, capped: false, floor: null, reason: "New weight — re-entry at 5 min × 12" };
    }
    var st = ladderForLoad(sessions);
    var out = {
      load: load, phase: st.phase, reps: st.reps, consolidating: st.consolidateLeft > 0,
      capped: false, floor: st.floor,
    };
    if (st.phase === 1) {
      out.type = "normal"; out.sets = P1_SETS; out.minutes = null;
      out.reason = st.p1Fulls > 0 ? (st.p1Fulls + "/" + P1_TO_P2_FULLS + " FULL 3×10 — " + (P1_TO_P2_FULLS - st.p1Fulls) + " more to unlock EMOM") : "Phase 1 — 3×10 to build the pattern";
      return out;
    }
    out.type = "emom"; out.sets = 1; out.minutes = st.target;
    // reason
    if (out.consolidating) out.reason = "Consolidating at " + st.target + " min — hold here (last session " + (st.lastRounds != null ? st.lastRounds : "?") + "/" + st.target + ")";
    else if (st.lastOutcome === "FULL") out.reason = "+1 from last session ✓";
    else if (st.lastOutcome === "PARTIAL") out.reason = "repeating — last session " + (st.lastRounds != null ? st.lastRounds : "?") + "/" + (st.floor && st.floor > st.target ? st.floor : (st.target + 1));
    else out.reason = "Phase " + st.phase + " — EMOM " + st.target + " min × " + st.reps;
    // Readiness guard: cap at the last FULL level (never suggest a NEW higher target
    // on a low-readiness day). No Oura → skip gracefully.
    if (opts.hasOura !== false && opts.readiness != null && opts.readiness < 60 && st.floor != null && out.minutes > st.floor) {
      out.minutes = st.floor; out.capped = true;
      out.reason = "Readiness " + opts.readiness + " — capped at last FULL (" + st.floor + " min)";
    }
    return out;
  }

  // Best completed EMOM per load → { "20": "8×12", "24": "6×12" } (highest minutes at
  // the highest reps that went FULL). Point 20's PB display.
  function pbsByLoad(exLog) {
    var pb = {};
    allSessions(exLog).forEach(function (s) {
      if (!s.isEmom || s.outcome !== "FULL" || s.load == null) return;
      var key = String(s.load);
      var cur = pb[key];
      var better = !cur || s.reps > cur.reps || (s.reps === cur.reps && s.roundsTarget > cur.minutes);
      if (better) pb[key] = { reps: s.reps, minutes: s.roundsTarget };
    });
    var out = {};
    Object.keys(pb).forEach(function (k) { out[k] = pb[k].minutes + "×" + pb[k].reps; });
    return out;
  }

  return {
    normalizeSession: normalizeSession, allSessions: allSessions, ladderForLoad: ladderForLoad,
    emomUnlocked: emomUnlocked, suggest: suggest, pbsByLoad: pbsByLoad,
    _c: { P1_SETS: P1_SETS, P1_REPS: P1_REPS, P2_ENTRY_MIN: P2_ENTRY_MIN, P2_REPS: P2_REPS, P2_TOP_MIN: P2_TOP_MIN, P3_REPS: P3_REPS, P3_TOP_MIN: P3_TOP_MIN },
  };
});
