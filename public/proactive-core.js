// ============================================================
// PROACTIVE COACH — deterministic core (Phase 57)
// ============================================================
// Pure, dependency-free maths for the proactive coaching agent: correlation
// engine (Phase 1), trigger checks + governance (Phase 2). NO LLM, NO I/O, NO
// Date.now-dependent behaviour beyond simple date arithmetic. Lives here (served
// statically) so the TS server and the zero-dep node tests share ONE copy —
// same UMD pattern as programme-shared.js. All "today"/"asOf" values are passed
// in so tests are deterministic.

var MIN_N = 14;          // pair-correlations below this are "insufficient data"
var MIN_CYCLES = 3;      // GLP-1 injection cycles below this are insufficient

// ---- stats helpers ----
function _num(v) { var n = typeof v === "number" ? v : parseFloat(v); return isFinite(n) ? n : null; }
function _mean(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : 0; }
function _round(x, d) { var m = Math.pow(10, d || 0); return Math.round(x * m) / m; }
function pearson(pairs) {
  var n = pairs.length; if (n < 2) return { r: null, n: n };
  var xs = pairs.map(function (p) { return p[0]; }), ys = pairs.map(function (p) { return p[1]; });
  var mx = _mean(xs), my = _mean(ys), sxy = 0, sxx = 0, syy = 0;
  for (var i = 0; i < n; i++) { var dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  if (sxx === 0 || syy === 0) return { r: null, n: n };
  return { r: _round(sxy / Math.sqrt(sxx * syy), 2), n: n };
}
function slope(points) {
  var n = points.length; if (n < 2) return null;
  var mx = _mean(points.map(function (p) { return p[0]; })), my = _mean(points.map(function (p) { return p[1]; }));
  var sxy = 0, sxx = 0;
  for (var i = 0; i < n; i++) { var dx = points[i][0] - mx; sxy += dx * (points[i][1] - my); sxx += dx * dx; }
  return sxx === 0 ? null : sxy / sxx;
}
function _addDays(d, k) { var dt = new Date(d + "T12:00:00"); dt.setDate(dt.getDate() + k); return dt.toISOString().slice(0, 10); }
function _dayIdx(d, base) { return Math.round((new Date(d + "T12:00:00") - new Date(base + "T12:00:00")) / 86400000); }
function _strength(r) { var a = Math.abs(r); return a >= 0.5 ? "strong" : a >= 0.3 ? "moderate" : a >= 0.15 ? "weak" : "negligible"; }
function _dir(r) { return r > 0 ? "positive" : r < 0 ? "negative" : "flat"; }

// ---- data accessors ----
function dailyIntake(state) {
  var foods = state.foods || {}, out = {};
  for (var d in foods) {
    var items = foods[d] || [], kcal = 0, protein = 0;
    for (var i = 0; i < items.length; i++) { kcal += _num(items[i].cals) || 0; protein += _num(items[i].protein) || 0; }
    out[d] = { kcal: Math.round(kcal), protein: Math.round(protein) };
  }
  return out;
}
function sleepEntry(state, d) {
  var s = (state.sleepLog || {})[d]; if (!s) return null;
  return { hours: _num(s.totalHours != null ? s.totalHours : s.hours), score: _num(s.score != null ? s.score : s.quality), bedtime: _num(s.bedtime != null ? s.bedtime : s.sleepStart) };
}
// Session performance in [-1,1]: (sets hitting top of range − tough sets) / sets.
function sessionPerf(dayLog, reps) {
  if (!dayLog) return null;
  var total = 0, hitUpper = 0, tough = 0;
  for (var k in dayLog) {
    if (k.charAt(0) === "_") continue;
    var ex = dayLog[k]; if (!ex || !Array.isArray(ex.sets)) continue;
    var range = reps[k];
    for (var i = 0; i < ex.sets.length; i++) {
      var s = ex.sets[i], kg = _num(s.kg), rp = _num(s.reps);
      if (kg == null || rp == null) continue;
      total++;
      if (range && rp >= range[1]) hitUpper++;
      if (s.effort === "tough") tough++;
    }
  }
  if (total < 3) return null;
  return _round((hitUpper - tough) / total, 2);
}
function _weightSlopeEnding(weightLog, endDate, days) {
  var start = _addDays(endDate, -(days - 1)), pts = [];
  for (var i = 0; i < weightLog.length; i++) {
    var e = weightLog[i]; if (e.date >= start && e.date <= endDate) { var w = _num(e.weight); if (w != null) pts.push([_dayIdx(e.date, start), w]); }
  }
  return pts.length < 3 ? null : slope(pts);
}

function _corr(key, label, pairs, xdesc, ydesc, emptyNote) {
  var pc = pearson(pairs);
  if (pc.n < MIN_N || pc.r == null) {
    return { key: key, label: label, n: pc.n, r: pc.r, insufficient: true, direction: null, r_abs: null,
      summary: (pairs.length === 0 && emptyNote) ? emptyNote : "insufficient data (n=" + pc.n + ", need " + MIN_N + ")" };
  }
  return { key: key, label: label, n: pc.n, r: pc.r, insufficient: false, strength: _strength(pc.r), direction: _dir(pc.r), r_abs: Math.abs(pc.r),
    summary: _strength(pc.r) + " " + _dir(pc.r) + " correlation (r=" + pc.r + ", n=" + pc.n + "): " + xdesc + " → " + ydesc };
}

function _glp1Effect(state, intake, opts) {
  var key = "glp1_vs_intake", label = "GLP-1 injection → next-3-day appetite";
  var ml = state.mounjaroLog || {};
  var injDates = Object.keys(ml).filter(function (d) { return ml[d] && ml[d].injected; }).sort();
  if (injDates.length === 0 && opts.onGlp1 && opts.glp1InjectionDow != null) {
    Object.keys(intake).sort().forEach(function (d) { if (new Date(d + "T12:00:00").getDay() === opts.glp1InjectionDow) injDates.push(d); });
  }
  if (injDates.length < MIN_CYCLES) return { key: key, label: label, insufficient: true, nCycles: injDates.length, summary: "insufficient injection cycles (n=" + injDates.length + ", need " + MIN_CYCLES + ")" };
  var win = {}; injDates.forEach(function (d) { for (var k = 0; k <= 3; k++) win[_addDays(d, k)] = true; });
  var winK = [], baseK = [];
  for (var d in intake) { if (intake[d].kcal <= 0) continue; (win[d] ? winK : baseK).push(intake[d].kcal); }
  if (winK.length < MIN_CYCLES || baseK.length < MIN_CYCLES) return { key: key, label: label, insufficient: true, nCycles: injDates.length, summary: "insufficient logged intake around injections" };
  var delta = Math.round(_mean(winK) - _mean(baseK));
  return { key: key, label: label, insufficient: false, nCycles: injDates.length, direction: delta < 0 ? "lower" : "higher", deltaKcal: delta,
    summary: "over " + injDates.length + " injection cycles, intake on the injection day + next 3 days averaged " + (delta < 0 ? delta : "+" + delta) + " kcal vs other days" };
}

// Per-lift stall: same top-set weight held across the last 3+ of the last 6
// sessions without any set reaching the top of the rep range.
function detectStalls(state, reps) {
  var exLog = state.exLog || {}, dates = Object.keys(exLog).filter(function (d) { return d.charAt(0) !== "_"; }).sort();
  var byEx = {};
  for (var di = 0; di < dates.length; di++) {
    var day = exLog[dates[di]];
    for (var k in day) {
      if (k.charAt(0) === "_" || !reps[k]) continue; // only lifts with a known rep range
      var ex = day[k]; if (!ex || !Array.isArray(ex.sets)) continue;
      var working = ex.sets.filter(function (s) { return _num(s.kg) != null && _num(s.reps) != null; });
      if (!working.length) continue;
      var topKg = Math.max.apply(null, working.map(function (s) { return _num(s.kg); }));
      var hitUpper = working.some(function (s) { return _num(s.reps) >= reps[k][1]; });
      (byEx[k] = byEx[k] || []).push({ date: dates[di], kg: topKg, hitUpper: hitUpper });
    }
  }
  var stalls = [];
  for (var exId in byEx) {
    var sess = byEx[exId].slice(-6); if (sess.length < 3) continue;
    var last = sess[sess.length - 1], streak = 0;
    for (var i = sess.length - 1; i >= 0; i--) { if (Math.abs(sess[i].kg - last.kg) < 0.1 && !sess[i].hitUpper) streak++; else break; }
    if (streak >= 3) stalls.push({ exId: exId, sessions: streak, kg: last.kg });
  }
  return stalls;
}

// Full correlation computation. opts: { exerciseReps, onGlp1, glp1InjectionDow }.
function computeCorrelations(state, opts) {
  opts = opts || {};
  var reps = opts.exerciseReps || {};
  var intake = dailyIntake(state);
  var weightLog = (state.weightLog || []).slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
  var recovery = state.recovery || {}, steps = state.stepsLog || {}, exLog = state.exLog || {};
  var results = [];

  var p1 = [];
  for (var d in steps) { var st = _num(steps[d]); var sl = sleepEntry(state, _addDays(d, 1)); if (st != null && sl && sl.hours != null) p1.push([st, sl.hours]); }
  results.push(_corr("steps_vs_sleep", "Steps → next-night sleep duration", p1, "more steps", "more sleep"));

  var p2 = [];
  for (var d2 in exLog) { if (d2.charAt(0) === "_") continue; var perf = sessionPerf(exLog[d2], reps); if (perf == null) continue; var s2 = sleepEntry(state, d2); if (s2 && s2.hours != null) p2.push([s2.hours, perf]); }
  results.push(_corr("sleep_vs_performance", "Sleep the night before → session performance", p2, "more sleep", "better session (hit reps, fewer grinders)"));

  var p3 = [];
  for (var d3 in intake) { var pr = intake[d3].protein; var sl3 = _weightSlopeEnding(weightLog, d3, 7); if (pr != null && sl3 != null) p3.push([pr, sl3]); }
  results.push(_corr("protein_vs_weighttrend", "Daily protein → 7-day weight trend (kg/day)", p3, "more protein", "weight-trend slope (negative = loss)"));

  results.push(_glp1Effect(state, intake, opts));

  var p5 = [];
  for (var d5 in (state.sleepLog || {})) { var sl5 = sleepEntry(state, d5); var rec = recovery[d5]; if (sl5 && sl5.bedtime != null && rec && _num(rec.readiness) != null) p5.push([sl5.bedtime, _num(rec.readiness)]); }
  results.push(_corr("bedtime_vs_readiness", "Bedtime → next-day readiness", p5, "later bedtime", "readiness", "Bedtime is not yet synced from Oura (no sleep-start field) — this will populate once it is captured."));

  return { minN: MIN_N, correlations: results, stalls: detectStalls(state, reps) };
}

// Plain-text block for the AI-coach context.
function formatCorrelations(c) {
  if (!c || !c.correlations) return "";
  var L = ["CORRELATIONS (computed deterministically over full history — cite these, do not eyeball patterns):"];
  c.correlations.forEach(function (x) { L.push("  - " + x.label + ": " + x.summary); });
  L.push("  - Stalled lifts (last 6 sessions): " + (c.stalls && c.stalls.length ? c.stalls.map(function (s) { return s.exId + " (" + s.sessions + " sessions @ " + s.kg + "kg)"; }).join(", ") : "none detected"));
  return L.join("\n");
}

var PROACTIVE_CORE = {
  MIN_N: MIN_N, MIN_CYCLES: MIN_CYCLES,
  pearson: pearson, slope: slope, dailyIntake: dailyIntake, sessionPerf: sessionPerf, detectStalls: detectStalls,
  computeCorrelations: computeCorrelations, formatCorrelations: formatCorrelations,
};
if (typeof window !== "undefined") window.PROACTIVE_CORE = PROACTIVE_CORE;
if (typeof module !== "undefined" && module.exports) module.exports = PROACTIVE_CORE;
