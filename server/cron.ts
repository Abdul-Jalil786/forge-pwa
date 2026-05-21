import cron from "node-cron";
import webpush from "web-push";
import prisma from "./db";
import { syncOuraForAllUsers } from "./oura";
import { syncWithingsForAllUsers } from "./withings";
import { generateWeeklyReport, saveReport, hoursSinceLastReport, hoursSinceLastPlanRegen, recomputeMealPlanMacros } from "./ai-coach";

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

// Phase 40: push an in-app notification onto a user's state (deduped per day).
function addStateNotification(state: any, notif: { type: string; title: string; message: string }): boolean {
  if (!Array.isArray(state.notifications)) state.notifications = [];
  const today = ukToday();
  const key = `${notif.type}:${notif.title}:${today}`;
  if (state.notifications.some((n: any) => n && n._key === key)) return false;
  state.notifications.unshift({
    id: "notif_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    _key: key,
    type: notif.type,
    title: notif.title,
    message: notif.message,
    date: today,
    read: false,
    expiresAt: ukDaysAgo(-1), // expires tomorrow
  });
  if (state.notifications.length > 10) state.notifications = state.notifications.slice(0, 10);
  return true;
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

  // Daily 21:00 UK — missed supplements check
  cron.schedule("0 21 * * *", async () => {
    console.log("Running daily supplement adherence check...");
    try {
      const today = ukToday();
      const users = await prisma.user.findMany();
      for (const user of users) {
        const state: any = user.state || {};
        const supplements = state.supplements || [];
        if (supplements.length === 0) continue;
        const suppLog = (state.supplementLog || {})[today] || {};
        const missed = supplements.filter((s: any) => suppLog[s.id] !== true).length;
        if (missed >= 2) {
          await sendPushToUser(user.id, {
            title: "Supplements missed today",
            body: `${missed} supplements missed today \u2014 open Forge to log if you took them.`
          });
        }
      }
      console.log("Supplement adherence check complete");
    } catch (err) {
      console.error("Supplement adherence check error:", err);
    }
  }, { timezone: "Europe/London" });

  // Sunday 21:00 UK — weekly numbers preview (lighter than the AI Coach's full Sunday report)
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
          body: `Weight ${deltaStr} · ${trainingDays} training days · sleep ${avgSleep.toFixed(1)}h avg · ${stepsHit}/7 step days. Coach review lands Sunday 9am.`
        });
      }
      console.log("Weekly summary complete");
    } catch (err) {
      console.error("Weekly summary error:", err);
    }
  }, { timezone: "Europe/London" });

  // Phase 40: Wednesday 14:00 UK — Mounjaro injection reminder
  cron.schedule("0 14 * * 3", async () => {
    console.log("Running Wednesday Mounjaro reminder...");
    try {
      const users = await prisma.user.findMany();
      for (const user of users) {
        const state: any = user.state || {};
        const supps = state.supplements || [];
        const hasMounjaro = Array.isArray(supps) && supps.some((s: any) =>
          /mounjaro|tirzepatide/i.test(s?.name || "") || s?.frequency === "weekly-wednesday");
        if (!hasMounjaro) continue;
        const added = addStateNotification(state, {
          type: "medication",
          title: "💉 Mounjaro injection due today",
          message: "Inject after meal 2 (around 3pm). Have ginger tea ready, and Omeprazole if reflux is an issue.",
        });
        if (added) {
          await prisma.user.update({ where: { id: user.id }, data: { state } });
          await sendPushToUser(user.id, {
            title: "💉 Mounjaro injection due today",
            body: "Inject after meal 2 (~3pm). Ginger tea ready?",
          });
        }
      }
      console.log("Wednesday Mounjaro reminder complete");
    } catch (err) {
      console.error("Wednesday Mounjaro reminder error:", err);
    }
  }, { timezone: "Europe/London" });

  // Phase 40: daily 08:00 UK — yesterday's missed critical supplements
  cron.schedule("0 8 * * *", async () => {
    console.log("Running daily missed-critical-supplement check...");
    try {
      const yesterday = ukDaysAgo(1);
      const users = await prisma.user.findMany();
      for (const user of users) {
        const state: any = user.state || {};
        const supps = state.supplements || [];
        const critical = Array.isArray(supps) ? supps.filter((s: any) => s?.critical) : [];
        if (!critical.length) continue;
        const log = (state.supplementLog || {})[yesterday] || {};
        const missed = critical.filter((s: any) => log[s.id] !== true);
        if (!missed.length) continue;
        const added = addStateNotification(state, {
          type: "medication",
          title: `${missed.length} critical supplement${missed.length > 1 ? "s" : ""} missed yesterday`,
          message: `${missed.map((s: any) => s.name).join(", ")} — don't miss them again today.`,
        });
        if (added) await prisma.user.update({ where: { id: user.id }, data: { state } });
      }
      console.log("Daily missed-supplement check complete");
    } catch (err) {
      console.error("Daily missed-supplement check error:", err);
    }
  }, { timezone: "Europe/London" });

  // Phase 23: BYOK coaching report — Sunday 09:00 UK
  cron.schedule("0 9 * * 0", async () => {
    console.log("Running Sunday BYOK coaching reports...");
    try {
      const users = await prisma.user.findMany();
      for (const user of users) {
        const state: any = user.state || {};
        if (!state.coachingKey) continue;
        if (hoursSinceLastReport(state) < 24) {
          console.log(`[coach] Skipping ${user.email} — report generated ${Math.round(hoursSinceLastReport(state))}h ago`);
          continue;
        }
        try {
          const report = await generateWeeklyReport(user.id);
          await saveReport(user.id, report);
          await sendPushToUser(user.id, {
            title: "🧠 Weekly coaching report",
            body: report.suggestions.length
              ? `${report.title} — ${report.suggestions.length} suggestion${report.suggestions.length === 1 ? "" : "s"}`
              : report.title,
          });
          console.log(`[coach] Report generated for ${user.email}`);
        } catch (e: any) {
          console.error(`[coach] Failed for ${user.email}:`, e?.message || e);
          // Phase 40: record a non-fatal error entry so the user sees what happened
          try {
            const fresh = await prisma.user.findUnique({ where: { id: user.id } });
            const st: any = fresh?.state || {};
            if (!Array.isArray(st.coachingReports)) st.coachingReports = [];
            st.coachingReports.unshift({
              id: "rpt_err_" + Date.now(),
              createdAt: new Date().toISOString(),
              type: "error",
              title: "Report generation failed",
              content: "This week's coaching report could not be generated. Forge will retry next Sunday. If this keeps happening, check your Anthropic API key in More settings.",
              suggestions: [],
            });
            if (st.coachingReports.length > 50) st.coachingReports.length = 50;
            await prisma.user.update({ where: { id: user.id }, data: { state: st } });
          } catch { /* swallow — never crash the cron */ }
        }

        // Phase 26a: refresh meal-plan macros (items locked) based on cadence.
        // Items never change automatically — only macros are recomputed against canonical references.
        if (state.mealPlan?.meals?.length) {
          const cadence = state.profile?.foodPrefs?.refreshCadence || "weekly-sunday";
          const planHrs = hoursSinceLastPlanRegen(state);
          const shouldRefresh =
            (cadence === "weekly-sunday" && planHrs >= 24 * 6) ||
            (cadence === "biweekly" && planHrs >= 24 * 13);
          if (shouldRefresh) {
            try {
              const result = await recomputeMealPlanMacros(user.id);
              if (result.updated > 0) {
                await sendPushToUser(user.id, {
                  title: "🍽️ Plan macros refreshed",
                  body: `${result.updated} ingredient${result.updated === 1 ? "" : "s"} updated · ${result.skipped} kept (your edits)`,
                });
              }
              console.log(`[coach] Macros refreshed for ${user.email}: ${result.updated}/${result.total} updated, ${result.skipped} skipped`);
            } catch (e: any) {
              console.error(`[coach] Macro refresh failed for ${user.email}:`, e?.message || e);
            }
          }
        }
      }
      console.log("Sunday coaching reports complete");
    } catch (err) {
      console.error("Sunday coaching reports error:", err);
    }
  }, { timezone: "Europe/London" });
}
