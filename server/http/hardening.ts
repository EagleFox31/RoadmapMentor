import type { Express, Request, RequestHandler } from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

export const JSON_BODY_LIMIT = "1mb";

// Raster formats only: SVG is excluded on purpose (scriptable when served inline).
export const ALLOWED_UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function isAllowedUploadType(contentType: string | undefined): boolean {
  const base = (contentType ?? "").split(";")[0].trim().toLowerCase();
  return (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(base);
}

export type LimiterConfig = { windowMs: number; max: number };
export type RateLimitConfig = Record<"auth" | "ai" | "upload" | "jobs" | "invitation", LimiterConfig>;

const MINUTE = 60 * 1000;

export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  auth: { windowMs: 15 * MINUTE, max: 20 },
  ai: { windowMs: 60 * MINUTE, max: 10 },
  upload: { windowMs: 15 * MINUTE, max: 60 },
  jobs: { windowMs: 60 * MINUTE, max: 6 },
  invitation: { windowMs: 60 * MINUTE, max: 30 },
};

/** Overrides via RATE_LIMIT_<NAME>_MAX / RATE_LIMIT_<NAME>_WINDOW_MS (positive integers only). */
export function resolveRateLimits(env: NodeJS.ProcessEnv = process.env): RateLimitConfig {
  const read = (key: string, fallback: number) => {
    const value = Number(env[key]);
    return Number.isInteger(value) && value > 0 ? value : fallback;
  };
  const resolved = {} as RateLimitConfig;
  for (const name of Object.keys(DEFAULT_RATE_LIMITS) as (keyof RateLimitConfig)[]) {
    const upper = name.toUpperCase();
    resolved[name] = {
      max: read(`RATE_LIMIT_${upper}_MAX`, DEFAULT_RATE_LIMITS[name].max),
      windowMs: read(`RATE_LIMIT_${upper}_WINDOW_MS`, DEFAULT_RATE_LIMITS[name].windowMs),
    };
  }
  return resolved;
}

function userOrIp(req: Request): string {
  const userId = (req as Request & { user?: { id?: number } }).user?.id;
  return userId !== undefined ? `user:${userId}` : `ip:${req.ip ?? "unknown"}`;
}

export function createLimiter(config: LimiterConfig, keyByUser = false): RequestHandler {
  return rateLimit({
    windowMs: config.windowMs,
    limit: config.max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: keyByUser ? userOrIp : (req) => req.ip ?? "unknown",
    validate: { keyGeneratorIpFallback: false },
    handler: (_req, res) =>
      res.status(429).json({ error: "Too many requests. Please try again later." }),
  });
}

export function createLimiters(config: RateLimitConfig = resolveRateLimits()) {
  return {
    auth: createLimiter(config.auth),
    ai: createLimiter(config.ai, true),
    upload: createLimiter(config.upload, true),
    jobs: createLimiter(config.jobs, true),
    invitation: createLimiter(config.invitation, true),
  };
}

/**
 * CSP compatible with the production bundle (same-origin scripts, Google Fonts).
 * Not applied in development: Vite's HMR needs inline scripts and websockets.
 */
export function contentSecurityPolicy() {
  return {
    useDefaults: false,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'wasm-unsafe-eval'"],
      "worker-src": ["'self'", "blob:"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
      "img-src": ["'self'", "data:", "blob:"],
      // Signed upload URLs of the cloud storage provider.
      "connect-src": ["'self'", "https://storage.googleapis.com"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'none'"],
    },
  };
}

/** Number of reverse-proxy hops to trust for req.ip (rate limiting). Unset = none. */
export function resolveTrustProxy(env: NodeJS.ProcessEnv = process.env): number | false {
  const hops = Number(env.TRUST_PROXY);
  return Number.isInteger(hops) && hops > 0 ? hops : false;
}

export function applySecurityHeaders(app: Express, env: NodeJS.ProcessEnv = process.env) {
  app.set("trust proxy", resolveTrustProxy(env));
  app.disable("x-powered-by");
  const production = env.NODE_ENV === "production";
  app.use(
    helmet({
      contentSecurityPolicy: production ? contentSecurityPolicy() : false,
      // Cross-origin isolation would block Google Fonts and signed storage URLs.
      crossOriginEmbedderPolicy: false,
      hsts: production,
    }),
  );
}
