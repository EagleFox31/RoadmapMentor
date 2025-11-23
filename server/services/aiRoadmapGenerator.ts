import OpenAI from "openai";
import pRetry, { AbortError } from "p-retry";
import { z } from "zod";

// Check if user provided their own OpenAI API key
// If OPENAI_API_KEY exists, use it directly (user's own key)
// Otherwise, use Replit AI Integrations (billed to Replit credits)
const useOwnApiKey = !!process.env.OPENAI_API_KEY;

console.log("[AI Service] OpenAI configuration:", {
  useOwnApiKey,
  hasOwnKey: !!process.env.OPENAI_API_KEY,
  hasReplitKey: !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  hasReplitBaseURL: !!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const openai = new OpenAI({
  baseURL: useOwnApiKey ? "https://api.openai.com/v1" : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: useOwnApiKey ? process.env.OPENAI_API_KEY : process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

// Helper function to check if error is rate limit or quota violation
function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

// Zod schemas for AI response validation with normalization
const taskSchema = z.object({
  label: z.string().trim().min(1, "Task label cannot be empty"),
  isOptional: z.boolean().default(false),
});

const objectiveSchema = z.object({
  type: z.enum(["CONCEPT", "ALGO", "PROJECT", "OTHER"]),
  title: z.string().trim().min(1, "Objective title cannot be empty"),
  description: z.string().trim().default(""),
  tasks: z.array(taskSchema).min(1, "At least one task required"),
});

const deliverableSchema = z.object({
  title: z.string().trim().default(""),
  description: z.string().trim().default(""),
  instructions: z.string().trim().default(""),
});

const resourceSchema = z.object({
  label: z.string().trim().default(""),
  url: z.string().trim().default("").refine((url) => {
    if (!url) return true; // Empty URLs will be filtered out later
    try {
      new URL(url);
      return url.startsWith('http://') || url.startsWith('https://');
    } catch {
      return false;
    }
  }, { message: "Invalid URL format" }),
  resourceType: z.enum(["DOC", "VIDEO", "COURSE", "ARTICLE", "OTHER"]).default("OTHER"),
});

const generatedWeekSchema = z.object({
  weekNumber: z.number().int().positive(),
  title: z.string().trim().min(1, "Week title cannot be empty"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  description: z.string().trim().default(""),
  objectives: z.array(objectiveSchema).min(1, "At least one objective required"),
  deliverables: z.array(deliverableSchema).default([]),
  resources: z.array(resourceSchema).default([]),
}).refine((week) => {
  // Validate that endDate is after startDate
  const start = new Date(week.startDate);
  const end = new Date(week.endDate);
  return end >= start;
}, { message: "End date must be after or equal to start date" })
.transform((week) => ({
  ...week,
  // Filter out deliverables/resources with empty titles/labels or invalid URLs
  deliverables: week.deliverables.filter(d => d.title.length > 0),
  resources: week.resources.filter(r => r.label.length > 0 && r.url.length > 0),
}));

export interface GeneratedWeek {
  weekNumber: number;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
  objectives: {
    type: "CONCEPT" | "ALGO" | "PROJECT" | "OTHER";
    title: string;
    description: string;
    tasks: {
      label: string;
      isOptional: boolean;
    }[];
  }[];
  deliverables: {
    title: string;
    description: string;
    instructions: string;
  }[];
  resources: {
    label: string;
    url: string;
    resourceType: "DOC" | "VIDEO" | "COURSE" | "ARTICLE" | "OTHER";
  }[];
}

export interface RoadmapGenerationRequest {
  topic: string;
  numberOfWeeks: number;
  skillLevel: "débutant" | "intermédiaire" | "avancé";
  additionalContext?: string;
  startWeekNumber?: number; // Optional: start from specific week number
  baseDate?: string; // Optional: base date to start from (YYYY-MM-DD)
}

export async function generateRoadmap(request: RoadmapGenerationRequest): Promise<GeneratedWeek[]> {
  const startWeek = request.startWeekNumber || 1;
  
  // CRITICAL: Enforce baseDate whenever startWeekNumber is provided
  // This ensures explicit timeline control (no ambiguity about start date)
  if (request.startWeekNumber && !request.baseDate) {
    throw new Error(`baseDate is required when startWeekNumber is provided (startWeekNumber=${startWeek}). This ensures explicit timeline control.`);
  }
  
  // Use provided baseDate or default to today (only when no startWeekNumber)
  const startDate = request.baseDate ? new Date(request.baseDate) : new Date();
  
  const prompt = `Tu es un expert en mentorat Backend Python. Génère un plan de formation structuré sur ${request.numberOfWeeks} semaines pour apprendre "${request.topic}".

Niveau: ${request.skillLevel}
${request.additionalContext ? `Contexte additionnel: ${request.additionalContext}` : ""}
Semaine de départ: ${startWeek} (commence le ${startDate.toISOString().split('T')[0]})

STRUCTURE OBLIGATOIRE PAR SEMAINE:
Chaque semaine DOIT contenir EXACTEMENT 3 objectifs dans cet ordre précis:

1. **CONCEPT** (type: "CONCEPT"): Théorie et concepts à apprendre
   - Tâches : lectures, visionnage de tutoriels, compréhension des concepts

2. **ALGO** (type: "ALGO"): Exercices pratiques de coding
   - OBLIGATOIRE : Inclure des liens vers des exercices HackerRank ou LeetCode adaptés au niveau
   - Tâches : résoudre X exercices sur la plateforme, pratiquer les algorithmes

3. **PROJECT** (type: "PROJECT"): Projet fil rouge e-commerce
   - Ce projet évolue chaque semaine en fonction des concepts appris
   - Tâches : implémenter une nouvelle fonctionnalité du projet e-commerce
   - Exemple semaine 1 : Créer la structure du projet
   - Exemple semaine 2 : Ajouter les modèles de données
   - Exemple semaine 3 : Créer les endpoints API
   - etc.

LIVRABLES:
Pour chaque semaine, inclure un deliverable "Guide GitHub" avec:
- title: "Code source sur GitHub"
- description: "Pousser le code de la semaine sur votre repository GitHub"
- instructions: "Guide détaillé étape par étape pour: 1) git init (si première fois), 2) git add ., 3) git commit -m 'Semaine X: [description]', 4) git push origin main"

RESSOURCES:
- Les URLs des ressources doivent être des liens RÉELS et VALIDES
- Privilégie la documentation officielle Python/FastAPI
- Pour les exercices ALGO, utilise des liens HackerRank ou LeetCode réels
- Pour les vidéos, utilise des chaînes YouTube reconnues

IMPORTANT: Génère exactement ${request.numberOfWeeks} semaines avec des numéros séquentiels (${startWeek}, ${startWeek + 1}, ${startWeek + 2}...).
Les dates ne sont pas critiques car elles seront recalculées côté serveur pour garantir la continuité chronologique.

Structure JSON attendue:
{
  "weeks": [
    {
      "weekNumber": ${startWeek},
      "title": "Introduction et fondamentaux",
      "startDate": "${startDate.toISOString().split('T')[0]}",
      "endDate": "${new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}",
      "description": "Description détaillée de la semaine",
      "objectives": [
        {
          "type": "CONCEPT",
          "title": "Comprendre les bases de ...",
          "description": "Apprendre les concepts fondamentaux",
          "tasks": [
            { "label": "Lire la documentation officielle", "isOptional": false },
            { "label": "Regarder tutoriel vidéo", "isOptional": false }
          ]
        },
        {
          "type": "ALGO",
          "title": "Exercices pratiques",
          "description": "Pratiquer avec des exercices de coding",
          "tasks": [
            { "label": "Résoudre 3 exercices faciles sur HackerRank", "isOptional": false }
          ]
        },
        {
          "type": "PROJECT",
          "title": "Projet e-commerce fil rouge",
          "description": "Créer la structure du projet",
          "tasks": [
            { "label": "Initialiser le projet avec les bonnes dépendances", "isOptional": false }
          ]
        }
      ],
      "deliverables": [
        {
          "title": "Code source sur GitHub",
          "description": "Pousser le code de la semaine sur GitHub",
          "instructions": "1) git init (si première fois), 2) git add ., 3) git commit -m 'Semaine ${startWeek}: ...', 4) git push origin main"
        }
      ],
      "resources": [
        {
          "label": "Documentation Python",
          "url": "https://docs.python.org/fr/3/",
          "resourceType": "DOC"
        }
      ]
    }
  ]
}`;

  try {
    const response = await pRetry(
      async () => {
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o", // Using GPT-4o for reliable JSON mode
            messages: [
              {
                role: "system",
                content: "Tu es un expert en mentorat Backend Python. Tu génères des plans de formation structurés et détaillés."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            response_format: { type: "json_object" },
            max_completion_tokens: 8192,
          });

          console.log("OpenAI response received:", {
            hasChoices: !!completion.choices,
            choicesLength: completion.choices?.length,
            hasContent: !!completion.choices[0]?.message?.content,
            finishReason: completion.choices[0]?.finish_reason,
          });

          const content = completion.choices[0]?.message?.content;
          if (!content) {
            console.error("OpenAI returned empty content. Full response:", JSON.stringify(completion, null, 2));
            throw new Error("No content returned from OpenAI");
          }

          // Parse the JSON response
          const parsed = JSON.parse(content);
          
          console.log("OpenAI parsed response structure:", {
            isArray: Array.isArray(parsed),
            keys: Object.keys(parsed),
            hasWeeks: 'weeks' in parsed,
            hasRoadmap: 'roadmap' in parsed,
            hasPlan: 'plan' in parsed,
            topLevelType: Array.isArray(parsed) ? 'array' : typeof parsed,
          });
          
          // Handle both array and object with weeks array
          const weeksData = Array.isArray(parsed) 
            ? parsed 
            : (parsed.weeks || parsed.roadmap || parsed.plan || parsed.semaines);
          
          if (!weeksData || !Array.isArray(weeksData)) {
            console.error("Invalid weeks data. Full parsed response:", JSON.stringify(parsed, null, 2));
            throw new Error("Invalid response format from OpenAI: expected array of weeks");
          }
          
          console.log(`Successfully extracted ${weeksData.length} weeks from OpenAI response`);

          // Validate each week using Zod schema
          const validatedWeeks = z.array(generatedWeekSchema).parse(weeksData);

          // CRITICAL: Normalize dates to ensure chronological continuity
          // This prevents AI drift and guarantees sequential 7-day weeks
          const normalizedWeeks = validatedWeeks.map((week, index) => {
            const weekStartDate = new Date(startDate);
            weekStartDate.setDate(weekStartDate.getDate() + (index * 7));
            
            const weekEndDate = new Date(weekStartDate);
            weekEndDate.setDate(weekEndDate.getDate() + 6);

            return {
              ...week,
              weekNumber: startWeek + index, // Ensure sequential numbering
              startDate: weekStartDate.toISOString().split('T')[0],
              endDate: weekEndDate.toISOString().split('T')[0],
            };
          });

          return normalizedWeeks;
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error; // Rethrow to trigger p-retry
          }
          // Preserve validation errors for better debugging
          if (error instanceof z.ZodError) {
            const errorMessage = `AI response validation failed: ${error.errors[0]?.message}`;
            throw new AbortError(errorMessage);
          }
          const errorMessage = error?.message || String(error);
          throw new AbortError(errorMessage);
        }
      },
      {
        retries: 7,
        minTimeout: 2000,
        maxTimeout: 128000,
        factor: 2,
      }
    );

    return response;
  } catch (error: any) {
    console.error("Error generating roadmap:", error);
    const errorMessage = error?.message || String(error) || "Unknown error occurred";
    throw new Error(`Failed to generate roadmap: ${errorMessage}`);
  }
}
