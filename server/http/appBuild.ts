import type { Express, NextFunction, Request, Response } from "express";
import { APP_BUILD_HEADER, readAppBuildId } from "@shared/appBuild";

// Build du client servi par ce processus ; reste null en dev (Vite sert le client à la volée).
let servedBuildId: string | null = null;

export function registerServedBuild(indexHtml: string): string | null {
  servedBuildId = readAppBuildId(indexHtml);
  return servedBuildId;
}

export function servedBuild(): string | null {
  return servedBuildId;
}

export function appBuildHeader(_req: Request, res: Response, next: NextFunction) {
  if (servedBuildId) res.setHeader(APP_BUILD_HEADER, servedBuildId);
  next();
}

// Sonde légère et publique : l'onglet qui revient au premier plan vérifie sa version sans session.
export function registerAppBuildRoute(app: Express) {
  app.get("/api/app-build", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(204).end();
  });
}
