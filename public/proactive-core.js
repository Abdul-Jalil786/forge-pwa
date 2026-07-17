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

// ============================================================
// Phase 58: Boditrax + source-hierarchy lean blending (pure)
// ============================================================
// Reliability hierarchy for lean mass / body composition: DEXA (gold standard) >
// Boditrax (multi-frequency BIA the user trusts) > Withings / manual daily BIA.
// Higher-priority readings ANCHOR the trend; lower-priority sources only fill the
// gaps between them. This is the single source of truth consumed by the frontend
// Track page, the correlation engine, and the daily lbm_drop trigger.
var LEAN_SOURCE_PRIORITY = { dexa: 3, boditrax: 2, withings: 1, manual: 1 };

// Lean (fat-free mass) from a Boditrax record: prefer the reported FFM, else
// derive it from weight − fat mass.
function _leanFromBoditrax(b) {
  if (!b) return null;
  var ffm = _num(b.ffm); if (ffm != null) return ffm;
  var w = _num(b.weight), f = _num(b.fat);
  if (w != null && f != null) return _round(w - f, 2);
  return null;
}

// Per-date lean series with each day resolved to its highest-priority source.
// Returns [{date, lean, source, priority}] sorted ascending. When two sources
// report the same date, the more reliable one wins. opts.reliableOnly keeps only
// Boditrax/DEXA points (priority >= 2).
function blendedLeanSeries(state, opts) {
  opts = opts || {};
  var byDate = {};
  function put(date, lean, source) {
    if (!date || lean == null) return;
    var pr = LEAN_SOURCE_PRIORITY[source] || 1;
    var cur = byDate[date];
    if (!cur || pr > cur.priority) byDate[date] = { date: date, lean: _round(lean, 2), source: source, priority: pr };
  }
  // Withings / manual daily BIA: weight × (1 − bf/100), bf aligned nearest-prior.
  var wl = (state.weightLog || []).slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
  var bl = (state.bfLog || []).slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
  wl.forEach(function (we) {
    var w = _num(we.weight); if (w == null) return;
    var bf = null;
    for (var i = 0; i < bl.length; i++) { if (bl[i].date <= we.date) { var b = _num(bl[i].bf); if (b != null) bf = b; } }
    if (bf != null) put(we.date, w * (1 - bf / 100), we.source === "withings" ? "withings" : "manual");
  });
  // Boditrax scans (fat-free mass).
  (state.boditraxLog || []).forEach(function (b) { if (b && b.date) put(b.date, _leanFromBoditrax(b), "boditrax"); });
  // DEXA scans (gold standard).
  (state.dexaScans || []).forEach(function (d) { if (d && d.date) { var l = _num(d.leanMass); if (l != null) put(d.date, l, "dexa"); } });

  var series = Object.keys(byDate).map(function (d) { return byDate[d]; }).sort(function (a, b) { return a.date.localeCompare(b.date); });
  if (opts.reliableOnly) series = series.filter(function (p) { return p.priority >= 2; });
  return series;
}

// Lean-mass trend as a least-squares slope in kg/week, weighted toward the most
// reliable available source. When >= 2 reliable (Boditrax/DEXA) readings exist,
// the slope is regressed over the last up-to-4 of them ONLY — daily Withings
// noise is excluded, so a device the user trusts governs the trend. With no
// reliable anchors it falls back to the Withings daily series over ~14 days.
// opts.until bounds the "as of" date. Returns { perWeek, source, n, points }.
function leanTrendRate(state, opts) {
  opts = opts || {};
  var until = opts.until;
  var all = blendedLeanSeries(state).filter(function (p) { return !until || p.date <= until; });
  if (all.length < 2) return { perWeek: null, source: null, n: all.length, points: all.slice() };
  var reliable = all.filter(function (p) { return p.priority >= 2; });
  var use, source;
  if (reliable.length >= 2) {
    use = reliable.slice(-4); // last up-to-4 reliable scans anchor the trend
    source = use.some(function (p) { return p.priority === 3; }) ? "dexa/boditrax" : "boditrax";
  } else {
    var end = until || all[all.length - 1].date;
    var since = _addDays(end, -13);
    use = all.filter(function (p) { return p.date >= since; });
    if (use.length < 2) use = all.slice(-2);
    source = "withings";
  }
  var base = use[0].date;
  var s = slope(use.map(function (p) { return [_dayIdx(p.date, base), p.lean]; }));
  return { perWeek: s == null ? null : _round(s * 7, 2), source: source, n: use.length, points: use, first: use[0], last: use[use.length - 1] };
}

// Field spec for a Boditrax scan: [min, max, required]. Shared by the frontend
// form, the server route, and the tests so ranges never drift apart.
var BODITRAX_FIELDS = {
  weight:        [30, 300, true],
  muscle:        [5, 200, true],
  fat:           [0, 200, true],
  visceral:      [1, 60, true],
  water:         [5, 150, false],
  bone:          [0.3, 15, false],
  ffm:           [10, 250, false],
  cellular:      [0, 20, false],
  bmr:           [500, 5000, false],
  metabolicAge:  [5, 120, false],
  physique:      [1, 9, false],
  legMuscle:     [0, 150, false],
  boditraxScore: [0, 1000, false],
  proteinPct:    [5, 40, false],
};

