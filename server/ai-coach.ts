import Anthropic from "@anthropic-ai/sdk";
import prisma from "./db";
import { decrypt } from "./crypto-util";
import { analyzeNutrition } from "./nutrition";
import { exerciseName, sessionTypeForDate } from "./programme-shared";

// Phase 46: upgraded 4.7 → 4.8 (drop-in; better at knowledge-work analysis and
// clearer writing — exactly what a coaching report needs). Forced tool_choice is
// kept for reliable structured output, so adaptive thinking is not enabled here
// (the two are incompatible on this SDK version).
export const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 5000;

function ukToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function daysAgoUK(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

function summarizeFoodDay(items: any[]): { kcal: number; p: number; c: number; f: number } {
  let kcal = 0, p = 0, c = 0, f = 0;
  for (const it of items || []) {
    kcal += +it.cals || 0; p += +it.protein || 0; c += +it.carbs || 0; f += +it.fat || 0;
  }
  return { kcal: Math.round(kcal), p: Math.round(p), c: Math.round(c), f: Math.round(f) };
}

// Phase 27: Mifflin-St Jeor BMR + activity factor estimate
function estimateTDEE(personal: any, currentWeightKg: number | null): { bmr: number; tdee: number } | null {
  if (!personal || !personal.age || !personal.heightCm || !personal.sex || !currentWeightKg) return null;
  const w = currentWeightKg, h = personal.heightCm, a = personal.age;
  // Mifflin-St Jeor
  const bmr = personal.sex === "female"
    ? 10 * w + 6.25 * h - 5 * a - 161
    : 10 * w + 6.25 * h - 5 * a + 5; // 'male' and 'other' default to male formula
  const af = { sedentary: 1.2, light: 1.375, moderate: 1.55, "very-active": 1.725 }[personal.activityLevel as string] || 1.375;
  return { bmr: Math.round(bmr), tdee: Math.round(bmr * af) };
}

// Phase 29: body comp helpers
function latestBodyComp(state: any): { weight: number | null; bf: number | null; lbm: number | null; fatMass: number | null; muscleMass: number | null; visceral: number | null; hydration: number | null; date: string | null } {
  const wl: any[] = state.weightLog || [];
  const bl: any[] = state.bfLog || [];
  const bc: any = state.bodyComp || {};
  const cw  = wl.length ? wl[wl.length - 1].weight : null;
  const cbf = bl.length ? bl[bl.length - 1].bf     : null;
  const lbm = (cw && cbf) ? Math.round(cw * (1 - cbf / 100) * 100) / 100 : null;
  const fatMass = (cw && cbf) ? Math.round(cw * (cbf / 100) * 100) / 100 : null;
  const bcDates = Object.keys(bc).sort();
  let muscleMass: number | null = null, visceral: number | null = null, hydration: number | null = null;
  for (let i = bcDates.length - 1; i >= 0; i--) {
    const e = bc[bcDates[i]] || {};
    if (muscleMass == null && e.muscleMass != null) muscleMass = e.muscleMass;
    if (visceral   == null && e.visceralFat != null) visceral   = e.visceralFat;
    if (hydration  == null && e.hydration  != null) hydration  = e.hydration;
    if (muscleMass != null && visceral != null && hydration != null) break;
  }
  const date = wl.length ? wl[wl.length - 1].date : (bl.length ? bl[bl.length - 1].date : null);
  return { weight: cw, bf: cbf, lbm, fatMass, muscleMass, visceral, hydration, date };
}

// Phase 30: aggregate stats over a date range
function periodStats(state: any, fromDate: string, toDate: string): {
  daysWithWeight: number;
  avgWeight: number | null;
  avgBF: number | null;
  trainingSessions: number;
  avgSleepHrs: number | null;
  avgSteps: number | null;
  avgActiveCal: number | null;
  avgTotalCal: number | null;
  avgFoodKcal: number | null;
  avgProtein: number | null;
} {
  const wl: any[] = (state.weightLog || []).filter((e: any) => e.date >= fromDate && e.date <= toDate);
  const bl: any[] = (state.bfLog     || []).filter((e: any) => e.date >= fromDate && e.date <= toDate);
  const sleepLog = state.sleepLog || {};
  const stepsLog = state.stepsLog || {};
  const calorieLog = state.calorieLog || {};
  const exLog = state.exLog || {};
  const foods = state.foods || {};

  const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 10) / 10 : null;
  const sleepHrs: number[] = [];
  const stepDays: number[] = [];
  const activeCals: number[] = [];
  const totalCals: number[] = [];
  const foodKcals: number[] = [];
  const proteins: number[] = [];
  let trainingSessions = 0;

  // iterate dates in range
  for (let d = new Date(fromDate); d <= new Date(toDate); d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const sl = sleepLog[key];
    if (sl?.hours != null) sleepHrs.push(sl.hours);
    if (stepsLog[key] != null) stepDays.push(stepsLog[key]);
    if (calorieLog[key]?.active != null) activeCals.push(calorieLog[key].active);
    if (calorieLog[key]?.total != null) totalCals.push(calorieLog[key].total);
    const dayFoods = foods[key] || [];
    if (dayFoods.length > 0) {
      let kcal = 0, p = 0;
      for (const f of dayFoods) { kcal += +f.cals || 0; p += +f.protein || 0; }
      foodKcals.push(Math.round(kcal));
      proteins.push(Math.round(p));
    }
    const session = exLog[key];
    if (session && Object.values(session).some((ex: any) => ex?.done)) trainingSessions++;
  }

  return {
    daysWithWeight: wl.length,
    avgWeight: wl.length ? Math.round((wl.reduce((s, e) => s + e.weight, 0) / wl.length) * 10) / 10 : null,
    avgBF:     bl.length ? Math.round((bl.reduce((s, e) => s + e.bf, 0) / bl.length) * 10) / 10 : null,
    trainingSessions,
    avgSleepHrs: avg(sleepHrs),
    avgSteps: avg(stepDays),
    avgActiveCal: avg(activeCals),
    avgTotalCal: avg(totalCals),
    avgFoodKcal: avg(foodKcals),
    avgProtein: avg(proteins),
  };
}

function bodyCompAtDate(state: any, date: string): { weight: number | null; bf: number | null; lbm: number | null; fatMass: number | null } {
  const wl: any[] = state.weightLog || [];
  const bl: any[] = state.bfLog || [];
  // pick closest entry on or before `date`
  const wOnBefore = [...wl].filter(e => e.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0];
  const bOnBefore = [...bl].filter(e => e.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0];
  const w = wOnBefore?.weight ?? null;
  const b = bOnBefore?.bf ?? null;
  const lbm = (w && b) ? Math.round(w * (1 - b / 100) * 100) / 100 : null;
  const fatMass = (w && b) ? Math.round(w * (b / 100) * 100) / 100 : null;
  return { weight: w, bf: b, lbm, fatMass };
}

// --- Phase 37: skin care context (server-side conflict engine + analytics) ---
function skinDueOnSrv(p: any, date: string): boolean {
  const freq = p.frequency || "daily";
  if (freq === "daily") return true;
  if (freq === "5x-week") { const dow = new Date(date + "T12:00:00").getDay(); return dow >= 1 && dow <= 5; }
  if (!p.startedDate) return true;
  const days = Math.round((new Date(date + "T12:00:00").getTime() - new Date(p.startedDate + "T12:00:00").getTime()) / 86400000);
  if (days < 0) return false;
  const step: Record<string, number> = { "every-2-days": 2, "every-3-days": 3, "every-4-days": 4, "weekly": 7 };
  return step[freq] ? (days % step[freq] === 0) : true;
}

function skinVisibleItemsSrv(products: any[], date: string): { items: Array<{ itemId: string; section: string }>; retinolNight: boolean } {
  const due = products.filter((p) => skinDueOnSrv(p, date));
  const retinolNight = due.some((p) => p.type === "retinol");
  const items: Array<{ itemId: string; section: string }> = [];
  for (const t of ["cleanser", "vitamin-c", "moisturizer", "spf"]) {
    const p = due.find((x) => (x.slot === "am" || x.slot === "both") && x.type === t);
    if (p) items.push({ itemId: `${p.id}_am`, section: "am" });
  }
  if (retinolNight) {
    for (const t of ["cleanser", "moisturizer", "retinol"]) {
      const p = due.find((x) => (x.slot === "pm" || x.slot === "both") && x.type === t);
      if (p) items.push({ itemId: `${p.id}_pm`, section: "pm" });
    }
    const cica = due.find((x) => x.id === "skn-cicaplast");
    if (cica) items.push({ itemId: `${cica.id}_pm`, section: "pm" });
  } else {
    const cl = due.find((x) => (x.slot === "pm" || x.slot === "both") && x.type === "cleanser");
    if (cl) items.push({ itemId: `${cl.id}_pm`, section: "pm" });
    const serums = due.filter((x) => x.slot === "pm" && x.type === "serum")
      .sort((a, b) => (parseFloat(a.concentration) || 0) - (parseFloat(b.concentration) || 0));
    for (const p of serums) items.push({ itemId: `${p.id}_pm`, section: "pm" });
    const m = due.find((x) => (x.slot === "pm" || x.slot === "both") && x.type === "moisturizer");
    if (m) items.push({ itemId: `${m.id}_pm`, section: "pm" });
    const h = due.find((x) => x.id === "skn-honeymask");
    if (h) items.push({ itemId: `${h.id}_pm`, section: "pm" });
  }
  return { items, retinolNight };
}

function buildSkinContext(state: any): string {
  const sc = state.skinCare || {};
  const products: any[] = Array.isArray(sc.products) ? sc.products : [];
  if (products.length === 0) return "";
  const log = state.skinCareLog || {};
  const L: string[] = [];
  const phase = sc.phase || 1;
  const ret = products.find((p) => p.type === "retinol");
  const retStart = ret?.frequencyStartedAt || ret?.startedDate;
  const weeksAtPhase = retStart ? ((Date.now() - new Date(retStart + "T12:00:00").getTime()) / (7 * 86400000)) : 0;

  L.push("SKIN CARE ROUTINE (review weekly):");
  L.push(`  Retinol phase: ${phase} of 6 · ${ret?.frequency || "?"} · ${weeksAtPhase.toFixed(1)} weeks at this frequency`);
  for (const p of products) {
    L.push(`  - [id:${p.id}] ${p.name}${p.concentration ? ` ${p.concentration}` : ""} · ${p.type} · ${p.slot} · ${p.frequency}`);
  }
  L.push("");

  // 14-day compliance
  let due = 0, done = 0, amDays = 0, pmDays = 0, streak = 0, bestStreak = 0, retDue = 0, retDone = 0;
  for (let i = 13; i >= 0; i--) {
    const d = daysAgoUK(i);
    const { items } = skinVisibleItemsSrv(products, d);
    if (items.length === 0) continue;
    const dlog = log[d] || {};
    const amItems = items.filter((it) => it.section === "am");
    const pmItems = items.filter((it) => it.section === "pm");
    let dayDone = 0;
    for (const it of items) { due++; if (dlog[it.itemId] === true) { done++; dayDone++; } }
    if (amItems.length && amItems.every((it) => dlog[it.itemId] === true)) amDays++;
    if (pmItems.length && pmItems.every((it) => dlog[it.itemId] === true)) pmDays++;
    if (dayDone === items.length) { streak++; bestStreak = Math.max(bestStreak, streak); } else streak = 0;
    if (ret && skinDueOnSrv(ret, d)) { retDue++; if (dlog[`${ret.id}_pm`] === true) retDone++; }
  }
  L.push("14-DAY COMPLIANCE:");
  L.push(`  Overall routine: ${due ? Math.round((done / due) * 100) : 0}% (${done}/${due} items)`);
  L.push(`  Retinol: ${retDue ? Math.round((retDone / retDue) * 100) : 0}% (${retDone}/${retDue} due nights)`);
  L.push(`  Full AM routine: ${amDays} days · Full PM routine: ${pmDays} days · Longest streak: ${bestStreak} days`);
  L.push("");

  // 14-day irritation
  const irr: Record<string, number> = { none: 0, "mild-dryness": 0, peeling: 0, redness: 0, burning: 0 };
  let mjCorr = 0;
  for (let i = 0; i < 14; i++) {
    const d = daysAgoUK(i);
    const dlog = log[d];
    if (!dlog) continue;
    const ir = dlog._irritation;
    if (ir && irr[ir] !== undefined) irr[ir]++;
    const dow = new Date(d + "T12:00:00").getDay();
    if (dow === 4 && (ir === "redness" || ir === "burning" || ir === "peeling")) mjCorr++;
  }
  L.push("14-DAY IRRITATION:");
  L.push(`  none ${irr.none} · mild-dryness ${irr["mild-dryness"]} · peeling ${irr.peeling} · redness ${irr.redness} · burning ${irr.burning}`);
  if (irr.burning > 0) L.push(`  ⚠️ BURNING logged ${irr.burning}× — HIGH PRIORITY. Instruct 5 rest days before resuming retinol.`);
  if (mjCorr > 0) L.push(`  ${mjCorr} irritation event(s) on Thursday (day after Mounjaro) — possible injection-sensitivity correlation`);
  L.push("");

  // Weekly journal — last 4
  const wci = sc.weeklyCheckIn || {};
  const jDates = Object.keys(wci).sort().reverse().slice(0, 4);
  if (jDates.length > 0) {
    L.push("WEEKLY SKIN JOURNAL (last 4 Sundays):");
    for (const jd of jDates) {
      const e = wci[jd];
      L.push(`  ${jd}: score ${e.score ?? "?"}/10 · trend ${e.trend ?? "?"}${e.notes ? ` · "${e.notes}"` : ""}`);
    }
    L.push("");
  }

  // Phase readiness
  const badIrr = irr.redness > 0 || irr.burning > 0;
  const retComplete = retDue > 0 ? (retDone / retDue) : 1;
  const reasons: string[] = [];
  if (weeksAtPhase < 3) reasons.push(`only ${weeksAtPhase.toFixed(1)} weeks at phase (need 3+)`);
  if (badIrr) reasons.push("redness/burning logged in last 14d");
  if (retComplete < 1) reasons.push(`retinol compliance ${Math.round(retComplete * 100)}% (need 100%)`);
  L.push("PHASE READINESS:");
  if (phase >= 6) L.push("  On tretinoin (phase 6).");
  else if (phase === 5) L.push(`  At final retinol phase (nightly).${weeksAtPhase >= 3 && !badIrr ? " 3+ weeks tolerated nightly with no redness — user may discuss tretinoin." : ""}`);
  else if (reasons.length === 0) L.push(`  READY to advance to phase ${phase + 1}. If appropriate, emit a "skincare-phase" suggestion.`);
  else L.push(`  NOT ready to advance: ${reasons.join("; ")}.`);

  return L.join("\n");
}

// Exercise id → display name now comes from the shared programme module
// (server/programme-shared.ts → public/programme-shared.js), the single source of
// truth. `exerciseName(id)` covers current + retired (legacy) ids and falls back
// to the raw id, so history never renders as "unknown".

// Phase 38: per-lift detailed history — last 4 sessions per exercise
// Phase 47: user-written training notes — per-exercise running notes (stick to
// the lift) + recent per-session notes. The coach factors these into advice.
function buildTrainingNotes(state: any): string {
  const exNotes = state.exerciseNotes || {};
  const exIds = Object.keys(exNotes).filter((k) => exNotes[k] && exNotes[k].note);
  const exLog = state.exLog || {};
  const sessNotes: Array<{ date: string; note: string }> = [];
  for (const d of Object.keys(exLog).sort().reverse()) {
    const n = exLog[d] && exLog[d]._session && exLog[d]._session.note;
    if (n) sessNotes.push({ date: d, note: n });
    if (sessNotes.length >= 5) break;
  }
  if (!exIds.length && !sessNotes.length) return "";
  const lines = ["TRAINING NOTES (user-written — factor into advice + per-exercise cues):"];
  for (const id of exIds) lines.push(`  ${id}: ${exNotes[id].note}${exNotes[id].source === "user" ? "" : " (coach-added)"}`);
  for (const s of sessNotes) lines.push(`  ${s.date} session: ${s.note}`);
  lines.push("");
  return lines.join("\n");
}

