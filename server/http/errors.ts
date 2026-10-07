

import {
  ConflictError,
  GoneError,
  InvalidRequestError,
  NotFoundError,
} from "../domain/errors";

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
  console.error("API Error:", error);
  res.status(500).json({ error: error.message || "Internal server error" });
};
