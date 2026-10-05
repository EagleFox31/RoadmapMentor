import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { pool } from "./db";
import { emailService } from "./services/emailService";
import { authMiddleware, requireMentor, requireLearner, generateToken, hashPassword, comparePassword, verifyToken, type AuthRequest } from "./auth";
import { publicRegistrationSchema, insertRoadmapSchema, insertMentorshipSchema, createMentoringPackageSchema, insertMentoringPackageSchema, createChangeRequestSchema, insertChangeRequestSchema, quoteChangeRequestSchema, changeRequestDecisionSchema, scheduleMentoringSessionSchema, insertMentoringSessionSchema, completeMentoringSessionSchema, createBillingPeriodSchema, insertBillingPeriodSchema, insertBillingChargeSchema, manualBillingChargeSchema, insertPaymentSchema, recordManualPaymentSchema, insertWeekSchema, insertObjectiveSchema, insertTaskSchema, insertDeliverableSchema, insertResourceSchema, insertWeekCommentSchema, insertRoadmapBulkSchema, updateEmailNotificationPreferencesSchema, type BillingPeriod, type Week } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { isDevelopmentEnvironment } from "./security";
import { assertChangeRequestTransition, requiresLinkedRoadmapWork } from "./domain/changeRequest";
import { canFinalizeMentoringSession, finalStatusForAttendance } from "./domain/mentoringSession";
import { assertCurrencyMatches, summarizeBilling } from "./domain/billing";
import { manualPaymentAdapter } from "./payments/provider";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/health/live", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/health/ready", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.status(200).json({ status: "ready" });
    } catch (error) {
      console.error("Readiness check failed:", error);
      res.status(503).json({ status: "not_ready" });
    }
  });

  // Helper to send errors
  const handleError = (res: any, error: any) => {
    if (error?.name === "ZodError") {
      return res.status(400).json({
        error: "Validation failed",
        issues: error.issues,
      });
    }
    console.error("API Error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  };

  const canAccessWeek = async (req: AuthRequest, weekId: number) => {
    const week = await storage.getWeek(weekId);
    if (!week) {
      return { week: undefined, allowed: false };
    }

    // Transitional compatibility: pre-domain weeks stay reachable until the
    // explicit legacy migration attaches them to the legacy roadmap.
    // Learners only see weeks validated by a mentor (same rule as GET /api/weeks).
    const hiddenFromLearner =
      req.user!.role === "LEARNER" && !week.isValidatedByMentor;

    if (week.roadmapId === null) {
      return { week, allowed: !hiddenFromLearner };
    }

    const allowed =
      !hiddenFromLearner &&
      (await storage.userCanAccessRoadmap(
        req.user!.id,
        req.user!.role,
        week.roadmapId,
      ));
    return { week, allowed };
  };

  const resolveRoadmapIdForNewWeek = async (
    req: AuthRequest,
    requestedRoadmapId: unknown,
  ): Promise<number | null> => {
    if (requestedRoadmapId !== undefined && requestedRoadmapId !== null) {
      const roadmapId = Number(requestedRoadmapId);
      if (!Number.isInteger(roadmapId) || roadmapId <= 0) {
        throw new Error("roadmapId must be a positive integer");
      }

      if (!(await storage.userCanAccessRoadmap(req.user!.id, req.user!.role, roadmapId))) {
        throw new Error("Roadmap not found");
      }
      return roadmapId;
    }

    const accessibleRoadmaps = await storage.getRoadmapsForUser(
      req.user!.id,
      req.user!.role,
    );

    if (accessibleRoadmaps.length === 1) {
      return accessibleRoadmaps[0].id;
    }

    if (accessibleRoadmaps.length > 1) {
      throw new Error("roadmapId is required when more than one roadmap is accessible");
    }

    return null;
  };

  const getMentorsForWeek = async (week: Week) => {
    if (week.roadmapId === null) {
      return await emailService.getAllMentors();
    }

    const roadmap = await storage.getRoadmap(week.roadmapId);
    const memberships = await storage.getMentorshipsByRoadmap(week.roadmapId);
    const mentorIds = new Set(
      memberships
        .filter((membership) => membership.status !== "CANCELLED")
        .map((membership) => membership.mentorId),
    );

    if (roadmap?.createdByUserId) {
      mentorIds.add(roadmap.createdByUserId);
    }

    const mentors = await Promise.all(
      Array.from(mentorIds).map((mentorId) => storage.getUser(mentorId)),
    );

    return mentors.filter(
      (mentor): mentor is NonNullable<typeof mentor> =>
        Boolean(mentor && mentor.role === "MENTOR"),
    );
  };

  const getLearnerIdsForWeek = async (week: Week): Promise<Set<number> | null> => {
    if (week.roadmapId === null) {
      return null;
    }

    const memberships = await storage.getMentorshipsByRoadmap(week.roadmapId);
    return new Set(
      memberships
        .filter((membership) => membership.status !== "CANCELLED")
        .map((membership) => membership.learnerId),
    );
  };

  const getObjectiveAccess = async (req: AuthRequest, objectiveId: number) => {
    const objective = await storage.getObjective(objectiveId);
    if (!objective) {
      return { objective: undefined, week: undefined, allowed: false };
    }

    const weekAccess = await canAccessWeek(req, objective.weekId);
    return {
      objective,
      week: weekAccess.week,
      allowed: weekAccess.allowed,
    };
  };

  const getTaskAccess = async (req: AuthRequest, taskId: number) => {
    const task = await storage.getTask(taskId);
    if (!task) {
      return {
        task: undefined,
        objective: undefined,
        week: undefined,
        allowed: false,
      };
    }

    const objectiveAccess = await getObjectiveAccess(req, task.objectiveId);
    return {
      task,
      objective: objectiveAccess.objective,
      week: objectiveAccess.week,
      allowed: objectiveAccess.allowed,
    };
  };

  const getDeliverableAccess = async (req: AuthRequest, deliverableId: number) => {
    const deliverable = await storage.getDeliverable(deliverableId);
    if (!deliverable) {
      return { deliverable: undefined, week: undefined, allowed: false };
    }

    const weekAccess = await canAccessWeek(req, deliverable.weekId);
    return {
      deliverable,
      week: weekAccess.week,
      allowed: weekAccess.allowed,
    };
  };

  const getResourceAccess = async (req: AuthRequest, resourceId: number) => {
    const resource = await storage.getResource(resourceId);
    if (!resource) {
      return { resource: undefined, week: undefined, allowed: false };
    }

    const weekAccess = await canAccessWeek(req, resource.weekId);
    return {
      resource,
      week: weekAccess.week,
      allowed: weekAccess.allowed,
    };
  };

  const getMentorshipAccess = async (req: AuthRequest, mentorshipId: number) => {
    const mentorship = await storage.getMentorship(mentorshipId);
    if (!mentorship) {
      return { mentorship: undefined, allowed: false, canManage: false };
    }

    const roadmap = await storage.getRoadmap(mentorship.roadmapId);
    if (!roadmap) {
      return { mentorship, allowed: false, canManage: false };
    }

    if (req.user!.role === "LEARNER") {
      const allowed =
        mentorship.learnerId === req.user!.id &&
        mentorship.status !== "CANCELLED";
      return { mentorship, allowed, canManage: false };
    }

    const canManage =
      mentorship.mentorId === req.user!.id ||
      roadmap.createdByUserId === req.user!.id;

    return { mentorship, allowed: canManage, canManage };
  };

  const validateTaskBelongsToMentorshipRoadmap = async (
    mentorshipId: number,
    taskId: number,
  ) => {
    const mentorship = await storage.getMentorship(mentorshipId);
    const task = await storage.getTask(taskId);
    if (!mentorship || !task) {
      return false;
    }

    const objective = await storage.getObjective(task.objectiveId);
    if (!objective) {
      return false;
    }

    const week = await storage.getWeek(objective.weekId);
    return Boolean(week && week.roadmapId === mentorship.roadmapId);
  };

  const getBillingPeriodAccess = async (
    req: AuthRequest,
    billingPeriodId: number,
  ) => {
    const billingPeriod = await storage.getBillingPeriod(billingPeriodId);
    if (!billingPeriod) {
      return { billingPeriod: undefined, allowed: false, canManage: false };
    }

    const mentorshipAccess = await getMentorshipAccess(
      req,
      billingPeriod.mentorshipId,
    );

    return {
      billingPeriod,
      allowed: mentorshipAccess.allowed,
      canManage: mentorshipAccess.canManage,
    };
  };

  const buildBillingPeriodDetails = async (billingPeriod: BillingPeriod) => {
    const [charges, payments] = await Promise.all([
      storage.getBillingChargesByPeriod(billingPeriod.id),
      storage.getPaymentsByBillingPeriod(billingPeriod.id),
    ]);

    const summary = summarizeBilling({
      baseAmountMinor: billingPeriod.baseAmountMinor,
      charges,
      payments,
      isVoid: billingPeriod.status === "VOID",
    });

    return {
      ...billingPeriod,
      charges,
      payments,
      ...summary,
    };
  };

  const refreshBillingPeriodStatus = async (billingPeriod: BillingPeriod) => {
    const details = await buildBillingPeriodDetails(billingPeriod);
    if (
      billingPeriod.status !== "VOID" &&
      details.status !== billingPeriod.status
    ) {
      const updated = await storage.updateBillingPeriod(billingPeriod.id, {
        status: details.status,
      });
      return updated ? await buildBillingPeriodDetails(updated) : details;
    }
    return details;
  };

  const reconcileBillingPeriod = async (billingPeriod: BillingPeriod) => {
    if (billingPeriod.status === "VOID") {
      return await buildBillingPeriodDetails(billingPeriod);
    }

    const requests = await storage.getChangeRequestsByMentorship(
      billingPeriod.mentorshipId,
    );

    for (const request of requests) {
      if (
        request.packageId !== billingPeriod.packageId ||
        (request.status !== "ACCEPTED" && request.status !== "DELIVERED") ||
        request.quotedPriceMinor === null
      ) {
        continue;
      }

      assertCurrencyMatches(billingPeriod.currency, request.currency);
      const existing = await storage.findBillingChargeByChangeRequest(
        request.id,
      );
      if (!existing) {
        const charge = insertBillingChargeSchema.parse({
          billingPeriodId: billingPeriod.id,
          type: "CHANGE_REQUEST",
          description: "Scope additionnel · " + request.title,
          amountMinor: request.quotedPriceMinor,
          changeRequestId: request.id,
          sessionId: null,
        });
        await storage.createBillingCharge(charge);
      }
    }

    const sessions = await storage.getMentoringSessionsByMentorship(
      billingPeriod.mentorshipId,
    );

    for (const session of sessions) {
      const sessionDate = session.startsAt.toISOString().slice(0, 10);
      const billableStatus =
        session.status === "COMPLETED" || session.status === "NO_SHOW";

      if (
        !session.isAdditional ||
        !billableStatus ||
        sessionDate < billingPeriod.periodStart ||
        sessionDate > billingPeriod.periodEnd ||
        session.additionalPriceMinor === null ||
        !session.additionalPriceCurrency
      ) {
        continue;
      }

      assertCurrencyMatches(
        billingPeriod.currency,
        session.additionalPriceCurrency,
      );
      const existing = await storage.findBillingChargeBySession(session.id);
      if (!existing) {
        const charge = insertBillingChargeSchema.parse({
          billingPeriodId: billingPeriod.id,
          type: "ADDITIONAL_SESSION",
          description: "Séance additionnelle · " + session.title,
          amountMinor: session.additionalPriceMinor,
          changeRequestId: null,
          sessionId: session.id,
        });
        await storage.createBillingCharge(charge);
      }
    }

    return await refreshBillingPeriodStatus(billingPeriod);
  };

  // ========== AUTH ROUTES ==========

  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = publicRegistrationSchema.parse(req.body);
      const { fullName, email, password } = userData;
      
      // Check if user exists
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "User already exists" });
      }

      // Hash password and create user
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        fullName,
        email,
        password: hashedPassword,
        role: "LEARNER",
      });

      // Create default email notification preferences
      await storage.createEmailPreferences({
        userId: user.id,
        taskReminders: true,
        weekPreparation: true,
        progressUpdates: true,
        commentNotifications: true,
      });

      const token = generateToken(user);
      const { password: _, ...userWithoutPassword } = user;
      
      res.status(201).json({ token, user: userWithoutPassword });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValid = await comparePassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = generateToken(user);
      const { password: _, ...userWithoutPassword } = user;

      res.json({ token, user: userWithoutPassword });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      handleError(res, error);
    }
  });

  // Development only: create local test users. This route does not exist in production.
  if (isDevelopmentEnvironment()) {
    app.post("/api/auth/create-test-users", async (req, res) => {
    try {
      const testUsers = [
        { fullName: "Mentor Test", email: "mentor@test.com", password: "Test123!", role: "MENTOR" },
        { fullName: "Apprenant Test", email: "learner@test.com", password: "Test123!", role: "LEARNER" },
      ];

      const createdUsers = [];
      for (const testUser of testUsers) {
        // Check if user already exists
        const existing = await storage.getUserByEmail(testUser.email);
        if (existing) {
          createdUsers.push({ email: testUser.email, message: "Already exists" });
          continue;
        }

        const hashedPassword = await hashPassword(testUser.password);
        const user = await storage.createUser({
          fullName: testUser.fullName,
          email: testUser.email,
          password: hashedPassword,
          role: testUser.role as "MENTOR" | "LEARNER",
        });
        createdUsers.push({ email: user.email, role: user.role, fullName: user.fullName });
      }

      res.json({ message: "Test users created", users: createdUsers });
    } catch (error) {
      handleError(res, error);
    }
    });
  }

  // ========== OBJECT STORAGE ROUTES ==========
  // Referenced from blueprint:javascript_object_storage

  // Get presigned upload URL for screenshots
  app.post("/api/objects/upload", authMiddleware, async (req: AuthRequest, res) => {
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
    express.raw({ type: "image/*", limit: "5mb" }),
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
        if (!contentType.startsWith("image/")) {
          return res.status(415).json({ error: "Only image uploads are allowed" });
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

  // ========== ROADMAP / MENTORSHIP ROUTES ==========

  app.get("/api/roadmaps", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const roadmaps = await storage.getRoadmapsForUser(
        req.user!.id,
        req.user!.role,
      );
      res.json(roadmaps);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/roadmaps/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const roadmapId = parseInt(req.params.id, 10);
      const roadmap = await storage.getRoadmap(roadmapId);
      if (
        !roadmap ||
        !(await storage.userCanAccessRoadmap(req.user!.id, req.user!.role, roadmapId))
      ) {
        return res.status(404).json({ error: "Roadmap not found" });
      }

      res.json(roadmap);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/roadmaps", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const roadmapData = insertRoadmapSchema.parse({
        ...req.body,
        createdByUserId: req.user!.id,
        isLegacy: false,
      });
      const roadmap = await storage.createRoadmap(roadmapData);
      res.status(201).json(roadmap);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/mentorships", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const accessibleRoadmaps = await storage.getRoadmapsForUser(
        req.user!.id,
        req.user!.role,
      );

      const entries = [];
      for (const roadmap of accessibleRoadmaps) {
        const memberships = await storage.getMentorshipsByRoadmap(roadmap.id);

        for (const mentorship of memberships) {
          const belongsToCurrentUser =
            req.user!.role === "MENTOR"
              ? mentorship.mentorId === req.user!.id ||
                roadmap.createdByUserId === req.user!.id
              : mentorship.learnerId === req.user!.id;

          if (!belongsToCurrentUser || mentorship.status === "CANCELLED") {
            continue;
          }

          const [mentor, learner] = await Promise.all([
            storage.getUser(mentorship.mentorId),
            storage.getUser(mentorship.learnerId),
          ]);

          entries.push({
            ...mentorship,
            roadmap: {
              id: roadmap.id,
              title: roadmap.title,
              description: roadmap.description,
            },
            mentor: mentor
              ? {
                  id: mentor.id,
                  fullName: mentor.fullName,
                  email: mentor.email,
                }
              : null,
            learner: learner
              ? {
                  id: learner.id,
                  fullName: learner.fullName,
                  email: learner.email,
                }
              : null,
          });
        }
      }

      res.json(entries);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get(
    "/api/roadmaps/:id/mentorships",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const roadmapId = parseInt(req.params.id, 10);
        if (
          !(await storage.userCanAccessRoadmap(
            req.user!.id,
            req.user!.role,
            roadmapId,
          ))
        ) {
          return res.status(404).json({ error: "Roadmap not found" });
        }

        const memberships = await storage.getMentorshipsByRoadmap(roadmapId);
        res.json(memberships);
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/roadmaps/:id/mentorships",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const roadmapId = parseInt(req.params.id, 10);
        if (
          !(await storage.userCanAccessRoadmap(
            req.user!.id,
            req.user!.role,
            roadmapId,
          ))
        ) {
          return res.status(404).json({ error: "Roadmap not found" });
        }

        const learnerId = Number(req.body.learnerId);
        const learner = Number.isInteger(learnerId)
          ? await storage.getUser(learnerId)
          : undefined;

        if (!learner || learner.role !== "LEARNER") {
          return res.status(400).json({ error: "A valid learnerId is required" });
        }

        const existing = await storage.findMentorship(
          roadmapId,
          req.user!.id,
          learnerId,
        );
        if (existing) {
          return res.status(200).json(existing);
        }

        const mentorshipData = insertMentorshipSchema.parse({
          roadmapId,
          mentorId: req.user!.id,
          learnerId,
          status: "ACTIVE",
          startedAt: new Date(),
          endedAt: null,
        });

        const mentorship = await storage.createMentorship(mentorshipData);
        res.status(201).json(mentorship);
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  // Exact-email lookup used by mentors to attach a learner to a roadmap.
  // Only LEARNER accounts are returned; any other outcome is an indistinguishable 404.
  app.get(
    "/api/learners/lookup",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const email =
          typeof req.query.email === "string" ? req.query.email.trim() : "";
        if (!email || !email.includes("@")) {
          return res.status(400).json({ error: "A valid email is required" });
        }

        const user = (await storage.getUserByEmail(email)) ?? (await storage.getUserByEmail(email.toLowerCase()));
        if (!user || user.role !== "LEARNER") {
          return res.status(404).json({ error: "Learner not found" });
        }

        res.json({ id: user.id, fullName: user.fullName, email: user.email });
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  // ========== MENTORING PACKAGE / SCOPE ROUTES ==========

  app.get(
    "/api/mentorships/:id/packages",
    authMiddleware,
    async (req: AuthRequest, res) => {
      try {
        const mentorshipId = Number(req.params.id);
        if (!Number.isInteger(mentorshipId) || mentorshipId <= 0) {
          return res.status(400).json({ error: "Invalid mentorship id" });
        }

        const access = await getMentorshipAccess(req, mentorshipId);
        if (!access.allowed) {
          return res.status(404).json({ error: "Mentorship not found" });
        }

        const packages = await storage.getMentoringPackagesByMentorship(
          mentorshipId,
        );
        res.json(packages);
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/mentorships/:id/packages",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const mentorshipId = Number(req.params.id);
        if (!Number.isInteger(mentorshipId) || mentorshipId <= 0) {
          return res.status(400).json({ error: "Invalid mentorship id" });
        }

        const access = await getMentorshipAccess(req, mentorshipId);
        if (!access.allowed || !access.canManage) {
          return res.status(404).json({ error: "Mentorship not found" });
        }

        const input = createMentoringPackageSchema.parse(req.body);
        const packageData = insertMentoringPackageSchema.parse({
          mentorshipId,
          title: input.title,
          basePriceMinor: input.basePriceMinor,
          currency: input.currency,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          includedSessionCount: input.includedSessionCount,
          includedSessionDurationMinutes:
            input.includedSessionDurationMinutes ?? null,
          sessionSchedule: input.sessionSchedule ?? null,
          scopeDescription: input.scopeDescription,
          createdByUserId: req.user!.id,
        });

        const mentoringPackage = await storage.createMentoringPackageWithScope(
          packageData,
          input.scopeItems.map(
            (scopeItem: { title: string; description?: string | null }) => ({
              title: scopeItem.title,
              description: scopeItem.description ?? null,
            }),
          ),
        );

        res.status(201).json(mentoringPackage);
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.get(
    "/api/mentorships/:id/change-requests",
    authMiddleware,
    async (req: AuthRequest, res) => {
      try {
        const mentorshipId = Number(req.params.id);
        if (!Number.isInteger(mentorshipId) || mentorshipId <= 0) {
          return res.status(400).json({ error: "Invalid mentorship id" });
        }

        const access = await getMentorshipAccess(req, mentorshipId);
        if (!access.allowed) {
          return res.status(404).json({ error: "Mentorship not found" });
        }

        const requests = await storage.getChangeRequestsByMentorship(
          mentorshipId,
        );
        res.json(requests);
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/mentorships/:id/change-requests",
    authMiddleware,
    requireLearner,
    async (req: AuthRequest, res) => {
      try {
        const mentorshipId = Number(req.params.id);
        if (!Number.isInteger(mentorshipId) || mentorshipId <= 0) {
          return res.status(400).json({ error: "Invalid mentorship id" });
        }

        const access = await getMentorshipAccess(req, mentorshipId);
        if (!access.allowed || access.mentorship?.learnerId !== req.user!.id) {
          return res.status(404).json({ error: "Mentorship not found" });
        }

        const input = createChangeRequestSchema.parse(req.body);
        const mentoringPackage = await storage.getMentoringPackage(input.packageId);
        if (
          !mentoringPackage ||
          mentoringPackage.mentorshipId !== mentorshipId
        ) {
          return res.status(400).json({
            error: "packageId must belong to this mentorship",
          });
        }

        const changeRequestData = insertChangeRequestSchema.parse({
          mentorshipId,
          packageId: mentoringPackage.id,
          requestedByUserId: req.user!.id,
          title: input.title,
          description: input.description,
          status: "PROPOSED",
          quotedPriceMinor: null,
          currency: mentoringPackage.currency,
          linkedTaskId: null,
        });

        const changeRequest = await storage.createChangeRequest(
          changeRequestData,
        );
        res.status(201).json(changeRequest);
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/change-requests/:id/quote",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const changeRequestId = Number(req.params.id);
        const changeRequest = Number.isInteger(changeRequestId)
          ? await storage.getChangeRequest(changeRequestId)
          : undefined;

        if (!changeRequest) {
          return res.status(404).json({ error: "Change request not found" });
        }

        const access = await getMentorshipAccess(
          req,
          changeRequest.mentorshipId,
        );
        if (!access.allowed || !access.canManage) {
          return res.status(404).json({ error: "Change request not found" });
        }

        assertChangeRequestTransition(changeRequest.status, "QUOTED");
        const input = quoteChangeRequestSchema.parse(req.body);

        if (
          !(await validateTaskBelongsToMentorshipRoadmap(
            changeRequest.mentorshipId,
            input.linkedTaskId,
          ))
        ) {
          return res.status(400).json({
            error: "linkedTaskId must belong to the mentorship roadmap",
          });
        }

        const updated = await storage.updateChangeRequest(changeRequest.id, {
          status: "QUOTED",
          quotedPriceMinor: input.quotedPriceMinor,
          currency: input.currency,
          linkedTaskId: input.linkedTaskId,
          quotedAt: new Date(),
        });

        res.json(updated);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("Invalid change request transition")
        ) {
          return res.status(409).json({ error: error.message });
        }
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/change-requests/:id/decision",
    authMiddleware,
    requireLearner,
    async (req: AuthRequest, res) => {
      try {
        const changeRequestId = Number(req.params.id);
        const changeRequest = Number.isInteger(changeRequestId)
          ? await storage.getChangeRequest(changeRequestId)
          : undefined;

        if (!changeRequest) {
          return res.status(404).json({ error: "Change request not found" });
        }

        const access = await getMentorshipAccess(
          req,
          changeRequest.mentorshipId,
        );
        if (
          !access.allowed ||
          access.mentorship?.learnerId !== req.user!.id
        ) {
          return res.status(404).json({ error: "Change request not found" });
        }

        const input = changeRequestDecisionSchema.parse(req.body);
        const nextStatus =
          input.decision === "ACCEPT" ? "ACCEPTED" : "REJECTED";

        assertChangeRequestTransition(changeRequest.status, nextStatus);

        if (
          requiresLinkedRoadmapWork(nextStatus) &&
          !changeRequest.linkedTaskId
        ) {
          return res.status(409).json({
            error:
              "Accepted scope changes must be linked to roadmap work before approval",
          });
        }

        const updated = await storage.updateChangeRequest(changeRequest.id, {
          status: nextStatus,
          acceptedAt: nextStatus === "ACCEPTED" ? new Date() : null,
          rejectedAt: nextStatus === "REJECTED" ? new Date() : null,
        });

        if (nextStatus === "ACCEPTED" && changeRequest.packageId) {
          const billingPeriod = await storage.findBillingPeriodByPackage(
            changeRequest.packageId,
          );
          if (billingPeriod) {
            await reconcileBillingPeriod(billingPeriod);
          }
        }

        res.json(updated);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("Invalid change request transition")
        ) {
          return res.status(409).json({ error: error.message });
        }
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/change-requests/:id/deliver",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const changeRequestId = Number(req.params.id);
        const changeRequest = Number.isInteger(changeRequestId)
          ? await storage.getChangeRequest(changeRequestId)
          : undefined;

        if (!changeRequest) {
          return res.status(404).json({ error: "Change request not found" });
        }

        const access = await getMentorshipAccess(
          req,
          changeRequest.mentorshipId,
        );
        if (!access.allowed || !access.canManage) {
          return res.status(404).json({ error: "Change request not found" });
        }

        assertChangeRequestTransition(changeRequest.status, "DELIVERED");
        if (!changeRequest.linkedTaskId) {
          return res.status(409).json({
            error: "Delivered scope changes must remain linked to roadmap work",
          });
        }

        const updated = await storage.updateChangeRequest(changeRequest.id, {
          status: "DELIVERED",
          deliveredAt: new Date(),
        });

        res.json(updated);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("Invalid change request transition")
        ) {
          return res.status(409).json({ error: error.message });
        }
        handleError(res, error);
      }
    },
  );

  // ========== MENTORING SESSION ROUTES ==========

  app.get(
    "/api/mentorships/:id/sessions",
    authMiddleware,
    async (req: AuthRequest, res) => {
      try {
        const mentorshipId = Number(req.params.id);
        if (!Number.isInteger(mentorshipId) || mentorshipId <= 0) {
          return res.status(400).json({ error: "Invalid mentorship id" });
        }

        const access = await getMentorshipAccess(req, mentorshipId);
        if (!access.allowed) {
          return res.status(404).json({ error: "Mentorship not found" });
        }

        const requestedMonth =
          typeof req.query.month === "string" ? req.query.month : undefined;
        if (
          requestedMonth &&
          !/^\d{4}-\d{2}$/.test(requestedMonth)
        ) {
          return res.status(400).json({ error: "month must use YYYY-MM" });
        }

        let sessions = await storage.getMentoringSessionsByMentorship(
          mentorshipId,
        );
        if (requestedMonth) {
          sessions = sessions.filter(
            (session) =>
              session.startsAt.toISOString().slice(0, 7) === requestedMonth,
          );
        }

        const packages = await storage.getMentoringPackagesByMentorship(
          mentorshipId,
        );
        const packageUsage = packages.map((mentoringPackage) => {
          const usedSessionCount = sessions.filter(
            (session) =>
              session.packageId === mentoringPackage.id &&
              !session.isAdditional &&
              session.status !== "CANCELLED",
          ).length;

          return {
            packageId: mentoringPackage.id,
            title: mentoringPackage.title,
            includedSessionCount: mentoringPackage.includedSessionCount,
            usedSessionCount,
            remainingSessionCount: Math.max(
              mentoringPackage.includedSessionCount - usedSessionCount,
              0,
            ),
          };
        });

        res.json({ sessions, packageUsage });
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/mentorships/:id/sessions",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const mentorshipId = Number(req.params.id);
        if (!Number.isInteger(mentorshipId) || mentorshipId <= 0) {
          return res.status(400).json({ error: "Invalid mentorship id" });
        }

        const access = await getMentorshipAccess(req, mentorshipId);
        if (!access.allowed || !access.canManage || !access.mentorship) {
          return res.status(404).json({ error: "Mentorship not found" });
        }

        const input = scheduleMentoringSessionSchema.parse(req.body);

        if (input.packageId) {
          const mentoringPackage = await storage.getMentoringPackage(
            input.packageId,
          );
          if (
            !mentoringPackage ||
            mentoringPackage.mentorshipId !== mentorshipId
          ) {
            return res.status(400).json({
              error: "packageId must belong to this mentorship",
            });
          }
        }

        if (input.weekId) {
          const week = await storage.getWeek(input.weekId);
          if (
            !week ||
            week.roadmapId !== access.mentorship.roadmapId
          ) {
            return res.status(400).json({
              error: "weekId must belong to this mentorship roadmap",
            });
          }
        }

        const sessionData = insertMentoringSessionSchema.parse({
          mentorshipId,
          packageId: input.packageId ?? null,
          weekId: input.weekId ?? null,
          title: input.title,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          status: "SCHEDULED",
          isAdditional: input.isAdditional,
          additionalPriceMinor: input.additionalPriceMinor ?? null,
          additionalPriceCurrency: input.additionalPriceCurrency ?? null,
          learnerAttended: null,
          mentorNotes: null,
          calendarProvider: input.calendarProvider ?? null,
          calendarEventId: input.calendarEventId ?? null,
          createdByUserId: req.user!.id,
        });

        const session = await storage.createMentoringSession(sessionData);
        res.status(201).json(session);
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/sessions/:id/complete",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const sessionId = Number(req.params.id);
        const session = Number.isInteger(sessionId)
          ? await storage.getMentoringSession(sessionId)
          : undefined;

        if (!session) {
          return res.status(404).json({ error: "Session not found" });
        }

        const access = await getMentorshipAccess(req, session.mentorshipId);
        if (!access.allowed || !access.canManage) {
          return res.status(404).json({ error: "Session not found" });
        }

        if (!canFinalizeMentoringSession(session.status)) {
          return res.status(409).json({
            error: `Session cannot be completed from status ${session.status}`,
          });
        }

        const input = completeMentoringSessionSchema.parse(req.body);
        const updated = await storage.updateMentoringSession(session.id, {
          status: finalStatusForAttendance(input.learnerAttended),
          learnerAttended: input.learnerAttended,
          mentorNotes: input.mentorNotes ?? null,
        });

        if (
          updated?.isAdditional &&
          updated.additionalPriceMinor !== null &&
          updated.additionalPriceCurrency
        ) {
          const sessionDate = updated.startsAt.toISOString().slice(0, 10);
          const billingPeriods = await storage.getBillingPeriodsByMentorship(
            updated.mentorshipId,
          );

          for (const billingPeriod of billingPeriods) {
            if (
              billingPeriod.status !== "VOID" &&
              sessionDate >= billingPeriod.periodStart &&
              sessionDate <= billingPeriod.periodEnd &&
              billingPeriod.currency.toUpperCase() ===
                updated.additionalPriceCurrency.toUpperCase()
            ) {
              await reconcileBillingPeriod(billingPeriod);
            }
          }
        }

        res.json(updated);
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/sessions/:id/cancel",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const sessionId = Number(req.params.id);
        const session = Number.isInteger(sessionId)
          ? await storage.getMentoringSession(sessionId)
          : undefined;

        if (!session) {
          return res.status(404).json({ error: "Session not found" });
        }

        const access = await getMentorshipAccess(req, session.mentorshipId);
        if (!access.allowed || !access.canManage) {
          return res.status(404).json({ error: "Session not found" });
        }

        if (!canFinalizeMentoringSession(session.status)) {
          return res.status(409).json({
            error: `Session cannot be cancelled from status ${session.status}`,
          });
        }

        const updated = await storage.updateMentoringSession(session.id, {
          status: "CANCELLED",
        });
        res.json(updated);
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  // ========== BILLING / PAYMENT ROUTES ==========

  app.get(
    "/api/mentorships/:id/billing",
    authMiddleware,
    async (req: AuthRequest, res) => {
      try {
        const mentorshipId = Number(req.params.id);
        if (!Number.isInteger(mentorshipId) || mentorshipId <= 0) {
          return res.status(400).json({ error: "Invalid mentorship id" });
        }

        const access = await getMentorshipAccess(req, mentorshipId);
        if (!access.allowed) {
          return res.status(404).json({ error: "Mentorship not found" });
        }

        const periods = await storage.getBillingPeriodsByMentorship(
          mentorshipId,
        );
        const details = await Promise.all(
          periods.map((period) => buildBillingPeriodDetails(period)),
        );

        res.json(details);
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/mentorships/:id/billing-periods",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const mentorshipId = Number(req.params.id);
        if (!Number.isInteger(mentorshipId) || mentorshipId <= 0) {
          return res.status(400).json({ error: "Invalid mentorship id" });
        }

        const access = await getMentorshipAccess(req, mentorshipId);
        if (!access.allowed || !access.canManage) {
          return res.status(404).json({ error: "Mentorship not found" });
        }

        const input = createBillingPeriodSchema.parse(req.body);
        const mentoringPackage = await storage.getMentoringPackage(
          input.packageId,
        );
        if (
          !mentoringPackage ||
          mentoringPackage.mentorshipId !== mentorshipId
        ) {
          return res.status(400).json({
            error: "packageId must belong to this mentorship",
          });
        }

        const existing = await storage.findBillingPeriodByPackage(
          mentoringPackage.id,
        );
        if (existing) {
          return res.status(200).json(
            await reconcileBillingPeriod(existing),
          );
        }

        const billingPeriodData = insertBillingPeriodSchema.parse({
          mentorshipId,
          packageId: mentoringPackage.id,
          title: mentoringPackage.title,
          currency: mentoringPackage.currency,
          periodStart: mentoringPackage.periodStart,
          periodEnd: mentoringPackage.periodEnd,
          dueDate: input.dueDate,
          baseAmountMinor: mentoringPackage.basePriceMinor,
          status: "DUE",
          createdByUserId: req.user!.id,
        });

        const billingPeriod = await storage.createBillingPeriod(
          billingPeriodData,
        );
        res.status(201).json(
          await reconcileBillingPeriod(billingPeriod),
        );
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/billing-periods/:id/reconcile",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const billingPeriodId = Number(req.params.id);
        const access = Number.isInteger(billingPeriodId)
          ? await getBillingPeriodAccess(req, billingPeriodId)
          : { billingPeriod: undefined, allowed: false, canManage: false };

        if (
          !access.billingPeriod ||
          !access.allowed ||
          !access.canManage
        ) {
          return res.status(404).json({ error: "Billing period not found" });
        }

        res.json(await reconcileBillingPeriod(access.billingPeriod));
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("Currency mismatch")
        ) {
          return res.status(409).json({ error: error.message });
        }
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/billing-periods/:id/charges",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const billingPeriodId = Number(req.params.id);
        const access = Number.isInteger(billingPeriodId)
          ? await getBillingPeriodAccess(req, billingPeriodId)
          : { billingPeriod: undefined, allowed: false, canManage: false };

        if (
          !access.billingPeriod ||
          !access.allowed ||
          !access.canManage
        ) {
          return res.status(404).json({ error: "Billing period not found" });
        }

        if (access.billingPeriod.status === "VOID") {
          return res.status(409).json({ error: "Billing period is void" });
        }

        const input = manualBillingChargeSchema.parse(req.body);
        const charge = insertBillingChargeSchema.parse({
          billingPeriodId: access.billingPeriod.id,
          type: "MANUAL",
          description: input.description,
          amountMinor: input.amountMinor,
          changeRequestId: null,
          sessionId: null,
        });

        await storage.createBillingCharge(charge);
        res.status(201).json(
          await refreshBillingPeriodStatus(access.billingPeriod),
        );
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/billing-periods/:id/payments",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const billingPeriodId = Number(req.params.id);
        const access = Number.isInteger(billingPeriodId)
          ? await getBillingPeriodAccess(req, billingPeriodId)
          : { billingPeriod: undefined, allowed: false, canManage: false };

        if (
          !access.billingPeriod ||
          !access.allowed ||
          !access.canManage
        ) {
          return res.status(404).json({ error: "Billing period not found" });
        }

        if (access.billingPeriod.status === "VOID") {
          return res.status(409).json({ error: "Billing period is void" });
        }

        const input = recordManualPaymentSchema.parse(req.body);
        const current = await buildBillingPeriodDetails(
          access.billingPeriod,
        );
        if (input.amountMinor > current.outstandingMinor) {
          return res.status(409).json({
            error: "Payment exceeds the outstanding amount",
          });
        }

        const capture = await manualPaymentAdapter.capture({
          amountMinor: input.amountMinor,
          currency: access.billingPeriod.currency,
          paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
          method: input.method ?? null,
          providerReference: input.providerReference ?? null,
          note: input.note ?? null,
        });

        const payment = insertPaymentSchema.parse({
          billingPeriodId: access.billingPeriod.id,
          amountMinor: capture.amountMinor,
          currency: capture.currency,
          provider: manualPaymentAdapter.name,
          providerReference: capture.providerReference,
          method: capture.method,
          note: capture.note,
          paidAt: capture.paidAt,
          recordedByUserId: req.user!.id,
        });

        await storage.createPayment(payment);
        res.status(201).json(
          await refreshBillingPeriodStatus(access.billingPeriod),
        );
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  // ========== WEEK ROUTES ==========

  app.get("/api/weeks", authMiddleware, async (req: AuthRequest, res) => {
    try {
      let weeks: Week[];
      const requestedRoadmapId = req.query.roadmapId;

      if (requestedRoadmapId !== undefined) {
        const roadmapId = Number(requestedRoadmapId);
        if (!Number.isInteger(roadmapId) || roadmapId <= 0) {
          return res.status(400).json({ error: "roadmapId must be a positive integer" });
        }

        if (
          !(await storage.userCanAccessRoadmap(
            req.user!.id,
            req.user!.role,
            roadmapId,
          ))
        ) {
          return res.status(404).json({ error: "Roadmap not found" });
        }

        weeks = await storage.getWeeksByRoadmap(roadmapId);
      } else {
        weeks = await storage.getAccessibleWeeks(
          req.user!.id,
          req.user!.role,
        );
      }

      const currentUserId = req.user!.id;
      const isLearner = req.user!.role === "LEARNER";

      if (isLearner) {
        weeks = weeks.filter((week) => week.isValidatedByMentor);
      }

      const weeksWithDetails = await Promise.all(
        weeks.map(async (week) => {
          const objectives = await storage.getObjectivesByWeek(week.id);
          const deliverables = await storage.getDeliverablesByWeek(week.id);
          const resources = await storage.getResourcesByWeek(week.id);
          const comments = await storage.getCommentsByWeek(week.id);
          const roadmapLearnerIds = await getLearnerIdsForWeek(week);

          const objectivesWithTasks = await Promise.all(
            objectives.map(async (objective) => {
              const taskList = await storage.getTasksByObjective(objective.id);

              const tasksWithProgress = await Promise.all(
                taskList.map(async (task) => {
                  if (isLearner) {
                    const progress = await storage.getTaskProgress(
                      task.id,
                      currentUserId,
                    );
                    return { ...task, progress: progress ? [progress] : [] };
                  }

                  const allProgress = await storage.getAllTaskProgress(task.id);
                  const scopedProgress =
                    roadmapLearnerIds === null
                      ? allProgress
                      : allProgress.filter((progress) =>
                          roadmapLearnerIds.has(progress.learnerId),
                        );
                  return { ...task, progress: scopedProgress };
                }),
              );

              return { ...objective, tasks: tasksWithProgress };
            }),
          );

          const scopedComments = isLearner
            ? comments.filter((comment) => comment.learnerId === currentUserId)
            : roadmapLearnerIds === null
              ? comments
              : comments.filter((comment) =>
                  roadmapLearnerIds.has(comment.learnerId),
                );

          const commentsWithLearner = await Promise.all(
            scopedComments.map(async (comment) => {
              const learner = await storage.getUser(comment.learnerId);
              return { ...comment, learner: learner! };
            }),
          );

          return {
            ...week,
            objectives: objectivesWithTasks,
            deliverables,
            resources,
            comments: commentsWithLearner,
          };
        }),
      );

      res.json(weeksWithDetails);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/weeks/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const weekId = parseInt(req.params.id, 10);
      const { week, allowed } = await canAccessWeek(req, weekId);
      if (!week || !allowed) {
        return res.status(404).json({ error: "Week not found" });
      }

      res.json(week);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/weeks", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const roadmapId = await resolveRoadmapIdForNewWeek(
        req,
        req.body.roadmapId,
      );
      const weekData = insertWeekSchema.parse({
        ...req.body,
        roadmapId,
      });
      const week = await storage.createWeek(weekData);
      res.status(201).json(week);
    } catch (error) {
      if (error instanceof Error && error.message === "Roadmap not found") {
        return res.status(404).json({ error: error.message });
      }
      if (
        error instanceof Error &&
        (error.message.includes("roadmapId is required") ||
          error.message.includes("roadmapId must be"))
      ) {
        return res.status(400).json({ error: error.message });
      }
      handleError(res, error);
    }
  });

  app.post("/api/weeks/bulk", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const validatedData = insertRoadmapBulkSchema.parse(req.body);
      const scopedData = await Promise.all(
        validatedData.map(async (week) => ({
          ...week,
          roadmapId: await resolveRoadmapIdForNewWeek(req, week.roadmapId),
        })),
      );

      const result = await storage.createRoadmapBulk(scopedData);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({
          error: "Validation error",
          details: error.message,
        });
      }
      if (error instanceof Error && error.message === "Roadmap not found") {
        return res.status(404).json({ error: error.message });
      }
      if (
        error instanceof Error &&
        (error.message.includes("roadmapId is required") ||
          error.message.includes("roadmapId must be"))
      ) {
        return res.status(400).json({ error: error.message });
      }
      handleError(res, error);
    }
  });

  app.put("/api/weeks/:id", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const weekId = parseInt(req.params.id, 10);
      const { week: existingWeek, allowed } = await canAccessWeek(req, weekId);
      if (!existingWeek || !allowed) {
        return res.status(404).json({ error: "Week not found" });
      }

      const weekData = insertWeekSchema
        .omit({ roadmapId: true })
        .partial()
        .parse(req.body);
      const week = await storage.updateWeek(weekId, weekData);
      res.json(week);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.delete("/api/weeks/:id", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const weekId = parseInt(req.params.id, 10);
      const { week, allowed } = await canAccessWeek(req, weekId);
      if (!week || !allowed) {
        return res.status(404).json({ error: "Week not found" });
      }

      await storage.deleteWeek(weekId);
      res.status(204).send();
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/weeks/:id/validate", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const weekId = parseInt(req.params.id, 10);
      const { week: existingWeek, allowed } = await canAccessWeek(req, weekId);
      if (!existingWeek || !allowed) {
        return res.status(404).json({ error: "Week not found" });
      }

      const week = await storage.validateWeek(weekId);
      res.json(week);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/weeks/:id/clone", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const weekId = parseInt(req.params.id, 10);
      const { week: existingWeek, allowed } = await canAccessWeek(req, weekId);
      if (!existingWeek || !allowed) {
        return res.status(404).json({ error: "Week not found" });
      }

      const { newNumber } = req.body;
      if (typeof newNumber !== "number") {
        return res.status(400).json({
          error: "newNumber is required and must be a number",
        });
      }

      const clonedWeek = await storage.cloneWeek(weekId, newNumber);
      res.status(201).json(clonedWeek);
    } catch (error) {
      handleError(res, error);
    }
  });

  // ========== OBJECTIVE ROUTES ==========

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

  // ========== PROGRESS ROUTES ==========

  app.post("/api/tasks/:taskId/toggle-progress", authMiddleware, requireLearner, async (req: AuthRequest, res) => {
    try {
      const authenticatedLearnerId = req.user!.id;
      const taskId = parseInt(req.params.taskId, 10);
      const taskAccess = await getTaskAccess(req, taskId);

      if (
        !taskAccess.task ||
        !taskAccess.objective ||
        !taskAccess.week ||
        !taskAccess.allowed
      ) {
        return res.status(404).json({ error: "Task not found" });
      }

      const { screenshotUrl } = req.body;
      let normalizedScreenshotUrl = screenshotUrl;

      if (screenshotUrl) {
        const objectStorageService = new ObjectStorageService();
        normalizedScreenshotUrl =
          await objectStorageService.trySetObjectEntityAclPolicy(
            screenshotUrl,
            {
              owner: authenticatedLearnerId.toString(),
              visibility: "public",
            },
          );
      }

      const progress = await storage.toggleTaskProgress(
        taskId,
        authenticatedLearnerId,
        normalizedScreenshotUrl,
      );

      if (progress.isDone || normalizedScreenshotUrl) {
        const learner = await storage.getUser(authenticatedLearnerId);
        if (learner) {
          const mentors = await getMentorsForWeek(taskAccess.week);

          if (normalizedScreenshotUrl && progress.isDone) {
            for (const mentor of mentors) {
              await emailService
                .sendScreenshotUploaded(
                  mentor.id,
                  mentor.email,
                  mentor.fullName,
                  learner.fullName,
                  taskAccess.task.label,
                  taskAccess.week.number,
                )
                .catch((err) =>
                  console.error("Failed to send screenshot notification:", err),
                );
            }
          }

          if (progress.isDone) {
            const allObjectives = await storage.getObjectivesByWeek(
              taskAccess.week.id,
            );
            let totalTasks = 0;
            let completedTasks = 0;

            for (const objective of allObjectives) {
              const tasks = await storage.getTasksByObjective(objective.id);
              totalTasks += tasks.length;

              for (const task of tasks) {
                const learnerProgress = await storage.getTaskProgress(
                  task.id,
                  authenticatedLearnerId,
                );
                if (learnerProgress?.isDone) {
                  completedTasks++;
                }
              }
            }

            const completionPercentage =
              totalTasks > 0
                ? Math.round((completedTasks / totalTasks) * 100)
                : 0;

            for (const mentor of mentors) {
              await emailService
                .sendProgressUpdate(
                  mentor.id,
                  mentor.email,
                  mentor.fullName,
                  learner.fullName,
                  taskAccess.week.number,
                  completionPercentage,
                )
                .catch((err) =>
                  console.error("Failed to send progress update:", err),
                );
            }
          }
        }
      }

      res.json(progress);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/progress/summary", authMiddleware, async (req: AuthRequest, res) => {
    try {
      let weeks = await storage.getAccessibleWeeks(
        req.user!.id,
        req.user!.role,
      );
      let totalTasks = 0;
      let completedTasks = 0;

      if (req.user!.role === "LEARNER") {
        const authenticatedLearnerId = req.user!.id;
        weeks = weeks.filter((week) => week.isValidatedByMentor);

        for (const week of weeks) {
          const objectives = await storage.getObjectivesByWeek(week.id);
          for (const objective of objectives) {
            const tasks = await storage.getTasksByObjective(objective.id);
            totalTasks += tasks.length;

            for (const task of tasks) {
              const progress = await storage.getTaskProgress(
                task.id,
                authenticatedLearnerId,
              );
              if (progress?.isDone) {
                completedTasks++;
              }
            }
          }
        }
      } else {
        for (const week of weeks) {
          const roadmapLearnerIds = await getLearnerIdsForWeek(week);
          const objectives = await storage.getObjectivesByWeek(week.id);

          for (const objective of objectives) {
            const tasks = await storage.getTasksByObjective(objective.id);
            totalTasks += tasks.length;

            for (const task of tasks) {
              const allProgress = await storage.getAllTaskProgress(task.id);
              const scopedProgress =
                roadmapLearnerIds === null
                  ? allProgress
                  : allProgress.filter((progress) =>
                      roadmapLearnerIds.has(progress.learnerId),
                    );

              if (scopedProgress.some((progress) => progress.isDone)) {
                completedTasks++;
              }
            }
          }
        }
      }

      const globalPercentage =
        totalTasks > 0
          ? Math.round((completedTasks / totalTasks) * 100)
          : 0;

      res.json({
        globalPercentage,
        totalCompleted: completedTasks,
        totalTasks,
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ========== COMMENT ROUTES ==========

  app.post("/api/weeks/:weekId/comments", authMiddleware, requireLearner, async (req: AuthRequest, res) => {
    try {
      const weekId = parseInt(req.params.weekId, 10);
      const weekAccess = await canAccessWeek(req, weekId);
      if (!weekAccess.week || !weekAccess.allowed) {
        return res.status(404).json({ error: "Week not found" });
      }

      const commentData = insertWeekCommentSchema.parse({
        ...req.body,
        weekId,
        learnerId: req.user!.id,
      });
      const comment = await storage.createComment(commentData);
      const learner = await storage.getUser(comment.learnerId);

      if (learner) {
        const mentors = await getMentorsForWeek(weekAccess.week);
        for (const mentor of mentors) {
          await emailService.sendCommentNotification(
            mentor.id,
            mentor.email,
            mentor.fullName,
            learner.fullName,
            weekAccess.week.number,
            comment.content,
          );
        }
      }

      res.status(201).json(comment);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/weeks/:weekId/comments", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const weekId = parseInt(req.params.weekId, 10);
      const weekAccess = await canAccessWeek(req, weekId);
      if (!weekAccess.week || !weekAccess.allowed) {
        return res.status(404).json({ error: "Week not found" });
      }

      const comments = await storage.getCommentsByWeek(weekId);
      if (req.user!.role === "LEARNER") {
        return res.json(
          comments.filter((comment) => comment.learnerId === req.user!.id),
        );
      }

      const roadmapLearnerIds = await getLearnerIdsForWeek(weekAccess.week);
      res.json(
        roadmapLearnerIds === null
          ? comments
          : comments.filter((comment) =>
              roadmapLearnerIds.has(comment.learnerId),
            ),
      );
    } catch (error) {
      handleError(res, error);
    }
  });

  // ========== EMAIL NOTIFICATION ROUTES ==========
  
  app.post("/api/test/email-notifications", authMiddleware, requireMentor, async (req, res) => {
    try {
      const { testEmailNotifications } = await import("./jobs/emailNotifications");
      await testEmailNotifications();
      res.json({ message: "Email notifications test completed. Check server logs for details." });
    } catch (error) {
      handleError(res, error);
    }
  });

  // Route pour envoyer manuellement les rappels de tâches
  app.post("/api/jobs/send-task-reminders", authMiddleware, requireMentor, async (_req, res) => {
    try {
      const { emailService } = await import("./services/emailService");
      const learners = await emailService.getAllLearners();

      let sentCount = 0;
      let skippedCount = 0;

      for (const learner of learners) {
        const learnerWeeks = (
          await storage.getAccessibleWeeks(learner.id, "LEARNER")
        ).filter((week) => week.isValidatedByMentor);

        for (const week of learnerWeeks) {
          const objectives = await storage.getObjectivesByWeek(week.id);
          let pendingTasksCount = 0;

          for (const objective of objectives) {
            const tasks = await storage.getTasksByObjective(objective.id);
            for (const task of tasks) {
              const progress = await storage.getTaskProgress(task.id, learner.id);
              if (!progress || !progress.isDone) {
                pendingTasksCount++;
              }
            }
          }

          if (pendingTasksCount > 0) {
            const sent = await emailService.sendTaskReminder(
              learner.id,
              learner.email,
              learner.fullName,
              week.number,
              pendingTasksCount,
            );

            if (sent) {
              sentCount++;
            } else {
              skippedCount++;
            }
          }
        }
      }

      res.json({
        message: "Task reminders sent successfully.",
        sent: sentCount,
        skipped: skippedCount,
        learners: learners.length,
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/email-preferences", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      let preferences = await storage.getEmailPreferences(userId);
      
      if (!preferences) {
        // Create default preferences if they don't exist (all enabled by default)
        preferences = await storage.createEmailPreferences({
          userId,
          // Existing preferences
          taskReminders: true,
          weekPreparation: true,
          progressUpdates: true,
          commentNotifications: true,
          // AI/System notifications
          aiGenerationNotifications: true,
          weekValidationNotifications: true,
          // Collaboration notifications
          newTaskNotifications: true,
          screenshotNotifications: true,
          weekModifiedNotifications: true,
          // Intelligent reminders
          deadlineReminders: true,
          streakWarnings: true,
          // Gamification
          milestoneNotifications: true,
          badgeNotifications: true,
          weeklyReports: true,
        });
      }
      
      res.json(preferences);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.put("/api/email-preferences", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const parsed = updateEmailNotificationPreferencesSchema.safeParse(req.body);

      if (!parsed.success || Object.keys(parsed.data).length === 0) {
        return res.status(400).json({
          error: "Invalid email preference update",
          details: parsed.success ? undefined : parsed.error.flatten(),
        });
      }

      const preferences = await storage.updateEmailPreferences(userId, parsed.data);
      res.json(preferences);
    } catch (error) {
      handleError(res, error);
    }
  });

  // ========== AI ROADMAP GENERATION ==========

  app.post("/api/ai/generate-roadmap", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const userEmail = req.user!.email;
    const userName = req.user!.fullName;
    
    try {
      const { generateRoadmap } = await import("./services/aiRoadmapGenerator");
      const { topic, numberOfWeeks, skillLevel, additionalContext } = req.body;

      if (!topic || !numberOfWeeks) {
        return res.status(400).json({ error: "topic and numberOfWeeks are required" });
      }

      if (numberOfWeeks < 1 || numberOfWeeks > 12) {
        return res.status(400).json({ error: "numberOfWeeks must be between 1 and 12" });
      }

      const generatedWeeks = await generateRoadmap({
        topic,
        numberOfWeeks,
        skillLevel: skillLevel || "intermédiaire",
        additionalContext,
      });

      // Envoyer notification de succès de génération IA
      emailService.sendAIGenerationSuccess(userId, userEmail, userName, numberOfWeeks)
        .catch(err => console.error("Failed to send AI generation success email:", err));

      res.json({ weeks: generatedWeeks });
    } catch (error) {
      // Envoyer notification d'échec de génération IA
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue lors de la génération";
      emailService.sendAIGenerationFailure(userId, userEmail, userName, errorMessage)
        .catch(err => console.error("Failed to send AI generation failure email:", err));
      
      handleError(res, error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