function buildTrainingDetail(state: any): string {
  const exLog = state.exLog || {};
  const dates = Object.keys(exLog).sort().reverse();
  const perEx: Record<string, Array<{ date: string; sets: any[]; effort?: string }>> = {};
  for (const date of dates) {
    const day = exLog[date] || {};
    for (const exId of Object.keys(day)) {
      if (exId.startsWith("_")) continue;
      const ex = day[exId];
      const sets = Array.isArray(ex?.sets) ? ex.sets.filter((s: any) => s.kg || s.reps || s.seconds) : [];
      if (sets.length === 0) continue;
      if (!perEx[exId]) perEx[exId] = [];
      if (perEx[exId].length < 4) perEx[exId].push({ date, sets, effort: ex.effort });
    }
  }
  const exIds = Object.keys(perEx);
  if (exIds.length === 0) return "";
  const lines: string[] = [];
  lines.push("TRAINING DETAIL (per-lift, last 4 sessions, newest first — read this to spot stalls, deloads, and rep progress):");
  for (const exId of exIds) {
    lines.push(`  ${exerciseName(exId)}:`);
    for (const h of perEx[exId]) {
      const setStr = h.sets.map((s: any) =>
        s.seconds ? `${s.seconds}s` : `${s.kg || "-"}×${s.reps || "-"}${s.effort ? `(${String(s.effort)[0]})` : ""}`
      ).join(", ");
      const restVals = h.sets.map((s: any) => s.actualRestSeconds).filter((r: any) => typeof r === "number" && r > 0);
      const restStr = restVals.length
        ? ` · ${Math.round(restVals.reduce((a: number, b: number) => a + b, 0) / restVals.length)}s avg rest`
        : "";
      lines.push(`    ${h.date}: ${setStr}${h.effort ? ` [overall: ${h.effort}]` : ""}${restStr}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

// Phase 38: pair each training session with the sleep + recovery that preceded it
function buildSleepPerformance(state: any): string {
  const exLog = state.exLog || {};
  const sleepLog = state.sleepLog || {};
  const recovery = state.recovery || {};
  const dates = Object.keys(exLog).sort().reverse();
  const rows: string[] = [];
  for (const date of dates) {
    if (rows.length >= 8) break;
    const day = exLog[date] || {};
    let volume = 0, sets = 0, tough = 0, easy = 0;
    for (const exId of Object.keys(day)) {
      if (exId.startsWith("_")) continue;
      const exSets = Array.isArray(day[exId]?.sets) ? day[exId].sets : [];
      for (const s of exSets) {
        if (!(s.kg || s.reps || s.seconds)) continue;
        sets++;
        volume += (parseFloat(s.kg) || 0) * (parseInt(s.reps, 10) || 0);
        if (s.effort === "tough") tough++;
        else if (s.effort === "easy") easy++;
      }
    }
    if (sets === 0) continue;
    const sl = sleepLog[date] || {};
    const hrs = sl.totalHours ?? sl.hours;
    const rec = recovery[date] || {};
    rows.push(`  ${date}: sleep ${hrs != null ? `${hrs}h` : "?"}${sl.deepMin != null ? ` (deep ${sl.deepMin}m, REM ${sl.remMin ?? "?"}m)` : ""}${rec.readiness != null ? ` · readiness ${rec.readiness}` : ""} → ${sets} sets, ${Math.round(volume)}kg volume${(tough || easy) ? `, ${tough} tough / ${easy} easy` : ""}`);
  }
  if (rows.length < 3) return "";
  return ["SLEEP VS PERFORMANCE CORRELATION (last " + rows.length + " sessions — does poor sleep precede weaker sessions?):", ...rows, ""].join("\n");
}

// Phase 39: nutrition system context — fasting, water, Mounjaro, protein distribution
// Phase 41: stretching/mobility compliance context (only emitted when stretchLog has data)
function buildStretchContext(state: any): string {
  const log = state.stretchLog || {};
  if (!log || typeof log !== "object" || Object.keys(log).length === 0) return "";

  const STRETCH_NAMES: Record<string, string> = {
    s1_childs_pose: "Child's Pose (AM)", s2_cat_cow: "Cat Cow", s3_hip_flexor: "Hip Flexor Stretch",
    s4_glute_bridge: "Glute Bridge Activation", s5_chest_stretch: "Doorway Chest Stretch",
    s6_thoracic_rotation: "Thoracic Rotation", s7_pelvic_tilt: "Pelvic Tilt", s8_hamstring_stretch: "Standing Hamstring Stretch",
    e1_childs_pose: "Child's Pose (PM)", e2_figure_four: "Figure Four Glute Stretch",
    e3_forward_fold: "Seated Forward Fold", e4_spinal_twist: "Supine Spinal Twist",
    e5_legs_up_wall: "Legs Up the Wall", e6_neck_rolls: "Neck Rolls", e7_deep_breathing: "4-7-8 Breathing",
    f1_hip_hinge: "Soft-Knee Hip Hinge", f2_hamstring: "Flat-Back Hamstring Stretch", f3_frog: "Frog Stretch",
    f4_frog_rock: "Frog Rocking", f5_straddle: "Straddle / Pancake Fold", f6_couch: "Couch Stretch",
    f7_runners_lunge: "Low Runner's Lunge", f8_split_slides: "Front Split Slides", f9_figure_four: "Figure-Four Glute Stretch (Flex)",
  };

  // Compliance over last 7d and prior 7d (for trend)
  function tally(start: number, span: number) {
    let mDone = 0, eDone = 0, fDone = 0;
    const skipCounts: Record<string, number> = {};
    const mDur: number[] = [], eDur: number[] = [], fDur: number[] = [];
    const mOnTime: number[] = [], eOnTime: number[] = [];
    for (let i = start; i < start + span; i++) {
      const d = daysAgoUK(i);
      const e = log[d] || {};
      if (e.morning?.completed) {
        mDone++;
        if (e.morning.startedAt && e.morning.completedAt) {
          mDur.push(Math.round((new Date(e.morning.completedAt).getTime() - new Date(e.morning.startedAt).getTime()) / 60000));
        }
        // morning on-time: started before 12:00
        if (e.morning.startedAt) {
          const h = new Date(e.morning.startedAt).getUTCHours(); // close enough for week-aggregate
          mOnTime.push(h < 12 ? 1 : 0);
        }
      }
      if (e.evening?.completed) {
        eDone++;
        if (e.evening.startedAt && e.evening.completedAt) {
          eDur.push(Math.round((new Date(e.evening.completedAt).getTime() - new Date(e.evening.startedAt).getTime()) / 60000));
        }
        if (e.evening.startedAt) {
          const h = new Date(e.evening.startedAt).getUTCHours();
          eOnTime.push(h >= 17 && h < 22 ? 1 : 0);
        }
      }
      if (e.flexibility?.completed) { // Phase 52: anytime routine — no on-time concept
        fDone++;
        if (e.flexibility.startedAt && e.flexibility.completedAt) {
          fDur.push(Math.round((new Date(e.flexibility.completedAt).getTime() - new Date(e.flexibility.startedAt).getTime()) / 60000));
        }
      }
      for (const arr of [e.morning?.skippedStretches, e.evening?.skippedStretches, e.flexibility?.skippedStretches]) {
        if (Array.isArray(arr)) for (const id of arr) skipCounts[id] = (skipCounts[id] || 0) + 1;
      }
    }
    const avg = (a: number[]) => a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null;
    const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
    return { mDone, eDone, fDone, skipCounts, mDur: avg(mDur), eDur: avg(eDur), fDur: avg(fDur), mOnTime: sum(mOnTime), eOnTime: sum(eOnTime) };
  }
  const cur = tally(0, 7);
  const prev = tally(7, 7);

  // Streaks
  function streakOf(type: "morning" | "evening" | "flexibility"): number {
    let s = 0;
    for (let i = 0; i < 400; i++) {
      const d = daysAgoUK(i);
      const e = (log[d] || {})[type];
      if (!e || !e.completed) { if (i === 0) continue; break; }
      s++;
    }
    return s;
  }
  const mStreak = streakOf("morning");
  const eStreak = streakOf("evening");
  const fStreak = streakOf("flexibility");

  // Most skipped (current 7d)
  let mostSkippedId = "", mostSkippedN = 0;
  for (const [id, n] of Object.entries(cur.skipCounts)) {
    if (n > mostSkippedN) { mostSkippedN = n; mostSkippedId = id; }
  }
  const mostSkippedName = mostSkippedId ? (STRETCH_NAMES[mostSkippedId] || mostSkippedId) : "—";

  const total = cur.mDone + cur.eDone + cur.fDone; // Phase 52: includes flexibility
  const possible = 21;
  const pct = Math.round((total / possible) * 100);
  const prevTotal = prev.mDone + prev.eDone + prev.fDone;
  const trend = total > prevTotal ? "improving" : total < prevTotal ? "declining" : (total === 0 && prevTotal === 0 ? "new" : "stable");

  const lines: string[] = [];
  lines.push("STRETCHING COMPLIANCE (mobility routines — last 7d):");
  lines.push("  Morning Routine (8 stretches, ~12 min):");
  lines.push(`    Days completed: ${cur.mDone}/7 · missed: ${7 - cur.mDone} · current streak: ${mStreak} day${mStreak === 1 ? "" : "s"}`);
  if (cur.mDur) lines.push(`    Avg session: ${cur.mDur} min · on-time (before 12pm): ${cur.mOnTime}/${cur.mDone}`);
  lines.push("  Evening Routine (7 stretches, ~15 min):");
  lines.push(`    Days completed: ${cur.eDone}/7 · missed: ${7 - cur.eDone} · current streak: ${eStreak} day${eStreak === 1 ? "" : "s"}`);
  if (cur.eDur) lines.push(`    Avg session: ${cur.eDur} min · on-time (17:00-22:00): ${cur.eOnTime}/${cur.eDone}`);
  lines.push("  Flexibility Routine (9 stretches, ~14 min · splits + forward fold; anytime, not before bed):");
  lines.push(`    Days completed: ${cur.fDone}/7 · missed: ${7 - cur.fDone} · current streak: ${fStreak} day${fStreak === 1 ? "" : "s"}`);
  if (cur.fDur) lines.push(`    Avg session: ${cur.fDur} min`);
  lines.push(`  Most skipped stretch: ${mostSkippedName}${mostSkippedN ? ` (${mostSkippedN}×)` : ""}`);
  lines.push(`  Combined: ${total}/${possible} sessions · ${pct}% compliance · trend vs last week: ${trend} (was ${prevTotal}/${possible})`);
  lines.push("");
  return lines.join("\n");
}

function buildNutritionContext(state: any): string {
  const lines: string[] = [];

  // Fasting compliance (14d)
  const fl = state.fastingLog || {};
  let maintained = 0, broken = 0, fastSum = 0, fastN = 0;
  const brokenDays: string[] = [];
  for (let i = 0; i < 14; i++) {
    const e = fl[daysAgoUK(i)];
    if (!e) continue;
    if (e.windowMaintained) maintained++;
    if (e.windowBroken) { broken++; brokenDays.push(daysAgoUK(i)); }
    if (typeof e.fastDurationHours === "number") { fastSum += e.fastDurationHours; fastN++; }
  }
  if (maintained || broken) {
    lines.push("FASTING COMPLIANCE (12:00-20:00 eating window, last 14d):");
    lines.push(`  Window maintained: ${maintained} days · broken: ${broken}`);
    if (fastN) lines.push(`  Average fast duration: ${(fastSum / fastN).toFixed(1)}h`);
    if (brokenDays.length) lines.push(`  Broken on: ${brokenDays.join(", ")} — check if a specific weekday recurs`);
    lines.push("");
  }

  // Water (7d)
  const wl = state.waterLog || {};
  let wSum = 0, wN = 0, wHit = 0, wLow: number | null = null, wHigh: number | null = null;
  for (let i = 0; i < 7; i++) {
    const e = wl[daysAgoUK(i)];
    if (!e) continue;
    wN++; wSum += e.total || 0;
    if ((e.total || 0) >= (e.target || 3000)) wHit++;
    if (wLow == null || e.total < wLow) wLow = e.total;
    if (wHigh == null || e.total > wHigh) wHigh = e.total;
  }
  if (wN) {
    lines.push("WATER INTAKE (last 7d, target 3000ml / 3500ml on gym days):");
    lines.push(`  Average: ${Math.round(wSum / wN)}ml/day · hit target ${wHit}/${wN} days · low ${wLow}ml · high ${wHigh}ml`);
    lines.push("");
  }

  // Mounjaro pattern (last 4 logged injections)
  const ml = state.mounjaroLog || {};
  const injDates = Object.keys(ml).filter((d) => ml[d] && ml[d].injected).sort().reverse().slice(0, 4);
  if (injDates.length) {
    lines.push(`MOUNJARO PATTERN (last ${injDates.length} injections):`);
    for (const d of injDates) {
      const e = ml[d];
      const fx = (e.sideEffects || []).join(", ") || "none logged";
      lines.push(`  ${d}: injected${e.injectionTime ? ` ${e.injectionTime}` : ""} · side effects: ${fx}${e.nauseaMode ? " · used nausea mode" : ""}`);
    }
    lines.push("");
  }

  // Protein distribution (7d, 40g/meal threshold)
  // Phase 41m fix: previous version averaged sum / n where n incremented every
  // day with any food logged — so a meal logged 2/7 days at 60g each showed up
  // as "17g average," conflating "meal composition is low protein" with "meal
  // wasn't logged most days." Split the two:
  //   - loggedDays = days the meal had ≥1 entry with mealId === m.id
  //   - avgWhenLogged = sum / loggedDays (real composition signal)
  const plan = state.mealPlan;
  if (plan && Array.isArray(plan.meals) && plan.meals.length) {
    let allHit = 0, dayN = 0;
    const mealStats: Record<string, { name: string; sum: number; loggedDays: number; totalDays: number; hitDays: number }> = {};
    for (const m of plan.meals.slice(0, 3)) {
      mealStats[m.id] = { name: m.name, sum: 0, loggedDays: 0, totalDays: 0, hitDays: 0 };
    }
    for (let i = 0; i < 7; i++) {
      const foods = (state.foods || {})[daysAgoUK(i)] || [];
      if (!foods.length) continue;
      dayN++;
      let hits = 0;
      for (const m of plan.meals.slice(0, 3)) {
        const entries = foods.filter((f: any) => f.mealId === m.id);
        const p = entries.reduce((s: number, f: any) => s + (+f.protein || 0), 0);
        mealStats[m.id].totalDays++;
        if (entries.length > 0) {
          mealStats[m.id].loggedDays++;
          mealStats[m.id].sum += p;
          if (p >= 40) { mealStats[m.id].hitDays++; hits++; }
        }
      }
      if (hits === 3) allHit++;
    }
    if (dayN) {
      lines.push("PROTEIN DISTRIBUTION (last 7d — 40g/meal triggers muscle protein synthesis, important at 52yo):");
      lines.push(`  Days all 3 meals hit 40g: ${allHit}/${dayN}`);
      for (const v of Object.values(mealStats)) {
        const avgWhenLogged = v.loggedDays ? Math.round(v.sum / v.loggedDays) : 0;
        const composition = v.loggedDays ? `avg ${avgWhenLogged}g when logged${avgWhenLogged >= 40 ? " ✓ above 40g threshold" : " — below 40g threshold"}` : "never logged this week";
        lines.push(`  ${v.name}: logged ${v.loggedDays}/${v.totalDays} days · ${composition}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// Phase 45: DEXA scans — ground truth for body composition. Where a Withings
// reading exists near the scan date, state the BIA offset so the coach can
// calibrate the daily noise against the gold standard.
function buildDexaContext(state: any): string {
  const scans = Array.isArray(state.dexaScans)
    ? [...state.dexaScans].filter((s: any) => s && s.date).sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))
    : [];
  if (!scans.length) return "";
  const nearWithings = (log: any[], date: string) => {
    if (!Array.isArray(log)) return null;
    const t = new Date(date + "T12:00:00").getTime();
    let best: any = null, bestDiff = Infinity;
    for (const e of log) {
      if (!e || e.source !== "withings" || !e.date) continue;
      const diff = Math.abs(new Date(e.date + "T12:00:00").getTime() - t);
      if (diff <= 3 * 86400000 && diff < bestDiff) { best = e; bestDiff = diff; }
    }
    return best;
  };
  const sign = (n: number) => (n >= 0 ? "+" : "") + (Math.round(n * 10) / 10);
  const lines = ["DEXA SCANS (gold standard — use to calibrate Withings BIA bias):"];
  for (const s of scans) {
    const parts: string[] = [];
    if (s.weight != null) parts.push(`weight ${s.weight}kg`);
    if (s.bodyFatPct != null) parts.push(`BF ${s.bodyFatPct}%`);
    if (s.fatMass != null) parts.push(`fat ${s.fatMass}kg`);
    if (s.leanMass != null) parts.push(`lean ${s.leanMass}kg`);
    if (s.vatCm2 != null) parts.push(`visceral (VAT) ${s.vatCm2}cm²`);
    if (s.tScore != null) parts.push(`bone T-score ${s.tScore}`);
    if (s.almi != null) parts.push(`ALMI ${s.almi}`);
    lines.push(`  ${s.date}${s.provider ? ` (${s.provider})` : ""}: ${parts.join(" · ")}`);
    const w = nearWithings(state.weightLog, s.date);
    const b = nearWithings(state.bfLog, s.date);
    const offs: string[] = [];
    if (w && s.weight != null && w.weight != null) offs.push(`Withings weight ${w.weight}kg (${w.date}) = ${sign(w.weight - s.weight)}kg vs DEXA`);
    if (b && s.bodyFatPct != null && b.bf != null) offs.push(`Withings BF ${b.bf}% (${b.date}) = ${sign(b.bf - s.bodyFatPct)}pp vs DEXA`);
    if (offs.length) lines.push(`    → BIA offset near this scan: ${offs.join(" · ")}`);
  }
  lines.push("");
  return lines.join("\n");
}

// Phase 45: tape measurements — hydration-immune trend data. Always emits
// (even when empty/stale) so the coach knows to nudge the user.
function buildTapeContext(state: any): string {
  const heightCm = state.profile?.personal?.heightCm;
  const sex = state.profile?.personal?.sex;
  const log = Array.isArray(state.measLog)
    ? state.measLog.filter((m: any) => m && m.date).sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))
    : [];
  const lines = ["TAPE MEASUREMENTS (immune to hydration noise — waist is the best visceral fat proxy):"];
  if (!log.length) {
    lines.push("  None logged yet — nudge the user: waist/chest/arms/thighs/neck takes 2 minutes (Saturday reminder is set).");
    lines.push("");
    return lines.join("\n");
  }
  const fmt = (m: any) => {
    const p: string[] = [];
    if (m.waist != null) p.push(`waist ${m.waist}cm`);
    if (m.chest != null) p.push(`chest ${m.chest}cm`);
    if (m.larm != null || m.rarm != null) p.push(`arms ${m.larm ?? "?"}/${m.rarm ?? "?"}cm`);
    if (m.lthigh != null || m.rthigh != null) p.push(`thighs ${m.lthigh ?? "?"}/${m.rthigh ?? "?"}cm`);
    if (m.neck != null) p.push(`neck ${m.neck}cm`);
    return p.join(" · ");
  };
  for (const m of log.slice(-10)) lines.push(`  ${m.date}: ${fmt(m)}`);
  const first = log[0];
  const latest = log[log.length - 1];
  const sign = (n: number) => (n >= 0 ? "+" : "") + (Math.round(n * 10) / 10);
  const delta = (a: any, b: any, field: string) => (a?.[field] != null && b?.[field] != null) ? `${field} ${sign(b[field] - a[field])}cm` : null;
  if (log.length >= 2) {
    const sinceFirst = ["waist", "chest", "larm", "rarm", "lthigh", "rthigh", "neck"].map((f) => delta(first, latest, f)).filter(Boolean);
    if (sinceFirst.length) lines.push(`  → Since first entry (${first.date}): ${sinceFirst.join(" · ")}`);
    const cutoff = new Date(latest.date + "T12:00:00");
    cutoff.setDate(cutoff.getDate() - 28);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const fourWkRef = [...log].reverse().find((m: any) => m.date <= cutoffStr);
    if (fourWkRef) {
      const last4w = ["waist", "chest", "larm", "rarm", "lthigh", "rthigh", "neck"].map((f) => delta(fourWkRef, latest, f)).filter(Boolean);
      if (last4w.length) lines.push(`  → Last ~4 weeks (since ${fourWkRef.date}): ${last4w.join(" · ")}`);
    }
  }
  if (latest.waist != null && heightCm) {
    const ratio = Math.round((latest.waist / heightCm) * 100) / 100;
    lines.push(`  → Waist-to-height ratio: ${ratio}${ratio >= 0.5 ? " — ABOVE the 0.5 health threshold, central fat is the priority" : " (below 0.5 ✓)"}`);
  }
  if (sex === "male" && latest.waist != null && latest.neck != null && heightCm && latest.waist > latest.neck) {
    const navyBF = 495 / (1.0324 - 0.19077 * Math.log10(latest.waist - latest.neck) + 0.15456 * Math.log10(heightCm)) - 450;
    lines.push(`  → US Navy BF estimate (neck+waist+height): ~${Math.round(navyBF * 10) / 10}% — rough cross-check only, compare direction against Withings and DEXA, not absolutes`);
  }
  const daysSince = Math.floor((Date.now() - new Date(latest.date + "T12:00:00").getTime()) / 86400000);
  if (daysSince > 21) lines.push(`  → STALE: last measurement ${daysSince} days ago — nudge the user to re-measure (it's the most reliable trend signal they have).`);
  lines.push("");
  return lines.join("\n");
}

