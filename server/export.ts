import { Router, Request, Response } from "express";
import crypto from "crypto";
import prisma from "./db";

function computeProgress(state: any) {
  const p = state.profile;
  if (!p) return null;
  const wl: any[] = state.weightLog || [];
  const bl: any[] = state.bfLog || [];
  const bc: any = state.bodyComp || {};

  const cw = wl.length ? wl[wl.length - 1].weight : p.startWeight;
  const cbf = bl.length ? bl[bl.length - 1].bf : null;
  const clbm = cw && cbf ? Math.round(cw * (1 - cbf / 100) * 100) / 100 : null;
  const vfDates = Object.keys(bc).filter(d => bc[d]?.visceralFat != null).sort();
  const cvf = vfDates.length ? bc[vfDates[vfDates.length - 1]].visceralFat : null;
  const svf = vfDates.length && p.startDate ? bc[(vfDates.find((d: string) => d >= p.startDate) || vfDates[0])]?.visceralFat : null;

  function avgRate(entries: any[], valFn: (e: any) => number) {
    if (entries.length < 7) return 0;
    const last14 = entries.slice(-14);
    if (last14.length < 2) return 0;
    const d0 = new Date(last14[0].date + "T12:00:00").getTime();
    const d1 = new Date(last14[last14.length - 1].date + "T12:00:00").getTime();
    const weeks = Math.max(0.5, (d1 - d0) / 604800000);
    return Math.round(((valFn(last14[last14.length - 1]) - valFn(last14[0])) / weeks) * 100) / 100;
  }

  function calcRateLinReg(entries: any[], key: string) {
    if (entries.length < 2) return 0;
    const x0 = new Date(entries[0].date + "T12:00:00").getTime();
    const points = entries.map((e: any) => ({ x: (new Date(e.date + "T12:00:00").getTime() - x0) / (1000 * 86400), y: e[key] }));
    const n = points.length;
    const sumX = points.reduce((s: number, p: any) => s + p.x, 0);
    const sumY = points.reduce((s: number, p: any) => s + p.y, 0);
    const sumXY = points.reduce((s: number, p: any) => s + p.x * p.y, 0);
    const sumXX = points.reduce((s: number, p: any) => s + p.x * p.x, 0);
    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) return 0;
    const slope = (n * sumXY - sumX * sumY) / denom;
    return Math.round(-slope * 7 * 100) / 100;
  }

  const startDate = p.startDate || "2000-01-01";
  const wFiltered = wl.filter((e: any) => e.date >= startDate);
  const bFiltered = bl.filter((e: any) => e.date >= startDate);
  const wRate = avgRate(wFiltered, (e: any) => e.weight);
  const bRate = avgRate(bFiltered, (e: any) => e.bf);
  const wRateLR = calcRateLinReg(wFiltered, "weight");
  const bRateLR = calcRateLinReg(bFiltered, "bf");

  const weeksToWeight = (wRateLR > 0 && p.targetWeight && cw > p.targetWeight) ? Math.ceil((cw - p.targetWeight) / wRateLR) : null;
  const weeksToBF = (bRateLR > 0 && p.targetBF && cbf && cbf > p.targetBF) ? Math.ceil((cbf - p.targetBF) / bRateLR) : null;
  const today = new Date();
  const addWeeksD = (d: Date, w: number) => { const r = new Date(d); r.setDate(r.getDate() + w * 7); return r; };
  const wDate = weeksToWeight ? addWeeksD(today, weeksToWeight).toISOString().slice(0, 10) : null;
  const bDate = weeksToBF ? addWeeksD(today, weeksToBF).toISOString().slice(0, 10) : null;
  const goalDate = wDate && bDate ? (wDate > bDate ? wDate : bDate) : (wDate || bDate);
  const entries = Math.min(wFiltered.length, bFiltered.length);
  const confidence = entries >= 14 ? "high" : entries >= 7 ? "medium" : "low";

  return {
    weight: { current: cw, start: p.startWeight, target: p.targetWeight, ratePerWeek: wRate, projectedGoal: wDate },
    bf: { current: cbf, start: p.startBF, target: p.targetBF, ratePerWeek: bRate, projectedGoal: bDate },
    lbm: { current: clbm, start: p.startLBM, target: p.targetLBM },
    visceral: { current: cvf, start: svf, target: p.targetVisceralFat },
    projections: { weightRate: wRateLR, bfRate: bRateLR, weeksToWeight, weeksToBF, wDate, bDate, goalDate, confidence },
  };
}

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing token" });
      return;
    }
    const token = auth.slice(7);
    if (!token.startsWith("forge_pat_")) {
      res.status(401).json({ error: "Invalid token format" });
      return;
    }
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const accessToken = await prisma.accessToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { email: true, state: true, updatedAt: true } } },
    });
    if (!accessToken) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    await prisma.accessToken.update({
      where: { id: accessToken.id },
      data: { lastUsedAt: new Date() },
    });
    const st: any = accessToken.user.state || {};
    const progress = computeProgress(st);
    res.json({
      user: { email: accessToken.user.email },
      state: st,
      progress,
      updatedAt: accessToken.user.updatedAt,
    });
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
