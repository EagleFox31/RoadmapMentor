import assert from "node:assert/strict";
import test from "node:test";
import { planRoadmapImport, roadmapImportSchema } from "../server/domain/roadmapImport";

const week = {
  number: 1,
  title: "Git & projet reproductible",
  startDate: "2026-10-12",
  endDate: "2026-10-18",
  objectives: [{ type: "PROJECT", title: "Versionner ShopFlow", tasks: [{ label: "Premier push" }] }],
  resources: [{ label: "GitHub Docs", url: "https://docs.github.com/fr", resourceType: "DOC" }],
};

test("roadmap import is idempotent and never overwrites mentor edits", () => {
  assert.equal(planRoadmapImport(undefined), "create");
  assert.equal(planRoadmapImport(0), "fill");
  assert.equal(planRoadmapImport(4), "noop");
});

test("import file reuses the bulk week contract", () => {
  const parsed = roadmapImportSchema.parse({ title: "  ShopFlow  ", weeks: [week] });
  assert.equal(parsed.title, "ShopFlow");
  assert.equal(parsed.weeks[0].deliverables.length, 0);
});

test("import file rejects a week without objectives and an unsafe resource URL", () => {
  assert.throws(() => roadmapImportSchema.parse({ title: "x", weeks: [{ ...week, objectives: [] }] }));
  assert.throws(() =>
    roadmapImportSchema.parse({
      title: "x",
      weeks: [{ ...week, resources: [{ label: "bad", url: "javascript:alert(1)", resourceType: "DOC" }] }],
    }),
  );
  assert.throws(() => roadmapImportSchema.parse({ title: "x", weeks: [] }));
});