// Validate + clean a raw Boditrax entry. Returns { ok, errors:{field:msg},
// clean:{...} }. Required fields must be present + in range; optional fields must
// be in range IF supplied (blank/omitted → null). Pure — no I/O, no DOM.
function validateBoditraxEntry(raw) {
  raw = raw || {};
  var errors = {}, clean = { source: "boditrax" };
  var date = String(raw.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = "Date is required (YYYY-MM-DD)";
  else clean.date = date;
  var time = String(raw.time || "").slice(0, 5);
  clean.time = /^\d{2}:\d{2}$/.test(time) ? time : null;
  for (var f in BODITRAX_FIELDS) {
    var spec = BODITRAX_FIELDS[f], lo = spec[0], hi = spec[1], req = spec[2];
    var v = raw[f];
    if (v == null || v === "") {
      if (req) errors[f] = f + " is required";
      clean[f] = null;
      continue;
    }
    var n = _num(v);
    if (n == null) errors[f] = f + " must be a number";
    else if (n < lo || n > hi) errors[f] = f + " must be between " + lo + " and " + hi;
    else clean[f] = n;
  }
  return { ok: Object.keys(errors).length === 0, errors: errors, clean: clean };
}

// ============================================================
// Phase 2: trigger checks + governance (pure)
// ============================================================
function _sessionSatisfied(exLog, madeUp, date) {
  var day = exLog[date];
  if (day) {
    if (day._session && day._session.skipped) return true;
    for (var k in day) {
      if (k.charAt(0) === "_") continue;
      var ex = day[k];
      if (ex && Array.isArray(ex.sets) && ex.sets.some(function (s) { return _num(s.kg) != null || _num(s.reps) != null || _num(s.seconds) != null; })) return true;
    }
  }
  return !!madeUp[date];
}

// Deterministic trigger checks. opts: { today, exerciseReps, proteinFloor, phase,
// scheduledDays[] }. Returns fired triggers [{ type, severity, detail, data }].
function computeTriggers(state, opts) {
  opts = opts || {};
  var today = opts.today; if (!today) return [];
  var fired = [];
  function fire(type, severity, detail, data) { fired.push({ type: type, severity: severity, detail: detail, data: data || {} }); }

  // 1. low_steps — yesterday < 50% of the 14d average (need >=7 days baseline)
  var steps = state.stepsLog || {};
  var yVal = _num(steps[_addDays(today, -1)]);
  var sHist = [];
  for (var i = 2; i <= 15; i++) { var v = _num(steps[_addDays(today, -i)]); if (v != null) sHist.push(v); }
  if (yVal != null && sHist.length >= 7) { var savg = _mean(sHist); if (savg > 0 && yVal < 0.5 * savg) fire("low_steps", 2, "Steps yesterday " + yVal + " — under half your ~" + Math.round(savg) + " average", { yesterday: yVal, avg: Math.round(savg) }); }

  // 2. poor_sleep — last night in bottom decile of 60d, or bedtime after 2am
  var ln = sleepEntry(state, today);
  if (ln && ln.hours != null) {
    var hh = [];
    for (var j = 1; j <= 60; j++) { var s = sleepEntry(state, _addDays(today, -j)); if (s && s.hours != null) hh.push(s.hours); }
    var lateBed = ln.bedtime != null && ln.bedtime >= 2 && ln.bedtime <= 6;
    var decile = false;
    if (hh.length >= 20) { var sorted = hh.slice().sort(function (a, b) { return a - b; }); var p10 = sorted[Math.floor(sorted.length * 0.1)]; decile = ln.hours <= p10; }
    if (decile || lateBed) fire("poor_sleep", 2, lateBed ? "Late bedtime last night" : "Last night " + ln.hours + "h — bottom 10% of your last 60 nights", { hours: ln.hours, lateBed: lateBed });
  }

  // 3. low_protein — under the floor two days running (both days must have food)
  if (opts.proteinFloor) {
    var intake = dailyIntake(state);
    var a1 = intake[_addDays(today, -1)], a2 = intake[_addDays(today, -2)];
    if (a1 && a2 && a1.kcal > 0 && a2.kcal > 0 && a1.protein < opts.proteinFloor && a2.protein < opts.proteinFloor) fire("low_protein", 3, "Protein under " + opts.proteinFloor + "g two days running (" + a2.protein + "g, " + a1.protein + "g)", { floor: opts.proteinFloor, days: [a2.protein, a1.protein] });
  }

  // 4. lift_stalled
  var stalls = detectStalls(state, opts.exerciseReps || {});
  if (stalls.length) fire("lift_stalled", 2, stalls.length + " lift(s) stalled: " + stalls.map(function (s) { return s.exId + " @ " + s.kg + "kg (" + s.sessions + " sessions)"; }).join(", "), { stalls: stalls });

  // 5. weight_plateau — cut phase, 10d slope flat/positive
  if (opts.phase === "cut") {
    var wl = (state.weightLog || []).slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    var pts10 = wl.filter(function (e) { return e.date >= _addDays(today, -9) && e.date <= today; });
    var sl10 = _weightSlopeEnding(wl, today, 10);
    if (sl10 != null && pts10.length >= 6 && sl10 >= -0.01) fire("weight_plateau", 3, "Weight trend flat/up over 10 days on a cut (" + _round(sl10 * 7, 2) + "kg/week)", { slopePerWeek: _round(sl10 * 7, 2) });
  }

  // 6. lbm_drop — lean mass falling > 0.3kg/week, anchored to the most reliable
  // source (Boditrax/DEXA over Withings) so daily BIA noise can't raise a false
  // alarm the trusted device contradicts.
  var lr = leanTrendRate(state, { until: today });
  // Sparse Boditrax/DEXA scans anchor with as few as 2 points; the noisy Withings
  // daily fallback still needs a dense window (>= 8 points) before it may alarm.
  var lbmEnough = lr.source === "withings" ? lr.n >= 8 : lr.n >= 2;
  if (lr.perWeek != null && lbmEnough && lr.perWeek < -0.3) fire("lbm_drop", 4, "Lean mass dropping ~" + lr.perWeek + "kg/week (" + lr.source + ")", { perWeek: lr.perWeek, source: lr.source });

  // 7. missed_sessions — 2+ consecutive missed scheduled sessions (make-ups/skips honoured)
  if (Array.isArray(opts.scheduledDays) && opts.scheduledDays.length) {
    var exLog = state.exLog || {}, madeUp = {};
    for (var dk in exLog) { var se = exLog[dk] && exLog[dk]._session; if (se && se.forDate) madeUp[se.forDate] = true; }
    var past = opts.scheduledDays.slice().sort().filter(function (d) { return d < today; });
    var miss = 0;
    for (var p = past.length - 1; p >= 0; p--) { if (!_sessionSatisfied(exLog, madeUp, past[p])) miss++; else break; }
    if (miss >= 2) fire("missed_sessions", 3, miss + " scheduled sessions missed in a row", { count: miss });
  }

  // 8. deload_week — placeholder; only fires once the deload feature sets opts.deloadStarting.
  if (opts.deloadStarting) fire("deload_week", 2, "Deload week starting", {});

  return fired.sort(function (a, b) { return (b.severity || 0) - (a.severity || 0); });
}

// Governance: pick ONE trigger to act on (or null). Enforces max 1 selection/day,
// max N delivered/week, and a per-type cooldown. history: [{type,date,delivered}].
function selectNudge(history, fired, today, config) {
  config = config || {};
  var maxPerWeek = config.maxPerWeek || 3, cooldown = config.cooldownDays || 5;
  if (!fired || !fired.length) return null;
  history = history || [];
  if (history.some(function (h) { return h.date === today; })) return null; // one selection/day
  var weekStart = _addDays(today, -6);
  if (history.filter(function (h) { return h.delivered && h.date >= weekStart; }).length >= maxPerWeek) return null;
  var eligible = fired.filter(function (f) {
    var last = history.filter(function (h) { return h.type === f.type; }).map(function (h) { return h.date; }).sort().pop();
    return !last || _dayIdx(today, last) >= cooldown;
  });
  if (!eligible.length) return null;
  eligible.sort(function (a, b) { return (b.severity || 0) - (a.severity || 0); });
  return eligible[0];
}

// True if dateStr is the first Sunday of its month (Phase 3 monthly deep-dive).
function isFirstSundayOfMonth(dateStr) {
  var dt = new Date(dateStr + "T12:00:00");
  return dt.getDay() === 0 && dt.getDate() <= 7;
}

var PROACTIVE_CORE = {
  MIN_N: MIN_N, MIN_CYCLES: MIN_CYCLES,
  pearson: pearson, slope: slope, dailyIntake: dailyIntake, sessionPerf: sessionPerf, detectStalls: detectStalls,
  computeCorrelations: computeCorrelations, formatCorrelations: formatCorrelations,
  computeTriggers: computeTriggers, selectNudge: selectNudge, isFirstSundayOfMonth: isFirstSundayOfMonth,
  blendedLeanSeries: blendedLeanSeries, leanTrendRate: leanTrendRate, LEAN_SOURCE_PRIORITY: LEAN_SOURCE_PRIORITY,
  validateBoditraxEntry: validateBoditraxEntry, BODITRAX_FIELDS: BODITRAX_FIELDS,
};
if (typeof window !== "undefined") window.PROACTIVE_CORE = PROACTIVE_CORE;
if (typeof module !== "undefined" && module.exports) module.exports = PROACTIVE_CORE;
