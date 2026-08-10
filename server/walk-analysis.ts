// Phase 89: walk analysis — pure, deterministic, no I/O (unit-testable).
// Given a walk's window and the HR time-series that overlaps it, compute the
// metrics the "Engine Trend" needs: duration, pace (if distance known), avg/max
// HR, and HR drift (avg HR in the final third minus the first third of the walk).

export interface HrSample { t: number; bpm: number; } // t = epoch ms
export interface WalkInput {
  id: string;
  day: string;
  start: string; // ISO
  end: string;   // ISO
  distanceM?: number | null;
  source: string; // 'oura' | 'manual'
  activity?: string;
}
export interface WalkResult {
  id: string;
  day: string;
  start: string;
  end: string;
  durationMin: number | null;
  distanceM: number | null;
  paceMph: number | null;
  avgHR: number | null;
  maxHR: number | null;
  hrDrift: number | null; // final-third avg − first-third avg (bpm); + = drifting up
  hrSamples: number;      // how many HR points landed in the window
  source: string;
}

const METERS_PER_MILE = 1609.344;

export interface HrWindowResult { avgHR: number | null; maxHR: number | null; minHR: number | null; hrDrift: number | null; samples: number; }

// Core HR-window analysis, shared by walks (Phase 89) and strength sessions
// (Phase 90). avg / max / min bpm + drift (final-third avg − first-third avg,
// split by TIME so an uneven sample cadence doesn't bias it).
export function analyzeHrWindow(startMs: number, endMs: number, hr: HrSample[]): HrWindowResult {
  const win = hr
    .filter((s) => s && isFinite(s.t) && s.t >= startMs && s.t <= endMs && typeof s.bpm === "number" && s.bpm > 0)
    .sort((a, b) => a.t - b.t);
  if (!win.length) return { avgHR: null, maxHR: null, minHR: null, hrDrift: null, samples: 0 };
  const avgHR = Math.round(win.reduce((s, x) => s + x.bpm, 0) / win.length);
  const maxHR = win.reduce((m, x) => Math.max(m, x.bpm), 0);
  const minHR = win.reduce((m, x) => Math.min(m, x.bpm), Infinity);
  let hrDrift: number | null = null;
  const t0 = win[0].t, t1 = win[win.length - 1].t, span = t1 - t0;
  if (span > 0 && win.length >= 6) {
    const first = win.filter((x) => x.t <= t0 + span / 3);
    const last = win.filter((x) => x.t >= t0 + (2 * span) / 3);
    if (first.length && last.length) {
      const a1 = first.reduce((s, x) => s + x.bpm, 0) / first.length;
      const a3 = last.reduce((s, x) => s + x.bpm, 0) / last.length;
      hrDrift = Math.round(a3 - a1);
    }
  }
  return { avgHR, maxHR, minHR: minHR === Infinity ? null : minHR, hrDrift, samples: win.length };
}

// Analyse a single walk against the HR samples that fall in its window.
export function analyzeWalk(walk: WalkInput, hr: HrSample[]): WalkResult {
  const startMs = Date.parse(walk.start);
  const endMs = Date.parse(walk.end);
  const durationMin = (isFinite(startMs) && isFinite(endMs) && endMs > startMs)
    ? Math.round(((endMs - startMs) / 60000) * 10) / 10
    : null;
  const distanceM = (typeof walk.distanceM === "number" && walk.distanceM > 0) ? walk.distanceM : null;
  const paceMph = (distanceM != null && durationMin != null && durationMin > 0)
    ? Math.round(((distanceM / METERS_PER_MILE) / (durationMin / 60)) * 100) / 100
    : null;
  const h = analyzeHrWindow(startMs, endMs, hr);
  return {
    id: walk.id, day: walk.day, start: walk.start, end: walk.end,
    durationMin, distanceM, paceMph, avgHR: h.avgHR, maxHR: h.maxHR, hrDrift: h.hrDrift,
    hrSamples: h.samples, source: walk.source,
  };
}

// Analyse every walk against a timestamp→bpm map (Oura raw HR). Returns a map
// keyed by walk id so results merge/update in place across syncs.
export function analyzeAllWalks(walks: WalkInput[], hrMap: Record<string, number>): Record<string, WalkResult> {
  const samples: HrSample[] = [];
  for (const iso in hrMap) {
    const t = Date.parse(iso);
    const bpm = hrMap[iso];
    if (isFinite(t) && typeof bpm === "number" && bpm > 0) samples.push({ t, bpm });
  }
  samples.sort((a, b) => a.t - b.t);
  const out: Record<string, WalkResult> = {};
  for (const w of walks) {
    if (!w || !w.id) continue;
    // narrow the sample list to the walk window before analysing (cheap pre-filter)
    const startMs = Date.parse(w.start), endMs = Date.parse(w.end);
    const win = samples.filter((s) => s.t >= startMs && s.t <= endMs);
    out[w.id] = analyzeWalk(w, win);
  }
  return out;
}

// Is an Oura workout a walk? Oura sets activity === 'walking' for walks.
export function isWalkActivity(activity: any): boolean {
  return String(activity || "").toLowerCase() === "walking";
}
