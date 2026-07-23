/**
 * GravityWorker - Runner Module Tests
 */

import { assertEquals, assert } from "@std/assert";
import { AgentRunnerFactory, AntigravityRunner } from "../runner.ts";

Deno.test("Runner Factory - default runner is Antigravity", () => {
  const runner = AgentRunnerFactory.getRunner("antigravity");
  assertEquals(runner.name, "antigravity");
  assert(runner instanceof AntigravityRunner);
});

Deno.test("Runner Factory - fallback custom runner", () => {
  const runner = AgentRunnerFactory.getRunner("custom-bot");
  assertEquals(runner.name, "custom-bot");
});

Deno.test("AntigravityRunner - dry run simulation", async () => {
  const runner = new AntigravityRunner();
  const res = await runner.run({
    prompt: "Test dry run",
    worktreePath: ".",
    dryRun: true,
  });

  assertEquals(res.success, true);
  assert(res.output.includes("[Dry Run]"));
  assert(res.durationMs >= 0);
});
