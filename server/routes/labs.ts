import { type Express } from "express";
import { storage } from "../storage";
import { asLabSubmissionView } from "../domain/labExecution";
import { authMiddleware, requireMentor, requireLearner, type AuthRequest } from "../auth";
import { createLabSchema, updateLabSchema, saveLabSubmissionSchema, reviewLabSubmissionSchema, type Week } from "@shared/schema";
import { handleError } from "../http/errors";
import { canAccessWeek, getLabAccess } from "../access/weekAccess";

export function registerLabRoutes(app: Express) {
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
      res.json(asLabSubmissionView(saved));
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
      const reviewed = await storage.reviewLabSubmission(
        submissionId,
        status,
        review.feedback ?? null,
      );
      res.json(reviewed ? asLabSubmissionView(reviewed) : reviewed);
    } catch (error) {
      handleError(res, error);
    }
  });
}
