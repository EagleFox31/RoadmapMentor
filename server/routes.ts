import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authMiddleware, requireMentor, requireLearner, generateToken, hashPassword, comparePassword, type AuthRequest } from "./auth";
import { insertUserSchema, insertWeekSchema, insertObjectiveSchema, insertTaskSchema, insertDeliverableSchema, insertResourceSchema, insertWeekCommentSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Helper to send errors
  const handleError = (res: any, error: any) => {
    console.error("API Error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  };

  // ========== AUTH ROUTES ==========

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { fullName, email, password, role } = insertUserSchema.parse(req.body);
      
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

  // ========== WEEK ROUTES ==========

  app.get("/api/weeks", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const weeks = await storage.getAllWeeks();
      
      // SECURITY: Progress is ONLY returned for the authenticated learner (req.user.id)
      // Mentors receive no progress data. Learners only see their own progress.
      const currentUserId = req.user!.id;
      const isLearner = req.user?.role === "LEARNER";
      
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
              
              // SECURITY: Only return progress for the CURRENT authenticated learner
              // Storage.getTaskProgress filters by BOTH taskId AND learnerId
              const tasksWithProgress = await Promise.all(
                taskList.map(async (task) => {
                  if (isLearner) {
                    // CRITICAL: Use req.user.id (from JWT) - never from request body
                    const progress = await storage.getTaskProgress(task.id, currentUserId);
                    return { ...task, progress: progress ? [progress] : [] };
                  }
                  // Mentors see no progress data
                  return { ...task, progress: [] };
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
      
      // Verify task exists before toggling
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      // Storage.toggleTaskProgress will create/update progress ONLY for the authenticated learner
      const progress = await storage.toggleTaskProgress(taskId, authenticatedLearnerId);
      res.json(progress);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/progress/summary", authMiddleware, async (req: AuthRequest, res) => {
    try {
      // SECURITY: Only learners can see progress summaries
      if (req.user?.role !== "LEARNER") {
        return res.json({ globalPercentage: 0, totalCompleted: 0, totalTasks: 0 });
      }

      // SECURITY: Always scope progress to the authenticated learner
      const authenticatedLearnerId = req.user.id;
      const weeks = await storage.getAllWeeks();
      let totalTasks = 0;
      let completedTasks = 0;

      for (const week of weeks) {
        const objectives = await storage.getObjectivesByWeek(week.id);
        for (const objective of objectives) {
          const tasks = await storage.getTasksByObjective(objective.id);
          totalTasks += tasks.length;

          for (const task of tasks) {
            // CRITICAL: Only fetch progress for the authenticated learner
            const progress = await storage.getTaskProgress(task.id, authenticatedLearnerId);
            if (progress?.isDone) {
              completedTasks++;
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

  const httpServer = createServer(app);
  return httpServer;
}
