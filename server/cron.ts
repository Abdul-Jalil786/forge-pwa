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
// Phase 41: accept optional `gaps` array for structured morning-recap notifications.
function addStateNotification(state: any, notif: { type: string; title: string; message: string; gaps?: any[] }): boolean {
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
    gaps: notif.gaps,
    date: today,
    read: false,
    expiresAt: ukDaysAgo(-1),
  });
  if (state.notifications.length > 10) state.notifications = state.notifications.slice(0, 10);
  return true;
}

// Phase 41g: server-side mirror of skinDueOn() from data.js — is a skincare
// product due to be applied on a given date?
function skinDueOnServer(product: any, dateStr: string): boolean {
  const freq = product?.frequency || "daily";
  if (freq === "daily") return true;
  if (freq === "5x-week") {
    const dow = new Date(dateStr + "T12:00:00").getDay();
    return dow >= 1 && dow <= 5;
  }
  const start = product?.frequencyStartedAt || product?.startedDate;
  if (!start) return true;
  const d0 = new Date(start + "T12:00:00").getTime();
  const d1 = new Date(dateStr + "T12:00:00").getTime();
  const days = Math.round((d1 - d0) / 86400000);
  if (days < 0) return false;
  const stepMap: Record<string, number> = { "every-2-days": 2, "every-3-days": 3, "every-4-days": 4, "weekly": 7 };
  const step = stepMap[freq];
  return step ? (days % step === 0) : true;
}

