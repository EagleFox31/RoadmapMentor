import type { Express } from "express";
import { createServer, type Server } from "http";
import { createLimiters } from "./http/hardening";
import { registerHealthRoutes } from "./routes/health";
import { registerAuthRoutes } from "./routes/auth";
import { registerObjectsRoutes } from "./routes/objects";
import { registerRoadmapRoutes } from "./routes/roadmaps";
import { registerMentoringPackageRoutes } from "./routes/packages";
import { registerMentoringSessionRoutes } from "./routes/sessions";
import { registerBillingRoutes } from "./routes/billing";
import { registerWeekRoutes } from "./routes/weeks";
import { registerWeekContentRoutes } from "./routes/content";
import { registerLabRoutes } from "./routes/labs";
import { registerProgressRoutes } from "./routes/progress";
import { registerCommentRoutes } from "./routes/comments";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerAiGenerationRoutes } from "./routes/ai";

export async function registerRoutes(app: Express): Promise<Server> {
  const deps = { limiters: createLimiters() };
  registerHealthRoutes(app);
  registerAuthRoutes(app, deps);
  registerObjectsRoutes(app, deps);
  registerRoadmapRoutes(app);
  registerMentoringPackageRoutes(app);
  registerMentoringSessionRoutes(app);
  registerBillingRoutes(app);
  registerWeekRoutes(app);
  registerWeekContentRoutes(app);
  registerLabRoutes(app);
  registerProgressRoutes(app);
  registerCommentRoutes(app);
  registerNotificationRoutes(app, deps);
  registerAiGenerationRoutes(app, deps);

  return createServer(app);
}
