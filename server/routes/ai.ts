import { type Express } from "express";
import { emailService } from "../services/emailService";
import { authMiddleware, requireMentor, type AuthRequest } from "../auth";
import { handleError } from "../http/errors";
import type { RouteDeps } from "./deps";

export function registerAiGenerationRoutes(app: Express, { limiters }: RouteDeps) {
  app.post("/api/ai/generate-roadmap", authMiddleware, requireMentor, limiters.ai, async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const userEmail = req.user!.email;
    const userName = req.user!.fullName;
    
    try {
      const { topic, numberOfWeeks, skillLevel, additionalContext, startWeekNumber, baseDate } = req.body;

      if (!topic || !numberOfWeeks) {
        return res.status(400).json({ error: "topic and numberOfWeeks are required" });
      }

      if (
        typeof topic !== "string" || topic.length > 200 ||
        (additionalContext !== undefined && (typeof additionalContext !== "string" || additionalContext.length > 2000))
      ) {
        return res.status(400).json({ error: "topic (200 characters max) and additionalContext (2000 characters max) must be text" });
      }

      if (!Number.isInteger(numberOfWeeks) || numberOfWeeks < 1 || numberOfWeeks > 12) {
        return res.status(400).json({ error: "numberOfWeeks must be between 1 and 12" });
      }

      const { generateRoadmap } = await import("../services/aiRoadmapGenerator");

      const generatedWeeks = await generateRoadmap({
        topic,
        numberOfWeeks,
        skillLevel: skillLevel || "intermédiaire",
        additionalContext,
        startWeekNumber: startWeekNumber ? parseInt(startWeekNumber, 10) || undefined : undefined,
        baseDate,
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
}