// Phase 44: recovery-gate calibration — what actually happened each time the
// gate fired, so the coach can test whether readiness predicts performance for
// THIS user (shifted sleep schedules depress Oura readiness scores).
function buildCalibrationContext(state: any): string {
  const overrides = state.recoveryOverrides || {};
  const dates = Object.keys(overrides).sort().slice(-8);
  if (dates.length === 0) return "";
  const exLog = state.exLog || {};
  const injuries = Object.values(state.injuries || {}) as any[];
  const lines: string[] = [];
  lines.push("RECOVERY GATE CALIBRATION (each gate firing — readiness vs feel vs choice vs outcome):");
  let trained = 0, eased = 0;
  const trainedScores: number[] = [];
  for (const d of dates) {
    const ov: any = overrides[d] || {};
    const score = exLog[d]?._session?.score;
    const scoreStr = score?.pct != null
      ? `session score ${score.pct}% of 4w avg (vol ${score.volume})`
      : (score?.volume ? `vol ${score.volume}, no 4w baseline yet` : "no session logged");
    const mix = score?.effortMix && score.effortMix.rated > 0
      ? ` · effort ${score.effortMix.easy}easy/${score.effortMix.solid}solid/${score.effortMix.tough}tough`
      : "";
    const end = new Date(d + "T12:00:00");
    end.setDate(end.getDate() + 7);
    const endStr = end.toISOString().slice(0, 10);
    const injAfter = injuries
      .filter((j: any) => j?.createdAt && j.createdAt > d && j.createdAt <= endStr)
      .map((j: any) => j.name);
    if (ov.choice === "train") { trained++; if (score?.pct != null) trainedScores.push(score.pct); }
    if (ov.choice === "easy") eased++;
    const holds = ov.deloadHolds ? ` · held instead of deload: ${Object.keys(ov.deloadHolds).join(",")}` : "";
    lines.push(`  ${d}${ov.sessionType ? ` (${ov.sessionType})` : ""}: readiness ${ov.readiness ?? "?"}, HRV↓3d ${ov.hrvDown3d ? "yes" : "no"} · felt: ${ov.feel || "?"} · chose: ${ov.choice === "train" ? "TRAIN AS PLANNED" : ov.choice === "easy" ? "take it easy" : "?"} → ${scoreStr}${mix} · ${injAfter.length ? "⚠ injury flagged within 7d: " + injAfter.join(", ") : "no injury in following 7d"}${holds}`);
  }
  const avgTrained = trainedScores.length
    ? Math.round(trainedScores.reduce((a, b) => a + b, 0) / trainedScores.length)
    : null;
  lines.push(`  → Summary: gate fired ${dates.length}×, trained through ${trained}×, took it easy ${eased}×${avgTrained != null ? ` · avg session score when training through: ${avgTrained}%` : ""}`);
  lines.push("");
  return lines.join("\n");
}

