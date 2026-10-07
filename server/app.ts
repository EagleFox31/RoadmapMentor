import { type Server } from "node:http";

import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";

import { registerRoutes } from "./routes";
import { initializeScheduler } from "./scheduler";
import { accessLog, errorFields, logEvent, requestId, requestIdOf } from "./http/observability";
import { applySecurityHeaders, JSON_BODY_LIMIT } from "./http/hardening";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
applySecurityHeaders(app);
app.use(express.json({
  limit: JSON_BODY_LIMIT,
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: JSON_BODY_LIMIT }));

app.use(requestId);
app.use(accessLog);

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
) {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = status >= 500 ? "Internal Server Error" : err.message || "Error";
    const id = requestIdOf(res);
    if (status >= 500) logEvent("error", "unhandled_error", { requestId: id, ...errorFields(err) });
    if (res.headersSent) return;
    res.status(status).json({ message, requestId: id });
  });

  // importantly run the final setup after setting up all the other routes so
  // the catch-all route doesn't interfere with the other routes
  await setup(app, server);

  // Initialize the task scheduler (mercredi et vendredi 10h)
  initializeScheduler();

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    // SO_REUSEPORT is not available on Windows (listen fails with ENOTSUP).
    ...(process.platform === "win32" ? {} : { reusePort: true }),
  }, () => {
    log(`serving on port ${port}`);
  });
}
