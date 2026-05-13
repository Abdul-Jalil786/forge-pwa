# Forge — Project Context

## What this is
A personal fitness tracking PWA. Mobile-first, vanilla JS frontend, Node + Express + Prisma + Postgres backend, deployed on Railway. Auto-deploys from main branch on GitHub.

## Who uses it
- Jay Shakeel (founder) — primary user, in active fat loss cut from 115kg to 90kg @ 15% BF
- Jay's friend (planned) — onboarding TBD

## Stack
- Frontend: vanilla JS PWA in /public/ (no build step for client)
- Backend: TypeScript + Express + Prisma in /server/
- DB: Postgres on Railway
- Auth: JWT (30-day expiry), bcrypt password hashing
- Push notifications: web-push + VAPID
- Cron: node-cron in same Express service
- External APIs: Oura (PAT), Withings (OAuth)
- Coaching: Cowork (Anthropic Claude) connected via Personal Access Tokens

## Domains/services connected
- Forge: forge-pwa-production.up.railway.app
- DB: Railway Postgres
- Oura: read-only via PAT
- Withings: OAuth (read-only metrics scope)
- Cowork: Jay's coaching agent connected via SHA-256-hashed PAT

## Active plan (May 2026)
- Daily calorie targets: 2,500 (gym day) / 2,400 (rest day)
- Macros: 250g protein / 210g carbs / 75g fat
- Eating window: 12:00-18:00 UK
- Training: alternating Upper/Rest/Lower/Rest, 4-day cycle, anchored 2026-05-08, 4pm workout time
- Mounjaro 2.5mg weekly Wednesday 18:00
- Meds: Metformin 1000mg with Meal 1, Statin with Meal 3, Vit D + Omega 3 daily, Creatine 5g in shake

## Coaching cadence
- Sunday 09:00 UK: scheduled task in Cowork pulls user data via /api/export, generates report, pushes to Forge via /api/coaching-reports
- Macros + meal plan auto-adjust based on weight/BF/TDEE trends
- Cowork CAN push: meal plans, profile fields (calsGym/calsRest/macros), reminders, coaching reports

## Phases shipped
- 1: Backend skeleton + auth + Railway deploy
- 1.5: UX polish (autofill fix, confirm pwd, max-width, secure logout)
- 2: Data sync to Postgres (cross-device)
- 2.1: Mobile safe-area fix
- 2.5: Train page week strip + history navigation + previous-session reference
- 3: Cowork connection + body fat tracking + remove AI Coach UI
- 4: Meal plan system (Today's Plan on Food page)
- 5: PWA push notifications + meal-time reminders
- 6: Oura auto-sync (sleep, steps, recovery, calories, workouts)
- 7: Withings auto-sync (weight, body fat, muscle mass, visceral fat)
- 8: AI coaching reports endpoint + Coach page display
- 8.1: Bug fixes (baseline week, water reset, planStartDate)
- 8.2: Profile auto-update endpoint (Cowork manages macros)
- 8.3: Generic reminders system (day-of-week + bi-weekly)
- 8.4: Alternating training schedule (Upper/Rest/Lower/Rest)
- 9: Dashboard rebuild (action-first Today page + sparklines)
- 11: Focused workout mode + smart progression + RIR effort
- 12: Critical security (token hashing, rate limit, helmet, health check, graceful shutdown) + remove photos + this CLAUDE.md
- 14: Daily evening + weekly preview cron nudges (protein check 22:00, weekly summary Sun 21:00)
- 16a: Field-scoped atomic state endpoints (jsonb_set) to fix concurrent write races
- 16b: UTC date bug fix — all date helpers now use Europe/London timezone
- 16c: Source tagging (manual/withings/oura) — manual entries protected from sync overwrite
- 16d: Network-first service worker for HTML/JS — deploys reflect on next page load
- 16e: Fix friend onboarding — set planStartDate + trainingStartDate on signup + migrate existing users
- 18: Granular meal logging — per-ingredient checkboxes, supplement tracking (supplementLog), expandable grouped food log, structured meal plan format (ingredients/supplements arrays)
- 19: Standalone supplements tracker — state.supplements[] CRUD, Today page checklist, Coach page 7-day heatmap + 30-day adherence, More page management, meal modal integration via mealId, 21:00 missed-supplements cron push
- 20: Time-based exercise tracking — isometric holds (plank, side plank, dead hang, wall sit, hollow hold, l-sit) track {seconds, done} instead of {weight, reps}, live count-up timer in guided workout mode, "Could you have held longer?" effort prompt (easy/hard/maybe), seconds-progression (+5s on easy/maybe), PB = longest single hold, one-shot migration of historical data, isTimeBased() helper with keyword fallback

## Skipped/deferred
- Photos to R2 (entire feature removed in Phase 12)
- Workout customisation editor (deferred, may revisit)
- Phase 15 (UI polish, de-hardcoding) — explicitly skipped per user

## Known issues / open work
- Calorie Stage Guide hardcoded for 114->87kg cut (pages.js:836)
- Eating window 12:00-18:00 hardcoded (pages.js)
- Workout time "16:00" hardcoded in dashboard
- prompt()/confirm() modals throughout (Edit Targets, Reset)
- No accessibility (ARIA, keyboard nav)
- No real charts (sparklines only)
- No password reset flow
- No exercise customisation
- Friend onboarding flow now sets trainingStartDate but anchors to signup date (not Jay's 2026-05-08)
- Race condition: full state PUT still used as fallback for non-hot fields (foods/exLog/water/weight/sleep use field-scoped endpoints)
- "Reset All Data" doesn't clear all keys (Oura/Withings tokens, reminders, etc. survive)

## How Cowork interacts with Forge
1. Jay's PAT (forge_pat_...) lives in Cowork memory, hashed in Forge DB
2. Cowork calls these endpoints:
   - GET /api/export — pulls full user state
   - PUT /api/meal-plan — updates meal plan
   - PUT /api/profile — updates calsGym/calsRest/macros/targets
   - PUT /api/reminders — updates reminders array
   - POST /api/coaching-reports — pushes weekly review
3. Sunday cron task in Cowork does the weekly review automatically
4. Meal plan format: meals[] with structured ingredients[] and supplements[] arrays (see memory/meal-plan-format.md for spec)
5. Field-scoped state endpoints (used by frontend, not Cowork):
   - PUT /api/state/foods/:date, /api/state/exLog/:date, /api/state/water/:date
   - PUT /api/state/weight, /api/state/sleep/:date

## Style conventions
- Lime (#c8ff00) primary, black (#080808) bg, Archivo Black for headlines
- Mobile-first, max-width 480px on desktop
- No external chart libs except Chart.js (CDN, only when needed)
- TypeScript strict on backend, vanilla JS on frontend (no build for /public/)
