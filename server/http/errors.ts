

import {
  ConflictError,
  GoneError,
  InvalidRequestError,
  NotFoundError,
} from "../domain/errors";
import { errorFields, logEvent, requestIdOf } from "./observability";

export const handleError = (res: any, error: any) => {
  if (error instanceof NotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof InvalidRequestError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof GoneError) {
    return res.status(410).json({ error: error.message, reason: error.reason });
  }
  if (error instanceof ConflictError) {
    return res.status(409).json({ error: error.message });
  }
  if (error?.name === "ZodError") {
    return res.status(400).json({
      error: "Validation failed",
      issues: error.issues,
    });
  }
  const id = requestIdOf(res);
  logEvent("error", "api_error", { requestId: id, ...errorFields(error) });
  res.status(500).json({ error: "Internal server error", requestId: id });
};
