import express, { type Express, type Response } from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { storage } from "../storage";
import { authMiddleware, requireMentor, requireLearner, type AuthRequest } from "../auth";
import { insertObjectiveSchema, insertTaskSchema, insertDeliverableSchema, insertResourceSchema, type Week } from "@shared/schema";
import { handleError } from "../http/errors";
import { z } from "zod";
import { canAccessWeek, getObjectiveAccess, getTaskAccess, getDeliverableAccess, getResourceAccess } from "../access/weekAccess";
import { emailService } from "../services/emailService";
import { notifyWeekLearners } from "../services/notifyWeekLearners";
import { ObjectStorageService, ObjectNotFoundError } from "../objectStorage";
import { canPreviewPdf, internalDocumentRef } from "@shared/resourceLinks";
import { fetchRemotePdf, PdfProxyError } from "../services/pdfProxy";
import type { RouteDeps } from "./deps";

export function registerWeekContentRoutes(app: Express, { limiters }: RouteDeps) {
  app.post("/api/weeks/:weekId/objectives", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const weekId = parseInt(req.params.weekId, 10);
      const { week, allowed } = await canAccessWeek(req, weekId);
      if (!week || !allowed) {
        return res.status(404).json({ error: "Week not found" });
      }

      const objectiveData = insertObjectiveSchema.parse({
        ...req.body,
        weekId,
      });
      const objective = await storage.createObjective(objectiveData);
      res.status(201).json(objective);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.put("/api/objectives/:id", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const objectiveId = parseInt(req.params.id, 10);
      const { objective: existingObjective, allowed } = await getObjectiveAccess(
        req,
        objectiveId,
      );
      if (!existingObjective || !allowed) {
        return res.status(404).json({ error: "Objective not found" });
      }

      const objectiveData = insertObjectiveSchema
        .omit({ weekId: true })
        .partial()
        .parse(req.body);
      const objective = await storage.updateObjective(objectiveId, objectiveData);
      res.json(objective);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.delete("/api/objectives/:id", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const objectiveId = parseInt(req.params.id, 10);
      const { objective, allowed } = await getObjectiveAccess(req, objectiveId);
      if (!objective || !allowed) {
        return res.status(404).json({ error: "Objective not found" });
      }

      await storage.deleteObjective(objectiveId);
      res.status(204).send();
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/objectives/:id/clone", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const objectiveId = parseInt(req.params.id, 10);
      const sourceAccess = await getObjectiveAccess(req, objectiveId);
      if (!sourceAccess.objective || !sourceAccess.allowed) {
        return res.status(404).json({ error: "Objective not found" });
      }

      const targetWeekId = req.body.targetWeekId
        ? parseInt(req.body.targetWeekId, 10)
        : undefined;

      if (targetWeekId !== undefined) {
        const targetAccess = await canAccessWeek(req, targetWeekId);
        if (!targetAccess.week || !targetAccess.allowed) {
          return res.status(404).json({ error: "Target week not found" });
        }
      }

      const clonedObjective = await storage.cloneObjective(
        objectiveId,
        targetWeekId,
      );
      res.status(201).json(clonedObjective);
    } catch (error) {
      handleError(res, error);
    }
  });

  // ========== TASK ROUTES ==========

  app.post("/api/objectives/:objectiveId/tasks", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const objectiveId = parseInt(req.params.objectiveId, 10);
      const { objective, week, allowed } = await getObjectiveAccess(req, objectiveId);
      if (!objective || !allowed) {
        return res.status(404).json({ error: "Objective not found" });
      }

      const taskData = insertTaskSchema.parse({
        ...req.body,
        objectiveId,
      });
      const task = await storage.createTask(taskData);
      if (week?.isValidatedByMentor) {
        void notifyWeekLearners(week, (learner) =>
          emailService.sendNewTaskAssigned(
            learner.id,
            learner.email,
            learner.fullName,
            week.number,
            1,
          ),
        );
      }
      res.status(201).json(task);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.put("/api/tasks/:id", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const taskId = parseInt(req.params.id, 10);
      const { task: existingTask, allowed } = await getTaskAccess(req, taskId);
      if (!existingTask || !allowed) {
        return res.status(404).json({ error: "Task not found" });
      }

      const taskData = insertTaskSchema
        .omit({ objectiveId: true })
        .partial()
        .parse(req.body);
      const task = await storage.updateTask(taskId, taskData);
      res.json(task);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.delete("/api/tasks/:id", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const taskId = parseInt(req.params.id, 10);
      const { task, allowed } = await getTaskAccess(req, taskId);
      if (!task || !allowed) {
        return res.status(404).json({ error: "Task not found" });
      }

      await storage.deleteTask(taskId);
      res.status(204).send();
    } catch (error) {
      handleError(res, error);
    }
  });

  // ========== DELIVERABLE ROUTES ==========

  app.post("/api/weeks/:weekId/deliverables", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const weekId = parseInt(req.params.weekId, 10);
      const { week, allowed } = await canAccessWeek(req, weekId);
      if (!week || !allowed) {
        return res.status(404).json({ error: "Week not found" });
      }

      const deliverableData = insertDeliverableSchema.parse({
        ...req.body,
        weekId,
      });
      const deliverable = await storage.createDeliverable(deliverableData);
      res.status(201).json(deliverable);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.put("/api/deliverables/:id", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const deliverableId = parseInt(req.params.id, 10);
      const { deliverable: existingDeliverable, allowed } =
        await getDeliverableAccess(req, deliverableId);
      if (!existingDeliverable || !allowed) {
        return res.status(404).json({ error: "Deliverable not found" });
      }

      const deliverableData = insertDeliverableSchema
        .omit({ weekId: true })
        .partial()
        .parse(req.body);
      const deliverable = await storage.updateDeliverable(
        deliverableId,
        deliverableData,
      );
      res.json(deliverable);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.delete("/api/deliverables/:id", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const deliverableId = parseInt(req.params.id, 10);
      const { deliverable, allowed } = await getDeliverableAccess(
        req,
        deliverableId,
      );
      if (!deliverable || !allowed) {
        return res.status(404).json({ error: "Deliverable not found" });
      }

      await storage.deleteDeliverable(deliverableId);
      res.status(204).send();
    } catch (error) {
      handleError(res, error);
    }
  });

  // Explicitly marked as consulted; this does not validate a skill or task.
  app.get("/api/weeks/:weekId/resource-consultations", authMiddleware, requireLearner, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.weekId);
      if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid week id" });
      const { week, allowed } = await canAccessWeek(req, id);
      if (!week || !allowed) return res.status(404).json({ error: "Week not found" });
      res.json({ resourceIds: await storage.getConsultedResourceIds(id, req.user!.id) });
    } catch (error) { handleError(res, error); }
  });

  app.put("/api/resources/:id/consultation", authMiddleware, requireLearner, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid resource id" });
      const { resource, allowed } = await getResourceAccess(req, id);
      if (!resource || !allowed || !resource.isApproved) return res.status(404).json({ error: "Resource not found" });
      const { consulted } = z.object({ consulted: z.boolean() }).strict().parse(req.body);
      await storage.setResourceConsulted(id, req.user!.id, consulted);
      res.json({ resourceId: id, consulted });
    } catch (error) { handleError(res, error); }
  });

  app.post("/api/resources/:id/report-unavailable", authMiddleware, requireLearner, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid resource id" });
      const { resource, allowed } = await getResourceAccess(req, id);
      if (!resource || !allowed || !resource.isApproved) return res.status(404).json({ error: "Resource not found" });
      await storage.reportUnavailableResource(id);
      res.json({ reported: true });
    } catch (error) { handleError(res, error); }
  });

  app.post("/api/resources/:id/approve", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid resource id" });
      const { resource, allowed } = await getResourceAccess(req, id);
      if (!resource || !allowed) return res.status(404).json({ error: "Resource not found" });
      res.json(await storage.approveResource(id));
    } catch (error) { handleError(res, error); }
  });

  app.post("/api/resources/:id/clear-unavailable", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid resource id" });
      const { resource, allowed } = await getResourceAccess(req, id);
      if (!resource || !allowed) return res.status(404).json({ error: "Resource not found" });
      res.json(await storage.clearUnavailableReport(id));
    } catch (error) { handleError(res, error); }
  });

  // ========== RESOURCE ROUTES ==========

  app.post("/api/weeks/:weekId/resources", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const weekId = parseInt(req.params.weekId, 10);
      const { week, allowed } = await canAccessWeek(req, weekId);
      if (!week || !allowed) {
        return res.status(404).json({ error: "Week not found" });
      }

      const resourceData = insertResourceSchema.parse({
        ...req.body,
        weekId,
      });
      const resource = await storage.createResource(resourceData);
      res.status(201).json(resource);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.put("/api/resources/:id", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const resourceId = parseInt(req.params.id, 10);
      const { resource: existingResource, allowed } = await getResourceAccess(
        req,
        resourceId,
      );
      if (!existingResource || !allowed) {
        return res.status(404).json({ error: "Resource not found" });
      }

      const resourceData = insertResourceSchema
        .omit({ weekId: true })
        .partial()
        .parse(req.body);
      const resource = await storage.updateResource(resourceId, resourceData);
      res.json(resource);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.delete("/api/resources/:id", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const resourceId = parseInt(req.params.id, 10);
      const { resource, allowed } = await getResourceAccess(req, resourceId);
      if (!resource || !allowed) {
        return res.status(404).json({ error: "Resource not found" });
      }

      await storage.deleteResource(resourceId);
      res.status(204).send();
    } catch (error) {
      handleError(res, error);
    }
  });

  // ========== CUSTOM DOCUMENT UPLOAD & SERVING ==========

  function sanitizeFilename(raw: string): string {
    const base = path.basename(decodeURIComponent(raw || "document.pdf"));
    const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 150);
    return sanitized.length > 0 ? sanitized : "document.pdf";
  }

  function humanLabelFromFilename(filename: string): string {
    return filename
      .replace(/\.[^/.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Upload custom document for resources (Mentor only)
  app.post(
    "/api/resources/upload-document",
    authMiddleware,
    requireMentor,
    express.raw({
      type: ["application/pdf", "text/markdown", "text/plain", "application/octet-stream"],
      limit: 25 * 1024 * 1024, // 25 MB
    }),
    async (req: AuthRequest, res) => {
      try {
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          return res.status(400).json({ error: "Fichier requis" });
        }

        const rawFilename = (req.headers["x-filename"] as string) || "document.pdf";
        const safeFilename = sanitizeFilename(rawFilename);
        const contentType = (req.headers["content-type"] as string) || "application/pdf";

        // Security check for PDF signature if declared as PDF
        if (safeFilename.endsWith(".pdf") || contentType.includes("pdf")) {
          const header = req.body.subarray(0, 5).toString("ascii");
          if (header !== "%PDF-") {
            return res.status(415).json({ error: "Signature de fichier PDF invalide" });
          }
        }

        const objectId = randomUUID();
        const objectStorage = new ObjectStorageService();
        await objectStorage.writeDirectUpload(
          objectId,
          req.body,
          safeFilename.endsWith(".pdf") ? "application/pdf" : contentType,
          { owner: req.user!.id.toString(), visibility: "private" },
        );

        const protocol = req.headers["x-forwarded-proto"] || req.protocol;
        const host = req.get("host");
        const url = `${protocol}://${host}/api/resources/documents/${objectId}/${safeFilename}`;
        const label = humanLabelFromFilename(safeFilename);

        res.status(201).json({
          objectId,
          filename: safeFilename,
          url,
          label,
          size: req.body.length,
        });
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  /** Streams a stored document. Callers have already checked who may read it. */
  async function sendInternalDocument(res: Response, objectFile: string, filename: string) {
    const safeFilename = sanitizeFilename(filename);
    const isPdf = safeFilename.toLowerCase().endsWith(".pdf");
    res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);
    res.setHeader("Content-Type", isPdf ? "application/pdf" : "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=300");
    await new ObjectStorageService().downloadObject(objectFile, res);
  }

  function findInternalDocument(objectId: string) {
    return new ObjectStorageService().getObjectEntityFile(`/objects/uploads/${objectId}`);
  }

  // Stored link of an uploaded document: readable by its uploader only.
  // Everyone else reads it through the resource (/api/resources/:id/document),
  // which applies the week access rules. Tokens are never accepted in the URL.
  app.get(
    "/api/resources/documents/:objectId/:filename",
    authMiddleware,
    async (req: AuthRequest, res) => {
      try {
        const { objectId, filename } = req.params;
        if (!/^[0-9a-f-]{36}$/i.test(objectId)) {
          return res.status(400).json({ error: "Invalid document ID" });
        }
        const objectFile = await findInternalDocument(objectId);
        const owner = await new ObjectStorageService().getObjectOwner(objectFile);
        if (owner !== String(req.user!.id)) {
          return res.status(404).json({ error: "Document introuvable" });
        }
        await sendInternalDocument(res, objectFile, filename);
      } catch (error) {
        if (error instanceof ObjectNotFoundError) {
          return res.status(404).json({ error: "Document introuvable" });
        }
        handleError(res, error);
      }
    },
  );

  // Uploaded document of a resource, for anyone allowed to see that resource.
  app.get("/api/resources/:id/document", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const resourceId = parseInt(req.params.id, 10);
      const { resource, allowed } = await getResourceAccess(req, resourceId);
      const ref = resource && allowed ? internalDocumentRef(resource.url) : null;
      if (!ref) {
        return res.status(404).json({ error: "Document introuvable" });
      }
      await sendInternalDocument(res, await findInternalDocument(ref.objectId), ref.filename);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Document introuvable" });
      }
      handleError(res, error);
    }
  });

  // In-app PDF preview: many document hosts send no CORS headers, so the
  // server fetches the stored URL (SSRF-guarded, see services/pdfProxy).
  // Uploaded documents are read from storage, never fetched over HTTP.
  app.get("/api/resources/:id/pdf", authMiddleware, limiters.pdfPreview, async (req: AuthRequest, res) => {
    try {
      const resourceId = parseInt(req.params.id, 10);
      const { resource, allowed } = await getResourceAccess(req, resourceId);
      if (!resource || !allowed || !canPreviewPdf(resource.url)) {
        return res.status(404).json({ error: "Resource not found" });
      }

      const ref = internalDocumentRef(resource.url);
      if (ref) {
        return await sendInternalDocument(res, await findInternalDocument(ref.objectId), ref.filename);
      }
      const pdf = await fetchRemotePdf(resource.url);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'inline; filename="document.pdf"');
      res.setHeader("Cache-Control", "private, max-age=300");
      res.send(pdf);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Document introuvable" });
      }
      if (error instanceof PdfProxyError || (error as NodeJS.ErrnoException)?.code) {
        return res.status(502).json({ error: "Aperçu PDF indisponible pour ce document." });
      }
      handleError(res, error);
    }
  });
}
