import { eq } from "drizzle-orm";
import { users } from "../shared/schema";
import { db, pool } from "../server/db";
import { storage } from "../server/storage";
import { planUserStatus, type UserStatusAction } from "../server/domain/userStatus";

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function run() {
  const email = readArg("email");
  const action = readArg("action") as UserStatusAction | undefined;
  if (!email || (action !== "disable" && action !== "enable")) {
    throw new Error("Usage: npm run user:set-status -- --email=<email> --action=disable|enable");
  }

  const user = await storage.getUserByEmail(email);
  const plan = planUserStatus(action, user ? { disabledAt: user.disabledAt ?? null } : undefined);

  if (plan === "not_found") throw new Error(`No user with email ${email}.`);
  if (plan === "noop") {
    console.log(`[user:set-status] ${email} is already ${action}d. Nothing to do.`);
    return;
  }

  await db
    .update(users)
    .set({ disabledAt: action === "disable" ? new Date() : null })
    .where(eq(users.id, user!.id));

  // Audit trail: operator action.
  console.log(
    `[audit] ${new Date().toISOString()} user_${action}d userId=${user!.id} email=${email} ` +
      `operator=${process.env.USERNAME ?? process.env.USER ?? "unknown"} source=cli`,
  );
}

run()
  .catch((error) => {
    console.error("[user:set-status] Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
