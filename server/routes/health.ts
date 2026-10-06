import { type Express } from "express";
import { pool } from "../db";

export function registerHealthRoutes(app: Express) {
  app.get("/health/live", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/health/ready", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.status(200).json({ status: "ready" });
    } catch (error) {
      console.error("Readiness check failed:", error);
      res.status(503).json({ status: "not_ready" });
    }
  });
}
