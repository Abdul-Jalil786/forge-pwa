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
- Mounjaro weekly Wednesday 18:00 (dose self-managed in Forge → More → Medications; CLAUDE.md no longer hardcodes)
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
- 18a: Fix race condition in logMealFromModal — single atomic PUT instead of N racing PUTs (clear + one per ingredient)
- 19: Standalone supplements tracker — state.supplements[] CRUD, Today page checklist, Coach page 7-day heatmap + 30-day adherence, More page management, meal modal integration via mealId, 21:00 missed-supplements cron push
- 20: Time-based exercise tracking — isometric holds (plank, side plank, dead hang, wall sit, hollow hold, l-sit) track {seconds, done} instead of {weight, reps}, live count-up timer in guided workout mode, "Could you have held longer?" effort prompt (easy/hard/maybe), seconds-progression (+5s on easy/maybe), PB = longest single hold, one-shot migration of historical data, isTimeBased() helper with keyword fallback
- 21: Oura sleep sync fix — three changes: (a) relaxed type filter so late_nap/rest entries 5+ hours count as main sleep, fixes daytime-shifted patterns where Oura mis-classifies long sleeps; (b) extended query end_date by 1 day to handle Oura's day-attribution boundary for daytime sleep; (c) removed aggressive auto-delete of stale entries — Oura updates if new data, otherwise leaves existing data alone
- 22: Progress dashboard on Track page — 4 metric cards (weight, BF, lean mass, visceral fat) with progress bars, sparklines, 14-day avg rates, projected goal date, LBM drop alert, /api/export includes computed progress
- 22a: Fix progress profile baseline for Jay — progressMigrationApplied guard, server-side migration on startup
- 22b: Linear regression goal projections — calcRate() using least-squares regression on all entries since start, getProjections() projects weight + BF goal dates separately with binding constraint, 5th GOAL DATE card with date range + confidence level (high 14+d / medium 7-13d / low <7d) + elapsed progress bar, export endpoint includes full projections for Cowork
- 23: BYOK AI Coach — replaces Cowork-driven weekly review with server-side generation using each user's own Anthropic API key (Opus 4.7). Key stored encrypted at rest (AES-256-GCM, `ENCRYPTION_KEY` env var). New routes `/api/coach/{key,test,generate-now}` (JWT). New `/api/coaching-reports/:rid/{apply,dismiss}/:sid` for user-driven application of structured suggestions (macros/reminders/note types). Sunday 09:00 UK cron generates per-user, 24h cost guard. Coach page renders Apply/Dismiss buttons under each report. `formatCoachingReport` now escapes HTML before markdown (closes XSS surface from LLM output). Legacy POST /api/coaching-reports kept for backward compat.
- 24: Food preferences profile — `state.profile.foodPrefs = { excluded[], notes, refreshCadence }`, atomic write via `PUT /api/state/profile/food-prefs` (jsonb_set, JWT). New "Food Preferences" section on More page with excluded-chips, free-text notes (2000 char cap), and plan-refresh cadence dropdown (weekly-sunday / biweekly / manual). Foundation for Phase 26 plan generation.
- 25: Portion control + log timestamps — meal detail modal replaces checkbox model with 5-button portion stepper (✕ · ½ · 1× · 1½ · 2×). Macros recompute live as portions change. Each food entry stores `quantity` (default 1.0) and `loggedAt` (ISO). Day detail + food log show actual-eaten time from loggedAt (fallback to planned time) and a `(½)` orange badge when quantity ≠ 1. Backward-compatible with old entries.
- 26: AI Coach generates the meal plan — `generateMealPlan()` uses Opus 4.7 with tool use to produce a structured plan, validates each ingredient name against `foodPrefs.excluded` server-side (rejects on match). Uses the user's actual logged-foods frequency (last 14d) so the plan reuses what they already eat. New routes `/api/coach/regenerate-plan` (JWT, 1h rate limit). New `lastMealPlanRegenAt` state field. Full-regen is now an "advanced" path; default is items-locked via Phase 26a.
- 26a: Items-locked plan editing — items in your plan never change automatically. New `recomputeMealPlanMacros()` (Opus 4.7, single batched call across all ingredients) keeps item names identical and only fills accurate per-ingredient macros from canonical reference data. Per-ingredient `edited: true` flag persists user overrides through auto-refreshes. New routes: `POST /api/coach/recompute-macros` (JWT, 1-min rate limit), `PUT /api/state/meal-plan` (JWT, validates against `foodPrefs.excluded`). Sunday cron switched from full regen to macros recompute (items locked). Meal detail modal: tap ingredient name to open edit modal (name + per-macro fields + delete); "+ Add ingredient" button appends new items; meal totals recompute from ingredient sums on every save. Food page button now reads "↻ Compute exact macros (keep items)".
- 26b: Seeded Jay's locked meal plan — startup migration `seedJayMealPlan()` writes Jay's exact 4-meal plan (breakfast eggs+oats+yogurt+berries, pre-workout chicken+basmati+veg, post-workout shake, dinner chicken+tomato stew + side salad). Guarded by `state.mealPlanSeededV2` so it only runs once.
- 27: Coach accuracy upgrade — three new things feed into the AI Coach report. (a) `state.profile.personal = { age, heightCm, sex, ethnicity, activityLevel }` via new `PUT /api/state/profile/personal` (JWT, jsonb_set). (b) `state.profile.medications = [{id, name, dose, schedule, notes}]` via new `PUT /api/state/profile/medications`. (c) Existing Oura recovery (`state.recovery[date] = { readiness, hrv, restingHR }`) now passed to coach context. AI prompt extended with med-aware reasoning rules (GLP-1 / statin / metformin / insulin specifics), Mifflin-St Jeor TDEE calculation (BMR × activity factor), and Oura recovery interpretation guidance (falling HRV + rising RHR = deload signal). "Personal Profile" and "Medications" sections added to More page. Sex required to compute BMR; flagged in context if missing.
- 28: Training progression v2 — three upgrades to `suggestWeight`/`suggestTime` in workout.js. (a) Recovery gate: reads today's `state.recovery[today]` Oura readiness/HRV plus 4-day HRV trend. Readiness < 60 or HRV down 3+ days running → every suggestion overrides to "Hold weight today — recover, don't push" with yellow banner on workout outline. (b) Stall detection: looks at last 5 sessions of same type via new `getPreviousSessions()` helper. Same weight held for 3+ sessions without hitting top of rep range → prescribes deload (drop weight by ~12%, rounded to 0.25kg, with reason "stalled N sessions — try Xkg today, back to Ykg next time"). (c) Per-lift increment scales: each WORKOUTS exercise tagged `size: small | medium | large`. Large compounds (leg press, RDL, hip thrust): +5/+2.5/-5kg. Medium (chest press, shoulder press, row, lat pulldown, leg ext/curl, calf raise): +5/+2.5/-2.5 (unchanged). Small isolation (curl, tricep pushdown, face pull, back ext, ab crunch): +2.5/+1.25/-1.25. DELOAD and HOLD badges shown in outline view next to affected lifts.
- 29: Coach intelligence v2 — six new data streams into the AI Coach context + sharper system prompt. (a) BODY COMPOSITION: current LBM (computed from latest weight × BF), muscle mass + visceral fat + hydration from Withings `bodyComp`, with 7d/14d deltas of weight / LBM / fat mass. New `latestBodyComp()` and `bodyCompAtDate()` helpers in ai-coach.ts. (b) SLEEP STAGES: Oura sync now extracts `rem_sleep_duration`, `deep_sleep_duration`, `light_sleep_duration`, `awake_time` per night and stores `remMin/deepMin/lightMin/awakeMin` on each `sleepLog[date]` entry. Coach prompt instructed to weight stages over total hours. (c) OURA ACTIVITY: daily steps + active calories from `stepsLog` / `calorieLog`. 7d avg active cal flagged as primary TDEE input over Mifflin estimate. (d) MEAL-PLAN ADHERENCE: per-day % of planned meals + ingredients actually logged (computed against `state.mealPlan` + `state.foods[date]`). (e) EFFORT DISTRIBUTION: % of sets tagged easy/solid/tough across last 7 days, with sandbag/under-recovery flag. (f) COACH MEMORY: last 4 `coachingReports` (with their `suggestions[]` apply/dismiss status) injected so the coach references and builds on prior advice instead of repeating. System prompt rewritten with goal-specific LBM-preservation framing (`Target LBM ≈ current LBM. Watch LBM week-over-week. Drop > 0.3kg/wk for 2+ weeks = urgent flag.`), explicit medication reasoning rules, sleep stage interpretation, and a hard rule never to repeat dismissed suggestions without new justification. Frontend: new Body Composition Trend card at top of Track page showing weight/fat-mass/LBM with 7d + 14d deltas, color-coded (green LBM stable, amber small drop, red losing muscle). Also: `fixJayVisceralTarget()` startup migration resets Jay's `profile.targetVisceralFat` from 10 → 6 (his current ~6.3 was already healthy; old target encouraged regression).
- 29a: Blood markers — clinical results flow into the AI Coach as ground-truth context. `state.profile.bloodMarkers[]` = `[{id, name, value, unit, refLow, refHigh, date, category, notes}]`. New atomic `PUT /api/state/profile/blood-markers` (JWT, jsonb_set, 100-marker cap). New "Blood Markers" section on More page — grouped by category with color-coded status (green in-range, amber out-of-range), tap to edit, latest panel date in header. New `modal-blm-edit` with name + value + unit + ref range + date + category + notes. Coach context now includes a BLOOD MARKERS block listing OUT OF RANGE markers prominently (with refs + per-marker notes) plus a brief in-range summary. System prompt gained explicit interpretation rules per marker class: HbA1c diabetic-range → low-GI non-negotiable; ALT > 56 → expect to drop with bodyfat; T < 12 nmol/L → double-down on LBM watch; SHBG low → reinforces low-GI; Vit D < 50 → 5000 IU until > 75; hsCRP > 1 → re-check 3mo; never make definitive medical diagnosis, always frame as "consistent with X, recommend GP". One-shot `seedJayBloodMarkers()` startup migration loads Jay's 2026-05-08 Bloodwork Group panel (~40 markers, full lipid + diabetes + liver + hormones + thyroid + vitamins + iron + FBC + prostate). PII is in DB-side encrypted JSON only — PDF source never committed to repo.
- 32: Phase-aware coaching + LBM ceiling projection + modal-weight progression. (a) Profile gains `phase` (cut / recomp / lean-bulk / maintenance) and `targetLBMStretch` (kg) — both saved via the existing `PUT /api/state/profile/personal` route with validators. (b) AI Coach system prompt rewritten to read phase from context and adapt advice: cut = LBM preservation, recomp = small simultaneous gain, lean-bulk = controlled surplus (~0.3kg/mo max past 50), maintenance = recovery. Stretch LBM target shifts framing toward multi-month "max muscle at target BF" objective. (c) New `computeMaxLBM(userId)` in ai-coach.ts uses Opus 4.7 with tool use to project conservative/realistic/optimistic LBM ceilings, timeline, phase sequence, and key constraints — factors age, T level, GLP-1 medications, training tier. Saved to `state.maxLBMProjection`. (d) New `POST /api/coach/max-lbm` endpoint + "🧠 Compute my realistic max LBM (AI)" button in Personal Profile section. Result rendered in a generic `modal-info` overlay with quick "set stretch LBM target to AI-recommended value" action. (e) Modal-weight progression fix in `suggestWeight`: replaces "use set 0 as reference" with "use most-frequent (modal) weight as reference; tiebreak heavier." Filters warm-ups + experimental top sets from the rep-range judgement. Fixes the "100×8, 140×3, 120×6, 120×6 → pyramid suggestion" bug. (f) Lower-day exercise swap: `Back Extension` (l7) → `Good Mornings` (no machine needed, barbell hip hinge, same erectors + adds hamstring work). Strength standards multipliers updated to match.
- 31a: Strength Standards card on Track page — classifies each lift into Untrained / Novice / Intermediate / Advanced / Elite based on estimated 1RM (Brzycki from best working set across all logged sessions), per-lift bodyweight multipliers (ExRx + StrengthLevel community data), and age-adjustment (0.5%/yr decay past 30, floor 60%). Includes overall summary tier, per-lift table with 1RM + ×BW ratio + colored tier, and clear footnotes about machine variability + estimation accuracy. Currently male-only; female sex shows a "coming soon" placeholder.
- 31: Past-date training editing + "Where You Stand" peer comparison. (a) Day Detail Training section: each exercise row is now tappable → opens `modal-set-edit` with editable kg/reps/seconds + effort dropdown per set, + Add set, delete-set ×, "Mark exercise as completed" checkbox, and "Remove Exercise From This Day" button. Not-yet-logged exercises from the day's prescribed workout also appear in the list (dimmed) so the user can backfill. Writes through existing `PUT /api/state/exLog/:date`. Critical for keeping the Phase 28 progression engine accurate when corrections are needed retroactively. (b) Body page top: new "Where You Stand" card classifies user against age + sex norms across 6 metrics — Body Fat % (Athletic/Fitness/Average/Above-avg/Obese bands by age), BMI (WHO standard), LBMI (lean / height² — height-normalized muscle index), Visceral Fat (South Asian threshold ≥7 vs European ≥10), 7d-avg Resting HR (Mayo bands), 7d-avg Sleep (NIH 7-9h). Each row shows value + colored category band + segmented bar visualizing position. Falls back to "fill in Personal Profile" prompt when age/height/sex are missing.
- 30a: Today page Key Metrics enhanced — Body Fat row now shows both % AND derived fat mass kg. New Lean Mass row (computed from weight × (1 - BF/100)) shows current LBM, week-rate trend (colored green if holding or up, amber if drop < 0.3kg/wk, red if larger drop), target hold reminder, and sparkline. Sparkline helper `spark()` upgraded: 100×32 (was 80×24), gradient fill under the line, dot at the latest value point — direction is much clearer at a glance.
- 30: Period comparisons + TDEE fix — three coach context blocks plus a new Track page card. (a) Bug fix: coach was told `active_calories` was TDEE; corrected — `total_calories` from Oura ≈ TDEE (BMR + active). Both labelled clearly in context. (b) SINCE PLAN START block: weeks-in, weight/BF/LBM absolute deltas from `profile.startWeight/startBF/startLBM`, plus a preservation-status verdict (EXCELLENT / GAINING / minor loss / concerning loss). (c) WEEK-OVER-WEEK block: last 7d vs prior 7d, aggregated `periodStats()` helper computes avg weight/BF, training sessions, sleep hrs, steps, TDEE, food kcal, protein with side-by-side + delta. (d) MONTHLY ARC block: last 30d vs prior 30d, only renders when ≥30d of data exists. System prompt rule additions: every "This week" section must cite SINCE START framing + WEEK-OVER-WEEK direction (accelerated/held/slowed/stalled). (e) Frontend: new "Compare Any Two Dates" card on Track page (between Body Comp Trend and the first metric card) with two date pickers and a side-by-side snapshot of weight/BF/LBM/fat/muscle/visceral/sleep/steps/TDEE, color-coded delta column. Default range = plan start → today. New `_snapshotAtDate()` JS helper.

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

