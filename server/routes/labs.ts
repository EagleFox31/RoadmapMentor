import { type Express, type Response } from "express";
import path from "node:path";
import { storage } from "../storage";
import { authMiddleware, requireMentor, requireLearner, type AuthRequest } from "../auth";
import { createLabSchema, createLabTemplateSchema, updateLabSchema, saveLabSubmissionSchema, reviewLabSubmissionSchema, type Week } from "@shared/schema";
import { handleError } from "../http/errors";
import { canAccessWeek, getLabAccess } from "../access/weekAccess";

const PYODIDE_FILES = new Set([
  "pyodide.js",
  "pyodide.asm.js",
  "pyodide.asm.wasm",
  "pyodide-lock.json",
  "python_stdlib.zip",
]);

const PYTHON_WORKER = `
let pyodide;
let initializationError;

const initialized = (async () => {
  try {
    importScripts("/lab-runtime/pyodide.js");
    pyodide = await loadPyodide({ indexURL: "/lab-runtime/" });
    self.postMessage({ type: "ready" });
  } catch (error) {
    initializationError = String(error && error.message ? error.message : error);
    self.postMessage({ type: "init-error", error: initializationError });
  }
})();

self.onmessage = async (event) => {
  const { requestId, code } = event.data;
  await initialized;
  if (!pyodide) {
    self.postMessage({ type: "result", requestId, stdout: "", stderr: initializationError || "Python unavailable" });
    return;
  }

  const stdout = [];
  const stderr = [];
  pyodide.setStdout({ batched: (message) => stdout.push(message) });
  pyodide.setStderr({ batched: (message) => stderr.push(message) });

  try {
    await pyodide.runPythonAsync(code);
  } catch (error) {
    stderr.push(String(error && error.message ? error.message : error));
  }

  self.postMessage({ type: "result", requestId, stdout: stdout.join("\\n"), stderr: stderr.join("\\n") });
};
`;

export const LAB_RUNTIME_CSP = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; object-src 'none'; base-uri 'none'";

function setLabRuntimeHeaders(res: Response, cacheControl: string) {
  res.setHeader("Content-Security-Policy", LAB_RUNTIME_CSP);
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Cache-Control", cacheControl);
}

export function registerLabRoutes(app: Express) {
  app.get("/lab-runtime/python-worker.js", (_req, res) => {
    setLabRuntimeHeaders(res, "no-cache");
    res.type("application/javascript").send(PYTHON_WORKER);
  });

  app.get("/lab-runtime/:file", (req, res) => {
    if (!PYODIDE_FILES.has(req.params.file)) {
      return res.status(404).send("Not found");
    }
    setLabRuntimeHeaders(res, "public, max-age=86400");
    res.sendFile(path.resolve(process.cwd(), "node_modules", "pyodide", req.params.file));
  });

  app.get("/api/lab-templates", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      res.json(await storage.getLabTemplates(req.user!.id));
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/lab-templates", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const template = createLabTemplateSchema.parse(req.body);
      res.status(201).json(await storage.createLabTemplate(req.user!.id, template));
    } catch (error) {
      handleError(res, error);
    }
  });

  app.delete("/api/lab-templates/:id", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const templateId = parseInt(req.params.id, 10);
      if (!Number.isInteger(templateId) || !(await storage.deleteLabTemplate(templateId, req.user!.id))) {
        return res.status(404).json({ error: "Lab template not found" });
      }
      res.status(204).send();
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/weeks/:weekId/labs", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const weekId = parseInt(req.params.weekId, 10);
      const { week, allowed } = await canAccessWeek(req, weekId);
      if (!week || !allowed) {
        return res.status(404).json({ error: "Week not found" });
      }

      const labData = createLabSchema.parse(req.body);
      const lab = await storage.createLab({ ...labData, weekId });
      res.status(201).json(lab);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.put("/api/labs/:id", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const labId = parseInt(req.params.id, 10);
      const { lab, allowed } = await getLabAccess(req, labId);
      if (!lab || !allowed) {
        return res.status(404).json({ error: "Lab not found" });
      }

      const patch = updateLabSchema.parse(req.body);
      res.json(await storage.updateLab(labId, patch));
    } catch (error) {
      handleError(res, error);
    }
  });

  app.delete("/api/labs/:id", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const labId = parseInt(req.params.id, 10);
      const { lab, allowed } = await getLabAccess(req, labId);
      if (!lab || !allowed) {
        return res.status(404).json({ error: "Lab not found" });
      }

      await storage.deleteLab(labId);
      res.status(204).send();
    } catch (error) {
      handleError(res, error);
    }
  });

  app.put("/api/labs/:id/submission", authMiddleware, requireLearner, async (req: AuthRequest, res) => {
    try {
      const labId = parseInt(req.params.id, 10);
      const { lab, allowed } = await getLabAccess(req, labId);
      if (!lab || !allowed) {
        return res.status(404).json({ error: "Lab not found" });
      }

      const submission = saveLabSubmissionSchema.parse(req.body);
      const existingSubmission = await storage.getLabSubmissionForLearner(labId, req.user!.id);
      if (existingSubmission?.status === "APPROVED") {
        return res.status(409).json({ error: "An approved lab cannot be changed" });
      }
      const saved = await storage.saveLabSubmission(
        labId,
        req.user!.id,
        submission.code,
        submission.output ?? null,
        submission.submit,
      );
      res.json({
        ...saved,
        executionTrust: lab.executionMode === "PYTHON_BROWSER" ? "client-side" : "external",
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/lab-submissions/:id/review", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const submissionId = parseInt(req.params.id, 10);
      const submission = await storage.getLabSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ error: "Lab submission not found" });
      }
      if (submission.status !== "SUBMITTED") {
        return res.status(409).json({ error: "Only a submitted lab can be reviewed" });
      }

      const { lab, allowed } = await getLabAccess(req, submission.labId);
      if (!lab || !allowed) {
        return res.status(404).json({ error: "Lab submission not found" });
      }

      const review = reviewLabSubmissionSchema.parse(req.body);
      const status = review.decision === "APPROVE" ? "APPROVED" : "CHANGES_REQUESTED";
      res.json(await storage.reviewLabSubmission(
        submissionId,
        status,
        review.feedback ?? null,
      ));
    } catch (error) {
      handleError(res, error);
    }
  });
}
