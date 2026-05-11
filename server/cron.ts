import cron from "node-cron";
import webpush from "web-push";
import prisma from "./db";
import { syncOuraForAllUsers } from "./oura";
import { syncWithingsForAllUsers } from "./withings";

function ukToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function ukDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

async function sendPushToUser(userId: string, payload: { title: string; body: string }): Promise<void> {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  const data = JSON.stringify(payload);
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        data
      );
    } catch (e: any) {
      if (e?.statusCode === 410 || e?.statusCode === 404) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
      }
    }
  }
}

const fired = new Map<string, Set<string>>();

export function startCron() {
  console.log("Push notification cron started");
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const uk = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(now);
      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(now);

      const dayKey = date;
      if (!fired.has(dayKey)) {
        fired.clear();
        fired.set(dayKey, new Set());
      }
      const firedSet = fired.get(dayKey)!;

      const users = await prisma.user.findMany({
        where: { pushSubscriptions: { some: {} } },
        include: { pushSubscriptions: true },
      });

      for (const user of users) {
        const state: any = user.state;

        // Meal plan notifications
        const meals = state?.mealPlan?.meals;
        if (Array.isArray(meals)) {
          for (const meal of meals) {
            if (meal.time !== uk) continue;
            const fireKey = `${user.id}:${meal.id}`;
            if (firedSet.has(fireKey)) continue;
            firedSet.add(fireKey);

            const body = (meal.ingredients || `${meal.cals} kcal · ${meal.protein}g protein`).slice(0, 200);
            const payload = JSON.stringify({
              title: `${meal.time} — ${meal.name}`,
              body,
              mealId: meal.id,
            });

            for (const sub of user.pushSubscriptions) {
              try {
                await webpush.sendNotification(
                  { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                  payload
                );
              } catch (e: any) {
                if (e?.statusCode === 410 || e?.statusCode === 404) {
                  await prisma.pushSubscription.delete({ where: { id: sub.id } });
                }
              }
            }
          }
        }

        // Generic reminders
        const reminders = state?.reminders || [];
        for (const r of reminders) {
          if (r.time !== uk) continue;
          const dayOfWeek = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' })).getDay();
          if (Array.isArray(r.daysOfWeek) && !r.daysOfWeek.includes(dayOfWeek)) continue;
          if (r.frequency === 'biweekly') {
            const weekStart = new Date(now);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            const weekNum = Math.floor((weekStart.getTime() - new Date('2026-01-01').getTime()) / (7 * 24 * 60 * 60 * 1000));
            if (r.weekParity === 'even' && weekNum % 2 !== 0) continue;
            if (r.weekParity === 'odd' && weekNum % 2 !== 1) continue;
          }
          const fireKey = `reminder:${user.id}:${r.id}`;
          if (firedSet.has(fireKey)) continue;
          firedSet.add(fireKey);

          const payload = JSON.stringify({
            title: r.title || "Forge reminder",
            body: r.body || "",
            reminderId: r.id,
          });

          for (const sub of user.pushSubscriptions) {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload
              );
            } catch (e: any) {
              if (e?.statusCode === 410 || e?.statusCode === 404) {
                await prisma.pushSubscription.delete({ where: { id: sub.id } });
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Cron error:", err);
    }
  });

  // Hourly Oura sync — runs at :00 every hour, all day
  cron.schedule("0 * * * *", async () => {
    console.log("Running hourly Oura sync...");
    try {
      await syncOuraForAllUsers();
      console.log("Hourly Oura sync complete");
    } catch (err) {
      console.error("Hourly Oura sync error:", err);
    }
  }, { timezone: "Europe/London" });

  // Hourly Withings sync — runs at :15 every hour
  cron.schedule("15 * * * *", async () => {
    console.log("Running hourly Withings sync...");
    try {
      await syncWithingsForAllUsers();
      console.log("Hourly Withings sync complete");
    } catch (err) {
      console.error("Hourly Withings sync error:", err);
    }
  }, { timezone: "Europe/London" });

  // Daily 22:00 UK — evening adherence check
  cron.schedule("0 22 * * *", async () => {
    console.log("Running daily evening adherence check...");
    try {
      const today = ukToday();
      const users = await prisma.user.findMany();
      for (const user of users) {
        const state: any = user.state || {};
        const profile = state.profile || {};
        if (!profile.proteinTarget) continue;

        const todayFoods = (state.foods || {})[today] || [];
        const totalProtein = todayFoods.reduce((s: number, f: any) => s + (f.protein || 0), 0);
        const totalCals = todayFoods.reduce((s: number, f: any) => s + (f.cals || 0), 0);

        // No food logged + eating window is closed
        if (todayFoods.length === 0) {
          await sendPushToUser(user.id, {
            title: "🍽 No food logged today",
            body: "Was this fasting or did you forget to log? Open Forge → Food to add retrospectively."
          });
          continue;
        }

        // Protein under 80% of target
        const proteinTarget = profile.proteinTarget;
        if (totalProtein < proteinTarget * 0.8) {
          await sendPushToUser(user.id, {
            title: "🥩 Protein under target today",
            body: `${totalProtein}g of ${proteinTarget}g target. A scoop of whey covers the gap if it's not too late.`
          });
        }

        // Calorie wildly off (huge under-eat is a red flag with Mounjaro)
        const calTarget = profile.calsRest || 2400;
        if (totalCals > 0 && totalCals < calTarget * 0.6) {
          await sendPushToUser(user.id, {
            title: "⚠️ Significant under-eating today",
            body: `${totalCals} kcal logged · target ${calTarget}. Under-eating slows fat loss + risks muscle. Get a shake in.`
          });
        }
      }
      console.log("Daily evening check complete");
    } catch (err) {
      console.error("Daily evening check error:", err);
    }
  }, { timezone: "Europe/London" });

  // Sunday 21:00 UK — weekly numbers preview (lighter than Cowork's full Sunday report)
  cron.schedule("0 21 * * 0", async () => {
    console.log("Running Sunday weekly summary...");
    try {
      const users = await prisma.user.findMany();
      for (const user of users) {
        const state: any = user.state || {};
        const weightLog = state.weightLog || [];
        const sleepLog = state.sleepLog || {};
        const stepsLog = state.stepsLog || {};
        const exLog = state.exLog || {};

        if (weightLog.length < 7) continue;

        // 7-day weight delta
        const sorted = [...weightLog].sort((a: any, b: any) => a.date.localeCompare(b.date));
        const recent = sorted.slice(-7);
        const prev = sorted.slice(-14, -7);
        const recentAvg = recent.reduce((s: number, e: any) => s + e.weight, 0) / recent.length;
        const prevAvg = prev.length ? prev.reduce((s: number, e: any) => s + e.weight, 0) / prev.length : recentAvg;
        const delta = recentAvg - prevAvg;

        // Sleep avg this week
        const last7 = Array.from({ length: 7 }, (_, i) => ukDaysAgo(i));
        const sleepHours = last7.map(d => sleepLog[d]?.hours).filter((h: any): h is number => typeof h === "number");
        const avgSleep = sleepHours.length ? sleepHours.reduce((a: number, b: number) => a + b, 0) / sleepHours.length : 0;

        // Training days hit
        const trainingDays = last7.filter(d => {
          const day = exLog[d] || {};
          return Object.values(day).filter((e: any) => e.done).length >= 4;
        }).length;

        // Steps days >= 10k
        const stepsHit = last7.filter(d => (stepsLog[d] || 0) >= 10000).length;

        const deltaStr = delta < 0 ? `down ${Math.abs(delta).toFixed(1)}kg` : delta > 0 ? `up ${delta.toFixed(1)}kg` : "flat";
        await sendPushToUser(user.id, {
          title: "📊 Week in numbers",
          body: `Weight ${deltaStr} · ${trainingDays} training days · sleep ${avgSleep.toFixed(1)}h avg · ${stepsHit}/7 step days. Full review lands Sunday 9am from Cowork.`
        });
      }
      console.log("Weekly summary complete");
    } catch (err) {
      console.error("Weekly summary error:", err);
    }
  }, { timezone: "Europe/London" });
}