export function buildContext(state: any): string {
  const today = ukToday();
  const cutoff14 = daysAgoUK(14);
  const cutoff7 = daysAgoUK(7);
  const profile = state.profile || {};
  const macros = profile.macros || {};
  const personal = profile.personal || {};
  const meds = Array.isArray(profile.medications) ? profile.medications : [];
  const bloodMarkers = Array.isArray(profile.bloodMarkers) ? profile.bloodMarkers : [];
  const recovery = state.recovery || {};
  const stepsLog = state.stepsLog || {};
  const calorieLog = state.calorieLog || {};
  const mealPlan = state.mealPlan;
  const bc = state.bodyComp || {};

  const wl = (state.weightLog || []).filter((e: any) => e.date >= cutoff14);
  const bl = (state.bfLog || []).filter((e: any) => e.date >= cutoff14);

  const foodDays: any[] = [];
  for (const date of Object.keys(state.foods || {}).sort()) {
    if (date < cutoff7) continue;
    foodDays.push({ date, ...summarizeFoodDay(state.foods[date]) });
  }

  // exLog[date][exerciseId] = { done: bool, sets: [{kg, reps, seconds, done?}, ...] }
  const exerciseDays: any[] = [];
  for (const date of Object.keys(state.exLog || {}).sort()) {
    if (date < cutoff7) continue;
    const exs = state.exLog[date] || {};
    // Phase 38: skip non-exercise keys (e.g. _session timing metadata)
    const exercises = Object.keys(exs).filter((k) => !k.startsWith("_")).map((k) => exs[k]) as any[];
    if (exercises.length === 0) continue;
    const doneExercises = exercises.filter((e) => e?.done).length;
    let setsLogged = 0;
    let totalVolume = 0;
    let timedSeconds = 0;
    for (const ex of exercises) {
      const sets = Array.isArray(ex?.sets) ? ex.sets : [];
      for (const s of sets) {
        const kg = parseFloat(s?.kg) || 0;
        const reps = parseInt(s?.reps, 10) || 0;
        const sec = parseInt(s?.seconds, 10) || 0;
        if (kg || reps || sec || s?.done) setsLogged++;
        if (kg && reps) totalVolume += kg * reps;
        if (sec) timedSeconds += sec;
      }
    }
    if (doneExercises === 0 && setsLogged === 0) continue;
    const parts = [`${doneExercises}/${exercises.length} exercises done`, `${setsLogged} sets`];
    if (totalVolume > 0) parts.push(`${Math.round(totalVolume)}kg volume`);
    if (timedSeconds > 0) parts.push(`${timedSeconds}s isometric`);
    exerciseDays.push({ date, summary: parts.join(", ") });
  }

  const sleepDays = Object.keys(state.sleepLog || {}).filter((d) => d >= cutoff7).sort().map((d) => {
    const s = state.sleepLog[d] || {};
    return {
      date: d,
      hours: s.totalHours ?? s.hours ?? null,
      score: s.score ?? null,
      remMin: s.remMin ?? null,
      deepMin: s.deepMin ?? null,
      lightMin: s.lightMin ?? null,
      awakeMin: s.awakeMin ?? null,
    };
  });

  // Phase 41m: fix — was reading the deprecated `state.supps`, which is empty,
  // so adherence has been 0/0 in every weekly report. Now reads the live
  // `state.supplements` and counts only supplements actually due that day.
  const supps = state.supplements || [];
  const suppLog = state.supplementLog || {};
  const suppAdherence: any[] = [];
  const suppPerId: Record<string, { name: string; taken: number; total: number; critical: boolean }> = {};
  for (const s of (supps as any[])) {
    suppPerId[s.id] = { name: s.name || s.id, taken: 0, total: 0, critical: !!s.critical };
  }
  for (let i = 0; i < 7; i++) {
    const d = daysAgoUK(i);
    const day = suppLog[d] || {};
    const dow = new Date(d + "T12:00:00").getDay();
    let taken = 0, dueToday = 0;
    for (const s of (supps as any[])) {
      // Skip weekly-Wednesday supplements when it isn't Wednesday
      if (s.frequency === "weekly-wednesday" && dow !== 3) continue;
      dueToday++;
      suppPerId[s.id].total++;
      if (day[s.id] === true) {
        taken++;
        suppPerId[s.id].taken++;
      }
    }
    suppAdherence.push({ date: d, taken, of: dueToday });
  }

  const currentWeight = wl.length ? wl[wl.length - 1].weight : profile.startWeight;
  const tdee = estimateTDEE(personal, currentWeight);

  const lines: string[] = [];
  lines.push(`Today (UK): ${today}`);
  lines.push("");
  lines.push("DEMOGRAPHICS + GOAL FRAMING:");
  lines.push(`  Age: ${personal.age ?? "(not set)"} · Height: ${personal.heightCm ?? "?"}cm · Sex (for BMR): ${personal.sex ?? "(not set)"} · Ethnicity: ${personal.ethnicity ?? "(not set)"}`);
  lines.push(`  Activity outside gym: ${personal.activityLevel ?? "(not set)"}`);
  lines.push(`  CURRENT PHASE: ${personal.phase ?? "(not specified — default behaviour: assume fat-loss cut)"}`);
  if (personal.targetLBMStretch) lines.push(`  STRETCH LBM GOAL: ${personal.targetLBMStretch}kg lean body mass (vs default target ${profile.targetLBM ?? "?"}kg). User wants to build muscle, not just lose fat — frame coaching toward the LBM ceiling.`);
  if (tdee) lines.push(`  Estimated BMR: ${tdee.bmr} kcal · TDEE (Mifflin-St Jeor × activity factor, excludes training): ${tdee.tdee} kcal/day`);
  else lines.push(`  TDEE estimate unavailable (demographics incomplete — coach should flag this if accuracy matters)`);
  lines.push("");
  lines.push("MEDICATIONS (factor these into interpretation):");
  if (meds.length === 0) lines.push("  (none recorded)");
  else for (const m of meds) lines.push(`  - ${m.name}${m.dose ? ` ${m.dose}` : ""}${m.schedule ? ` · ${m.schedule}` : ""}${m.notes ? ` · ${m.notes}` : ""}`);
  lines.push("");

  // Phase 57: health conditions — gate condition-specific coaching rules on
  // what's actually present in state, instead of asserting fixed facts in the prompt.
  const conditions = Array.isArray(profile.healthConditions) ? profile.healthConditions : [];
  lines.push("HEALTH CONDITIONS (apply the matching coaching rules ONLY for conditions listed here):");
  if (conditions.length === 0) lines.push("  (none recorded)");
  else for (const c of conditions) lines.push(`  - ${c.label || c.key || c.name}${c.notes ? ` — ${c.notes}` : ""}`);
  lines.push("");

  // Phase 57: existing reminders — so the coach never suggests a duplicate.
  const reminders = Array.isArray(state.reminders) ? state.reminders : [];
  lines.push("EXISTING REMINDERS (already configured — do NOT suggest adding one that duplicates these):");
  if (reminders.length === 0) lines.push("  (none configured)");
  else for (const r of reminders) lines.push(`  - ${r.time || "?"}${Array.isArray(r.days) && r.days.length ? ` [dow ${r.days.join(",")}]` : ""}: ${r.text || r.label || "(no text)"}${r.enabled === false ? " (disabled)" : ""}`);
  lines.push("");

  // Phase 29a: blood markers — clinical context for every coaching decision
  if (bloodMarkers.length > 0) {
    // Phase 55: panel-aware. Show ONLY the latest panel's markers (so multiple
    // panels don't duplicate/bloat), and annotate flagged markers with their most
    // recent earlier value for trend.
    const latestDate = bloodMarkers.reduce((d: string, m: any) => m.date && m.date > d ? m.date : d, "");
    const latest = latestDate ? bloodMarkers.filter((m: any) => m.date === latestDate) : bloodMarkers;
    const priorDates = Array.from(new Set(bloodMarkers.map((m: any) => m.date).filter((d: string) => d && d !== latestDate))).sort().reverse();
    const priorOf = (name: string): any => {
      const hits = bloodMarkers.filter((m: any) => m.name === name && m.date && m.date < latestDate)
        .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
      return hits[0] || null;
    };
    lines.push(`BLOOD MARKERS (latest panel: ${latestDate || "unknown date"}${priorDates.length ? `; ${priorDates.length} earlier panel(s) on ${priorDates.join(", ")} — trend the flagged markers` : ""}):`);
    const flagged: any[] = [];
    const inRange: any[] = [];
    for (const m of latest) {
      const v = m.value;
      if (v == null) continue;
      let status = "in range";
      if (m.refLow != null && v < m.refLow) status = "BELOW range";
      else if (m.refHigh != null && v > m.refHigh) status = "ABOVE range";
      if (status === "in range") inRange.push(m);
      else flagged.push({ ...m, status });
    }
    if (flagged.length > 0) {
      lines.push("  OUT OF RANGE (factor these into every recommendation):");
      for (const m of flagged) {
        const refStr = m.refLow != null && m.refHigh != null ? `${m.refLow}-${m.refHigh}` : m.refLow != null ? `>${m.refLow}` : m.refHigh != null ? `<${m.refHigh}` : "?";
        const p = priorOf(m.name);
        const trend = p && p.value != null ? ` (was ${p.value}${p.unit ? ` ${p.unit}` : ""} on ${p.date})` : "";
        lines.push(`    - ${m.name}: ${m.value}${m.unit ? ` ${m.unit}` : ""} [${m.status}, ref ${refStr}]${trend}${m.notes ? ` — ${m.notes}` : ""}`);
      }
    }
    if (inRange.length > 0) {
      const names = inRange.slice(0, 30).map((m: any) => `${m.name} ${m.value}${m.unit ? m.unit : ""}`).join(", ");
      lines.push(`  IN RANGE: ${names}${inRange.length > 30 ? `, +${inRange.length - 30} more` : ""}`);
    }
    lines.push("");
  }
  lines.push("PLAN PROFILE:");
  lines.push(`  Goal: ${profile.startWeight ?? "?"}kg @ ${profile.startBF ?? "?"}% BF → ${profile.targetWeight ?? "?"}kg @ ${profile.targetBF ?? "?"}% BF (LBM target ${profile.targetLBM ?? "?"}kg, visceral target ${profile.targetVisceralFat ?? "?"})`);
  lines.push(`  Plan start: ${profile.startDate || profile.planStartDate || "?"}`);
  lines.push(`  Daily targets: gym=${profile.calsGym ?? "?"}kcal, rest=${profile.calsRest ?? "?"}kcal`);
  lines.push(`  Macros: P=${macros.protein ?? "?"}g, C=${macros.carbs ?? "?"}g, F=${macros.fat ?? "?"}g`);
  if (profile.eatingWindow) lines.push(`  Eating window: ${profile.eatingWindow}`);
  if (state.trainingStartDate) lines.push(`  Training anchor: ${state.trainingStartDate} (Upper/Rest/Lower/Rest 4-day cycle)`);
  lines.push("");

  lines.push("WEIGHT (last 14d):");
  if (wl.length === 0) lines.push("  (no entries)");
  else for (const e of wl) lines.push(`  ${e.date}: ${e.weight}kg${e.source ? ` (${e.source})` : ""}`);
  lines.push("");

  lines.push("BODY FAT (last 14d):");
  if (bl.length === 0) lines.push("  (no entries)");
  else for (const e of bl) lines.push(`  ${e.date}: ${e.bf}%${e.source ? ` (${e.source})` : ""}`);
  lines.push("");

  // Phase 29: body composition trends — most important section for LBM preservation
  const cur = latestBodyComp(state);
  const past7 = bodyCompAtDate(state, daysAgoUK(7));
  const past14 = bodyCompAtDate(state, daysAgoUK(14));
  lines.push("BODY COMPOSITION (current + deltas — CRITICAL for fat-loss-with-LBM-preservation goal):");
  lines.push(`  Current: ${cur.weight ?? "?"}kg total · ${cur.bf ?? "?"}% BF · ${cur.lbm ?? "?"}kg LBM · ${cur.fatMass ?? "?"}kg fat mass`);
  if (cur.muscleMass != null) lines.push(`  Muscle mass (Withings): ${cur.muscleMass}kg`);
  if (cur.visceral != null)   lines.push(`  Visceral fat: ${cur.visceral} (lower is better; user has South Asian threshold context if set)`);
  if (cur.hydration != null)  lines.push(`  Hydration: ${cur.hydration}kg (rough indicator only)`);
  if (past7.weight != null && cur.weight != null) {
    const dw = (cur.weight - past7.weight).toFixed(2);
    const dlbm = (past7.lbm != null && cur.lbm != null) ? (cur.lbm - past7.lbm).toFixed(2) : "?";
    const dfat = (past7.fatMass != null && cur.fatMass != null) ? (cur.fatMass - past7.fatMass).toFixed(2) : "?";
    lines.push(`  7-day delta: weight ${dw}kg · LBM ${dlbm}kg · fat mass ${dfat}kg`);
  }
  if (past14.weight != null && cur.weight != null) {
    const dw = (cur.weight - past14.weight).toFixed(2);
    const dlbm = (past14.lbm != null && cur.lbm != null) ? (cur.lbm - past14.lbm).toFixed(2) : "?";
    const dfat = (past14.fatMass != null && cur.fatMass != null) ? (cur.fatMass - past14.fatMass).toFixed(2) : "?";
    lines.push(`  14-day delta: weight ${dw}kg · LBM ${dlbm}kg · fat mass ${dfat}kg`);
  }
  lines.push("");

  lines.push("FOOD INTAKE (last 7d, daily totals):");
  if (foodDays.length === 0) lines.push("  (no entries)");
  else for (const d of foodDays) lines.push(`  ${d.date}: ${d.kcal}kcal P${d.p} C${d.c} F${d.f}`);
  lines.push("");

  lines.push("TRAINING (last 7d, exercise:done/total sets):");
  if (exerciseDays.length === 0) lines.push("  (no sessions)");
  else for (const d of exerciseDays) lines.push(`  ${d.date}: ${d.summary}`);
  lines.push("");

  lines.push("SLEEP (last 7d, stages in minutes — REM/deep matter more than total hours):");
  if (sleepDays.length === 0) lines.push("  (no entries)");
  else for (const s of sleepDays) {
    const stages = (s.remMin != null || s.deepMin != null)
      ? ` · REM ${s.remMin ?? "?"}m · deep ${s.deepMin ?? "?"}m · light ${s.lightMin ?? "?"}m · awake ${s.awakeMin ?? "?"}m`
      : " (stages not captured)";
    lines.push(`  ${s.date}: ${s.hours != null ? `${s.hours}h` : "?"}${s.score != null ? ` score=${s.score}` : ""}${stages}`);
  }
  lines.push("");

  // Phase 41i: cardio compliance (zone-2 sessions logged separately from gym training)
  const cardioLog = state.cardioLog || {};
  let cardioSessions7 = 0, cardioMinutes7 = 0, cardioHrSum = 0, cardioHrN = 0, restDayCount = 0, nonRestCount = 0;
  for (let i = 0; i < 7; i++) {
    const d = daysAgoUK(i);
    const e = cardioLog[d];
    if (!e || !e.duration) continue;
    cardioSessions7++;
    cardioMinutes7 += +e.duration || 0;
    if (typeof e.avgHr === "number") { cardioHrSum += e.avgHr; cardioHrN++; }
    // Determine if this date was a training day, honouring the user's programme
    // (delegates to the shared schedule — no hardcoded upper/lower cycle).
    const programId = state.profile?.programId || "upper-lower-4d";
    const wasTrainingDay = sessionTypeForDate(programId, d, state.trainingStartDate) !== null;
    if (wasTrainingDay) nonRestCount++; else restDayCount++;
  }
  if (cardioSessions7 > 0 || cardioLog && Object.keys(cardioLog).length > 0) {
    lines.push("CARDIO COMPLIANCE (zone-2 / steady-state sessions, last 7d — target 3 on rest days):");
    lines.push(`  Sessions: ${cardioSessions7}/3 · Total: ${cardioMinutes7} min${cardioHrN ? ` · Avg HR: ${Math.round(cardioHrSum / cardioHrN)} bpm` : ""}`);
    lines.push(`  On rest days: ${restDayCount} · on training days: ${nonRestCount} (rest-day scheduling is preferred — interference risk if cardio piled onto lifting days)`);
    lines.push("");
  }

  // Phase 41l: blood pressure — only emit if at least one reading
  const bpLog = Array.isArray(state.bpLog) ? state.bpLog : [];
  if (bpLog.length > 0) {
    const cutoff7 = daysAgoUK(7);
    const cutoff14 = daysAgoUK(14);
    const last7 = bpLog.filter((r: any) => r && r.date >= cutoff7 && r.systolic && r.diastolic);
    const last14 = bpLog.filter((r: any) => r && r.date >= cutoff14 && r.systolic && r.diastolic);
    const avg = (rows: any[]) => {
      if (!rows.length) return null;
      return {
        s: Math.round(rows.reduce((a, b) => a + b.systolic, 0) / rows.length),
        d: Math.round(rows.reduce((a, b) => a + b.diastolic, 0) / rows.length),
        n: rows.length,
      };
    };
    const a7 = avg(last7);
    const a14 = avg(last14);
    const sorted = [...bpLog].sort((a: any, b: any) => ((a.date || "") + (a.time || "")).localeCompare((b.date || "") + (b.time || "")));
    const latest = sorted[sorted.length - 1];
    // Best + worst in last 14d
    let best: any = null, worst: any = null;
    for (const r of last14) {
      if (!best || r.systolic < best.systolic) best = r;
      if (!worst || r.systolic > worst.systolic) worst = r;
    }
    lines.push("BLOOD PRESSURE (LVH context — target <130/80):");
    if (a7) lines.push(`  7-day avg: ${a7.s}/${a7.d} (n=${a7.n})${a7.s >= 130 || a7.d >= 80 ? " — ABOVE target" : " — within target"}`);
    if (a14) lines.push(`  14-day avg: ${a14.s}/${a14.d} (n=${a14.n})`);
    if (latest) lines.push(`  Latest: ${latest.systolic}/${latest.diastolic}${latest.pulse ? ` · pulse ${latest.pulse}` : ""} on ${latest.date} ${latest.time || ""}${latest.notes ? ` — "${latest.notes}"` : ""}`);
    if (best && worst && best.id !== worst.id) {
      lines.push(`  Range last 14d: best ${best.systolic}/${best.diastolic}${best.notes ? ` ("${best.notes}")` : ""} · worst ${worst.systolic}/${worst.diastolic}${worst.notes ? ` ("${worst.notes}")` : ""}`);
    }
    lines.push("");
  }

  // Phase 41h: VO2 max — cardio fitness trend (only emit if Oura supplied data)
  const vo2log = state.vo2maxLog || {};
  const vo2Dates = Object.keys(vo2log).filter((d) => typeof vo2log[d]?.vo2 === "number").sort();
  if (vo2Dates.length > 0) {
    const cur = vo2log[vo2Dates[vo2Dates.length - 1]].vo2;
    const cutoff14d = daysAgoUK(14);
    const last14 = vo2Dates.filter((d) => d >= cutoff14d);
    const delta = last14.length >= 2 ? (vo2log[last14[last14.length - 1]].vo2 - vo2log[last14[0]].vo2) : null;
    lines.push("CARDIO FITNESS (Oura VO₂ max):");
    lines.push(`  Current: ${cur} ml/kg/min · 14-day Δ: ${delta != null ? (delta >= 0 ? "+" : "") + delta.toFixed(1) : "—"}`);
    lines.push("  Norms (male 50-59): <26 Poor · 26-30 Fair · 31-35 Average · 36-40 Good · 41-44 Excellent · 45+ Superior");
    lines.push("");
  }

  lines.push("RECOVERY (Oura last 7d, scores 0-100; rising HRV + falling RHR = recovering well):");
  let anyRec = false;
  for (let i = 6; i >= 0; i--) {
    const d = daysAgoUK(i);
    const r = recovery[d];
    if (!r) continue;
    anyRec = true;
    const parts = [];
    if (r.readiness != null) parts.push(`readiness=${r.readiness}`);
    if (r.hrv != null) parts.push(`hrv=${r.hrv}`);
    if (r.restingHR != null) parts.push(`rhr=${r.restingHR}`);
    lines.push(`  ${d}: ${parts.join(" · ") || "(no data)"}`);
  }
  if (!anyRec) lines.push("  (no Oura recovery data)");
  lines.push("");

  lines.push("SUPPLEMENT ADHERENCE (last 7d, taken/total — counts only supplements due that day):");
  for (const a of suppAdherence) lines.push(`  ${a.date}: ${a.taken}/${a.of}`);
  // Phase 41m: per-supplement breakdown so suggestions can name specific items
  const perIdList = Object.values(suppPerId).filter((s) => s.total > 0);
  if (perIdList.length > 0) {
    const lowSupps = perIdList.filter((s) => s.taken / s.total < 0.5);
    const highSupps = perIdList.filter((s) => s.taken / s.total >= 0.8);
    if (lowSupps.length > 0) {
      lines.push("  Below 50%: " + lowSupps.map((s) => `${s.name} ${s.taken}/${s.total}${s.critical ? " ⚠️ CRITICAL" : ""}`).join(" · "));
    }
    if (highSupps.length > 0) {
      lines.push("  Above 80%: " + highSupps.map((s) => `${s.name} ${s.taken}/${s.total}`).join(" · "));
    }
  }
  lines.push("");

  // Phase 39: nutrition system blocks (fasting / water / Mounjaro / protein distribution)
  const nutritionBlock = buildNutritionContext(state);
  if (nutritionBlock) lines.push(nutritionBlock);

  // Phase 41: stretching / mobility compliance block (between Recovery and Skin Care)
  const stretchBlock = buildStretchContext(state);
  if (stretchBlock) lines.push(stretchBlock);

  // Phase 44: recovery-gate calibration — gate firings vs choices vs outcomes
  const calibrationBlock = buildCalibrationContext(state);
  if (calibrationBlock) lines.push(calibrationBlock);

  // Phase 45: DEXA ground truth + tape measurements (tape always emits — it
  // carries the empty/stale nudge)
  const dexaBlock = buildDexaContext(state);
  if (dexaBlock) lines.push(dexaBlock);
  lines.push(buildTapeContext(state));

  // Phase 29 + 30: Oura activity. NOTE: total_calories ≈ TDEE (BMR + active);
  // active_calories alone is just movement burn above BMR. Use total for TDEE.
  lines.push("DAILY ACTIVITY (last 7d, Oura):");
  let totalCalSum = 0, totalCalDays = 0;
  let activeCalSum = 0, activeCalDays = 0;
  for (let i = 6; i >= 0; i--) {
    const d = daysAgoUK(i);
    const steps = stepsLog[d];
    const cals = calorieLog[d];
    const parts: string[] = [];
    if (steps != null) parts.push(`${steps} steps`);
    if (cals?.total != null) { parts.push(`${cals.total} total kcal (TDEE)`); totalCalSum += cals.total; totalCalDays++; }
    if (cals?.active != null) { parts.push(`${cals.active} active kcal`); activeCalSum += cals.active; activeCalDays++; }
    if (parts.length === 0) continue;
    lines.push(`  ${d}: ${parts.join(" · ")}`);
  }
  if (totalCalDays > 0)  lines.push(`  → 7-day avg TOTAL calories (= Oura TDEE estimate): ${Math.round(totalCalSum / totalCalDays)} kcal/day — use this as primary TDEE`);
  if (activeCalDays > 0) lines.push(`  → 7-day avg ACTIVE calories (movement above BMR only): ${Math.round(activeCalSum / activeCalDays)} kcal/day`);
  lines.push("");

  // Phase 30: SINCE START — current vs plan start absolute progress
  const startDate = profile.startDate || profile.planStartDate;
  if (startDate && profile.startWeight) {
    const cwNow = cur.weight;
    const cbfNow = cur.bf;
    const startW = profile.startWeight;
    const startBF = profile.startBF;
    const startLBM = profile.startLBM;
    const weeksIn = Math.max(0.1, (Date.now() - new Date(startDate + "T12:00:00").getTime()) / (7 * 86400000));
    const dW   = (cwNow != null && startW != null) ? cwNow - startW : null;
    const dBF  = (cbfNow != null && startBF != null) ? cbfNow - startBF : null;
    const dLBM = (cur.lbm != null && startLBM != null) ? cur.lbm - startLBM : null;
    lines.push(`SINCE PLAN START (${startDate}, ${weeksIn.toFixed(1)} weeks in):`);
    if (dW != null)  lines.push(`  Weight: ${startW}kg → ${cwNow}kg (${dW.toFixed(1)}kg, ${(dW / weeksIn).toFixed(2)}kg/wk)`);
    if (dBF != null) lines.push(`  Body fat: ${startBF}% → ${cbfNow}% (${dBF > 0 ? "+" : ""}${dBF.toFixed(1)}pp)`);
    if (dLBM != null) lines.push(`  LBM: ${startLBM}kg → ${cur.lbm}kg (${dLBM > 0 ? "+" : ""}${dLBM.toFixed(2)}kg) — preservation status: ${Math.abs(dLBM) < 0.5 ? "EXCELLENT" : dLBM > 0 ? "GAINING" : dLBM > -1 ? "minor loss" : "concerning loss"}`);
    lines.push("");
  }

  // Phase 30: WEEK-OVER-WEEK comparison — last 7 days vs the 7 days before
  const wk0From = daysAgoUK(6),  wk0To = ukToday();
  const wk1From = daysAgoUK(13), wk1To = daysAgoUK(7);
  const wk0 = periodStats(state, wk0From, wk0To);
  const wk1 = periodStats(state, wk1From, wk1To);
  lines.push("WEEK-OVER-WEEK (last 7d vs the 7d before — did the trend accelerate, hold, or slow?):");
  const wowRow = (label: string, k: keyof typeof wk0, unit: string) => {
    const a = wk0[k] as number | null;
    const b = wk1[k] as number | null;
    if (a == null && b == null) return;
    const delta = (a != null && b != null) ? a - b : null;
    const sign = delta != null ? (delta >= 0 ? "+" : "") : "";
    lines.push(`  ${label}: this week ${a ?? "—"}${unit}, last week ${b ?? "—"}${unit}${delta != null ? ` (Δ ${sign}${delta.toFixed(unit ? 1 : 0)})` : ""}`);
  };
  wowRow("Avg weight",          "avgWeight",        "kg");
  wowRow("Avg body fat",        "avgBF",            "%");
  wowRow("Training sessions",   "trainingSessions", "");
  wowRow("Avg sleep",           "avgSleepHrs",      "h");
  wowRow("Avg steps",           "avgSteps",         "");
  wowRow("Avg TDEE (total kcal)", "avgTotalCal",    " kcal");
  wowRow("Avg food intake",     "avgFoodKcal",      " kcal");
  wowRow("Avg protein",         "avgProtein",       "g");
  lines.push("");

  // Phase 30: MONTHLY ARC — last 30d vs prior 30d (only if data exists)
  const m0From = daysAgoUK(29), m0To = ukToday();
  const m1From = daysAgoUK(59), m1To = daysAgoUK(30);
  const m0 = periodStats(state, m0From, m0To);
  const m1 = periodStats(state, m1From, m1To);
  if (m1.daysWithWeight > 0 || m1.trainingSessions > 0) {
    lines.push("MONTHLY ARC (last 30d vs prior 30d — long-term momentum check):");
    const mowRow = (label: string, k: keyof typeof m0, unit: string) => {
      const a = m0[k] as number | null;
      const b = m1[k] as number | null;
      if (a == null && b == null) return;
      const delta = (a != null && b != null) ? a - b : null;
      const sign = delta != null ? (delta >= 0 ? "+" : "") : "";
      lines.push(`  ${label}: last 30d ${a ?? "—"}${unit}, prior 30d ${b ?? "—"}${unit}${delta != null ? ` (Δ ${sign}${delta.toFixed(unit ? 1 : 0)})` : ""}`);
    };
    mowRow("Avg weight",        "avgWeight",        "kg");
    mowRow("Avg body fat",      "avgBF",            "%");
    mowRow("Training sessions", "trainingSessions", "");
    mowRow("Avg sleep",         "avgSleepHrs",      "h");
    mowRow("Avg TDEE",          "avgTotalCal",      " kcal");
    mowRow("Avg food intake",   "avgFoodKcal",      " kcal");
    mowRow("Avg protein",       "avgProtein",       "g");
    lines.push("");
  }

  // Phase 29: meal-plan adherence
  if (mealPlan?.meals?.length) {
    lines.push("MEAL PLAN ADHERENCE (last 7d — % of planned meals + ingredients actually logged):");
    const plannedMeals = mealPlan.meals;
    for (let i = 6; i >= 0; i--) {
      const d = daysAgoUK(i);
      const dayFoods: any[] = (state.foods || {})[d] || [];
      let mealsLogged = 0, ingsLogged = 0, ingsPlanned = 0;
      for (const m of plannedMeals) {
        const ings = Array.isArray(m.ingredients) ? m.ingredients : [];
        ingsPlanned += ings.length;
        const granular = dayFoods.filter(f => f.mealId === m.id);
        const legacy = dayFoods.find(f => f.name === m.name && !f.mealId);
        if (granular.length > 0 || legacy) mealsLogged++;
        if (granular.length > 0) {
          const ln = new Set(granular.map(f => f.name));
          ingsLogged += ings.filter((ing: any) => ln.has(ing.name)).length;
        } else if (legacy) {
          ingsLogged += ings.length;
        }
      }
      const mealPct = plannedMeals.length ? Math.round((mealsLogged / plannedMeals.length) * 100) : 0;
      const ingPct  = ingsPlanned ? Math.round((ingsLogged / ingsPlanned) * 100) : 0;
      lines.push(`  ${d}: ${mealsLogged}/${plannedMeals.length} meals (${mealPct}%) · ${ingsLogged}/${ingsPlanned} ingredients (${ingPct}%)`);
    }
    lines.push("");
  }

  // Phase 29: training effort distribution
  lines.push("TRAINING EFFORT (last 7d, % of logged sets tagged easy/solid/tough):");
  let easyCount = 0, solidCount = 0, toughCount = 0, totalTagged = 0;
  for (const date of Object.keys(state.exLog || {}).sort()) {
    if (date < cutoff7) continue;
    const exs = state.exLog[date] || {};
    for (const ex of Object.values(exs) as any[]) {
      const sets = Array.isArray(ex?.sets) ? ex.sets : [];
      for (const s of sets) {
        if (s?.effort === "easy")  { easyCount++; totalTagged++; }
        else if (s?.effort === "solid") { solidCount++; totalTagged++; }
        else if (s?.effort === "tough") { toughCount++; totalTagged++; }
      }
    }
  }
  if (totalTagged === 0) lines.push("  (no effort tags in last 7d — user is not rating sets)");
  else {
    const p = (n: number) => Math.round((n / totalTagged) * 100);
    lines.push(`  ${totalTagged} tagged sets: easy ${p(easyCount)}% · solid ${p(solidCount)}% · tough ${p(toughCount)}%`);
    lines.push(`  → ${easyCount > toughCount * 2 ? "Skewed easy — could push harder" : toughCount > easyCount * 2 ? "Skewed tough — possible under-recovery or weight too high" : "Balanced effort distribution"}`);
  }
  lines.push("");

  // Phase 38: active injuries
  const activeInjuries = Object.values(state.injuries || {}).filter((j: any) => j && j.status !== "resolved");
  if (activeInjuries.length > 0) {
    lines.push("ACTIVE INJURIES (loads on affected lifts are auto-reduced — factor recovery, deloads and form into advice):");
    for (const j of activeInjuries as any[]) {
      const exNames = (j.affectedExercises || []).map((id: string) => exerciseName(id)).join(", ");
      lines.push(`  - ${j.name} (${j.severity}${j.bodyPart ? `, ${j.bodyPart}` : ""})${exNames ? ` — affects: ${exNames}` : ""}${j.notes ? ` · "${j.notes}"` : ""}`);
    }
    lines.push("");
  }

  // Phase 38: per-lift detail + sleep/performance correlation
  const trainingDetail = buildTrainingDetail(state);
  if (trainingDetail) lines.push(trainingDetail);
  const sleepPerf = buildSleepPerformance(state);
  if (sleepPerf) lines.push(sleepPerf);
  // Phase 47: user-written training notes (per-exercise running + per-session)
  const trainingNotes = buildTrainingNotes(state);
  if (trainingNotes) lines.push(trainingNotes);

  // Phase 37: skin care routine — enhanced context block
  const skinBlock = buildSkinContext(state);
  if (skinBlock) lines.push(skinBlock, "");

  // Phase 29: previous coaching reports (memory)
  const prevReports = (state.coachingReports || []).slice(0, 4);
  if (prevReports.length > 0) {
    lines.push("PREVIOUS REPORTS (your last 4 — reference them to build on advice, don't repeat yourself):");
    for (const r of prevReports) {
      const dt = (r.createdAt || "").slice(0, 10);
      lines.push(`  [${dt}] "${r.title}"`);
      // Trim content to a digestible summary
      const contentPreview = String(r.content || "").replace(/\s+/g, " ").slice(0, 400);
      lines.push(`    Content: ${contentPreview}${contentPreview.length >= 400 ? "..." : ""}`);
      if (Array.isArray(r.suggestions) && r.suggestions.length > 0) {
        const applied = r.suggestions.filter((s: any) => s.applied);
        const dismissed = r.suggestions.filter((s: any) => s.dismissed);
        const pending = r.suggestions.filter((s: any) => !s.applied && !s.dismissed);
        lines.push(`    Suggestions: ${applied.length} applied, ${dismissed.length} dismissed, ${pending.length} pending`);
        for (const s of applied)   lines.push(`      ✓ APPLIED  · ${s.type} · ${s.label}`);
        for (const s of dismissed) lines.push(`      ✕ DISMISSED · ${s.type} · ${s.label}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are Forge's weekly coach. You write concise, specific, actionable weekly reviews for a user on a structured fat-loss / recomp plan. This is a serious medical context — coaching must be evidence-based, conservative and medically aware. All personal, medical and demographic facts come from the CONTEXT below — never assume details that aren't provided.

COACHING PRINCIPLES (apply every report):
1. Fat loss with maximum muscle preservation is the goal — not just scale weight.
2. If the user is diabetic / pre-diabetic (see BLOOD MARKERS), HbA1c improvement matters as much as weight.
3. Every suggestion must account for the medical conditions, medications and injuries shown in the context.
4. Never recommend anything that could worsen a flagged cardiac condition (e.g. LVH).
5. Never recommend alcohol when liver markers (ALT) are elevated.
6. Account for GLP-1 medication side effects on and after injection day.
7. Progressive overload is non-negotiable for muscle preservation.
8. Sleep is usually the highest-leverage unresolved lever — address it whenever the data shows a gap.
9. Respect active injuries — never push load on an injured lift.
10. Be respectful of the user's stated values and lifestyle.

TONE: Direct and practical — no waffle. Acknowledge wins before addressing gaps. Honest about concerns, never sugar-coat. Always cite specific numbers. Keep medical advice conservative — frame as "consistent with X, discuss with your GP", never a diagnosis.

THE USER'S GOAL (read every report through this lens):
- Read the user's CURRENT PHASE from the DEMOGRAPHICS block:
  * cut          → fat loss with LBM preservation. Target LBM ≈ current LBM.
  * recomp       → simultaneous fat loss + small LBM gain. Slow deficit (~10-15%), high protein, hard training.
  * lean-bulk    → controlled surplus (~10-15%). Slow LBM gain (~0.3kg/month max for trained users past 50). Watch fat gain.
  * maintenance  → hold current. Recovery + small recomposition.
  * If phase not set: assume cut.
- If the user has a STRETCH LBM GOAL set, the long-arc objective is "maximum lean mass at target BF%", not just hitting weight + BF numbers. Frame multi-month strategy through this lens — current phase is one step toward the LBM ceiling.
- The single most important metric every week is the LBM delta. If LBM drops > 0.3kg/week for 2+ weeks running, flag it URGENTLY. Likely cause: deficit too aggressive, protein too low, or training stimulus too low.
- Never credit "weight loss" without checking LBM. "Down 1.1kg this week" is meaningless until you know fat-mass-delta vs LBM-delta. Report both.
- BODY-COMP RECONCILIATION (Phase 46): the user may have THREE body-composition sources, in descending trust: DEXA (gold standard / ground truth) > TAPE MEASUREMENTS (immune to hydration noise; waist is the best visceral-fat proxy) > Withings (BIA — noisy day-to-day, trust only 7-day averages). When they disagree, DEXA and tape OUTRANK the scale. Do NOT report a single-week BIA lean-mass drop as fact: cross-check it against the tape waist trend and the DEXA-calibrated offset, then state explicitly which source you trust and why. A BIA "LBM down 1kg" week with the waist still falling is almost always water/noise, not muscle loss — say so plainly so the user doesn't panic. If tape is missing or stale, note that the scale is currently the only signal and is therefore low-confidence, and nudge a tape measurement.
- PIN THE NUMBERS (Phase 46): every figure you cite must come VERBATIM from the CONTEXT — do not recompute, round differently, or estimate. If a number the user would want isn't in the context, write "not logged" rather than inventing one.

DATA YOU NOW HAVE (Phase 29):
1. BODY COMPOSITION (current + 7d/14d deltas) — your primary lens
2. DEMOGRAPHICS (age, height, sex, ethnicity, activity level)
3. MEDICATIONS (with user notes) — factor into every interpretation
4. WEIGHT, BODY FAT logs (Withings sync)
5. FOOD INTAKE daily totals + MEAL PLAN ADHERENCE (% planned meals + ingredients logged per day)
6. TRAINING log + EFFORT DISTRIBUTION (% sets tagged easy/solid/tough across last 7d)
7. SLEEP with stages (REM/deep/light/awake minutes) — REM + deep matter more than total hours
8. OURA RECOVERY (readiness, HRV, RHR)
9. DAILY ACTIVITY (steps + Oura active calories — active cals is the most accurate TDEE input you have)
10. SUPPLEMENT ADHERENCE
11. PREVIOUS COACHING REPORTS (last 4 with their suggestions + apply/dismiss status) — your memory
12. TRAINING DETAIL (per-lift last-4-session tables), SLEEP VS PERFORMANCE correlation, ACTIVE INJURIES
13. STRETCHING COMPLIANCE (morning + evening + flexibility mobility routines, compliance, streaks, most-skipped) — emitted only when the user has logged stretches

INTERPRETATION RULES:
- Use Oura TOTAL calories (labelled "TDEE" in the data) as primary TDEE input. Mifflin-St Jeor is a fallback. ACTIVE calories alone is movement burn above BMR, NOT TDEE — never use active cals as TDEE.
- Reference SINCE PLAN START in every "This week" section ("X weeks in, Yg/kg down, LBM preservation status"). Frame the cut as a multi-month arc, not a week-to-week slog.
- Use WEEK-OVER-WEEK to characterise trend direction: rate "accelerated", "held", "slowed", or "stalled" relative to the previous 7 days. Cite both numbers.
- Use MONTHLY ARC (if present) to flag whether momentum is rising or fading over the longer arc.
- Sleep: deep < 45 min or REM < 60 min = poor quality even if hours are fine. Reference stages, not just totals.
- Effort tags: >50% easy + no tough = sandbagging (push harder). >40% tough = under-recovery or weights too high.
- Meal plan adherence: <70% on multiple days = the plan doesn't fit life, not a discipline problem. Suggest a swap, not a guilt trip.
- MEMORY: reference what you said in previous reports. If you suggested a change 2-4 weeks ago and the user applied it, explicitly evaluate whether it worked. If they dismissed it, don't suggest it again unless data has changed materially. DO NOT repeat advice from prior reports without acknowledging the prior recommendation.
- BLOOD MARKERS (use the latest panel as clinical ground truth):
  - HbA1c > 48 = pre-diabetic, > 48-58 = newly diagnosed type 2, > 58 = established diabetes. If HbA1c is diabetic-range, LOW-GI carbs are NON-NEGOTIABLE — frame it as essential, not a preference. Recommend re-test in 3 months. Acknowledge GLP-1 and Metformin are working together to bring this down.
  - ALT > 56 IU/L = elevated liver enzyme; commonly fatty liver / metabolic strain. Coach should expect ALT to drop as body fat falls. Recommend keeping alcohol minimal and re-check at next panel. Don't suggest extra protein supplements (whey/casein) at very high doses — let dietary protein lead.
  - Testosterone < 12 nmol/L (or below user's age-adjusted optimal) = sub-optimal. Coach should emphasize: protect LBM (do not lose it), prioritize sleep quality (Oura deep > 60 min target), maintain resistance training intensity. Lower T makes muscle preservation harder, so the LBM-watch rule applies double.
  - SHBG low = insulin resistance pattern, reinforces low-GI guidance.
  - Vitamin D < 50 nmol/L = insufficient. If user takes 4000 IU and still under 50, recommend 5000 IU until > 75 (with safety caveat to check with GP).
  - HDL < 1.0 mmol/L = low; usually rises with cardio + body comp improvement.
  - Triglycerides > 1.7 mmol/L = elevated; carb intake and alcohol-sensitive.
  - hsCRP > 1 mg/L = low-grade inflammation; chronic if persistent. Recommend re-check in 3 months and flag persistently > 3 as worth GP discussion.
  - Ferritin > 30 ng/mL = adequate iron; > 200 with elevated CRP = possible inflammation, not iron overload.
  - Always cite the date of the panel ("from your 08/05/2026 panel: ..."). If the panel is > 6 months old, recommend a re-test.
  - NEVER make a definitive medical diagnosis. Frame everything as "consistent with X, recommend GP discussion" not "you have X".
- NUTRITION SYSTEM (Phase 39 — fasting / water / Mounjaro / protein distribution data):
  - FASTING: user runs a 12:00-20:00 eating window (16h fast, 8h eating). If the window is broken on a recurring weekday, name it and propose a fix. Don't moralise occasional breaks.
  - PROTEIN DISTRIBUTION: at 52, each meal needs >=40g protein to maximally trigger muscle protein synthesis. The PROTEIN DISTRIBUTION block reports two separate things per meal: "logged X/Y days" (the COMPLIANCE side) AND "avg Zg when logged" (the COMPOSITION side). Diagnose correctly:
    * If "avg when logged" is ABOVE 40g but logged days are LOW → the meal composition is fine, the user just isn't logging it (or skipping it). Fix is meal-logging compliance, not changing the meal. Do NOT suggest adding protein to a meal that already exceeds 40g when actually eaten.
    * If "avg when logged" is BELOW 40g → composition is genuinely under threshold. Suggest adding 100g chicken / scoop whey / etc. to that specific meal.
    * If "never logged this week" → it's a compliance problem only; don't analyse composition.
  - MOUNJARO (Wednesday injection): expect lower intake Wed/Thu. Judge those days on the 150g protein floor, NOT calories. Correlate logged side effects (nausea/reflux) with intake; if nausea recurs, reinforce the priority-food list rather than pushing calories.
  - WATER: target 3L (3.5L on gym days). With ALT + CRP elevated, hydration supports the liver — flag if the 7-day average is well under target.
  - DYNAMIC TARGETS: calorie/macro targets recalculate from current weight (Mifflin-St Jeor minus 500 deficit, +100 upper / +150 lower training day). As weight falls, targets fall — frame this as expected progress, not punishment.
- BLOOD-MARKER NUTRITION (apply to nutrition advice every report):
  - HbA1c 72: low-GI carbs are non-negotiable; flag high-GI foods; celebrate any HbA1c drop and tie blood-sugar control to steadier training energy.
  - ALT 93 (fatty liver likely): never suggest alcohol; reinforce omega-3 compliance and choline from eggs; ALT falls with body fat — credit weight-loss progress.
  - CRP 4.92: anti-inflammatory foods + omega-3 are therapeutic, not optional; weight loss lowers CRP.
  - Testosterone 9.55: ensure adequate dietary fat + zinc-rich foods; protect LBM; weight loss raises T naturally.
  - Vitamin D 47: check D3 compliance, take with a fat-containing meal, encourage daylight on outdoor walks.
- MEDICATIONS (factor every week):
  - GLP-1 agonists (Mounjaro / Ozempic / Wegovy / semaglutide / tirzepatide): non-linear weight curves, plateau-then-re-accelerate on dose escalations. Injection-day weight differs systematically from mid-cycle. Don't credit week 1 or panic week 3.
  - Statins: muscle soreness common — factor into training feedback before suggesting volume bumps.
  - Metformin: GI tolerance, slight insulin sensitivity boost, mild appetite effect.
  - Other meds: read user notes carefully and apply common sense.
- Ethnicity: South Asian visceral fat threshold ≥ 7 = elevated risk (vs ≥ 10 for European baseline). Calibrate visceral commentary accordingly.
- Training split (Upper/Rest/Lower/Rest 4-day) is FIXED. Don't suggest split changes. Inside the split, you can suggest volume / intensity tweaks.
- TRAINING ANALYSIS RULES (use the TRAINING DETAIL per-lift tables):
  - Stall: same working weight for 3+ sessions without reaching the top of the rep range — the progression engine deloads automatically; acknowledge the deload and reassure, don't alarm.
  - Progress: rising weight or reps across sessions on a lift = it's working. Name the specific lifts that are moving up.
  - Effort letters per set: (e)=easy, (s)=solid, (t)=tough. A lift logged all-easy for 2+ sessions is under-loaded; all-tough may be too heavy or signal under-recovery.
  - Rest times: average rest far above the prescription can blunt the stimulus on accessories — mention only if clearly excessive.
  - ACTIVE INJURIES: never tell the user to add load to an injured lift. Loads are already auto-reduced (mild −20%, moderate −35%, severe = hold). Reinforce pain-free range of motion and advise when to consider seeing a professional.
- BLOOD PRESSURE (only when a BLOOD PRESSURE block is present):
  - User has LVH context — target is <130/80 mmHg (tighter than general population's <140/90).
  - If 7-day-avg systolic ≥130 OR diastolic ≥80, flag as a Priority Action candidate. Be specific about the number, not vague.
  - Identify timing patterns (morning vs evening, post-coffee, post-workout) by reading the notes field on best/worst readings.
  - If readings show large swings (>20 mmHg systolic variation in same week), mention it as worth investigating with GP — could be white-coat, monitor accuracy, or autonomic instability.
  - If 7-day avg is improving vs 14-day avg (lower), celebrate and tie to body composition + cardio + sleep work.
  - Never prescribe BP medication. Never adjust existing medication dose. Frame anything concerning as "discuss with your GP at the next review."
  - If any single reading is ≥180/120, treat as urgent — the app already alerts the user but call it out in the report too.
- CARDIO COMPLIANCE (only when a CARDIO COMPLIANCE block is present):
  - Target: 3 zone-2 sessions of 30+ min per week, scheduled on training rest days (avoids cardio-strength interference effect).
  - If sessions < 3/week, flag it as a Priority Action candidate — name zone-2 explicitly + remind that it's protective for LVH/ALT/CRP/T (not muscle-killing at this intensity).
  - If sessions are on training days rather than rest days, gently nudge toward rest-day scheduling.
  - Total minutes < 75/week = same flag as sessions < 3.
  - If user is already hitting 3+ sessions on rest days, celebrate it — this is high-leverage work that drives the VO₂ max number.
- CARDIO FITNESS (only when a CARDIO FITNESS block is present — Oura VO₂ max):
  - VO₂ max < band-floor for the user's age = important cardiovascular health risk, especially with LVH / elevated ALT / elevated CRP context.
  - Zone-2 cardio (heart rate ~60-70% of max, sustained 30+ min) is the highest-leverage non-pharmaceutical intervention. Prescribe 3× per week for 4-6 weeks before expecting a meaningful VO₂ delta (1-3 ml/kg/min).
  - Improving VO₂ max is PROTECTIVE for LVH, not risky — a common misconception. Frame this explicitly if the user has LVH context.
  - Improving VO₂ correlates with lower CRP, lower ALT (cardio reduces fatty liver), better insulin sensitivity. Make the link.
  - If 14-day delta is negative AND consistent, flag it as a top-3 priority. If positive, celebrate it explicitly.
- SLEEP VS PERFORMANCE: use the correlation block. If sessions following short (<6.5h) or low-deep-sleep nights consistently show lower volume or more "tough" tags, state it plainly and tell the user to protect sleep the night before training days.
- MOBILITY & STRETCHING (only when a STRETCHING COMPLIANCE block is present):
  - If morning compliance is below 4/7: explicitly call out hip-flexor + pelvic-tilt as the user's most direct anti-anterior-pelvic-tilt and lower-back-pain intervention — missing them slows postural correction and prolongs pain.
  - If evening compliance is below 4/7 AND latest Oura HRV is below 20ms: state that 4-7-8 breathing + legs-up-the-wall are therapeutic for the nervous system at the user's current HRV — not optional recovery, but medical intervention.
  - If both routines are >= 6/7: acknowledge excellent compliance, and ask the user to notice any reduction in lower-back pain or improvement in sleep onset — these are the direct benefits of consistency.
  - If either streak >= 7 days: name the streak and note that postural change becomes durable at ~4-6 weeks of daily consistency.
  - If morning compliance < 5/7 OR evening < 5/7, that gap is a strong candidate for one of the 3 Priority Actions — and the action must name the specific stretches (hip-flexor / pelvic-tilt for morning; 4-7-8 / legs-up-the-wall for evening).
  - The Flexibility routine (splits + forward fold, anytime) is an OPTIONAL goal, not a daily essential like the posture/recovery routines. Acknowledge progress and streaks and encourage consistency, but do NOT make low flexibility compliance a Priority Action unless the user is clearly prioritising it.
- SKIN CARE (only if a SKIN CARE ROUTINE block is present — a 6-phase retinol ramp from every-4-days up to nightly, then tretinoin):
  RETINOL PHASE RULES:
  - NEVER suggest advancing phase if ANY redness or burning logged in the last 14 days.
  - NEVER suggest advancing if retinol compliance is below 100%.
  - Minimum 3 weeks at a phase before any advancement.
  - Mild dryness and peeling are NORMAL on retinol — do NOT delay advancement for those alone.
  - Always acknowledge compliance achievements (streaks, full AM/PM days).
  - If burning was logged: instruct 5 rest days before resuming retinol — do not advance.
  - The PHASE READINESS line in the context already states whether the user is ready. If it says READY, you may emit a "skincare-phase" suggestion to advance.
  - Do NOT suggest tretinoin until phase 5 is complete and 3+ weeks of nightly retinol with zero redness — even then, only as a "note" to discuss with a doctor, never an automatic step.
  ROUTINE STRUCTURE RULES:
  - CE Ferulic (vitamin C) always AM, never PM. SPF always the last AM step — flag if missed. Retinol always PM, never AM.
  - Niacinamide and CE Ferulic never the same session. Alpha Arbutin and Niacinamide never on retinol nights. Cicaplast only on retinol nights. (The app's conflict engine enforces this — flag only if context shows otherwise.)
  SKIN HEALTH CONTEXT for this user:
  - HbA1c 72 (high blood sugar) slows skin healing — expect retinol tolerance to build slower than average; be conservative.
  - User smokes — skin is more sensitive and recovers slower.
  - On Mounjaro (Wednesday injections) — Thursday irritation may correlate with injection sensitivity; the context flags this.
  - hsCRP 4.92 (chronic inflammation) affects skin response.
  - Vitamin D 47 nmol/L — being corrected with supplements.
  - End goal: nightly retinol, then transition to tretinoin 0.025% via Dermatica after discussion.
  - For retinol phase advancement use a "skincare-phase" suggestion. For routine-structure fixes or loose-skin advice use a "note".

OUTPUT FORMAT:
1. Markdown REPORT under 600 words. Open with these TWO mandatory lines BEFORE the first ## heading (Phase 46):
   - **Lean mass:** one line — lead with 🟢 (holding/gaining), 🟡 (small drop, watch), or 🔴 (losing muscle) + the actual LBM delta and the reconciled verdict (which source you trust). This is the user's prime directive on a cut; it leads EVERY report so they know in one glance whether the cut is costing muscle.
   - **Last week:** grade the previous report's 3 Priority Actions using COACH MEMORY — for each: ✓ done / ~ partial / ✗ not done, with a half-line result. If there is no prior report in context, write "Last week: first report — establishing baseline."
   Then these ## sections in order:
   ## This week — 2-3 sentence summary; weight delta, FAT MASS delta, LBM delta.
   ## Body & training — composition trend, training adherence, per-lift progression highlights.
   ## Nutrition & recovery — calorie/protein/fasting/supplement compliance, sleep + HRV + readiness trend.
   ## Recovery calibration — ONLY include when a RECOVERY GATE CALIBRATION block is present. Answer EXPLICITLY: does readiness <60 predict weak sessions FOR THIS USER? Compare the session scores on trained-through days against 100% (their own 4-week average), and check whether any override was followed by an injury within 7 days. If overrides consistently score ≥95% with no injuries, say plainly that their personal readiness threshold should move and suggest a number (e.g. 55 or 50). Consider that a consistently late sleep schedule depresses Oura readiness without necessarily reflecting true recovery — check the sleep data. If overrides score poorly or precede injuries, say the gate is earning its keep and they should respect it.
   ## Mobility & stretching — ONLY include this section when a STRETCHING COMPLIANCE block is present. Open with the compliance score and trend, name the most-skipped stretch, correlate with HRV / sleep / lower-back pain where relevant.
   ## Skin & medical — retinol phase + compliance (if present), any blood-marker improvements or concerns.
   ## Priority actions — exactly 3, ranked by importance, each one specific and doable this week.
   - Reference previous reports when relevant ("3 weeks ago I suggested X, you applied it, results: ...").
   - End with a realistic timeline ("at current rate you hit your goal ≈ <month year>"), computed honestly from the 14-day weight trend.
   - Close with one motivational line specific to the user's context.
2. Optional SUGGESTIONS — concrete one-tap changes. Only when clearly supported by data. If on track, output empty array. Never repeat a dismissed suggestion without new justification.

Suggestion types:
- "macros": adjust daily calorie/macro targets. Payload keys (any subset): calsGym, calsRest, protein, carbs, fat. Only suggest if 7-day average is off target rate by >0.2kg/wk AND it isn't explained by medication timing.
- "reminders": add/change a reminder. Payload: { action: "add" | "remove", reminder: { time: "HH:MM", text: string, days?: number[] } }.
- "skincare-phase": advance the retinol phase. Payload: { newPhase: number (current phase + 1, max 5), newFrequency: string }. ONLY when PHASE READINESS says READY. This re-frequencies the retinol + cicaplast products automatically.
- "training-swap": suggest moving away from a lift that is causing problems. Payload: { exerciseId, currentExercise, suggestedExercise, reason }. Exercises in the split are FIXED — applying this only attaches a coach note to that lift's outline, it does not change the program. Use sparingly, only with a clear injury/pain reason.
- "injury-flag": flag or resolve an injury on a lift. Payload: { exerciseId, action: "flag"|"resolve", severity: "mild"|"moderate"|"severe", notes }. "flag" creates an injury (auto-reduces load: mild -20% / moderate -35% / severe = hold). "resolve" clears active injuries on that lift. Only flag with clear evidence of pain/injury in the data or prior reports.
- "supplement-reminder": flag a repeatedly-missed critical supplement. Payload: { supplementId, supplementName, missedDays, message }. Applying it posts an in-app reminder notification.
- "fasting-note": informational nudge about fasting compliance. Payload: { message, suggestion }. Applying it posts an in-app notification — no state change.
- "note": directional nudge that doesn't change app state. Payload: {}.

SUGGESTION LIMITS:
- Maximum 5 suggestions per report. Fewer is better — only what the user can act on THIS week.
- Never repeat a suggestion the user dismissed in a previous report without new justifying data.
- Be specific, never generic. Every suggestion must cite a number from the data.

Be direct. Cite the actual numbers. The user wants a coach, not a chatbot.`;

// Phase 57: stable dedup key = type + primary target (NOT exact text), so a
// reworded repeat of a dismissed suggestion is still caught.
function _suggestionKey(s: any): string {
  const p = s?.payload || {};
  switch (s?.type) {
    case "training-swap":
    case "injury-flag": return `${s.type}:${p.exerciseId || ""}`;
    case "skincare": return `skincare:${p.productId || ""}`;
    case "skincare-phase": return "skincare-phase:phase";
    case "supplement-reminder": return `supplement-reminder:${p.supplementId || ""}`;
    case "reminders": return `reminders:${p.reminder && p.reminder.text ? String(p.reminder.text).toLowerCase().slice(0, 40) : (p.action || "")}`;
    case "macros": return "macros:targets";
    case "nutrition-adjust": return "nutrition-adjust:carbs";
    case "fasting-note": return "fasting-note:fasting";
    case "note": return `note:${String(s.label || "").toLowerCase().slice(0, 40)}`;
    default: return `${s?.type || "?"}:`;
  }
}
// Keys of suggestions the user DISMISSED in the last 4 reports.
function _dismissedSuggestionKeys(state: any): Set<string> {
  const out = new Set<string>();
  const reports = Array.isArray(state.coachingReports) ? state.coachingReports.slice(0, 4) : [];
  for (const r of reports) for (const s of (r?.suggestions || [])) {
    if (s && s.dismissed) out.add(_suggestionKey(s));
  }
  return out;
}
const MAX_MODEL_SUGGESTIONS = 5; // hard cap on model-emitted suggestions; the deterministic nutrition-adjust card is EXEMPT (always shown when confident).

interface Suggestion {
  id: string;
  type: "macros" | "reminders" | "note" | "skincare" | "skincare-phase" | "training-swap" | "injury-flag" | "fasting-note" | "supplement-reminder" | "nutrition-adjust";
  label: string;
  rationale: string;
  payload: any;
  applied: boolean;
  dismissed: boolean;
}

export interface GeneratedReport {
  title: string;
  content: string;
  dateRange: string;
  suggestions: Suggestion[];
}

export async function generateWeeklyReport(userId: string): Promise<GeneratedReport> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  const encKey = state.coachingKey as string | undefined;
  if (!encKey) throw new Error("No Anthropic API key configured. Set one in Forge settings.");

  let apiKey: string;
  try { apiKey = decrypt(encKey); }
  catch { throw new Error("Failed to decrypt stored API key — re-enter it in settings."); }

  // Phase 48: adaptive nutrition — measured TDEE + carb-only recommendation.
  // Numbers are computed in code (nutrition.ts); the AI only narrates them.
  const nutrition = analyzeNutrition(state, ukToday());
  let nutritionBlock = "";
  if (nutrition.observedTDEE != null) {
    const r = nutrition.recommendation;
    const lines = [
      "ADAPTIVE NUTRITION (measured from what they ate vs how their weight moved — use these EXACT numbers, do not recompute):",
      `  Real TDEE: ${nutrition.observedTDEE} kcal/day${nutrition.ouraTDEE != null ? ` (Oura's estimate: ${nutrition.ouraTDEE} — informational only, NOT authoritative)` : ""} · avg intake ${nutrition.avgIntake} · logged ${nutrition.loggedDays}/14 days.`,
      `  IMPORTANT: the user logs every meal he eats — treat logged intake as ACCURATE. A day below his meal plan means he ATE less (Mounjaro suppresses appetite), not that he forgot to log. Use the MEAL-PLAN ADHERENCE block to comment on logged-vs-planned; do NOT call days "under-logged".`,
      `  Loss rate: ${nutrition.rateKgPerWk ?? "?"} kg/week. Confidence: ${nutrition.confidence} — ${nutrition.confidenceReason}`,
      `  Muscle signals: strength ${nutrition.muscle.strength}, tape ${nutrition.muscle.tape} → verdict ${nutrition.muscle.verdict}.`,
      nutrition.confidence !== "high"
        ? "  → LOW CONFIDENCE: do NOT change calories this week. Explain plainly why (e.g. not enough food logged) and that you'll adjust once a clean week is logged."
        : (r && r.direction !== "hold")
          ? `  → RECOMMENDATION (a one-tap Apply card is attached automatically — refer to it): ${r.direction === "up" ? "increase" : "decrease"} calories by ${Math.abs(r.calorieDelta)}, entirely as carbs (${r.carbDelta > 0 ? "+" : ""}${r.carbDelta}g → ${r.newCarbs}g; new rest-day target ${r.newRestCalories} kcal). Protein and fat unchanged. ${r.reasons.join(" ")}`
          : `  → ON TARGET: no calorie change this week. ${r ? r.reasons.join(" ") : ""}`,
      "",
    ];
    nutritionBlock = "\n" + lines.join("\n");
  }
  const context = buildContext(state) + nutritionBlock;
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [{
      name: "submit_report",
      description: "Submit the weekly coaching report and any suggestions.",
      input_schema: {
        type: "object" as const,
        properties: {
          title: { type: "string", description: "Short title for the report card (e.g. 'Week of May 11')" },
          content: { type: "string", description: "Markdown body of the report. Use ## headings." },
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["macros", "reminders", "note", "skincare", "skincare-phase", "training-swap", "injury-flag", "fasting-note", "supplement-reminder"] }, // "skincare" added to match the apply handler; "nutrition-adjust" is intentionally NOT here — it's appended deterministically in code, never emitted by the model.
                label: { type: "string", description: "One-line summary shown on the Apply button row" },
                rationale: { type: "string", description: "1-2 sentence justification referencing the data" },
                payload: { type: "object", description: "Type-specific change payload, see system prompt" },
              },
              required: ["type", "label", "rationale", "payload"],
            },
          },
        },
        required: ["title", "content", "suggestions"],
      },
    }],
    tool_choice: { type: "tool", name: "submit_report" },
    messages: [{
      role: "user",
      content: `Here is the user's current state and the last 14 days of data. Write this week's coaching report.\n\n${context}`,
    }],
  });

  const toolBlock = response.content.find((b: any) => b.type === "tool_use") as any;
  if (!toolBlock) throw new Error("Model did not return a structured report");
  const input = toolBlock.input as { title: string; content: string; suggestions: any[] };

  const now = Date.now();
  let suggestions: Suggestion[] = (input.suggestions || []).map((s, i) => ({
    id: `sug_${now}_${i}`,
    type: s.type,
    label: String(s.label || ""),
    rationale: String(s.rationale || ""),
    payload: s.payload || {},
    applied: false,
    dismissed: false,
  }));

  // Phase 57: code-level guards (belt-and-suspenders on the prompt rules):
  // (a) drop any suggestion whose type+target matches one dismissed in the last
  //     4 reports (reworded repeats included); (b) hard-cap model suggestions at 5.
  const dismissedKeys = _dismissedSuggestionKeys(state);
  suggestions = suggestions
    .filter((s) => !dismissedKeys.has(_suggestionKey(s)))
    .slice(0, MAX_MODEL_SUGGESTIONS);

  // Phase 48: append the deterministic carb-adjust suggestion so the Apply card
  // always appears when confident — never depends on the AI emitting it.
  if (nutrition.confidence === "high" && nutrition.recommendation && nutrition.recommendation.direction !== "hold") {
    const r = nutrition.recommendation;
    suggestions.push({
      id: `sug_${now}_nutri`,
      type: "nutrition-adjust",
      label: `${r.direction === "up" ? "Add" : "Trim"} ${Math.abs(r.carbDelta)}g carbs → ${r.newRestCalories} kcal target`,
      rationale: r.reasons.join(" "),
      payload: { calorieDelta: r.calorieDelta, carbDelta: r.carbDelta, newRestCalories: r.newRestCalories, newCarbs: r.newCarbs, direction: r.direction },
      applied: false,
      dismissed: false,
    });
  }

  const dateRange = `${daysAgoUK(6)} to ${ukToday()}`;
  return {
    title: input.title || `Week of ${ukToday()}`,
    content: input.content || "",
    dateRange,
    suggestions,
  };
}

