import OpenAI from "openai";
import pRetry, { AbortError } from "p-retry";
import { z } from "zod";

// Check if user provided their own OpenAI API key
// If OPENAI_API_KEY exists, use it directly (user's own key)
// Otherwise, use Replit AI Integrations (billed to Replit credits)
const useOwnApiKey = !!process.env.OPENAI_API_KEY;

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
}

export async function generateRoadmap(request: RoadmapGenerationRequest): Promise<GeneratedWeek[]> {
  const prompt = `Tu es un expert en mentorat Backend Python. Génère un plan de formation structuré sur ${request.numberOfWeeks} semaines pour apprendre "${request.topic}".

Niveau: ${request.skillLevel}
${request.additionalContext ? `Contexte additionnel: ${request.additionalContext}` : ""}

Pour chaque semaine, fournis:
- Un titre clair et motivant
- Une description détaillée des concepts à apprendre
- Des objectifs d'apprentissage (CONCEPT, ALGO, PROJECT, OTHER) avec leurs tâches associées
- Des livrables concrets (projets, exercices)
- Des ressources d'apprentissage (documentation, vidéos, cours, articles)

IMPORTANT: 
- Les URLs des ressources doivent être des liens RÉELS et VALIDES vers des ressources en ligne
- Privilégie les ressources officielles (documentation Python, tutoriels Django/FastAPI, etc.)
- Pour les vidéos, utilise des chaînes YouTube reconnues
- Chaque tâche doit être claire et actionnable
- Marque les tâches bonus comme "isOptional: true"

Retourne le résultat en JSON avec cette structure exacte:
[
  {
    "weekNumber": 1,
    "title": "Titre de la semaine",
    "startDate": "2025-01-06",
    "endDate": "2025-01-12",
    "description": "Description détaillée",
    "objectives": [
      {
        "type": "CONCEPT",
        "title": "Titre de l'objectif",
        "description": "Description de l'objectif",
        "tasks": [
          { "label": "Tâche à accomplir", "isOptional": false }
        ]
      }
    ],
    "deliverables": [
      {
        "title": "Livrable à produire",
        "description": "Description du livrable",
        "instructions": "Instructions détaillées"
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

Génère exactement ${request.numberOfWeeks} semaines. Les dates doivent être séquentielles (chaque semaine dure 7 jours).`;

  try {
    const response = await pRetry(
      async () => {
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
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

          const content = completion.choices[0]?.message?.content;
          if (!content) {
            throw new Error("No content returned from OpenAI");
          }

          // Parse the JSON response
          const parsed = JSON.parse(content);
          
          // Handle both array and object with weeks array
          const weeksData = Array.isArray(parsed) ? parsed : parsed.weeks;
          
          if (!weeksData || !Array.isArray(weeksData)) {
            throw new Error("Invalid response format from OpenAI: expected array of weeks");
          }

          // Validate each week using Zod schema
          const validatedWeeks = z.array(generatedWeekSchema).parse(weeksData);

          return validatedWeeks;
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
