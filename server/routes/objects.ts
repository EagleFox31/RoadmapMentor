import express, { type Express } from "express";
import { authMiddleware, verifyToken, type AuthRequest } from "../auth";
import { ObjectStorageService, ObjectNotFoundError } from "../objectStorage";
import { ObjectPermission } from "../objectAcl";
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
        if (objectStorageService.getProviderName() !== "filesystem") {
          return res.sendStatus(404);
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

  // Serve uploaded screenshots (public and private)
  app.get("/objects/:objectPath(*)", async (req, res) => {
    // Try to get user ID from token if provided, but don't require it
    const authHeader = req.headers.authorization;
    let userId: string | null = null;
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.substring(7);
        const decoded = verifyToken(token) as { id?: number } | null;
        if (decoded?.id) {
          userId = decoded.id.toString();
        }
      } catch (error) {
        // Token invalid or expired, but that's ok for public files
      }
    }
    
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      
      // Check if file is public or if user has access
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId || "anonymous",
        requestedPermission: ObjectPermission.READ,
      });
      
      if (!canAccess) {
        return res.sendStatus(userId ? 403 : 401);
      }
      
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });
}