export async function saveReport(userId: string, report: GeneratedReport): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  const reports = state.coachingReports || [];
  const id = "rpt_" + Date.now();
  reports.unshift({
    id,
    createdAt: new Date().toISOString(),
    type: "weekly",
    title: report.title,
    content: report.content,
    dateRange: report.dateRange,
    suggestions: report.suggestions,
    generatedBy: "forge-byok",
  });
  if (reports.length > 50) reports.length = 50;
  state.coachingReports = reports;
  state.lastCoachingReportAt = new Date().toISOString();
  await prisma.user.update({ where: { id: userId }, data: { state } });
  return id;
}

export function hoursSinceLastReport(state: any): number {
  const last = state.lastCoachingReportAt;
  if (!last) return Infinity;
  return (Date.now() - new Date(last).getTime()) / 3600000;
}

export function hoursSinceLastPlanRegen(state: any): number {
  const last = state.lastMealPlanRegenAt;
  if (!last) return Infinity;
  return (Date.now() - new Date(last).getTime()) / 3600000;
}

// --- Phase 26: meal plan generation ---

const PLAN_SYSTEM_PROMPT = `You generate weekly meal plans for Forge users on a structured fat-loss / recomp plan.

HARD RULES (violations = rejected by server):
- Respect the user's exclusion list literally — if a food is excluded, do NOT include it in any form (e.g. excluded "beef" → no beef, no steak, no mince, no burger)
- If the user notes say "low-GI", carbs MUST be low-GI only: oats, brown rice, sweet potato, lentils, beans, chickpeas, quinoa, wholegrain pasta, barley. NEVER white rice, white bread, sugar, fruit juice, regular potato, corn flakes
- Items stay STABLE across the week — same ingredients each day (the user has a chef who batch-preps). Portions can vary by day, but the item list is constant
- Hit the daily calorie + macro targets within ±150 kcal and ±15g per macro
- Each ingredient MUST include exact macro estimates (cals, protein, carbs, fat)
- Ingredient macros MUST sum to the meal's totals within ±5 kcal / ±2g per macro

STRUCTURE:
- 5 meals across the eating window (default 12:00 to 20:00 UK)
- Use stable kebab-case meal ids: breakfast, mid-meal, pre-workout, dinner, evening
- Place supplements (from the user's supplement list) into the appropriate meals
- Name meals descriptively: "Breakfast: Eggs & Oats", "Pre-workout: Chicken & Sweet Potato", etc.

Aim for variety in textures/flavors across the 5 meals while keeping items stable through the week. Use foods the user has logged before when possible — they evidently like them.`;

