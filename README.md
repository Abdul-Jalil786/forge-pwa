# Forge PWA

Fitness tracking PWA with Node/Express/Prisma/Postgres backend.

## Setup

1. Copy `.env.example` to `.env` and fill in values
2. `npm install`
3. `npx prisma migrate deploy`
4. `npm run dev`

## Scripts

- `npm run dev` - Start dev server with hot reload
- `npm run build` - Build for production
- `npm start` - Run production server (runs migrations first)
- `npm run db:studio` - Open Prisma Studio

## Deployment (Railway)

Set these environment variables in Railway:
- `DATABASE_URL` - Provisioned automatically if you add a Postgres plugin
- `JWT_SECRET` - A long random string
- `APP_URL` - Your Railway app URL (e.g. `https://forge-pwa-production.up.railway.app`)
- `PORT` - Railway sets this automatically

## Required Railway env vars

- `DATABASE_URL` — Postgres connection string (auto-set by Railway Postgres plugin)
- `JWT_SECRET` — long random string for signing JWTs
- `APP_URL` — public URL of the deployment (e.g. https://forge-pwa-production.up.railway.app)
- `PORT` — set by Railway automatically
- `VAPID_PUBLIC_KEY` — Web Push public key (generate via `npx web-push generate-vapid-keys`)
- `VAPID_PRIVATE_KEY` — Web Push private key
- `VAPID_EMAIL` — `mailto:youremail@example.com`
- `WITHINGS_CLIENT_ID` — from developer.withings.com
- `WITHINGS_CLIENT_SECRET` — from developer.withings.com
