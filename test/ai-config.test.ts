import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveAiConfig } from "../server/services/aiConfig";

test("defaults to OpenAI gpt-4o when OPENAI_API_KEY is set", () => {
  const c = resolveAiConfig({ OPENAI_API_KEY: "sk-x" });
  assert.equal(c.source, "openai");
  assert.equal(c.baseURL, "https://api.openai.com/v1");
  assert.equal(c.model, "gpt-4o");
});

test("AI_API_KEY selects a custom provider such as DeepSeek", () => {
  const c = resolveAiConfig({
    AI_API_KEY: "ds-x",
    AI_BASE_URL: "https://api.deepseek.com",
    AI_MODEL: "deepseek-chat",
    OPENAI_API_KEY: "sk-x",
  });
  assert.deepEqual(
    { s: c.source, k: c.apiKey, u: c.baseURL, m: c.model },
    { s: "custom", k: "ds-x", u: "https://api.deepseek.com", m: "deepseek-chat" },
  );
});

test("falls back to Replit integration without own keys", () => {
  const c = resolveAiConfig({
    AI_INTEGRATIONS_OPENAI_API_KEY: "r",
    AI_INTEGRATIONS_OPENAI_BASE_URL: "https://replit/ai",
  });
  assert.equal(c.source, "replit");
  assert.equal(c.baseURL, "https://replit/ai");
});
