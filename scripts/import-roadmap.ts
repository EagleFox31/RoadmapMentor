import { readFileSync } from "node:fs";
import { ZodError } from "zod";
import { pool } from "../server/db";
import { storage } from "../server/storage";
import { planRoadmapImport, roadmapImportSchema } from "../server/domain/roadmapImport";

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function run() {
  const file = readArg("file");
  const mentorEmail = (readArg("mentor") ?? process.env.MENTOR_EMAIL)?.trim().toLowerCase();
  if (!file || !mentorEmail) {
    throw new Error("Usage: npm run roadmap:import -- --file=<roadmap.json> --mentor=<mentor email>");
  }

  const input = roadmapImportSchema.parse(JSON.parse(readFileSync(file, "utf8")));

  const mentor = await storage.getUserByEmail(mentorEmail);
  if (!mentor || mentor.role !== "MENTOR") {
    throw new Error(`No mentor account for ${mentorEmail}. Create it first with npm run mentor:create.`);
  }

  const owned = (await storage.getRoadmapsForUser(mentor.id, "MENTOR")).filter(
    (roadmap) => roadmap.createdByUserId === mentor.id && roadmap.title === input.title,
  );
  if (owned.length > 1) {
    throw new Error(`Several roadmaps titled "${input.title}" belong to ${mentorEmail}. Rename one before importing.`);
  }
  const existing = owned[0];
  const existingWeeks = existing ? (await storage.getWeeksByRoadmap(existing.id)).length : undefined;
  const action = planRoadmapImport(existingWeeks);

  if (action === "noop") {
    console.log(`[roadmap:import] "${input.title}" already has ${existingWeeks} week(s) (roadmapId=${existing!.id}). Nothing to do.`);
    return;
  }

  const roadmap =
    existing ??
    (await storage.createRoadmap({
      title: input.title,
      description: input.description ?? null,
      createdByUserId: mentor.id,
      isLegacy: false,
    }));

  const created = await storage.createRoadmapBulk(
    input.weeks.map((week) => ({ ...week, roadmapId: roadmap.id })),
  );

  // Resources come from a mentor-authored file: approve them like a mentor would in the UI.
  let approved = 0;
  for (const week of created.weeks) {
    for (const resource of week.resources) {
      await storage.approveResource(resource.id);
      approved += 1;
    }
  }

  console.log(
    `[audit] ${new Date().toISOString()} roadmap_imported roadmapId=${roadmap.id} mentorId=${mentor.id} ` +
      `weeks=${created.weeks.length} resources=${approved} action=${action} ` +
      `operator=${process.env.USERNAME ?? process.env.USER ?? "unknown"} source=cli`,
  );
}

run()
  .catch((error) => {
    const message =
      error instanceof ZodError
        ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
        : error instanceof Error
          ? error.message
          : error;
    console.error("[roadmap:import] Failed:", message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
