import "dotenv/config";
import express from "express";
import path from "path";
import authRouter from "./auth";
import stateRouter from "./state";

const PORT = parseInt(process.env.PORT || "3000", 10);

const app = express();

app.use(express.json({ limit: "6mb" }));

// API routes
app.use("/api/auth", authRouter);
app.use("/api/state", stateRouter);

// Static files — use process.cwd() so it works in both dev (tsx) and prod (dist/)
const publicDir = path.join(process.cwd(), "public");
app.use(express.static(publicDir));

// SPA catch-all
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Forge server running on port ${PORT}`);
});
