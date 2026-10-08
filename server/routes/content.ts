import { type Express } from "express";
import { storage } from "../storage";
import { authMiddleware, requireMentor, requireLearner, type AuthRequest } from "../auth";
import { insertObjectiveSchema, insertTaskSchema, insertDeliverableSchema, insertResourceSchema, type Week } from "@shared/schema";
import { handleError } from "../http/errors";
import { z } from "zod";
import { canAccessWeek, getObjectiveAccess, getTaskAccess, getDeliverableAccess, getResourceAccess } from "../access/weekAccess";

export function registerWeekContentRoutes(app: Express) {
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
      const { objective, allowed } = await getObjectiveAccess(req, objectiveId);
      if (!objective || !allowed) {
        return res.status(404).json({ error: "Objective not found" });
      }

      const taskData = insertTaskSchema.parse({
        ...req.body,
        objectiveId,
      });
      const task = await storage.createTask(taskData);
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
}
