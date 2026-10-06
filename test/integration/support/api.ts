import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { after, test } from "node:test";

export const BASE = process.env.TEST_BASE_URL;
export const PASSWORD = "Test123!";
export const run = Date.now().toString(36);

export async function api(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

export interface Actor {
  token: string;
  id: number;
  email: string;
}

export async function login(email: string): Promise<Actor> {
  const res = await api("POST", "/api/auth/login", undefined, { email, password: PASSWORD });
  assert.equal(res.status, 200, `login ${email}: ${JSON.stringify(res.data)}`);
  return { token: res.data.token, id: res.data.user?.id, email };
}

export async function register(label: string): Promise<Actor> {
  const email = `${label}.${run}@it.test`;
  const res = await api("POST", "/api/auth/register", undefined, {
    email,
    password: PASSWORD,
    fullName: `IT ${label}`,
  });
  assert.equal(res.status, 201, `register ${label}: ${JSON.stringify(res.data)}`);
  return { token: res.data.token, id: res.data.user?.id, email };
}

/**
 * Provisions a mentor through the operator script, which works in dev and
 * production builds alike (unlike the dev-only create-test-users route).
 * Idempotent: an existing mentor is a no-op.
 */
export async function ensureMentor(label: string): Promise<Actor> {
  const email = `mentor.${label}.${run}@it.test`;
  execFileSync(
    process.execPath,
    ["--import", "tsx", "scripts/create-mentor.ts", `--email=${email}`, `--name=IT Mentor ${label}`],
    { env: { ...process.env, MENTOR_PASSWORD: PASSWORD }, stdio: "pipe" },
  );
  return login(email);
}

const tracked: Array<{ path: string; token: string }> = [];

/** Registers a resource to be deleted (best effort) once the file's tests end. */
export function track(path: string, token: string) {
  tracked.push({ path, token });
}

export function registerCleanup() {
  after(async () => {
    for (const { path, token } of tracked.splice(0).reverse()) {
      await api("DELETE", path, token).catch(() => undefined);
    }
  });
}

export type AccessRow = [
  method: string,
  path: string | (() => string),
  actor: string,
  body: unknown,
  expectedStatus: number,
];

/**
 * Declarative access matrix: one test per row, so removing an authorisation
 * guard fails a test named after the exact route and actor.
 */
export function expectAccess(actors: Record<string, () => string | undefined>, rows: AccessRow[]) {
  for (const [method, path, actor, body, expected] of rows) {
    const label = typeof path === "function" ? path.toString() : path;
    test(`${actor} ${method} ${label} -> ${expected}`, async () => {
      const resolved = typeof path === "function" ? path() : path;
      const res = await api(method, resolved, actors[actor]?.(), body);
      assert.equal(res.status, expected, `${method} ${resolved} as ${actor}: ${JSON.stringify(res.data)}`);
    });
  }
}
