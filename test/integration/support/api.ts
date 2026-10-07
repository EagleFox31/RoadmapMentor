import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { after, test } from "node:test";

export const BASE = process.env.TEST_BASE_URL;
export const PASSWORD = "Test123!";
// Mentor provisioning enforces a stricter password policy than public sign-up.
export const MENTOR_PASSWORD = "Mentor-Test-123!";
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

export async function login(email: string, password = PASSWORD): Promise<Actor> {
  const res = await api("POST", "/api/auth/login", undefined, { email, password });
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
    { env: { ...process.env, MENTOR_PASSWORD }, stdio: "pipe" },
  );
  return login(email, MENTOR_PASSWORD);
}

/** Installs a known token on an invitation (the API never exposes the real one). */
export function forgeInvitationToken(invitationId: number, options: { expired?: boolean } = {}): string {
  const token = `it-${run}-${invitationId}-${Math.random().toString(36).slice(2)}`;
  execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "test/integration/support/set-invitation-token.ts",
      `--id=${invitationId}`,
      `--token=${token}`,
      ...(options.expired ? ["--expired"] : []),
    ],
    { env: process.env, stdio: "pipe" },
  );
  return token;
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

// Paths are lazy (ids exist only after setup); name the test from the source text instead.
function describePath(path: () => string): string {
  return path.toString().replace(/^\(\)\s*=>\s*/, "").replace(/\$\{[^}]*\}/g, ":id").replace(/[`]/g, "");
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
    const label = typeof path === "function" ? describePath(path) : path;
    test(`${actor} ${method} ${label} -> ${expected}`, async () => {
      const resolved = typeof path === "function" ? path() : path;
      const res = await api(method, resolved, actors[actor]?.(), body);
      assert.equal(res.status, expected, `${method} ${resolved} as ${actor}: ${JSON.stringify(res.data)}`);
    });
  }
}

export interface MentoringFixture {
  mentorA: Actor;
  mentorB: Actor;
  learner: Actor;
  outsider: Actor;
  roadmapId: number;
  mentorshipId: number;
  tokens: Record<"mentorA" | "mentorB" | "learner" | "outsider" | "anonymous", () => string | undefined>;
}

/**
 * Two mentors, an attached learner and an unrelated learner, with one roadmap
 * and one mentorship owned by mentorA. Labels keep fixtures of different
 * files from colliding on e-mail addresses.
 */
export async function mentoringFixture(label: string): Promise<MentoringFixture> {
  const mentorA = await ensureMentor(`${label}a`);
  const mentorB = await ensureMentor(`${label}b`);
  const learner = await register(`${label}.learner`);
  const outsider = await register(`${label}.outsider`);

  const roadmap = await api("POST", "/api/roadmaps", mentorA.token, { title: `${label} ${run}` });
  assert.equal(roadmap.status, 201, JSON.stringify(roadmap.data));
  const link = await api("POST", `/api/roadmaps/${roadmap.data.id}/mentorships`, mentorA.token, { learnerId: learner.id });
  assert.ok([200, 201].includes(link.status), JSON.stringify(link.data));
  assert.ok(Number.isInteger(link.data.id), `mentorship id missing: ${JSON.stringify(link.data)}`);

  return {
    mentorA,
    mentorB,
    learner,
    outsider,
    roadmapId: roadmap.data.id,
    mentorshipId: link.data.id,
    tokens: {
      mentorA: () => mentorA.token,
      mentorB: () => mentorB.token,
      learner: () => learner.token,
      outsider: () => outsider.token,
      anonymous: () => undefined,
    },
  };
}

/** Creates a March 2026 package (XAF, 3 included sessions) on the fixture's mentorship. */
export async function createPackage(f: MentoringFixture, overrides: Record<string, unknown> = {}) {
  const res = await api("POST", `/api/mentorships/${f.mentorshipId}/packages`, f.mentorA.token, {
    title: "Forfait mars",
    basePriceMinor: 100000,
    currency: "XAF",
    periodStart: "2026-03-01",
    periodEnd: "2026-03-31",
    includedSessionCount: 3,
    scopeDescription: "Accompagnement mensuel",
    scopeItems: [{ title: "Revue de code" }],
    ...overrides,
  });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return res.data as { id: number };
}
