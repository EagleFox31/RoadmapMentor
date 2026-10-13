type RuntimeEnvironment = NodeJS.ProcessEnv;

const DEVELOPMENT_ONLY_JWT_SECRET = "roadmapmentor-development-only-secret";

export function isDevelopmentEnvironment(
  env: RuntimeEnvironment = process.env,
): boolean {
  return env.NODE_ENV === "development";
}

function readBooleanFlag(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
}

/**
 * Legacy POST /api/auth/register creates an account without proving email
 * ownership. Off by default outside development; automated suites opt in
 * explicitly with AUTH_DIRECT_REGISTRATION=true.
 */
export function isDirectRegistrationEnabled(
  env: RuntimeEnvironment = process.env,
): boolean {
  return readBooleanFlag(env.AUTH_DIRECT_REGISTRATION) ?? isDevelopmentEnvironment(env);
}

/**
 * OTP codes are credentials: they may only reach the logs (and replace real
 * delivery when no provider is configured) in development, or when a local
 * stack opts in with OTP_LOG_CODES=true.
 */
export function canLogOtpCodes(
  env: RuntimeEnvironment = process.env,
): boolean {
  return readBooleanFlag(env.OTP_LOG_CODES) ?? isDevelopmentEnvironment(env);
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
