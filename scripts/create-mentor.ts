import { ZodError } from "zod";
import { pool } from "../server/db";
import { hashPassword } from "../server/auth";
import { storage } from "../server/storage";
import {
  generateMentorPassword,
  mentorProvisioningSchema,
  planMentorProvisioning,
} from "../server/domain/mentorProvisioning";

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function run() {
  const email = readArg("email") ?? process.env.MENTOR_EMAIL;
  const fullName = readArg("name") ?? process.env.MENTOR_NAME;
  const suppliedPassword = process.env.MENTOR_PASSWORD;
  const generated = !suppliedPassword;

  const input = mentorProvisioningSchema.parse({
    email,
    fullName,
    password: suppliedPassword ?? generateMentorPassword(),
  });

  const existing = await storage.getUserByEmail(input.email);
  const action = planMentorProvisioning(existing?.role);

  if (action === "noop") {
    console.log(`[mentor:create] ${input.email} is already a mentor. Nothing to do.`);
    return;
  }

  const user = await storage.createUser({
    fullName: input.fullName,
    email: input.email,
    password: await hashPassword(input.password),
    role: "MENTOR",
  });
  await storage.createEmailPreferences({
    userId: user.id,
    taskReminders: true,
    weekPreparation: true,
    progressUpdates: true,
    commentNotifications: true,
  });

  // Audit trail: operator action, never includes the password.
  console.log(
    `[audit] ${new Date().toISOString()} mentor_created userId=${user.id} email=${user.email} ` +
      `operator=${process.env.USERNAME ?? process.env.USER ?? "unknown"} source=cli`,
  );
  if (generated) {
    console.log(`[mentor:create] Generated password (shown once, change it after first login): ${input.password}`);
  }
}

run()
  .catch((error) => {
    const message =
      error instanceof ZodError
        ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
        : error instanceof Error
          ? error.message
          : error;
    console.error("[mentor:create] Failed:", message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
