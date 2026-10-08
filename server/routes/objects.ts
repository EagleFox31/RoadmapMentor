import express, { type Express } from "express";
import { authMiddleware, type AuthRequest } from "../auth";
import { storage } from "../storage";
import { getTaskAccess, getLearnerIdsForWeek } from "../access/weekAccess";
import { ObjectStorageService, ObjectNotFoundError } from "../objectStorage";
import { ObjectPermission } from "../objectAcl";
import { issueObjectUploadTicket, verifyObjectUploadTicket } from "../security/objectUploadTicket";
import { isAllowedUploadType, MAX_UPLOAD_BYTES, ALLOWED_UPLOAD_TYPES } from "../http/hardening";
import { handleError } from "../http/errors";
import type { RouteDeps } from "./deps";

export function registerObjectsRoutes(app: Express, { limiters }: RouteDeps) {
  // Referenced from blueprint:javascript_object_storage

  // Get presigned upload URL for screenshots
  app.post("/api/objects/upload", authMiddleware, limiters.upload, async (req: AuthRequest, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadTarget =
        await objectStorageService.getObjectEntityUploadTarget();
      // Direct-upload destinations must be bound to the authenticated requester.
      // Keep legacy provider-signed URLs unchanged.
      if (
        objectStorageService.supportsDirectUpload() &&
        uploadTarget.uploadURL.startsWith("/api/objects/local-upload/")
      ) {
        const objectId = uploadTarget.objectPath.split("/").at(-1)!;
        return res.json({
          ...uploadTarget,
          uploadTicket: issueObjectUploadTicket(objectId, req.user!.id),
        });
      }
      res.json(uploadTarget);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.put(
    "/api/objects/local-upload/:objectId",
    authMiddleware,
    limiters.upload,
    express.raw({ type: [...ALLOWED_UPLOAD_TYPES], limit: MAX_UPLOAD_BYTES }),
    async (req: AuthRequest, res) => {
      try {
        const objectStorageService = new ObjectStorageService();
        // Filesystem and S3-compatible providers use the same authenticated upload route.
        // The legacy Replit adapter still uses provider-issued upload URLs.
        if (!objectStorageService.supportsDirectUpload()) {
          return res.sendStatus(404);
        }

        // The bearer token alone is insufficient: an upload URL copied from
        // another learner cannot be used to claim that learner's evidence.
        if (!verifyObjectUploadTicket(
          req.headers["x-upload-ticket"],
          req.params.objectId,
          req.user!.id,
        )) {
          return res.status(403).json({ error: "Invalid or expired upload ticket" });
        }

        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          return res.status(400).json({ error: "Image body is required" });
        }

        const contentType = req.headers["content-type"] || "";
        if (!isAllowedUploadType(contentType)) {
          return res.status(415).json({ error: "Only PNG, JPEG, WebP or GIF images are allowed" });
        }

        await objectStorageService.writeDirectUpload(
          req.params.objectId,
          req.body,
          contentType,
        );

        const objectPath = "/objects/uploads/" + req.params.objectId;
        await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
          owner: req.user!.id.toString(),
          visibility: "private",
        });

        res.status(201).json({ objectPath });
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  // Files must not become public merely because a learner completed a task.
  // Direct object URLs are restricted to their uploader, including legacy
  // objects whose metadata still says "public".
  app.get("/objects/:objectPath(*)", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const objects = new ObjectStorageService();
      const objectFile = await objects.getObjectEntityFile(req.path);
      const isOwner = await objects.canAccessObjectEntity({
        objectFile,
        userId: req.user!.id.toString(),
        requestedPermission: ObjectPermission.WRITE,
      });
      if (!isOwner) return res.sendStatus(403);
      await objects.downloadObject(objectFile, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) return res.sendStatus(404);
      handleError(res, error);
    }
  });

  // Authorization is derived from task progress and roadmap membership, not
  // from a user-supplied storage path. Learners see only their own evidence;
  // mentors can see evidence of learners belonging to their roadmap.
  app.get("/api/tasks/:taskId/evidence/:learnerId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const taskId = Number(req.params.taskId);
      const learnerId = Number(req.params.learnerId);
      if (!Number.isSafeInteger(taskId) || taskId <= 0 ||
          !Number.isSafeInteger(learnerId) || learnerId <= 0) {
        return res.status(400).json({ error: "Invalid evidence request" });
      }

      const access = await getTaskAccess(req, taskId);
      if (!access.allowed || !access.week || !access.task) return res.sendStatus(404);

      if (req.user!.role === "LEARNER") {
        if (req.user!.id !== learnerId) return res.sendStatus(403);
      } else if (req.user!.role === "MENTOR") {
        const members = await getLearnerIdsForWeek(access.week);
        if (members !== null && !members.has(learnerId)) return res.sendStatus(404);
      } else {
        return res.sendStatus(403);
      }

      const progress = await storage.getTaskProgress(taskId, learnerId);
      if (!progress?.screenshotUrl) return res.sendStatus(404);
      const objects = new ObjectStorageService();
      const objectPath = objects.normalizeObjectEntityPath(progress.screenshotUrl);
      if (!objectPath.startsWith("/objects/uploads/")) return res.sendStatus(404);
      const objectFile = await objects.getObjectEntityFile(objectPath);
      // Prevent accidentally serving another uploader's private object if
      // progress data was tampered with or misassigned.
      const owner = await objects.getObjectOwner(objectFile);
      if (owner !== learnerId.toString()) return res.sendStatus(403);
      await objects.downloadObject(objectFile, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) return res.sendStatus(404);
      handleError(res, error);
    }
  });
}
