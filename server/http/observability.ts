import { randomUUID } from "node:crypto";
import { describeError } from "./errorCatalog";
import type { NextFunction, Request, Response } from "express";

export const REQUEST_ID_HEADER = "x-request-id";
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

type LogLevel = "info" | "warn" | "error";

// Une ligne JSON par événement : exploitable par n'importe quel agrégateur de logs.
export function logEvent(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  (level === "error" ? console.error : console.log)(line);
}

export function errorFields(error: unknown) {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message, stack: error.stack };
  }
  return { errorMessage: String(error) };
}

export function requestIdOf(res: { locals?: Record<string, unknown> }): string | undefined {
  const id = res.locals?.requestId;
  return typeof id === "string" ? id : undefined;
}

// Reprend l'identifiant fourni par un proxy s'il est sûr, sinon en génère un.
export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header(REQUEST_ID_HEADER);
  const id = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.locals.requestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}

// Journal d'accès : jamais de corps, de requête ni de chemin brut (les jetons d'invitation y figurent).
export function accessLog(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const user = (req as Request & { user?: { id?: number; role?: string } }).user;
    if (!req.originalUrl.startsWith("/api")) return;
    const status = res.statusCode;
    logEvent(status >= 500 ? "error" : status >= 400 ? "warn" : "info", "http_request", {
      requestId: requestIdOf(res),
      method: req.method,
      route: req.route ? `${req.baseUrl}${req.route.path}` : "unmatched",
      status,
      durationMs: Number(process.hrtime.bigint() - start) / 1e6,
      userId: user?.id,
      role: user?.role,
    });
  });
  next();
}

// Décorateur de réponse : toute erreur /api reçoit `code` (stable), `message` (français) et `requestId`.
// Le champ historique `error` n'est jamais modifié.
export function errorEnvelope(req: Request, res: Response, next: NextFunction) {
  if (!req.originalUrl.startsWith("/api")) return next();
  const originalJson = res.json.bind(res);
  res.json = ((body?: unknown) => {
    if (res.statusCode >= 400 && body && typeof body === "object" && !Array.isArray(body)) {
      const current = body as Record<string, unknown>;
      if (typeof current.code !== "string") {
        const english = typeof current.error === "string" ? current.error : current.message;
        const { code, message } = describeError(res.statusCode, english);
        return originalJson({ ...current, code, message, requestId: requestIdOf(res) });
      }
    }
    return originalJson(body);
  }) as Response["json"];
  next();
}
