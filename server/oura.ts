import prisma from "./db";
import { readToken, isEncryptedToken, writeToken } from "./token-crypto";
import { mergeStateMap, setStateKey } from "./state-merge";
import { analyzeAllWalks, analyzeHrWindow, isWalkActivity, WalkInput, HrSample } from "./walk-analysis";

const BASE = "https://api.ouraring.com/v2/usercollection";
const HR_RETENTION_DAYS = 60; // raw HR kept ~60 days (server-only, pruned each sync)

function ymd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

function mapSleepQuality(score: number): number {
  if (score >= 85) return 4;
  if (score >= 70) return 3;
  if (score >= 55) return 2;
  return 1;
}

async function ouraGet(token: string, path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${BASE}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err: any = new Error(`Oura ${path} ${res.status}: ${await res.text().catch(() => "")}`);
    err.status = res.status; // 401 = expired/invalid token (see syncOuraForUser)
    throw err;
  }
  return res.json();
}

// Heartrate is a time-series and can paginate via next_token. Pull all pages in
// the window (start_datetime/end_datetime are ISO, per Oura v2 heartrate docs).
async function ouraGetHeartrate(token: string, startIso: string, endIso: string): Promise<Array<{ bpm: number; timestamp: string; source?: string }>> {
  const out: Array<{ bpm: number; timestamp: string; source?: string }> = [];
  let nextToken: string | null = null;
  let guard = 0;
  do {
    const params: Record<string, string> = { start_datetime: startIso, end_datetime: endIso };
    if (nextToken) params.next_token = nextToken;
    const page: any = await ouraGet(token, "heartrate", params);
    for (const s of page.data || []) {
      if (typeof s?.bpm === "number" && s?.timestamp) out.push({ bpm: s.bpm, timestamp: s.timestamp, source: s.source });
    }
    nextToken = page.next_token || null;
  } while (nextToken && ++guard < 20);
  return out;
}

