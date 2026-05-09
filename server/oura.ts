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
    const [dailySleep, sleepDetail, readiness, activity] = await Promise.all([
      ouraGet(token, "daily_sleep", params),
      ouraGet(token, "sleep", params),
      ouraGet(token, "daily_readiness", params),
      ouraGet(token, "daily_activity", params),
    ]);

    const sleepLog = state.sleepLog || {};
    const stepsLog = state.stepsLog || {};
    const recovery = state.recovery || {};

    // Sleep score -> quality 1-4
    const scoreByDay: Record<string, number> = {};
    for (const e of dailySleep.data || []) {
      scoreByDay[e.day] = e.score;
    }
    // Sleep duration from detailed sleep (sum if multiple periods per day)
    const durationByDay: Record<string, number> = {};
    for (const e of sleepDetail.data || []) {
      const day = e.day;
      const seconds = e.total_sleep_duration || 0;
      durationByDay[day] = (durationByDay[day] || 0) + seconds;
    }
    for (const day of new Set([...Object.keys(scoreByDay), ...Object.keys(durationByDay)])) {
      const hours = durationByDay[day] ? Math.round((durationByDay[day] / 3600) * 10) / 10 : null;
      if (hours !== null && hours > 0) {
        sleepLog[day] = { hours, quality: scoreByDay[day] ? mapSleepQuality(scoreByDay[day]) : 3 };
        updated++;
      }
    }

    // Steps from daily activity
    for (const e of activity.data || []) {
      if (typeof e.steps === "number") {
        stepsLog[e.day] = e.steps;
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

    await prisma.user.update({
      where: { id: userId },
      data: {
        state: {
          ...state,
          sleepLog,
          stepsLog,
          recovery,
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