// Phase 41: server-side session-type lookup (mirrors data.js _trainingDayInCycle)
function sessionTypeFor(state: any, dateStr: string): "upper" | "lower" | null {
  const startDate = state.trainingStartDate || "2026-05-08";
  const start = new Date(startDate + "T12:00:00").getTime();
  const target = new Date(dateStr + "T12:00:00").getTime();
  const days = Math.floor((target - start) / 86400000);
  if (days < 0) return null;
  const cycle = ((days % 4) + 4) % 4;
  if (cycle === 0) return "upper";
  if (cycle === 2) return "lower";
  return null;
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

// Phase 46: weekly coaching reports, reliability-hardened. node-cron is
// IN-PROCESS — if the dyno restarts, deploys, or sleeps across the Sunday 09:00
// tick, that tick is lost forever with no retry (this is why a Sunday report
// can silently go missing). So the same loop runs from four triggers, each
// guarded by hoursSinceLastReport so it can never double-generate:
//   - Sunday 09:00 (primary) and hourly Sunday 10:00–23:00 — threshold 24h
//     (the hourly run heals a 09:00 missed earlier the same Sunday)
//   - daily 12:00 + on server startup — threshold ~6.25 days
//     (heals a Sunday that was missed entirely, e.g. process down all day)
export async function runWeeklyCoaching(minHoursSinceReport: number, reason: string): Promise<void> {
  console.log(`Running coaching reports (${reason})...`);
  try {
    const users = await prisma.user.findMany();
    for (const user of users) {
      const state: any = user.state || {};
      if (!state.coachingKey) continue;
      if (hoursSinceLastReport(state) < minHoursSinceReport) continue;
      try {
        const report = await generateWeeklyReport(user.id);
        await saveReport(user.id, report);
        await sendPushToUser(user.id, {
          title: "🧠 Weekly coaching report",
          body: report.suggestions.length
            ? `${report.title} — ${report.suggestions.length} suggestion${report.suggestions.length === 1 ? "" : "s"}`
            : report.title,
        });
        console.log(`[coach] Report generated for ${user.email} (${reason})`);
      } catch (e: any) {
        console.error(`[coach] Failed for ${user.email}:`, e?.message || e);
        // Phase 40/43: record a non-fatal error entry (atomic jsonb prepend)
        try {
          const errEntry = JSON.stringify([{
            id: "rpt_err_" + Date.now(),
            createdAt: new Date().toISOString(),
            type: "error",
            title: "Report generation failed",
            content: "This week's coaching report could not be generated. Forge will retry automatically. If this keeps happening, check your Anthropic API key in More settings.",
            suggestions: [],
          }]);
          await prisma.$executeRaw`
            UPDATE "User"
            SET state = jsonb_set(
              COALESCE(state, '{}')::jsonb,
              '{coachingReports}',
              ${errEntry}::jsonb || COALESCE(state->'coachingReports', '[]'::jsonb),
              true
            )
            WHERE id = ${user.id}
          `;
        } catch { /* swallow — never crash the cron */ }
      }

      // Phase 26a: refresh meal-plan macros (items locked) based on cadence.
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
          } catch (e: any) {
            console.error(`[coach] Macro refresh failed for ${user.email}:`, e?.message || e);
          }
        }
      }
    }
    console.log(`Coaching reports complete (${reason})`);
  } catch (err) {
    console.error(`Coaching reports error (${reason}):`, err);
  }
}

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

  // Phase 41: daily 08:00 UK — consolidated yesterday gap recap (food + training + supps + skin + water)
  cron.schedule("0 8 * * *", async () => {
    console.log("Running daily yesterday-recap...");
    try {
      const yesterday = ukDaysAgo(1);
      const users = await prisma.user.findMany();
      for (const user of users) {
        const state: any = user.state || {};
        const gaps: any[] = [];

        // FOOD — flag if nothing logged OR protein < 60% of target
        const foods = (state.foods || {})[yesterday] || [];
        if (foods.length === 0) {
          gaps.push({ area: "food", date: yesterday, label: "No food logged" });
        } else {
          const proteinTotal = foods.reduce((s: number, f: any) => s + (+f.protein || 0), 0);
          const proteinTarget = state.profile?.dynamicTargets?.rest?.protein || state.profile?.proteinTarget || 180;
          if (proteinTotal < proteinTarget * 0.6) {
            gaps.push({ area: "food", date: yesterday, label: `Protein only ${Math.round(proteinTotal)}g of ${proteinTarget}g target` });
          }
        }

        // TRAINING — flag if yesterday was a training day in the cycle but <4 exercises marked done
        const sessionType = sessionTypeFor(state, yesterday);
        if (sessionType) {
          const dayLog = (state.exLog || {})[yesterday] || {};
          const doneCount = Object.entries(dayLog).filter(([k, e]: [string, any]) => !k.startsWith("_") && e && e.done).length;
          if (doneCount < 4) {
            const label = sessionType[0].toUpperCase() + sessionType.slice(1);
            gaps.push({ area: "training", date: yesterday, label: `${label} session — only ${doneCount} exercise${doneCount === 1 ? "" : "s"} done` });
          }
        }

        // SUPPLEMENTS — critical untiked
        const supps = state.supplements || [];
        const critical = Array.isArray(supps) ? supps.filter((s: any) => s?.critical) : [];
        if (critical.length) {
          const dow = new Date(yesterday + "T12:00:00").getDay();
          const dueCritical = critical.filter((s: any) => !(s.frequency === "weekly-wednesday" && dow !== 3));
          const log = (state.supplementLog || {})[yesterday] || {};
          const missedSupps = dueCritical.filter((s: any) => log[s.id] !== true);
          if (missedSupps.length) {
            const names = missedSupps.slice(0, 3).map((s: any) => s.name).join(", ");
            const more = missedSupps.length > 3 ? ` (+${missedSupps.length - 3})` : "";
            gaps.push({
              area: "supplements",
              date: yesterday,
              label: `${missedSupps.length} critical: ${names}${more}`,
            });
          }
        }

        // SKIN — owner only, compliance < 60%
        if (user.email === "jay@afjltd.co.uk") {
          const skinLog = (state.skinCareLog || {})[yesterday];
          if (skinLog && typeof skinLog._compliance === "number" && skinLog._compliance < 0.6) {
            gaps.push({
              area: "skin",
              date: yesterday,
              label: `Skin compliance: ${Math.round(skinLog._compliance * 100)}%`,
            });
          }
        }

        // WATER — flag only if user logged some water but well under target
        const waterEntry = (state.waterLog || {})[yesterday];
        if (waterEntry) {
          const total = waterEntry.total || 0;
          const target = waterEntry.target || 3000;
          if (total > 0 && total < target * 0.5) {
            gaps.push({
              area: "water",
              date: yesterday,
              label: `${(total / 1000).toFixed(1)}L of ${(target / 1000).toFixed(1)}L`,
            });
          }
        }

        if (gaps.length === 0) continue;

        const summary = gaps.length === 1 ? "1 gap" : `${gaps.length} gaps`;
        const added = addStateNotification(state, {
          type: "morning-recap",
          title: `🌅 Yesterday: ${summary} to backfill`,
          message: gaps.map((g) => `• ${g.label}`).join(" · "),
          gaps,
        });
        if (added) await prisma.user.update({ where: { id: user.id }, data: { state } });
      }
      console.log("Daily yesterday-recap complete");
    } catch (err) {
      console.error("Daily yesterday-recap error:", err);
    }
  }, { timezone: "Europe/London" });

  // Phase 41g: nightly retinol reminder — 21:30 UK on retinol-due nights only.
  // Owner-only (skincare feature is gated to jay@afjltd.co.uk). Distinct triple-buzz
  // vibration + requireInteraction so the notification persists on the lock screen.
  cron.schedule("30 21 * * *", async () => {
    console.log("Running 21:30 retinol reminder check...");
    try {
      const today = ukToday();
      const users = await prisma.user.findMany({
        where: { pushSubscriptions: { some: {} } },
        include: { pushSubscriptions: true },
      });
      for (const user of users) {
        if (user.email !== "jay@afjltd.co.uk") continue; // owner-only feature
        const state: any = user.state || {};
        const products = state.skinCare?.products;
        if (!Array.isArray(products)) continue;
        const retinol = products.find((p: any) => p?.type === "retinol");
        if (!retinol) continue;
        if (!skinDueOnServer(retinol, today)) continue;
        // Skip if already ticked tonight
        const log = (state.skinCareLog || {})[today] || {};
        if (log[`${retinol.id}_pm`] === true) continue;

        const payload = JSON.stringify({
          title: "🧴 Retinol night",
          body: "Retinol is due tonight. Apply to dry skin (wait 5 min after washing), then Cicaplast on top. Skip if <4h before you'd wash it off.",
          tag: "retinol-reminder",
          vibrate: [300, 100, 300, 100, 300], // distinct triple-buzz vs default single
          requireInteraction: true, // persists until tapped
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
        console.log(`[cron] retinol reminder sent to ${user.email} (${retinol.frequency})`);
      }
    } catch (err) {
      console.error("21:30 retinol reminder error:", err);
    }
  }, { timezone: "Europe/London" });

  // Phase 23 + 46: BYOK coaching report — Sunday 09:00 UK, with catch-up so a
  // missed tick (deploy/restart/sleep) self-heals instead of skipping the week.
  cron.schedule("0 9 * * 0",     () => runWeeklyCoaching(24, "sunday-9am"),       { timezone: "Europe/London" });
  cron.schedule("0 10-23 * * 0", () => runWeeklyCoaching(24, "sunday-catchup"),   { timezone: "Europe/London" });
  cron.schedule("0 12 * * *",    () => runWeeklyCoaching(150, "daily-safety-net"), { timezone: "Europe/London" });
}