export async function syncOuraForUser(userId: string): Promise<{ updated: number; error?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { updated: 0, error: "User not found" };
  const state: any = user.state || {};
  const storedToken = state.ouraToken;
  if (!storedToken) return { updated: 0, error: "No Oura token configured" };
  const token = readToken(storedToken);
  if (!token) return { updated: 0, error: "Oura connection needs refreshing — please reconnect in More settings" };
  // Lazy migration of a legacy plaintext PAT is persisted via its own key at the
  // end of a successful sync (not by rewriting the whole state object).

  const today = new Date();
  const start = new Date(); start.setDate(start.getDate() - 7);
  const endQuery = new Date(); endQuery.setDate(endQuery.getDate() + 1); // include tomorrow in case Oura attributes daytime sleep there
  const params = { start_date: ymd(start), end_date: ymd(endQuery) };

  let updated = 0;
  try {
    const [dailySleep, sleepDetail, readiness, activity, workouts, vo2Resp] = await Promise.all([
      ouraGet(token, "daily_sleep", params),
      ouraGet(token, "sleep", params),
      ouraGet(token, "daily_readiness", params),
      ouraGet(token, "daily_activity", params),
      ouraGet(token, "workout", params),
      // Phase 41h: VO2 max — not all users have it; tolerate failure silently
      ouraGet(token, "vO2_max", params).catch(() => ({ data: [] })),
    ]);

    const existingSleep = state.sleepLog || {};
    const existingWorkouts = state.ouraWorkouts || {};

    // Phase 64: race-safe writes. Build PARTIAL maps containing only the entries
    // this sync writes, then merge each per-key into the LIVE column (jsonb ||).
    // The old code copied state.<key>, mutated it, and rewrote the whole state
    // object — which clobbered any concurrent write to a sibling key/date (e.g. a
    // meal the user logged during the hourly sync).
    const sleepPartial: Record<string, any> = {};
    const stepsPartial: Record<string, number> = {};
    const recoveryPartial: Record<string, any> = {};
    const caloriePartial: Record<string, any> = {};
    const workoutsPartial: Record<string, any[]> = {};
    const workoutDaysTouched = new Set<string>();
    const vo2Partial: Record<string, any> = {};

    // Sleep score -> quality 1-4
    const scoreByDay: Record<string, number> = {};
    for (const e of dailySleep.data || []) {
      scoreByDay[e.day] = e.score;
    }
    // Sleep duration — only count main overnight sleep, skip naps/short rests
    // Oura type values: "long_sleep" = main overnight, "sleep" = main sleep, "late_nap" = nap, "rest" = quiet rest, "deleted" = ignored
    const durationByDay: Record<string, number> = {};
    const stagesByDay: Record<string, { rem: number; deep: number; light: number; awake: number }> = {};
    // Phase 61: bedtime hour (local clock, e.g. 23.5 = 11:30pm) of the MAIN sleep
    // per day — feeds the report card's sleep-timing grade. The time portion of
    // Oura's bedtime_start ISO is already in the user's local zone.
    const bedtimeByDay: Record<string, number> = {};
    const bedtimeDurByDay: Record<string, number> = {};
    // Phase 89: REAL physiological resting HR (bpm) + HRV (ms) from the main sleep —
    // NOT the 0-100 readiness contributor SCORES (which is all state.recovery has).
    const vitalsByDay: Record<string, { rhr: number | null; hrv: number | null }> = {};
    for (const e of sleepDetail.data || []) {
      if (e.type === "deleted") continue;
      const seconds = e.total_sleep_duration || 0;
      if ((e.type === "late_nap" || e.type === "rest") && seconds < 18000) continue;
      if (seconds < 10800) continue;
      const day = e.day;
      durationByDay[day] = (durationByDay[day] || 0) + seconds;
      if (e.bedtime_start && seconds > (bedtimeDurByDay[day] || 0)) {
        const bm = String(e.bedtime_start).match(/T(\d{2}):(\d{2})/);
        if (bm) { bedtimeByDay[day] = parseInt(bm[1], 10) + parseInt(bm[2], 10) / 60; bedtimeDurByDay[day] = seconds; }
        // vitals ride with the longest sleep of the day (same "main sleep" gate)
        vitalsByDay[day] = {
          rhr: typeof e.lowest_heart_rate === "number" ? e.lowest_heart_rate : null,
          hrv: typeof e.average_hrv === "number" ? e.average_hrv : null,
        };
      }
      // Phase 29: capture sleep stages
      if (!stagesByDay[day]) stagesByDay[day] = { rem: 0, deep: 0, light: 0, awake: 0 };
      stagesByDay[day].rem   += e.rem_sleep_duration   || 0;
      stagesByDay[day].deep  += e.deep_sleep_duration  || 0;
      stagesByDay[day].light += e.light_sleep_duration || 0;
      stagesByDay[day].awake += e.awake_time           || 0;
    }
    // Build list of all days in the lookback window
    const allDays: string[] = [];
    const cursor = new Date(start);
    const endStr = ymd(today);
    while (ymd(cursor) <= endStr) {
      allDays.push(ymd(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    // For each day: if we have valid sleep duration, store it. Otherwise delete any stale entry.
    // Skip days where user logged manually — manual wins.
    for (const day of allDays) {
      if (existingSleep[day]?.source === "manual") continue; // manual entries win — never overwritten
      if (durationByDay[day]) {
        const hours = Math.round((durationByDay[day] / 3600) * 10) / 10;
        const s = stagesByDay[day];
        const stages = s ? {
          remMin:   Math.round(s.rem   / 60),
          deepMin:  Math.round(s.deep  / 60),
          lightMin: Math.round(s.light / 60),
          awakeMin: Math.round(s.awake / 60),
        } : undefined;
        sleepPartial[day] = { hours, quality: scoreByDay[day] ? mapSleepQuality(scoreByDay[day]) : 3, source: "oura", ...(stages || {}), ...(bedtimeByDay[day] != null ? { bedtime: Math.round(bedtimeByDay[day] * 100) / 100 } : {}) };
        updated++;
      }
      // No-data branch removed — never delete existing entries on a sync that doesn't return that day.
      // Stale-data risk is much smaller than data-loss risk from aggressive deletion.
    }

    // Steps + calories from daily activity
    const manualSteps = state.manualSteps || {};
    for (const e of activity.data || []) {
      if (typeof e.steps === "number") {
        // Phase 41: manual step entries override Oura sync
        if (!manualSteps[e.day]) {
          stepsPartial[e.day] = e.steps;
          updated++;
        }
      }
      if (typeof e.total_calories === "number" || typeof e.active_calories === "number") {
        caloriePartial[e.day] = {
          total: e.total_calories ?? null,
          active: e.active_calories ?? null,
          target: e.target_calories ?? null,
        };
        updated++;
      }
    }

    // Readiness + HRV
    for (const e of readiness.data || []) {
      const day = e.day;
      recoveryPartial[day] = {
        readiness: e.score ?? null,
        hrv: e.contributors?.hrv_balance ?? null,
        restingHR: e.contributors?.resting_heart_rate ?? null,
      };
    }

    // Workouts (auto-detected + manually tagged). A shallow jsonb merge replaces a
    // whole day's array, so build each touched day's FULL array (existing snapshot
    // + new deduped) and only write days that actually gained a workout.
    for (const w of workouts.data || []) {
      const day = w.day;
      if (!workoutsPartial[day]) workoutsPartial[day] = Array.isArray(existingWorkouts[day]) ? [...existingWorkouts[day]] : [];
      if (workoutsPartial[day].some((x: any) => x.id === w.id)) continue; // dedupe by id
      workoutsPartial[day].push({
        id: w.id,
        activity: w.activity,
        intensity: w.intensity,
        source: w.source,
        start: w.start_datetime,
        end: w.end_datetime,
        calories: w.calories,
        distance: typeof w.distance === "number" ? w.distance : null, // Phase 89: meters (nullable) — pace
      });
      workoutDaysTouched.add(day);
      updated++;
    }
    // Only merge days that actually gained a workout (skip pure-duplicate days).
    const workoutsToWrite: Record<string, any[]> = {};
    for (const day of workoutDaysTouched) workoutsToWrite[day] = workoutsPartial[day];

    // Phase 41h: VO2 max — keep the most recent reading per day
    for (const e of (vo2Resp.data || [])) {
      if (!e?.day || typeof e?.vo2_max !== "number") continue;
      vo2Partial[e.day] = { vo2: Math.round(e.vo2_max * 10) / 10, timestamp: e.timestamp || null };
      updated++;
    }

    // Phase 89: HR time-series → server-only raw store (pruned to 60 days), then
    // walk analysis (avg/max HR + drift) for every walking workout + manual walk.
    const hrStartIso = new Date(ymd(start) + "T00:00:00Z").toISOString();
    const hrEndIso = new Date(ymd(endQuery) + "T00:00:00Z").toISOString();
    // Tolerate a heartrate failure (e.g. missing scope) without killing the sync.
    const hrSamples = await ouraGetHeartrate(token, hrStartIso, hrEndIso).catch(() => []);
    const hrMap: Record<string, number> = { ...(state.ouraHeartrate || {}) };
    for (const s of hrSamples) hrMap[s.timestamp] = s.bpm;
    // prune anything older than the retention window
    const cutMs = Date.now() - HR_RETENTION_DAYS * 86400000;
    for (const iso in hrMap) { const t = Date.parse(iso); if (!isFinite(t) || t < cutMs) delete hrMap[iso]; }

    // Gather walks in the retained window: Oura walking workouts (existing snapshot
    // now includes this sync's writes) + the user's manual walks (state.walkLog).
    const walks: WalkInput[] = [];
    const mergedWorkouts: Record<string, any[]> = { ...existingWorkouts, ...workoutsToWrite };
    for (const day in mergedWorkouts) {
      for (const w of mergedWorkouts[day] || []) {
        if (isWalkActivity(w.activity) && w.start && w.end) {
          walks.push({ id: w.id, day, start: w.start, end: w.end, distanceM: w.distance ?? null, source: "oura", activity: w.activity });
        }
      }
    }
    const manualWalks = state.walkLog || {};
    for (const day in manualWalks) {
      for (const w of manualWalks[day] || []) {
        if (w && w.start && w.end) walks.push({ id: w.id, day, start: w.start, end: w.end, distanceM: w.distanceM ?? null, source: "manual" });
      }
    }
    const walkResults = analyzeAllWalks(walks, hrMap);

    // Phase 90: strength-session HR link — overlay the Oura HR series onto each
    // logged Forge session's own time window (exLog[date]._session.startedAt/
    // completedAt, epoch ms) → avg/max HR + drift. Match an overlapping Oura
    // workout's calories where present. Read-only join, keyed by date.
    const samples: HrSample[] = [];
    for (const iso in hrMap) { const t = Date.parse(iso); if (isFinite(t)) samples.push({ t, bpm: hrMap[iso] }); }
    samples.sort((a, b) => a.t - b.t);
    const sessionHrPartial: Record<string, any> = {};
    const exLog = state.exLog || {};
    for (const d in exLog) {
      const sess = exLog[d] && exLog[d]._session;
      if (!sess || !sess.startedAt || !sess.completedAt) continue;
      if (sess.completedAt < cutMs) continue; // outside the raw-HR retention window
      const h = analyzeHrWindow(sess.startedAt, sess.completedAt, samples);
      if (h.avgHR == null) continue; // no HR overlap yet — leave any prior result untouched
      // calories: the Oura workout whose window overlaps this session (if any)
      let calories: number | null = null;
      for (const w of (mergedWorkouts[d] || [])) {
        if (!w.start || !w.end) continue;
        const ws = Date.parse(w.start), we = Date.parse(w.end);
        if (ws <= sess.completedAt && we >= sess.startedAt && typeof w.calories === "number") { calories = w.calories; break; }
      }
      sessionHrPartial[d] = {
        avgHR: h.avgHR, maxHR: h.maxHR, minHR: h.minHR, hrDrift: h.hrDrift,
        durationMin: Math.round(((sess.completedAt - sess.startedAt) / 60000) * 10) / 10,
        calories, samples: h.samples, sessionType: sess.sessionType || null, source: "oura",
      };
      updated++;
    }

    // Phase 64: write each key on its own (atomic merge of only the changed
    // days), never the whole state object. Concurrent writes to other keys/dates
    // survive. No cross-key invariant here, so no transaction needed — a crash
    // mid-write self-heals on the next hourly sync.
    await mergeStateMap(userId, "sleepLog", sleepPartial);
    await mergeStateMap(userId, "stepsLog", stepsPartial);
    await mergeStateMap(userId, "recovery", recoveryPartial);
    await mergeStateMap(userId, "calorieLog", caloriePartial);
    await mergeStateMap(userId, "ouraWorkouts", workoutsToWrite);
    await mergeStateMap(userId, "vo2maxLog", vo2Partial);
    await mergeStateMap(userId, "ouraVitals", vitalsByDay);        // Phase 89: real RHR/HRV
    await mergeStateMap(userId, "walkAnalysis", walkResults);      // Phase 89: per-walk metrics
    await mergeStateMap(userId, "sessionHR", sessionHrPartial);    // Phase 90: strength-session HR
    await setStateKey(userId, "ouraHeartrate", hrMap);             // Phase 89: raw HR (server-only)
    await setStateKey(userId, "ouraLastSync", new Date().toISOString());
    if (state.ouraTokenInvalid) await setStateKey(userId, "ouraTokenInvalid", false); // clear a prior re-auth prompt
    // Lazy migration: re-encrypt a legacy plaintext PAT via its own key.
    if (!isEncryptedToken(storedToken)) await setStateKey(userId, "ouraToken", writeToken(token));
    return { updated };
  } catch (err: any) {
    console.error(`Oura sync failed for user ${userId}:`, err);
    // Phase 89: a 401 means the token is expired/revoked — flag it so the UI can
    // show a reconnect prompt (read-only integration, so we just re-prompt the PAT).
    if (err?.status === 401) {
      await setStateKey(userId, "ouraTokenInvalid", true).catch(() => {});
      return { updated: 0, error: "Oura connection expired — reconnect in More settings" };
    }
    return { updated: 0, error: err.message || "Sync failed" };
  }
}

export async function syncOuraForAllUsers(): Promise<void> {
  const users = await prisma.user.findMany();
  for (const user of users) {
    const state: any = user.state;
    if (!state?.ouraToken) continue;
    await syncOuraForUser(user.id).catch(e => console.error(`Sync error ${user.id}:`, e));
  }
}
