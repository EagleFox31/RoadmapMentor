import cron from "node-cron";

export interface SchedulerJobConfig {
  name: string;
  label: string;
  expression: string;
}

export interface SchedulerConfig {
  enabled: boolean;
  timezone: string;
  jobs: SchedulerJobConfig[];
}

const DEFAULT_TIMEZONE = "Europe/Paris";
const DEFAULT_MIDWEEK = "0 10 * * 3";
const DEFAULT_ENDWEEK = "0 10 * * 5";

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the scheduled jobs from the environment.
 * SCHEDULER_ENABLED=false disables every job on this instance (e.g. web replicas when a
 * dedicated worker runs them); SCHEDULER_TIMEZONE, SCHEDULER_MIDWEEK_CRON and
 * SCHEDULER_ENDWEEK_CRON override the defaults. Invalid values fail fast at startup.
 */
export function resolveSchedulerConfig(env: NodeJS.ProcessEnv = process.env): SchedulerConfig {
  const timezone = env.SCHEDULER_TIMEZONE?.trim() || DEFAULT_TIMEZONE;
  if (!isValidTimezone(timezone)) {
    throw new Error(`SCHEDULER_TIMEZONE is not a valid IANA timezone: ${timezone}`);
  }

  const jobs: SchedulerJobConfig[] = [
    {
      name: "task-reminder-midweek",
      label: "Rappel de mi-semaine",
      expression: env.SCHEDULER_MIDWEEK_CRON?.trim() || DEFAULT_MIDWEEK,
    },
    {
      name: "task-reminder-endweek",
      label: "Rappel de fin de semaine",
      expression: env.SCHEDULER_ENDWEEK_CRON?.trim() || DEFAULT_ENDWEEK,
    },
  ];

  for (const job of jobs) {
    if (!cron.validate(job.expression)) {
      throw new Error(`Invalid cron expression for ${job.name}: ${job.expression}`);
    }
  }

  const enabled = !["false", "0", "off"].includes((env.SCHEDULER_ENABLED ?? "true").trim().toLowerCase());
  return { enabled, timezone, jobs };
}
