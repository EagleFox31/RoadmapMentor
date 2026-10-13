import { type Express } from "express";
import { storage } from "../storage";
import { authMiddleware, generateToken, hashPassword, comparePassword, type AuthRequest } from "../auth";
import {
  publicRegistrationSchema,
  sendRegistrationOtpSchema,
  verifyRegistrationOtpSchema,
  sendLoginOtpSchema,
  verifyLoginOtpSchema,
  updateProfileSchema,
} from "@shared/schema";
import { isDevelopmentEnvironment, isDirectRegistrationEnabled } from "../security";
import { handleError } from "../http/errors";
import { userError } from "../http/errorCatalog";
import { otpService } from "../services/otpService";
import type { RouteDeps } from "./deps";

export function registerAuthRoutes(app: Express, { limiters }: RouteDeps) {
  app.post("/api/auth/register", limiters.auth, async (req, res) => {
    try {
      if (!isDirectRegistrationEnabled()) {
        return res.status(403).json({
          error: "L'inscription requiert la vérification de votre adresse e-mail par code.",
          code: "DIRECT_REGISTRATION_DISABLED",
        });
      }

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
        return res.status(400).json(userError("AUTH_USER_EXISTS", "Cette adresse e-mail est déjà associée à un compte. Connectez-vous."));
      }

      const hashedPassword = await hashPassword(data.password);
      const payload = JSON.stringify({
        fullName: data.fullName,
        passwordHash: hashedPassword,
      });

      const result = await otpService.sendOtp(data.email, "REGISTRATION", payload, data.fullName);
      if (!result.success) {
        return res.status(result.failure === "DELIVERY_FAILED" ? 503 : 429).json(userError(result.failure === "DELIVERY_FAILED" ? "OTP_DELIVERY_FAILED" : "OTP_RATE_LIMITED", result.message ?? "Envoi du code impossible."));
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
        return res.status(400).json(userError("OTP_INVALID", check.error ?? "Code invalide."));
      }

      if (!check.payload) {
        return res.status(400).json(userError("OTP_REGISTRATION_EXPIRED", "Données d'inscription expirées. Veuillez recommencer."));
      }

      const { fullName, passwordHash } = JSON.parse(check.payload);

      // Vérification finale d'unicité
      const existing = await storage.getUserByEmail(data.email);
      if (existing) {
        return res.status(400).json(userError("AUTH_USER_EXISTS", "Cette adresse e-mail est déjà associée à un compte. Connectez-vous."));
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
      // Same answer whether or not an active account exists: this route must not reveal registered emails.
      const message = "Si un compte actif correspond à cette adresse, un code à 6 chiffres vient de vous être envoyé.";
      const user = await storage.getUserByEmail(data.email);
      if (!user || user.disabledAt) {
        return res.json({ message });
      }

      const result = await otpService.sendOtp(data.email, "LOGIN", undefined, user.fullName);
      if (!result.success) {
        return res.status(result.failure === "DELIVERY_FAILED" ? 503 : 429).json(userError(result.failure === "DELIVERY_FAILED" ? "OTP_DELIVERY_FAILED" : "OTP_RATE_LIMITED", result.message ?? "Envoi du code impossible."));
      }

      res.json({ message });
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
        return res.status(400).json(userError("OTP_INVALID", check.error ?? "Code invalide."));
      }

      const user = await storage.getUserByEmail(data.email);
      if (!user || user.disabledAt) {
        return res.status(401).json(userError("AUTH_ACCOUNT_UNAVAILABLE", "Compte introuvable ou désactivé."));
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

  // Rate-limited like login: the current-password check must not become a brute-force oracle.
  app.put("/api/auth/profile", limiters.auth, authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const { fullName, currentPassword, newPassword } = updateProfileSchema.parse(req.body);

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json(userError("USER_NOT_FOUND", "Utilisateur non trouvé."));
      }

      const updates: Partial<{ fullName: string; password: string }> = {};

      if (fullName) {
        updates.fullName = fullName;
      }

      if (newPassword) {
        const isValid = await comparePassword(currentPassword!, user.password);
        if (!isValid) {
          return res.status(400).json(userError("AUTH_WRONG_PASSWORD", "Mot de passe actuel incorrect."));
        }
        updates.password = await hashPassword(newPassword);
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json(userError("PROFILE_NO_CHANGE", "Aucune modification fournie."));
      }

      const updated = await storage.updateUser(userId, updates);
      const { password: _, ...userWithoutPassword } = updated;
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
