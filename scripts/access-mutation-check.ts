/**
 * Proves the integration suites notice a removed authorisation guard.
 *
 * For each mutation: weaken one guard in the source, start a dev server on a
 * scratch port, run the matching integration file and require it to FAIL, then
 * restore the file. Slow by design (one server boot per mutation): run it by
 * hand before changing access rules, not in CI.
 *
 *   DATABASE_URL=... DATABASE_WS_PROXY=... DATABASE_WS_PROXY_INSECURE=true JWT_SECRET=x \
 *     npx tsx scripts/access-mutation-check.ts
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

interface Mutation {
  name: string;
  file: string;
  find: string;
  replace: string;
  suite: string;
}

const PORT = process.env.MUTATION_PORT ?? "5057";
const BASE = `http://localhost:${PORT}`;

const mutations: Mutation[] = [
  {
    name: "PUT /api/weeks/:id without requireMentor",
    file: "server/routes/weeks.ts",
    find: 'app.put("/api/weeks/:id", authMiddleware, requireMentor,',
    replace: 'app.put("/api/weeks/:id", authMiddleware,',
    suite: "test/integration/weeks-crud.integration.ts",
  },
  {
    name: "DELETE /api/weeks/:id without ownership check",
    file: "server/routes/weeks.ts",
    find: "if (!week || !allowed) {\n        return res.status(404).json({ error: \"Week not found\" });\n      }\n\n      await storage.deleteWeek",
    replace: "if (!week) {\n        return res.status(404).json({ error: \"Week not found\" });\n      }\n\n      await storage.deleteWeek",
    suite: "test/integration/weeks-crud.integration.ts",
  },
  {
    name: "session completion without requireMentor",
    file: "server/routes/sessions.ts",
    find: '"/api/sessions/:id/complete",\n    authMiddleware,\n    requireMentor,',
    replace: '"/api/sessions/:id/complete",\n    authMiddleware,',
    suite: "test/integration/sessions.integration.ts",
  },
  {
    name: "change request decision without requireLearner",
    file: "server/routes/packages.ts",
    find: '"/api/change-requests/:id/decision",\n    authMiddleware,\n    requireLearner,',
    replace: '"/api/change-requests/:id/decision",\n    authMiddleware,',
    suite: "test/integration/change-requests.integration.ts",
  },
  {
    name: "payments without requireMentor",
    file: "server/routes/billing.ts",
    find: '"/api/billing-periods/:id/payments",\n    authMiddleware,\n    requireMentor,',
    replace: '"/api/billing-periods/:id/payments",\n    authMiddleware,',
    suite: "test/integration/billing.integration.ts",
  },
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function stop(child: ChildProcess) {
  if (child.pid === undefined) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/F", "/T"]);
  } else {
    child.kill("SIGTERM");
  }
}

async function waitReady(): Promise<boolean> {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${BASE}/health/ready`)).ok) return true;
    } catch {
      // not listening yet
    }
    await sleep(1000);
  }
  return false;
}

async function check(mutation: Mutation): Promise<"caught" | "survived" | "error"> {
  // Source files may use CRLF; match on the normalised text and keep the file's own EOL.
  const original = readFileSync(mutation.file, "utf8");
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  const text = original.replace(/\r\n/g, "\n");
  if (!text.includes(mutation.find)) {
    console.error(`  pattern not found in ${mutation.file}: the mutation is stale`);
    return "error";
  }
  writeFileSync(mutation.file, text.replace(mutation.find, mutation.replace).replace(/\n/g, eol));

  let server: ChildProcess | undefined;
  try {
    server = spawn("npx", ["tsx", "server/index-dev.ts"], {
      env: { ...process.env, PORT, NODE_ENV: "development", RATE_LIMIT_AUTH_MAX: "1000" },
      stdio: "ignore",
      shell: true,
    });
    if (!(await waitReady())) {
      console.error("  server did not become ready");
      return "error";
    }
    const result = spawnSync("npx", ["tsx", "--test", mutation.suite], {
      env: { ...process.env, TEST_BASE_URL: BASE },
      stdio: "ignore",
      shell: true,
    });
    return result.status === 0 ? "survived" : "caught";
  } finally {
    if (server) stop(server);
    writeFileSync(mutation.file, original);
    await sleep(1000);
  }
}

async function main() {
  let failures = 0;
  for (const mutation of mutations) {
    console.log(`> ${mutation.name}`);
    const outcome = await check(mutation);
    console.log(`  ${outcome === "caught" ? "OK, suite failed as expected" : outcome.toUpperCase()}`);
    if (outcome !== "caught") failures++;
  }
  if (failures > 0) {
    console.error(`${failures} mutation(s) not caught: the matching suite does not protect that guard.`);
    process.exit(1);
  }
  console.log("All mutations caught.");
}

main();
