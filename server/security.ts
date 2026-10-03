type RuntimeEnvironment = NodeJS.ProcessEnv;

const DEVELOPMENT_ONLY_JWT_SECRET = "roadmapmentor-development-only-secret";

export function isDevelopmentEnvironment(
  env: RuntimeEnvironment = process.env,
): boolean {
  return env.NODE_ENV === "development";
}

export function resolveJwtSecret(
  env: RuntimeEnvironment = process.env,
): string {
  const configuredSecret = env.JWT_SECRET?.trim();

  if (configuredSecret) {
    return configuredSecret;
  }

  if (isDevelopmentEnvironment(env)) {
    return DEVELOPMENT_ONLY_JWT_SECRET;
  }

  throw new Error(
    "JWT_SECRET is required outside local development. Refusing to start with an insecure fallback.",
  );
}
