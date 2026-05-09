import cron from "node-cron";
import webpush from "web-push";
import prisma from "./db";
import { syncOuraForAllUsers } from "./oura";
import { syncWithingsForAllUsers } from "./withings";

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

  // Daily Oura sync at 08:00 UK time
  cron.schedule("0 8 * * *", async () => {
    console.log("Running daily Oura sync...");
    try {
      await syncOuraForAllUsers();
      console.log("Daily Oura sync complete");
    } catch (err) {
      console.error("Daily Oura sync error:", err);
    }
  }, { timezone: "Europe/London" });

  // Daily Withings sync at 08:15 UK time
  cron.schedule("15 8 * * *", async () => {
    console.log("Running daily Withings sync...");
    try {
      await syncWithingsForAllUsers();
      console.log("Daily Withings sync complete");
    } catch (err) {
      console.error("Daily Withings sync error:", err);
    }
  }, { timezone: "Europe/London" });
}