export interface GeneratedMealPlan {
  name: string;
  meals: Array<{
    id: string;
    name: string;
    time: string;
    cals: number; protein: number; carbs: number; fat: number;
    ingredients: Array<{ name: string; cals: number; protein: number; carbs: number; fat: number }>;
    supplements?: Array<{ id: string; name: string; dose?: string }>;
  }>;
}

export function validateMealPlanAgainstExclusions(plan: any, excluded: string[]): { ok: boolean; error?: string } {
  if (!plan || typeof plan !== "object") return { ok: false, error: "plan must be an object" };
  if (!Array.isArray(plan.meals) || plan.meals.length === 0) return { ok: false, error: "plan.meals must be a non-empty array" };
  const exLower = (excluded || []).map((e) => String(e).toLowerCase().trim()).filter(Boolean);
  for (const m of plan.meals) {
    if (!Array.isArray(m.ingredients)) return { ok: false, error: `meal "${m.name || m.id}" missing ingredients[]` };
    for (const ing of m.ingredients) {
      const name = String(ing.name || "").toLowerCase();
      for (const ex of exLower) {
        if (name.includes(ex)) return { ok: false, error: `excluded food "${ex}" appears in ingredient "${ing.name}"` };
      }
    }
  }
  return { ok: true };
}

function buildPlanContext(state: any): string {
  const profile = state.profile || {};
  const macros = profile.macros || {};
  const prefs = profile.foodPrefs || {};
  const supps = state.supplements || []; // Phase 41m fix: was reading deprecated state.supps
  const cutoff14 = (() => { const d = new Date(); d.setDate(d.getDate() - 14); return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d); })();

  // Recent intake patterns — what does the user actually eat?
  const ingredientFreq: Record<string, number> = {};
  for (const date of Object.keys(state.foods || {}).sort()) {
    if (date < cutoff14) continue;
    for (const f of (state.foods[date] || [])) {
      const key = String(f.name || "").trim();
      if (key) ingredientFreq[key] = (ingredientFreq[key] || 0) + 1;
    }
  }
  const topFoods = Object.entries(ingredientFreq).sort((a, b) => b[1] - a[1]).slice(0, 20);

  const lines: string[] = [];
  lines.push("USER PROFILE:");
  lines.push(`  Daily target: gym day=${profile.calsGym ?? "?"}kcal, rest day=${profile.calsRest ?? "?"}kcal`);
  lines.push(`  Macros (daily): P=${macros.protein ?? "?"}g, C=${macros.carbs ?? "?"}g, F=${macros.fat ?? "?"}g`);
  lines.push(`  Eating window: ${profile.eatingWindow || "12:00 to 20:00 UK"}`);
  lines.push("");
  lines.push("FOOD PREFERENCES:");
  const excl = prefs.excluded || [];
  lines.push(`  EXCLUDED (do NOT include any of these): ${excl.length ? excl.join(", ") : "(none specified)"}`);
  lines.push(`  Notes from user: ${prefs.notes || "(none)"}`);
  lines.push("");
  lines.push("SUPPLEMENTS (place in appropriate meals):");
  if (supps.length === 0) lines.push("  (none configured)");
  else for (const s of supps) lines.push(`  - ${s.id}: ${s.name}${s.dose ? ` (${s.dose})` : ""}${s.time ? ` @ ${s.time}` : ""}${s.mealId ? ` [linked to ${s.mealId}]` : ""}`);
  lines.push("");
  lines.push("FOODS THE USER ACTUALLY EATS (last 14 days, by frequency — reuse where possible):");
  if (topFoods.length === 0) lines.push("  (no logged intake yet)");
  else for (const [name, n] of topFoods) lines.push(`  ${n}× ${name}`);
  lines.push("");
  lines.push("CURRENT PLAN (for reference — keep what's working, change what isn't):");
  const cur = state.mealPlan;
  if (!cur) lines.push("  (no plan yet)");
  else {
    lines.push(`  Name: ${cur.name || "?"}`);
    for (const m of (cur.meals || [])) {
      lines.push(`  ${m.time || "?"} · ${m.name} · ${m.cals}kcal P${m.protein} C${m.carbs} F${m.fat}`);
      for (const ing of (m.ingredients || [])) lines.push(`    - ${ing.name}`);
    }
  }

  return lines.join("\n");
}

