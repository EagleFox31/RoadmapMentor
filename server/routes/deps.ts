import type { createLimiters } from "../http/hardening";

export type RouteDeps = { limiters: ReturnType<typeof createLimiters> };
