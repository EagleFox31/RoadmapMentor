import { type Express } from "express";
import { storage } from "../storage";
import { authMiddleware, generateToken, hashPassword, comparePassword, type AuthRequest } from "../auth";
import {
  publicRegistrationSchema,
  sendRegistrationOtpSchema,
  verifyRegistrationOtpSchema,
  sendLoginOtpSchema,
  verifyLoginOtpSchema,
} from "@shared/schema";
import { isDevelopmentEnvironment } from "../security";
import { handleError } from "../http/errors";
import { otpService } from "../services/otpService";
import type { RouteDeps } from "./deps";

export function registerAuthRoutes(app: Express, { limiters }: RouteDeps) {
  app.post("/api/auth/register", limiters.auth, async (req, res) => {
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

  app.post("/api/auth/login", limiters.auth, async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValid = await comparePassword(password, user.password);
      if (!isValid || user.disabledAt) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = generateToken(user);
      const { password: _, ...userWithoutPassword } = user;

      res.json({ token, user: userWithoutPassword });
    } catch (error) {
      handleError(res, error);
    }
  });

  // Demande d'OTP pour inscription
  app.post("/api/auth/otp/send-registration", limiters.auth, async (req, res) => {
    try {
      const data = sendRegistrationOtpSchema.parse(req.body);
      const existing = await storage.getUserByEmail(data.email);
      if (existing) {
        return res.status(400).json({ error: "Cette adresse email est déjà associée à un compte." });
      }

      const hashedPassword = await hashPassword(data.password);
      const payload = JSON.stringify({
        fullName: data.fullName,
        passwordHash: hashedPassword,
      });

      const result = await otpService.sendOtp(data.email, "REGISTRATION", payload, data.fullName);
      if (!result.success) {
        return res.status(429).json({ error: result.message });
      }

      res.json({ message: result.message });
    } catch (error) {
      handleError(res, error);
    }
  });

  // Validation d'OTP et création du compte apprenant
  app.post("/api/auth/otp/verify-registration", limiters.auth, async (req, res) => {
    try {
      const data = verifyRegistrationOtpSchema.parse(req.body);
      const check = await otpService.verifyOtp(data.email, data.code, "REGISTRATION");
      if (!check.valid) {
        return res.status(400).json({ error: check.error });
      }

      if (!check.payload) {
        return res.status(400).json({ error: "Données d'inscription expirées. Veuillez recommencer." });
      }

      const { fullName, passwordHash } = JSON.parse(check.payload);

      // Vérification finale d'unicité
      const existing = await storage.getUserByEmail(data.email);
      if (existing) {
        return res.status(400).json({ error: "Cette adresse email est déjà associée à un compte." });
      }

      const user = await storage.createUser({
        fullName,
        email: data.email,
        password: passwordHash,
        role: "LEARNER",
      });

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

  // Demande d'OTP pour connexion sans mot de passe
  app.post("/api/auth/otp/send-login", limiters.auth, async (req, res) => {
    try {
      const data = sendLoginOtpSchema.parse(req.body);
      const user = await storage.getUserByEmail(data.email);
      if (!user || user.disabledAt) {
        return res.status(404).json({ error: "Aucun compte actif trouvé avec cette adresse email." });
      }

      const result = await otpService.sendOtp(data.email, "LOGIN", undefined, user.fullName);
      if (!result.success) {
        return res.status(429).json({ error: result.message });
      }

      res.json({ message: result.message });
    } catch (error) {
      handleError(res, error);
    }
  });

  // Validation d'OTP et connexion
  app.post("/api/auth/otp/verify-login", limiters.auth, async (req, res) => {
    try {
      const data = verifyLoginOtpSchema.parse(req.body);
      const check = await otpService.verifyOtp(data.email, data.code, "LOGIN");
      if (!check.valid) {
        return res.status(400).json({ error: check.error });
      }

      const user = await storage.getUserByEmail(data.email);
      if (!user || user.disabledAt) {
        return res.status(401).json({ error: "Compte introuvable ou désactivé." });
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
}
