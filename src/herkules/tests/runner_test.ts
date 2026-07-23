/**
 * Herkules - Runner Module Tests
 *
 * @module herkules/tests/runner_test
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  AgentRunnerFactory,
  AntigravityRunner,
  applyFallbackFileWrites,
  CustomAgentRunner,
} from "@herkules/runner.ts";

Deno.test("Runner Factory - default runner is Antigravity", () => {
  const runner = AgentRunnerFactory.getRunner();
  assertEquals(runner.name, "antigravity");
});

Deno.test("Runner Factory - fallback custom runner", () => {
  const runner = AgentRunnerFactory.getRunner("claude");
  assertEquals(runner.name, "claude");
  assertEquals(runner instanceof CustomAgentRunner, true);
});

Deno.test("AntigravityRunner - dry run simulation", async () => {
  const runner = new AntigravityRunner();
  const res = await runner.run({
    prompt: "Test prompt",
    worktreePath: Deno.cwd(),
    dryRun: true,
  });

  assertEquals(res.success, true);
  assertExists(res.output);
  assertEquals(res.output.includes("[Dry Run]"), true);
});

Deno.test("Runner Module - fallback file write extraction", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "herkules_fallback_test_" });
  try {
    const prompt = "Create .env.example with database settings";
    const agentOutput = `Here is the requested file:

\`\`\`env
DATABASE_URL=postgres://user:pass@localhost:5432/db
PORT=8000
\`\`\`
`;

    const applied = await applyFallbackFileWrites(prompt, agentOutput, tempDir);
    assertEquals(applied, true);

    const writtenContent = await Deno.readTextFile(`${tempDir}/.env.example`);
    assertEquals(writtenContent.includes("DATABASE_URL"), true);
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
});
