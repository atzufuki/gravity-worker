/**
 * Unit Tests for ServerCommand (Local Daemon Issue Watcher)
 *
 * @module cli/tests/server_test
 */

import { assertEquals, assertExists } from "@std/assert";
import { ServerCommand } from "@cli/commands/server.ts";

Deno.test("ServerCommand - instantiation and property checks", () => {
  const cmd = new ServerCommand();
  assertEquals(cmd.name, "server");
  assertExists(cmd.help);
});

Deno.test("ServerCommand - processCycle single iteration verification", async () => {
  const serverCmd = new ServerCommand();
  const processedIssues = new Set<number>();
  let saveStateCalled = false;
  const saveState = async () => {
    saveStateCalled = true;
  };

  const executedIssues: number[] = [];
  const fakeExecFn = async (issueNum: number) => {
    executedIssues.push(issueNum);
    return true;
  };

  // Single cycle with mock issue
  const cycleResponse = [{ number: 99, title: "Test Daemon Task" }];
  const fakeFetch = async () => new Response(JSON.stringify(cycleResponse), { status: 200 });

  const res = await serverCmd.processCycle(
    "test-owner",
    "test-repo",
    ".",
    processedIssues,
    saveState,
    "mock-token",
    "antigravity",
    undefined,
    fakeFetch as unknown as typeof fetch,
    fakeExecFn,
  );

  assertEquals(res.triggeredCount, 1);
  assertEquals(processedIssues.has(99), true);
  assertEquals(executedIssues, [99]);
  assertEquals(saveStateCalled, true);
});
