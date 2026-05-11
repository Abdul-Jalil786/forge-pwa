import prisma from "./db";

const BASE = "https://api.ouraring.com/v2/usercollection";

function ymd(d: Date): string {
  return d.toISOString().split("T")[0];
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
  if (!res.ok) throw new Error(`Oura ${path} ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

export async function syncOuraForUser(userId: string): Promise<{ updated: number; error?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { updated: 0, error: "User not found" };
  const state: any = user.state || {};
  const token = state.ouraToken;
  if (!token) return { updated: 0, error: "No Oura token configured" };

  const today = new Date();
  const start = new Date(); start.setDate(start.getDate() - 7);
  const params = { start_date: ymd(start), end_date: ymd(today) };

  let updated = 0;
  try {
    const [dailySleep, sleepDetail, readiness, activity, workouts] = await Promise.all([
      ouraGet(token, "daily_sleep", params),
      ouraGet(token, "sleep", params),
      ouraGet(token, "daily_readiness", params),
      ouraGet(token, "daily_activity", params),
      ouraGet(token, "workout", params),
    ]);

    const sleepLog = state.sleepLog || {};
    const stepsLog = state.stepsLog || {};
    const recovery = state.recovery || {};
    const calorieLog = state.calorieLog || {};
    const ouraWorkouts = state.ouraWorkouts || {};

    // Sleep score -> quality 1-4
    const scoreByDay: Record<string, number> = {};
    for (const e of dailySleep.data || []) {
      scoreByDay[e.day] = e.score;
    }
    // Sleep duration — only count main overnight sleep, skip naps/short rests
    // Oura type values: "long_sleep" = main overnight, "sleep" = main sleep, "late_nap" = nap, "rest" = quiet rest, "deleted" = ignored
    const durationByDay: Record<string, number> = {};
    for (const e of sleepDetail.data || []) {
      if (e.type === "late_nap" || e.type === "rest" || e.type === "deleted") continue;
      const seconds = e.total_sleep_duration || 0;
      if (seconds < 10800) continue; // Skip anything under 3 hours (probably a nap mis-categorised)
      const day = e.day;
      durationByDay[day] = (durationByDay[day] || 0) + seconds;
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
    for (const day of allDays) {
      if (durationByDay[day]) {
        const hours = Math.round((durationByDay[day] / 3600) * 10) / 10;
        sleepLog[day] = { hours, quality: scoreByDay[day] ? mapSleepQuality(scoreByDay[day]) : 3 };
        updated++;
      } else if (sleepLog[day]) {
        // No valid main-sleep for this day in Oura — remove any stale (possibly nap-only) entry
        delete sleepLog[day];
        updated++;
      }
    }

    // Steps + calories from daily activity
    for (const e of activity.data || []) {
      if (typeof e.steps === "number") {
        stepsLog[e.day] = e.steps;
        updated++;
      }
      if (typeof e.total_calories === "number" || typeof e.active_calories === "number") {
        calorieLog[e.day] = {
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
      recovery[day] = {
        readiness: e.score ?? null,
        hrv: e.contributors?.hrv_balance ?? null,
        restingHR: e.contributors?.resting_heart_rate ?? null,
      };
    }

    // Workouts (auto-detected + manually tagged)
    for (const w of workouts.data || []) {
      const day = w.day;
      if (!ouraWorkouts[day]) ouraWorkouts[day] = [];
      // Avoid duplicates by id
      const existing = ouraWorkouts[day].find((x: any) => x.id === w.id);
      if (existing) continue;
      ouraWorkouts[day].push({
        id: w.id,
        activity: w.activity,
        intensity: w.intensity,
        source: w.source,
        start: w.start_datetime,
        end: w.end_datetime,
        calories: w.calories,
      });
      updated++;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        state: {
          ...state,
          sleepLog,
          stepsLog,
          recovery,
          calorieLog,
          ouraWorkouts,
          ouraLastSync: new Date().toISOString(),
        },
      },
    });
    return { updated };
  } catch (err: any) {
    console.error(`Oura sync failed for user ${userId}:`, err);
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
