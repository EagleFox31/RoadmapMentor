import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createLabSchema,
  reviewLabSubmissionSchema,
  saveLabSubmissionSchema,
} from "../shared/schema";

test("a mentor can define a browser Python lab", () => {
  const lab = createLabSchema.parse({
    title: "Manipuler une liste",
    description: "Appliquer map et filter sur des données simples",
    instructions: "Implémente la fonction total_pairs.",
    difficulty: "BEGINNER",
    estimatedMinutes: 25,
    starterCode: "def total_pairs(values):\n    pass",
    testCode: "assert total_pairs([1, 2, 3, 4]) == 6",
    repositoryUrl: null,
    launchUrl: null,
    orderIndex: 0,
    isPublished: false,
  });

  assert.equal(lab.estimatedMinutes, 25);
  assert.equal(lab.isPublished, false);
});

test("lab duration stays suitable for guided practice", () => {
  const result = createLabSchema.safeParse({
    title: "Projet trop long",
    instructions: "Construire une application complète.",
    difficulty: "ADVANCED",
    estimatedMinutes: 600,
  });

  assert.equal(result.success, false);
});

test("saving a lab defaults to an in-progress draft", () => {
  const submission = saveLabSubmissionSchema.parse({ code: "print('ok')" });
  assert.equal(submission.submit, false);
});

test("a lab review only accepts the two mentor decisions", () => {
  assert.equal(
    reviewLabSubmissionSchema.safeParse({ decision: "APPROVE", feedback: "Bien joué" }).success,
    true,
  );
  assert.equal(
    reviewLabSubmissionSchema.safeParse({ decision: "DELETE" }).success,
    false,
  );
});
