import prisma from "./db";
import { readToken, writeToken, isEncryptedToken } from "./token-crypto";

const TOKEN_URL = "https://wbsapi.withings.net/v2/oauth2";
const MEAS_URL = "https://wbsapi.withings.net/measure";
const AUTH_URL = "https://account.withings.com/oauth2_user/authorize2";

const CLIENT_ID = process.env.WITHINGS_CLIENT_ID || "";
const CLIENT_SECRET = process.env.WITHINGS_CLIENT_SECRET || "";

export function getAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: "user.metrics",
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<any> {
  const body = new URLSearchParams({
    action: "requesttoken",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data: any = await res.json();
  if (data.status !== 0) throw new Error(`Withings token error: ${JSON.stringify(data)}`);
  return data.body;
}

export async function refreshToken(refresh: string): Promise<any> {
  const body = new URLSearchParams({
    action: "requesttoken",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refresh,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data: any = await res.json();
  if (data.status !== 0) throw new Error(`Withings refresh error: ${JSON.stringify(data)}`);
  return data.body;
}

async function ensureFreshToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const state: any = user?.state || {};
  const w = state.withings;
  if (!w?.accessToken) throw new Error("Not connected");
  const access = readToken(w.accessToken);
  const refresh = readToken(w.refreshToken);
  if (!access) throw new Error("Withings connection needs refreshing — please reconnect in More settings");
  // Refresh if expiring within 5 mins
  if (Date.now() > (w.expiresAt || 0) - 5 * 60 * 1000) {
    if (!refresh) throw new Error("Withings connection needs refreshing — please reconnect in More settings");
    const fresh = await refreshToken(refresh);
    state.withings = {
      ...w,
      accessToken: writeToken(fresh.access_token), // encrypted at rest
      refreshToken: writeToken(fresh.refresh_token),
      expiresAt: Date.now() + fresh.expires_in * 1000,
    };
    await prisma.user.update({ where: { id: userId }, data: { state } });
    return fresh.access_token;
  }
  // Lazy migration: re-encrypt any legacy plaintext tokens
  if (!isEncryptedToken(w.accessToken) || (w.refreshToken && !isEncryptedToken(w.refreshToken))) {
    state.withings = { ...w, accessToken: writeToken(access), refreshToken: refresh ? writeToken(refresh) : w.refreshToken };
    await prisma.user.update({ where: { id: userId }, data: { state } });
  }
  return access;
}

export async function syncWithingsForUser(userId: string): Promise<{ updated: number; error?: string }> {
  let token: string;
  try {
    token = await ensureFreshToken(userId);
  } catch (e: any) {
    return { updated: 0, error: e.message };
  }

  const startdate = Math.floor(Date.now() / 1000) - 30 * 86400; // last 30 days
  const meastypes = "1,5,6,8,76,88,77,170,169,91";
  const url = `${MEAS_URL}?action=getmeas&meastypes=${meastypes}&startdate=${startdate}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json: any = await res.json();
  if (json.status !== 0) return { updated: 0, error: JSON.stringify(json) };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const state: any = user?.state || {};
  const weightLog = state.weightLog || [];
  const bfLog = state.bfLog || [];
  const bodyComp = state.bodyComp || {};

  const byDate: Record<string, any> = {};
  for (const grp of json.body.measuregrps || []) {
    const dateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(grp.date * 1000));
    if (!byDate[dateStr]) byDate[dateStr] = {};
    for (const m of grp.measures || []) {
      const v = m.value * Math.pow(10, m.unit);
      // Withings type IDs per official docs:
      // 1=weight kg, 5=fat-free mass kg, 6=fat ratio %, 8=fat mass kg,
      // 76=muscle mass kg, 77=hydration kg, 88=bone mass kg,
      // 91=pulse wave velocity, 169=vascular age, 170=visceral fat index
      if (m.type === 1) byDate[dateStr].weight = Math.round(v * 10) / 10;
      else if (m.type === 6) byDate[dateStr].bf = Math.round(v * 10) / 10;
      else if (m.type === 5) byDate[dateStr].fatFreeMass = Math.round(v * 10) / 10;
      else if (m.type === 8) byDate[dateStr].fatMass = Math.round(v * 10) / 10;
      else if (m.type === 76) byDate[dateStr].muscleMass = Math.round(v * 10) / 10;
      else if (m.type === 88) byDate[dateStr].boneMass = Math.round(v * 10) / 10;
      else if (m.type === 77) byDate[dateStr].hydration = Math.round(v * 10) / 10;
      else if (m.type === 170) byDate[dateStr].visceralFat = Math.round(v * 10) / 10;
      else if (m.type === 169) byDate[dateStr].vascularAge = v;
      else if (m.type === 91) byDate[dateStr].pulseWaveVelocity = Math.round(v * 10) / 10;
    }
  }

  // Migrate legacy entries without source tag to 'withings'
  for (const e of weightLog) { if (!e.source) e.source = "withings"; }
  for (const e of bfLog) { if (!e.source) e.source = "withings"; }

  let updated = 0;
  for (const [date, meas] of Object.entries(byDate)) {
    if (meas.weight) {
      const existing = weightLog.findIndex((e: any) => e.date === date);
      if (existing >= 0) {
        if (weightLog[existing].source === "manual") { /* skip — manual wins */ }
        else { weightLog[existing].weight = meas.weight; weightLog[existing].source = "withings"; updated++; }
      } else {
        weightLog.push({ date, weight: meas.weight, source: "withings" });
        updated++;
      }
    }
    if (meas.bf) {
      const existing = bfLog.findIndex((e: any) => e.date === date);
      if (existing >= 0) {
        if (bfLog[existing].source === "manual") { /* skip */ }
        else { bfLog[existing].bf = meas.bf; bfLog[existing].source = "withings"; updated++; }
      } else {
        bfLog.push({ date, bf: meas.bf, source: "withings" });
        updated++;
      }
    }
    bodyComp[date] = meas;
  }

  weightLog.sort((a: any, b: any) => a.date.localeCompare(b.date));
  bfLog.sort((a: any, b: any) => a.date.localeCompare(b.date));

  state.weightLog = weightLog;
  state.bfLog = bfLog;
  state.bodyComp = bodyComp;
  state.withings = { ...state.withings, lastSync: new Date().toISOString() };
  await prisma.user.update({ where: { id: userId }, data: { state } });
  return { updated };
}

export async function syncWithingsForAllUsers(): Promise<void> {
  const users = await prisma.user.findMany();
  for (const user of users) {
    const state: any = user.state;
    if (!state?.withings?.accessToken) continue;
    await syncWithingsForUser(user.id).catch(e => console.error(`Withings sync ${user.id}:`, e));
  }
}