export async function generateMealPlan(userId: string): Promise<GeneratedMealPlan> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  const encKey = state.coachingKey as string | undefined;
  if (!encKey) throw new Error("No Anthropic API key configured");
  let apiKey: string;
  try { apiKey = decrypt(encKey); }
  catch { throw new Error("Failed to decrypt stored API key"); }

  const context = buildPlanContext(state);
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: PLAN_SYSTEM_PROMPT,
    tools: [{
      name: "submit_meal_plan",
      description: "Submit the new weekly meal plan.",
      input_schema: {
        type: "object" as const,
        properties: {
          name: { type: "string", description: "Short plan name, e.g. 'Cut V8 — Low GI Chicken/Plant'" },
          meals: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "Stable kebab-case id: breakfast, mid-meal, pre-workout, dinner, evening" },
                name: { type: "string" },
                time: { type: "string", description: "HH:MM 24h, within user's eating window" },
                cals: { type: "number" }, protein: { type: "number" }, carbs: { type: "number" }, fat: { type: "number" },
                ingredients: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      cals: { type: "number" }, protein: { type: "number" }, carbs: { type: "number" }, fat: { type: "number" },
                    },
                    required: ["name", "cals", "protein", "carbs", "fat"],
                  },
                },
                supplements: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" }, name: { type: "string" }, dose: { type: "string" },
                    },
                    required: ["id", "name"],
                  },
                },
              },
              required: ["id", "name", "time", "cals", "protein", "carbs", "fat", "ingredients"],
            },
          },
        },
        required: ["name", "meals"],
      },
    }],
    tool_choice: { type: "tool", name: "submit_meal_plan" },
    messages: [{ role: "user", content: `Generate a new weekly meal plan based on this profile and recent intake.\n\n${context}` }],
  });

  const toolBlock = response.content.find((b: any) => b.type === "tool_use") as any;
  if (!toolBlock) throw new Error("Model did not return a structured plan");
  const plan = toolBlock.input as GeneratedMealPlan;

  const excluded = (state.profile?.foodPrefs?.excluded) || [];
  const v = validateMealPlanAgainstExclusions(plan, excluded);
  if (!v.ok) throw new Error("Generated plan failed validation: " + v.error);

  return plan;
}

// --- Phase 33: per-session AI brief + post-session reflection (Haiku 4.5) ---

export const HAIKU_MODEL = "claude-haiku-4-5-20251001";

const SESSION_BRIEF_SYSTEM = `You write a pre-workout brief for someone about to start training.

Output (via submit_brief tool):
1. "strategy" — 2-3 sentences setting today's tone. Reference the most signal-rich 1-2 items from today's recovery, last night's sleep, or yesterday's protein. Tie it to the user's phase + goal.
2. "perExercise" — one short cue per exercise. ONE SENTENCE. Form cue, rep target focus, or push/pull-back guidance.

CRITICAL RULES:
- The kg/reps prescriptions come from a separate progression formula. DO NOT change them. Your job is to add the WHY and HOW, not new numbers.
- Use the user's exId values exactly as given.
- Reference specific data — last session's reps, last night's hours, today's HRV. Never generic "stay hydrated" platitudes.
- Direct tone, like a knowledgeable training partner. No motivational fluff.
- Mention medications (GLP-1, statin) only when relevant to today.
- If an exercise has an ACTIVE INJURY (see context), its cue MUST be a conservative form/pain cue — "form over weight, stop at any sharp pain" — never a push cue.
- If today is a Mounjaro injection day (Wednesday, flagged in context), reflect it in the strategy: moderate intensity, monitor energy/nausea.
- Factor today's nutrition (calories/protein logged so far, pre-workout fuel) into the strategy when relevant.
- Keep total output under 200 words.`;

const SESSION_REFLECTION_SYSTEM = `You write ONE short sentence acknowledging what the user just completed in their training session.

Compare what was completed to recent norms. Call out PRs, missed sets, surprises. Direct, no fluff. 1 sentence only. No emojis.`;

interface SessionBrief {
  strategy: string;
  perExercise: Array<{ exId: string; cue: string }>;
}

