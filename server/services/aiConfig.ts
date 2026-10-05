export interface AiConfig {
  apiKey: string | undefined;
  baseURL: string | undefined;
  model: string;
  source: "custom" | "openai" | "replit";
}

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o";

/**
 * Resolves the OpenAI-compatible provider from the environment.
 * Priority: AI_API_KEY (any compatible provider, e.g. DeepSeek) > OPENAI_API_KEY > Replit AI Integrations.
 * AI_MODEL overrides the model for every source.
 */
export function resolveAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  const model = env.AI_MODEL?.trim() || DEFAULT_MODEL;

  if (env.AI_API_KEY) {
    return {
      apiKey: env.AI_API_KEY,
      baseURL: env.AI_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL,
      model,
      source: "custom",
    };
  }

  if (env.OPENAI_API_KEY) {
    return {
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.AI_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL,
      model,
      source: "openai",
    };
  }

  return {
    apiKey: env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    model,
    source: "replit",
  };
}