## How coaching works (Phase 23 — BYOK)
1. Each user pastes their own Anthropic API key on the More page; Forge encrypts it with AES-256-GCM (`ENCRYPTION_KEY`) and stores in `state.coachingKey`.
2. Sunday 09:00 UK cron runs `generateWeeklyReport(userId)` for every user with a key. Skips if a report exists in the last 24h.
3. Report is generated by Opus 4.7 via tool use (forced structured JSON output: `{title, content, suggestions[]}`).
4. Suggestions appear on the Coach page with Apply/Dismiss buttons. Apply types: `macros` (writes profile.calsGym/calsRest/macros), `reminders` (adds/removes), `note` (informational).
5. Manual "Generate Report Now" button on More page (rate-limited to 1/hour).

## Legacy Cowork integration (kept for backward compat, not actively used)
- Jay's PAT (forge_pat_...) lives in Cowork memory, hashed in Forge DB
- Cowork endpoints still available: GET /api/export, PUT /api/meal-plan, PUT /api/profile, PUT /api/reminders, POST /api/coaching-reports
- Sunday cron task in Cowork is no longer the primary path — BYOK Forge cron is
4. Meal plan format: meals[] with structured ingredients[] and supplements[] arrays (see memory/meal-plan-format.md for spec)
5. Field-scoped state endpoints (used by frontend, not Cowork):
   - PUT /api/state/foods/:date, /api/state/exLog/:date, /api/state/water/:date
   - PUT /api/state/weight, /api/state/sleep/:date

## Style conventions
- Lime (#c8ff00) primary, black (#080808) bg, Archivo Black for headlines
- Mobile-first, max-width 480px on desktop
- No external chart libs except Chart.js (CDN, only when needed)
- TypeScript strict on backend, vanilla JS on frontend (no build for /public/)