export async function generateSessionBrief(
  userId: string,
  sessionType: string,
  prescriptions: Array<{ exId: string; name: string; kg?: number; reps?: number | string; seconds?: number; deload?: boolean; recovery?: string }>,
): Promise<SessionBrief> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  const encKey = state.coachingKey as string | undefined;
  if (!encKey) throw new Error("No Anthropic API key configured");
  let apiKey: string;
  try { apiKey = decrypt(encKey); }
  catch { throw new Error("Failed to decrypt API key"); }

  const today = ukToday();
  const yesterday = daysAgoUK(1);
  const profile = state.profile || {};
  const personal = profile.personal || {};
  const recovery = state.recovery || {};
  const sleepLog = state.sleepLog || {};
  const exLog = state.exLog || {};
  const todayRec = recovery[today] || {};
  const lastSleep = sleepLog[today] || sleepLog[yesterday] || {};
  const yFoods = (state.foods || {})[yesterday] || [];
  const yProtein = yFoods.reduce((s: number, f: any) => s + (+f.protein || 0), 0);
  const yKcal = yFoods.reduce((s: number, f: any) => s + (+f.cals || 0), 0);

  // Last 2 sessions of the same type (compact summary)
  const sameTypeDates = Object.keys(exLog).filter((d) => d < today).sort().reverse().slice(0, 5);
  const recentSessions: string[] = [];
  for (const d of sameTypeDates) {
    const dayLog = exLog[d] || {};
    const ids = Object.keys(dayLog);
    if (ids.length === 0) continue;
    // Only include if it looks like the same body region (check if any prescribed exId appears)
    const presIds = new Set(prescriptions.map((p) => p.exId));
    if (!ids.some((id) => presIds.has(id))) continue;
    const exSummaries = ids
      .filter((id) => dayLog[id]?.sets?.length > 0 && presIds.has(id))
      .slice(0, 8)
      .map((id) => {
        const sets = (dayLog[id].sets || []).filter((s: any) => s.kg || s.reps || s.seconds);
        const txt = sets.map((s: any) => s.seconds ? `${s.seconds}s` : `${s.kg || '-'}×${s.reps || '-'}`).join(',');
        return `${id}:${txt}`;
      })
      .join(' · ');
    recentSessions.push(`${d}: ${exSummaries}`);
    if (recentSessions.length >= 2) break;
  }

  const lines: string[] = [];
  lines.push(`SESSION: ${sessionType.toUpperCase()} BODY · ${today}`);
  lines.push("");
  lines.push("USER:");
  if (personal.age) lines.push(`  ${personal.age}yo ${personal.sex || ''}, phase: ${personal.phase || 'cut'}`);
  if (profile.targetWeight && profile.targetBF) lines.push(`  Goal: ${profile.targetWeight}kg @ ${profile.targetBF}% BF${personal.targetLBMStretch ? ` (stretch LBM target ${personal.targetLBMStretch}kg)` : ''}`);
  const meds = (profile.medications || []).map((m: any) => m.name).filter(Boolean);
  if (meds.length > 0) lines.push(`  Medications: ${meds.join(', ')}`);
  // Highlight notable blood markers
  const bm = profile.bloodMarkers || [];
  const flagged = bm.filter((m: any) => m.value != null && ((m.refHigh != null && m.value > m.refHigh) || (m.refLow != null && m.value < m.refLow)))
    .slice(0, 5).map((m: any) => `${m.name} ${m.value}${m.unit || ''}`).join(', ');
  if (flagged) lines.push(`  Out-of-range markers: ${flagged}`);
  lines.push("");

  lines.push("TODAY:");
  const rcv: string[] = [];
  if (todayRec.readiness != null) rcv.push(`readiness ${todayRec.readiness}`);
  if (todayRec.hrv != null) rcv.push(`HRV ${todayRec.hrv}`);
  if (todayRec.restingHR != null) rcv.push(`RHR ${todayRec.restingHR}`);
  if (rcv.length) lines.push(`  Recovery: ${rcv.join(' · ')}`);
  if (lastSleep.hours != null) {
    const stages = (lastSleep.remMin != null || lastSleep.deepMin != null) ? ` (REM ${lastSleep.remMin ?? '?'}m, deep ${lastSleep.deepMin ?? '?'}m)` : '';
    lines.push(`  Sleep last night: ${lastSleep.hours}h${stages}`);
  }
  if (yProtein > 0) lines.push(`  Yesterday's intake: ${yKcal}kcal, ${yProtein}g protein`);
  // Phase 40: today's nutrition so far + water + injuries
  const todayFoods = (state.foods || {})[today] || [];
  if (todayFoods.length) {
    const tCals = todayFoods.reduce((s: number, f: any) => s + (+f.cals || 0), 0);
    const tProt = todayFoods.reduce((s: number, f: any) => s + (+f.protein || 0), 0);
    lines.push(`  Today so far: ${tCals}kcal, ${tProt}g protein (${todayFoods.length} items logged)`);
  } else {
    lines.push("  Today so far: nothing logged yet — pre-workout fuel may be missing");
  }
  const todayWater = (state.waterLog || {})[today];
  if (todayWater) lines.push(`  Water today: ${todayWater.total || 0}ml`);
  const activeInj = Object.values(state.injuries || {}).filter((j: any) => j && j.status !== "resolved");
  if (activeInj.length) {
    lines.push("  ACTIVE INJURIES: " + (activeInj as any[]).map((j) => `${j.name} (${j.severity}) — lifts: ${(j.affectedExercises || []).join(",")}`).join("; "));
  }
  if (new Date(today + "T12:00:00").getDay() === 3) {
    lines.push("  Wednesday = Mounjaro injection day — keep intensity moderate, train before the injection if possible.");
  }
  // Phase 44: pre-session feel (asked before any prescription was shown)
  const todayFeel = (state.sessionFeel || {})[today];
  if (todayFeel) lines.push(`  Pre-session feel (self-reported, unanchored): ${todayFeel}`);
  const todayOv = (state.recoveryOverrides || {})[today];
  if (todayOv?.choice) lines.push(`  Recovery gate fired today (readiness ${todayOv.readiness ?? "?"}) — user chose to ${todayOv.choice === "train" ? "TRAIN AS PLANNED" : "take it easy"}.`);
  lines.push("");

  // Phase 44: last 3 gate-override outcomes — cite when relevant, e.g.
  // "last time you trained through at readiness 55 you scored 104%".
  const ovAll = state.recoveryOverrides || {};
  const ovDates = Object.keys(ovAll).filter((d) => d < today).sort().slice(-3);
  if (ovDates.length) {
    lines.push("RECOVERY OVERRIDE HISTORY (past gate firings — reference these when today's gate fired):");
    for (const d of ovDates) {
      const ov: any = ovAll[d];
      const score = (state.exLog || {})[d]?._session?.score;
      lines.push(`  ${d}: readiness ${ov.readiness ?? "?"} · felt ${ov.feel || "?"} · chose ${ov.choice || "?"} → ${score?.pct != null ? `scored ${score.pct}% of 4w avg` : "no session score"}`);
    }
    lines.push("");
  }

  lines.push("TODAY'S PRESCRIPTIONS (formula-computed — DO NOT change):");
  const exNotes = state.exerciseNotes || {};
  for (const p of prescriptions) {
    const target = p.seconds ? `${p.seconds}s` : (p.kg != null ? `${p.kg}kg × ${p.reps} reps` : '—');
    const flags: string[] = [];
    if (p.deload) flags.push('DELOAD');
    if (p.recovery === 'low') flags.push('HOLD (low recovery)');
    // Phase 47: surface the user's running note for this lift so the cue respects it
    const note = exNotes[p.exId] && exNotes[p.exId].note ? ` — NOTE: ${exNotes[p.exId].note}` : '';
    lines.push(`  ${p.exId} ${p.name}: ${target}${flags.length ? ' [' + flags.join(', ') + ']' : ''}${note}`);
  }
  lines.push("");

  if (recentSessions.length > 0) {
    lines.push("RECENT SAME-TYPE SESSIONS (for context):");
    for (const r of recentSessions) lines.push(`  ${r}`);
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 1500,
    system: SESSION_BRIEF_SYSTEM,
    tools: [{
      name: "submit_brief",
      description: "Submit the session brief.",
      input_schema: {
        type: "object" as const,
        properties: {
          strategy: { type: "string", description: "2-3 sentences setting today's tone" },
          perExercise: {
            type: "array",
            items: {
              type: "object",
              properties: {
                exId: { type: "string", description: "Must match an exId from the prescriptions list" },
                cue: { type: "string", description: "One short sentence cue" },
              },
              required: ["exId", "cue"],
            },
          },
        },
        required: ["strategy", "perExercise"],
      },
    }],
    tool_choice: { type: "tool", name: "submit_brief" },
    messages: [{ role: "user", content: lines.join("\n") }],
  });

  const toolBlock = response.content.find((b: any) => b.type === "tool_use") as any;
  if (!toolBlock) throw new Error("Model did not return a structured brief");
  return toolBlock.input as SessionBrief;
}

export async function generateSessionReflection(
  userId: string,
  sessionType: string,
  completedSession: Record<string, any>,
): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  const encKey = state.coachingKey as string | undefined;
  if (!encKey) throw new Error("No Anthropic API key configured");
  let apiKey: string;
  try { apiKey = decrypt(encKey); }
  catch { throw new Error("Failed to decrypt API key"); }

  const summary = Object.entries(completedSession || {}).map(([exId, log]: [string, any]) => {
    const sets = ((log && log.sets) || []).filter((s: any) => s.kg || s.reps || s.seconds);
    if (sets.length === 0) return null;
    const txt = sets.map((s: any) => s.seconds ? `${s.seconds}s` : `${s.kg || '-'}×${s.reps || '-'}${s.effort ? `(${s.effort})` : ''}`).join(', ');
    return `${exId}: ${txt}`;
  }).filter(Boolean).join('\n');

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 200,
    system: SESSION_REFLECTION_SYSTEM,
    messages: [{ role: "user", content: `Session type: ${sessionType.toUpperCase()}\n\nCompleted:\n${summary || '(nothing logged)'}` }],
  });

  const textBlock = response.content.find((b: any) => b.type === "text") as any;
  return (textBlock?.text || "Session complete.").trim();
}

// --- Phase 32: realistic max LBM projection ---

const MAX_LBM_SYSTEM = `You are a sports physiologist analysing a single user's realistic upper bound for lean body mass (LBM).

Your job:
1. Compute a HONEST, evidence-based projection of this user's realistic LBM ceiling over 24 months.
2. Account for: age (sarcopenia), sex, current LBM + training tier, blood markers (especially testosterone, HbA1c), medications (especially GLP-1 agonists which can blunt lean mass gain), training history.
3. Give three scenarios — conservative, realistic, optimistic — with kg LBM targets and resulting body weight at 15% BF.
4. Be honest about constraints. Older lifters past 50 gain LBM at ~0.3-0.5kg/month MAX during dedicated build phases. Low testosterone slows this further. GLP-1 medications during weight loss can cause modest lean mass loss.
5. Recommend a phase sequence (cut → recomp → lean bulk → cut again, or similar).
6. Cite numbers from the user's data — do not generalise.

MEDICAL CONTEXT THAT SHAPES THE LBM CEILING (read from the context blocks):
- Testosterone: if below ~12 nmol/L, natural anabolic capacity is reduced — the no-TRT ceiling is lower. If TRT were ever prescribed, the optimistic scenario could be ~4-6kg higher; present that ONLY as a hypothetical, never a recommendation to seek TRT.
- HbA1c: elevated HbA1c = insulin resistance = poorer nutrient partitioning. As HbA1c improves, the realistic ceiling rises — say so explicitly.
- Age past 50: anabolic resistance means 40g+ protein per meal is required to trigger MPS — note whether the data shows this is being met.
- GLP-1 medication: preserves muscle better than diet-alone fat loss, so body recomposition is favourable — but does not raise the absolute ceiling.
KEY LEVERS to state in the output, ranked: (1) testosterone optimisation — natural routes first; (2) HbA1c improvement; (3) progressive-overload consistency; (4) sleep optimisation for GH release. Frame the conservative ceiling as "no TRT", realistic as "no TRT, everything else optimised", optimistic as "with TRT if a doctor prescribes it".`;

export interface MaxLBMProjection {
  conservativeLBM: number;
  realisticLBM: number;
  optimisticLBM: number;
  conservativeWeightAt15: number;
  realisticWeightAt15: number;
  optimisticWeightAt15: number;
  timelineMonths: number;
  phaseSequence: string;
  rationale: string;
  keyConstraints: string[];
}

export async function computeMaxLBM(userId: string): Promise<MaxLBMProjection> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  const encKey = state.coachingKey as string | undefined;
  if (!encKey) throw new Error("No Anthropic API key configured");
  let apiKey: string;
  try { apiKey = decrypt(encKey); }
  catch { throw new Error("Failed to decrypt API key"); }

  const context = buildContext(state);
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: MAX_LBM_SYSTEM,
    tools: [{
      name: "submit_max_lbm",
      description: "Submit the realistic LBM projection.",
      input_schema: {
        type: "object" as const,
        properties: {
          conservativeLBM: { type: "number", description: "LBM kg in 'preservation-only' scenario" },
          realisticLBM:    { type: "number", description: "LBM kg in 'realistic best-case' scenario with good adherence" },
          optimisticLBM:   { type: "number", description: "LBM kg in 'optimistic scenario' — best case without unrealistic assumptions" },
          conservativeWeightAt15: { type: "number", description: "Total weight at 15% BF in conservative scenario" },
          realisticWeightAt15:    { type: "number" },
          optimisticWeightAt15:   { type: "number" },
          timelineMonths: { type: "number", description: "Months from now to reach realistic scenario" },
          phaseSequence: { type: "string", description: "Recommended phase sequence, e.g. 'Cut 6mo → recomp 3mo → lean bulk 6mo → mini-cut 2mo'" },
          rationale: { type: "string", description: "1-paragraph explanation citing the user's specific data" },
          keyConstraints: { type: "array", items: { type: "string" }, description: "3-5 specific factors limiting this user's ceiling" },
        },
        required: ["conservativeLBM", "realisticLBM", "optimisticLBM", "conservativeWeightAt15", "realisticWeightAt15", "optimisticWeightAt15", "timelineMonths", "phaseSequence", "rationale", "keyConstraints"],
      },
    }],
    tool_choice: { type: "tool", name: "submit_max_lbm" },
    messages: [{ role: "user", content: `Analyse this user's data and project their realistic LBM ceiling.\n\n${context}` }],
  });

  const toolBlock = response.content.find((b: any) => b.type === "tool_use") as any;
  if (!toolBlock) throw new Error("Model did not return a structured projection");
  return toolBlock.input as MaxLBMProjection;
}

export async function saveMealPlan(userId: string, plan: GeneratedMealPlan): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  state.mealPlan = plan;
  state.lastMealPlanRegenAt = new Date().toISOString();
  await prisma.user.update({ where: { id: userId }, data: { state } });
}

// --- Phase 26a: recompute macros for existing items (keeps items, fills correct macros) ---

const MACRO_RECOMPUTE_SYSTEM = `You are a nutrition database. For each food item provided, return accurate macro estimates using standard UK supermarket / USDA reference values.

Rules:
- For mixed items ("3 eggs + 6 egg whites scrambled with 1 tsp olive oil"), compute the TOTAL for the combined portion as written.
- For raw weights ("200g raw chicken breast"), use raw values.
- For cooked weights, use cooked values.
- For prepared dishes, sum the components.
- Be precise to within ±5% of canonical reference values.
- Round to whole numbers.`;

export async function recomputeMealPlanMacros(userId: string): Promise<{ updated: number; total: number; skipped: number }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const state: any = user.state || {};
  if (!state.mealPlan?.meals?.length) throw new Error("No meal plan to update");
  const encKey = state.coachingKey as string | undefined;
  if (!encKey) throw new Error("No Anthropic API key configured");
  let apiKey: string;
  try { apiKey = decrypt(encKey); }
  catch { throw new Error("Failed to decrypt API key"); }

  // Collect all non-edited ingredients across all meals
  type Slot = { mealIdx: number; ingIdx: number; name: string };
  const slots: Slot[] = [];
  let skipped = 0;
  state.mealPlan.meals.forEach((m: any, mi: number) => {
    if (!Array.isArray(m.ingredients)) return;
    m.ingredients.forEach((ing: any, ii: number) => {
      if (ing.edited) { skipped++; return; }
      if (!ing.name) return;
      slots.push({ mealIdx: mi, ingIdx: ii, name: String(ing.name) });
    });
  });

  if (slots.length === 0) return { updated: 0, total: 0, skipped };

  const client = new Anthropic({ apiKey });
  const itemsList = slots.map((s, i) => `${i + 1}. ${s.name}`).join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: MACRO_RECOMPUTE_SYSTEM,
    tools: [{
      name: "submit_macros",
      description: "Submit per-item macros, one entry per input item.",
      input_schema: {
        type: "object" as const,
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                index: { type: "number", description: "1-based input index, must match the prompt numbering" },
                cals: { type: "number" },
                protein: { type: "number" },
                carbs: { type: "number" },
                fat: { type: "number" },
              },
              required: ["index", "cals", "protein", "carbs", "fat"],
            },
          },
        },
        required: ["items"],
      },
    }],
    tool_choice: { type: "tool", name: "submit_macros" },
    messages: [{ role: "user", content: `Compute exact macros per item:\n\n${itemsList}` }],
  });

  const toolBlock = response.content.find((b: any) => b.type === "tool_use") as any;
  if (!toolBlock) throw new Error("Model did not return structured macros");
  const result = toolBlock.input as { items: Array<{ index: number; cals: number; protein: number; carbs: number; fat: number }> };

  const newPlan = JSON.parse(JSON.stringify(state.mealPlan));
  let updated = 0;
  for (const item of result.items) {
    const slot = slots[item.index - 1];
    if (!slot) continue;
    const ing = newPlan.meals[slot.mealIdx].ingredients[slot.ingIdx];
    if (ing.edited) continue;
    ing.cals    = Math.max(0, Math.round(item.cals    || 0));
    ing.protein = Math.max(0, Math.round(item.protein || 0));
    ing.carbs   = Math.max(0, Math.round(item.carbs   || 0));
    ing.fat     = Math.max(0, Math.round(item.fat     || 0));
    updated++;
  }

  // Recompute meal totals from ingredients
  for (const meal of newPlan.meals) {
    if (!Array.isArray(meal.ingredients)) continue;
    meal.cals    = meal.ingredients.reduce((s: number, i: any) => s + (i.cals    || 0), 0);
    meal.protein = meal.ingredients.reduce((s: number, i: any) => s + (i.protein || 0), 0);
    meal.carbs   = meal.ingredients.reduce((s: number, i: any) => s + (i.carbs   || 0), 0);
    meal.fat     = meal.ingredients.reduce((s: number, i: any) => s + (i.fat     || 0), 0);
  }

  state.mealPlan = newPlan;
  state.lastMealPlanRegenAt = new Date().toISOString();
  await prisma.user.update({ where: { id: userId }, data: { state } });

  return { updated, total: slots.length, skipped };
}
