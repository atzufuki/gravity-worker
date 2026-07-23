/**
 * GravityWorker - Artifacts Module Tests
 */

import { assertEquals, assert } from "@std/assert";
import { generateImplementationPlan, generateWalkthrough } from "../artifacts.ts";

Deno.test("Artifacts - generate implementation plan", () => {
  const plan = generateImplementationPlan({
    taskId: "task-100",
    prompt: "Fix auth race condition",
    agentName: "antigravity",
  });

  assert(plan.includes("# Implementation Plan - Task #task-100"));
  assert(plan.includes("Fix auth race condition"));
  assert(plan.includes("antigravity"));
});

Deno.test("Artifacts - generate walkthrough", () => {
  const walkthrough = generateWalkthrough({
    taskId: "task-100",
    prompt: "Fix auth race condition",
    agentName: "antigravity",
    output: "Success",
    durationMs: 1500,
  });

  assert(walkthrough.includes("# Walkthrough - Task #task-100"));
  assert(walkthrough.includes("Success"));
  assert(walkthrough.includes("1.50s"));
});
