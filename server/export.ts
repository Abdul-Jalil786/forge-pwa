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

  const startDate = p.startDate || "2000-01-01";
  const wRate = avgRate(wl.filter((e: any) => e.date >= startDate), (e: any) => e.weight);
  const bRate = avgRate(bl.filter((e: any) => e.date >= startDate), (e: any) => e.bf);

  let projectedGoal: string | null = null;
  if (wRate < 0 && p.targetWeight && cw > p.targetWeight) {
    const weeksLeft = (cw - p.targetWeight) / Math.abs(wRate);
    const goal = new Date();
    goal.setDate(goal.getDate() + Math.round(weeksLeft * 7));
    projectedGoal = goal.toISOString().slice(0, 10);
  }

  return {
    weight: { current: cw, start: p.startWeight, target: p.targetWeight, ratePerWeek: wRate, projectedGoal },
    bf: { current: cbf, start: p.startBF, target: p.targetBF, ratePerWeek: bRate },
    lbm: { current: clbm, start: p.startLBM, target: p.targetLBM },
    visceral: { current: cvf, start: svf, target: p.targetVisceralFat },
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
