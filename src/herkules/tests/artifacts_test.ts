/**
 * Herkules - Artifacts Module Tests
 *
 * @module herkules/tests/artifacts_test
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { generateImplementationPlan, generateWalkthrough } from "@herkules/artifacts.ts";

Deno.test("Artifacts - generate implementation plan", () => {
  const plan = generateImplementationPlan({
    taskId: "task-123",
    prompt: "Fix bug in authentication",
    agentName: "antigravity",
  });

  assertStringIncludes(plan, "implementation plan");
  assertStringIncludes(plan, "Fix bug in authentication");
});

Deno.test("Artifacts - generate walkthrough open-source PR format", () => {
  const walkthrough = generateWalkthrough({
    taskId: "task-123",
    prompt: "Fix bug in authentication",
    agentName: "antigravity",
    output: "Fixed auth logic successfully.",
    diff: "diff --git a/auth.ts b/auth.ts\n+ fixed",
    durationMs: 1500,
  });

  assertStringIncludes(walkthrough, "### Summary");
  assertStringIncludes(walkthrough, "Fixed auth logic successfully.");
  assertStringIncludes(walkthrough, "`auth.ts`");
});

Deno.test("Artifacts - generate walkthrough filters out raw JSON output", () => {
  const walkthrough = generateWalkthrough({
    taskId: "task-123",
    prompt: "Add .env.example template to repository root",
    agentName: "gemini",
    output: '[ { "action": "write", "path": ".env.example" } ]',
    diff: "diff --git a/.env.example b/.env.example\n+ KEY=value",
    durationMs: 1500,
  });

  assertStringIncludes(walkthrough, "### Summary");
  assertStringIncludes(walkthrough, "Add .env.example template to repository root");
  assertStringIncludes(walkthrough, "`.env.example`");
});
