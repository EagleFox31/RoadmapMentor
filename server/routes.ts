import type { Express } from "express";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import { emailService } from "./services/emailService";
import { authMiddleware, requireMentor, requireLearner, generateToken, hashPassword, comparePassword, type AuthRequest } from "./auth";
import { insertUserSchema, insertWeekSchema, insertObjectiveSchema, insertTaskSchema, insertDeliverableSchema, insertResourceSchema, insertWeekCommentSchema, insertRoadmapBulkSchema } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

export async function registerRoutes(app: Express): Promise<Server> {
  // Helper to send errors
  const handleError = (res: any, error: any) => {
    console.error("API Error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  };

  // ========== AUTH ROUTES ==========

  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const { fullName, email, password, role } = userData;
      
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
        role: role || "LEARNER",
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

  // Development: Create test users
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

  // ========== OBJECT STORAGE ROUTES ==========
  // Referenced from blueprint:javascript_object_storage

  // Get presigned upload URL for screenshots
  app.post("/api/objects/upload", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      handleError(res, error);
    }
  });

  // Serve uploaded screenshots (public and private)
  app.get("/objects/:objectPath(*)", async (req, res) => {
    // Try to get user ID from token if provided, but don't require it
    const authHeader = req.headers.authorization;
    let userId: string | null = null;
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
        userId = decoded.userId.toString();
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

  // ========== WEEK ROUTES ==========

  app.get("/api/weeks", authMiddleware, async (req: AuthRequest, res) => {
    try {
      let weeks = await storage.getAllWeeks();
      
      // SECURITY: Progress is ONLY returned for the authenticated learner (req.user.id)
      // Mentors receive no progress data. Learners only see their own progress.
      const currentUserId = req.user!.id;
      const isLearner = req.user?.role === "LEARNER";
      
      // BUSINESS RULE: Learners can only see validated weeks
      if (isLearner) {
        console.log(`[LEARNER VIEW] Total weeks: ${weeks.length}, Validated weeks:`, weeks.filter(w => w.isValidatedByMentor).map(w => ({id: w.id, number: w.number, isValidatedByMentor: w.isValidatedByMentor})));
        weeks = weeks.filter(week => week.isValidatedByMentor);
      }
      
      // Get all nested data for each week
      const weeksWithDetails = await Promise.all(
        weeks.map(async (week) => {
          const objectives = await storage.getObjectivesByWeek(week.id);
          const deliverables = await storage.getDeliverablesByWeek(week.id);
          const resources = await storage.getResourcesByWeek(week.id);
          const comments = await storage.getCommentsByWeek(week.id);

          // Get tasks for each objective with progress
          const objectivesWithTasks = await Promise.all(
            objectives.map(async (objective) => {
              const taskList = await storage.getTasksByObjective(objective.id);
              
              // SECURITY: Learners see only their own progress, Mentors see all learners' progress
              // Storage.getTaskProgress filters by BOTH taskId AND learnerId
              const tasksWithProgress = await Promise.all(
                taskList.map(async (task) => {
                  if (isLearner) {
                    // CRITICAL: Use req.user.id (from JWT) - never from request body
                    const progress = await storage.getTaskProgress(task.id, currentUserId);
                    return { ...task, progress: progress ? [progress] : [] };
                  } else {
                    // Mentors see progress from ALL learners
                    const allProgress = await storage.getAllTaskProgress(task.id);
                    return { ...task, progress: allProgress };
                  }
                })
              );

              return { ...objective, tasks: tasksWithProgress };
            })
          );

          // Get learner info for comments
          const commentsWithLearner = await Promise.all(
            comments.map(async (comment) => {
              const learner = await storage.getUser(comment.learnerId);
              return { ...comment, learner: learner! };
            })
          );

          return {
            ...week,
            objectives: objectivesWithTasks,
            deliverables,
            resources,
            comments: commentsWithLearner,
          };
        })
      );

      res.json(weeksWithDetails);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/weeks/:id", authMiddleware, async (req, res) => {
    try {
      const week = await storage.getWeek(parseInt(req.params.id));
      if (!week) {
        return res.status(404).json({ error: "Week not found" });
      }
      res.json(week);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/weeks", authMiddleware, requireMentor, async (req, res) => {
    try {
      const weekData = insertWeekSchema.parse(req.body);
      const week = await storage.createWeek(weekData);
      res.status(201).json(week);
    } catch (error) {
      handleError(res, error);
    }
  });

  // Bulk roadmap creation endpoint (transactional)
  app.post("/api/weeks/bulk", authMiddleware, requireMentor, async (req, res) => {
    try {
      // Validate the entire roadmap data with nested validation
      const validatedData = insertRoadmapBulkSchema.parse(req.body);
      
      // Create all weeks, objectives, tasks, deliverables, and resources in a single transaction
      const result = await storage.createRoadmapBulk(validatedData);
      
      res.status(201).json(result);
    } catch (error) {
      // Return detailed error for validation failures
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ 
          error: "Validation error", 
          details: error.message 
        });
      }
      handleError(res, error);
    }
  });

  app.put("/api/weeks/:id", authMiddleware, requireMentor, async (req, res) => {
    try {
      const weekData = insertWeekSchema.partial().parse(req.body);
      const week = await storage.updateWeek(parseInt(req.params.id), weekData);
      if (!week) {
        return res.status(404).json({ error: "Week not found" });
      }
      res.json(week);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.delete("/api/weeks/:id", authMiddleware, requireMentor, async (req, res) => {
    try {
      await storage.deleteWeek(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/weeks/:id/validate", authMiddleware, requireMentor, async (req, res) => {
    try {
      const week = await storage.validateWeek(parseInt(req.params.id));
      if (!week) {
        return res.status(404).json({ error: "Week not found" });
      }
      res.json(week);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/weeks/:id/clone", authMiddleware, requireMentor, async (req, res) => {
    try {
      const { newNumber } = req.body;
      if (typeof newNumber !== "number") {
        return res.status(400).json({ error: "newNumber is required and must be a number" });
      }
      const clonedWeek = await storage.cloneWeek(parseInt(req.params.id), newNumber);
      if (!clonedWeek) {
        return res.status(404).json({ error: "Week not found" });
      }
      // Invalidate cache and return with full details
      const weeks = await storage.getAllWeeks();
      res.status(201).json(clonedWeek);
    } catch (error) {
      handleError(res, error);
    }
  });

  // ========== OBJECTIVE ROUTES ==========

  app.post("/api/weeks/:weekId/objectives", authMiddleware, requireMentor, async (req, res) => {
    try {
      const objectiveData = insertObjectiveSchema.parse({
        ...req.body,
        weekId: parseInt(req.params.weekId),
      });
      const objective = await storage.createObjective(objectiveData);
      res.status(201).json(objective);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.put("/api/objectives/:id", authMiddleware, requireMentor, async (req, res) => {
    try {
      const objectiveData = insertObjectiveSchema.partial().parse(req.body);
      const objective = await storage.updateObjective(parseInt(req.params.id), objectiveData);
      if (!objective) {
        return res.status(404).json({ error: "Objective not found" });
      }
      res.json(objective);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.delete("/api/objectives/:id", authMiddleware, requireMentor, async (req, res) => {
    try {
      await storage.deleteObjective(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/objectives/:id/clone", authMiddleware, requireMentor, async (req, res) => {
    try {
      const { targetWeekId } = req.body;
      const clonedObjective = await storage.cloneObjective(
        parseInt(req.params.id), 
        targetWeekId ? parseInt(targetWeekId) : undefined
      );
      if (!clonedObjective) {
        return res.status(404).json({ error: "Objective not found" });
      }
      res.status(201).json(clonedObjective);
    } catch (error) {
      handleError(res, error);
    }
  });

  // ========== TASK ROUTES ==========

  app.post("/api/objectives/:objectiveId/tasks", authMiddleware, requireMentor, async (req, res) => {
    try {
      const taskData = insertTaskSchema.parse({
        ...req.body,
        objectiveId: parseInt(req.params.objectiveId),
      });
      const task = await storage.createTask(taskData);
      res.status(201).json(task);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.put("/api/tasks/:id", authMiddleware, requireMentor, async (req, res) => {
    try {
      const taskData = insertTaskSchema.partial().parse(req.body);
      const task = await storage.updateTask(parseInt(req.params.id), taskData);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.delete("/api/tasks/:id", authMiddleware, requireMentor, async (req, res) => {
    try {
      await storage.deleteTask(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      handleError(res, error);
    }
  });

  // ========== DELIVERABLE ROUTES ==========

  app.post("/api/weeks/:weekId/deliverables", authMiddleware, requireMentor, async (req, res) => {
    try {
      const deliverableData = insertDeliverableSchema.parse({
        ...req.body,
        weekId: parseInt(req.params.weekId),
      });
      const deliverable = await storage.createDeliverable(deliverableData);
      res.status(201).json(deliverable);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.put("/api/deliverables/:id", authMiddleware, requireMentor, async (req, res) => {
    try {
      const deliverableData = insertDeliverableSchema.partial().parse(req.body);
      const deliverable = await storage.updateDeliverable(parseInt(req.params.id), deliverableData);
      if (!deliverable) {
        return res.status(404).json({ error: "Deliverable not found" });
      }
      res.json(deliverable);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.delete("/api/deliverables/:id", authMiddleware, requireMentor, async (req, res) => {
    try {
      await storage.deleteDeliverable(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      handleError(res, error);
    }
  });

  // ========== RESOURCE ROUTES ==========

  app.post("/api/weeks/:weekId/resources", authMiddleware, requireMentor, async (req, res) => {
    try {
      const resourceData = insertResourceSchema.parse({
        ...req.body,
        weekId: parseInt(req.params.weekId),
      });
      const resource = await storage.createResource(resourceData);
      res.status(201).json(resource);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.put("/api/resources/:id", authMiddleware, requireMentor, async (req, res) => {
    try {
      const resourceData = insertResourceSchema.partial().parse(req.body);
      const resource = await storage.updateResource(parseInt(req.params.id), resourceData);
      if (!resource) {
        return res.status(404).json({ error: "Resource not found" });
      }
      res.json(resource);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.delete("/api/resources/:id", authMiddleware, requireMentor, async (req, res) => {
    try {
      await storage.deleteResource(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      handleError(res, error);
    }
  });

  // ========== PROGRESS ROUTES ==========

  app.post("/api/tasks/:taskId/toggle-progress", authMiddleware, requireLearner, async (req: AuthRequest, res) => {
    try {
      // SECURITY CRITICAL: Always use learnerId from JWT token (req.user.id)
      // NEVER accept learnerId from request body - prevents privilege escalation
      const authenticatedLearnerId = req.user!.id;
      const taskId = parseInt(req.params.taskId);
      const { screenshotUrl } = req.body;
      
      // Verify task exists before toggling
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      // If screenshot URL is provided, set ACL policy
      let normalizedScreenshotUrl = screenshotUrl;
      if (screenshotUrl) {
        const objectStorageService = new ObjectStorageService();
        normalizedScreenshotUrl = await objectStorageService.trySetObjectEntityAclPolicy(
          screenshotUrl,
          {
            owner: authenticatedLearnerId.toString(),
            visibility: "public",
          }
        );
      }
      
      // Storage.toggleTaskProgress will create/update progress ONLY for the authenticated learner
      const progress = await storage.toggleTaskProgress(taskId, authenticatedLearnerId, normalizedScreenshotUrl);
      
      // Email notifications
      if (progress.isDone || normalizedScreenshotUrl) {
        // Import email service
        const { emailService } = await import("./services/emailService");
        
        // Get objective to find week
        const objective = await storage.getObjective(task.objectiveId);
        if (objective) {
          const week = await storage.getWeek(objective.weekId);
          const learner = await storage.getUser(authenticatedLearnerId);
          
          if (week && learner) {
            const mentors = await emailService.getAllMentors();
            
            // Notification de screenshot uploadé (si screenshot fourni)
            if (normalizedScreenshotUrl && progress.isDone) {
              for (const mentor of mentors) {
                await emailService.sendScreenshotUploaded(
                  mentor.id,
                  mentor.email,
                  mentor.fullName,
                  learner.fullName,
                  task.title,
                  week.number
                ).catch(err => console.error("Failed to send screenshot notification:", err));
              }
            }
            
            // Notification de progression (si tâche complétée)
            if (progress.isDone) {
              // Calculate completion percentage for this week
              const allObjectives = await storage.getObjectivesByWeek(week.id);
              let totalTasks = 0;
              let completedTasks = 0;
              
              for (const obj of allObjectives) {
                const tasks = await storage.getTasksByObjective(obj.id);
                totalTasks += tasks.length;
                for (const t of tasks) {
                  const prog = await storage.getTaskProgress(t.id, authenticatedLearnerId);
                  if (prog?.isDone) completedTasks++;
                }
              }
              
              const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
              
              // Notify all mentors of progress update
              for (const mentor of mentors) {
                await emailService.sendProgressUpdate(
                  mentor.id,
                  mentor.email,
                  mentor.fullName,
                  learner.fullName,
                  week.number,
                  completionPercentage
                ).catch(err => console.error("Failed to send progress update:", err));
              }
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
      let weeks = await storage.getAllWeeks();
      let totalTasks = 0;
      let completedTasks = 0;

      if (req.user?.role === "LEARNER") {
        // For learners: scope progress to the authenticated learner only AND only validated weeks
        const authenticatedLearnerId = req.user.id;
        
        // BUSINESS RULE: Learners can only see validated weeks
        weeks = weeks.filter(week => week.isValidatedByMentor);

        for (const week of weeks) {
          const objectives = await storage.getObjectivesByWeek(week.id);
          for (const objective of objectives) {
            const tasks = await storage.getTasksByObjective(objective.id);
            totalTasks += tasks.length;

            for (const task of tasks) {
              const progress = await storage.getTaskProgress(task.id, authenticatedLearnerId);
              if (progress?.isDone) {
                completedTasks++;
              }
            }
          }
        }
      } else {
        // For mentors: count tasks completed by ANY learner
        for (const week of weeks) {
          const objectives = await storage.getObjectivesByWeek(week.id);
          for (const objective of objectives) {
            const tasks = await storage.getTasksByObjective(objective.id);
            totalTasks += tasks.length;

            for (const task of tasks) {
              const allProgress = await storage.getAllTaskProgress(task.id);
              if (allProgress.some(p => p.isDone)) {
                completedTasks++;
              }
            }
          }
        }
      }

      const globalPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

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
      const commentData = insertWeekCommentSchema.parse({
        ...req.body,
        weekId: parseInt(req.params.weekId),
        learnerId: req.user!.id,
      });
      const comment = await storage.createComment(commentData);
      
      // Email notification: notify mentors when learner comments
      const { emailService } = await import("./services/emailService");
      const week = await storage.getWeek(comment.weekId);
      const learner = await storage.getUser(comment.learnerId);
      
      if (week && learner) {
        const mentors = await emailService.getAllMentors();
        for (const mentor of mentors) {
          await emailService.sendCommentNotification(
            mentor.id,
            mentor.email,
            mentor.fullName,
            learner.fullName,
            week.number,
            comment.content
          );
        }
      }
      
      res.status(201).json(comment);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/weeks/:weekId/comments", authMiddleware, async (req, res) => {
    try {
      const comments = await storage.getCommentsByWeek(parseInt(req.params.weekId));
      res.json(comments);
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
  app.post("/api/jobs/send-task-reminders", authMiddleware, requireMentor, async (req, res) => {
    try {
      const { emailService } = await import("./services/emailService");
      const learners = await emailService.getAllLearners();
      const weeks = await storage.getAllWeeks();
      
      let sentCount = 0;
      let skippedCount = 0;

      for (const learner of learners) {
        // Calculer les tâches en attente pour chaque semaine
        for (const week of weeks) {
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

          // Envoyer le rappel si des tâches sont en attente
          if (pendingTasksCount > 0) {
            const sent = await emailService.sendTaskReminder(
              learner.id,
              learner.email,
              learner.fullName,
              week.number,
              pendingTasksCount
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
        message: `Task reminders sent successfully.`,
        sent: sentCount,
        skipped: skippedCount,
        learners: learners.length
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
      const { 
        // Existing preferences
        taskReminders, 
        weekPreparation, 
        progressUpdates, 
        commentNotifications,
        // AI/System notifications
        aiGenerationNotifications,
        weekValidationNotifications,
        // Collaboration notifications
        newTaskNotifications,
        screenshotNotifications,
        weekModifiedNotifications,
        // Intelligent reminders
        deadlineReminders,
        streakWarnings,
        // Gamification
        milestoneNotifications,
        badgeNotifications,
        weeklyReports
      } = req.body;
      
      const preferences = await storage.updateEmailPreferences(userId, {
        taskReminders,
        weekPreparation,
        progressUpdates,
        commentNotifications,
        aiGenerationNotifications,
        weekValidationNotifications,
        newTaskNotifications,
        screenshotNotifications,
        weekModifiedNotifications,
        deadlineReminders,
        streakWarnings,
        milestoneNotifications,
        badgeNotifications,
        weeklyReports,
      });
      
      res.json(preferences);
    } catch (error) {
      handleError(res, error);
    }
  });

  // ========== AI ROADMAP GENERATION ==========

  app.post("/api/ai/generate-roadmap", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const userEmail = req.user!.email;
    const userName = req.user!.username;
    
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
