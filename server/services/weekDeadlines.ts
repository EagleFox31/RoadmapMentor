const MS_PER_DAY = 86_400_000;

/** Jours calendaires entre aujourd'hui (date seule) et `endDate` (YYYY-MM-DD). */
export function daysUntilEndDate(
  endDate: string,
  now: Date = new Date(),
  timeZone = "Europe/Paris",
): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return null;
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }
  return Math.round((end - start) / MS_PER_DAY);
}

export const DEADLINE_REMINDER_DAYS = 2;
