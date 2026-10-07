// Vérifie le budget de poids du build frontend (dist/public) : échoue si dépassé.
import { readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const dir = process.env.BUNDLE_DIR ?? "dist/public/assets";
const kb = (name, fallback) => Number(process.env[name] ?? fallback) * 1024;
const budgets = {
  ".js": { limit: kb("BUDGET_JS_KB", 400), label: "chunk JS" },
  ".css": { limit: kb("BUDGET_CSS_KB", 150), label: "feuille CSS" },
  media: { limit: kb("BUDGET_MEDIA_KB", 500), label: "média" },
};
const media = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg"]);

const failures = [];
for (const name of readdirSync(dir)) {
  const ext = extname(name);
  const budget = budgets[ext] ?? (media.has(ext) ? budgets.media : null);
  if (!budget) continue;
  const size = statSync(join(dir, name)).size;
  if (size > budget.limit) {
    failures.push(`${name} : ${(size / 1024).toFixed(0)} kB > ${(budget.limit / 1024).toFixed(0)} kB (${budget.label})`);
  }
}
if (failures.length) {
  console.error(`Budget de poids dépassé :\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("Budget de poids respecté.");
