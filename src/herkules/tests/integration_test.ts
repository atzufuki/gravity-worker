/**
 * Herkules Integration Tests
 *
 * Tests the local daemon issue polling cycle, issue label tracking,
 * label removal state resets, and execution trigger workflows.
 *
 * @module herkules/tests/integration_test
 */

import { assertEquals } from "@std/assert";
import { ServerCommand } from "@cli/commands/server.ts";

Deno.test("Integration Test - Local Daemon Label Removal and Re-Labeling Lifecycle", async () => {
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

  // Cycle 1: Issue #48 is labeled with 'herkules' -> Should trigger processing
  const cycle1Response = [
    { number: 48, title: "Add .env.example" },
  ];
  const fakeFetch1 = async () => new Response(JSON.stringify(cycle1Response), { status: 200 });

  const res1 = await serverCmd.processCycle(
    "atzufuki",
    "herkules",
    ".",
    processedIssues,
    saveState,
    "fake-token",
    "antigravity",
    undefined,
    fakeFetch1 as unknown as typeof fetch,
    fakeExecFn,
  );

  assertEquals(res1.triggeredCount, 1);
  assertEquals(processedIssues.has(48), true);
  assertEquals(executedIssues, [48]);

  // Cycle 2: Same Issue #48 is STILL labeled -> Should NOT trigger (already processed)
  const res2 = await serverCmd.processCycle(
    "atzufuki",
    "herkules",
    ".",
    processedIssues,
    saveState,
    "fake-token",
    "antigravity",
    undefined,
    fakeFetch1 as unknown as typeof fetch,
    fakeExecFn,
  );

  assertEquals(res2.triggeredCount, 0);
  assertEquals(executedIssues, [48]);

  // Cycle 3: User removes 'herkules' label from Issue #48 -> Should reset processed state
  const cycle3Response: any[] = [];
  const fakeFetch3 = async () => new Response(JSON.stringify(cycle3Response), { status: 200 });

  const res3 = await serverCmd.processCycle(
    "atzufuki",
    "herkules",
    ".",
    processedIssues,
    saveState,
    "fake-token",
    "antigravity",
    undefined,
    fakeFetch3 as unknown as typeof fetch,
    fakeExecFn,
  );

  assertEquals(res3.stateChanged, true);
  assertEquals(processedIssues.has(48), false); // Reset!

  // Cycle 4: User re-adds 'herkules' label to Issue #48 -> Should trigger processing again!
  const res4 = await serverCmd.processCycle(
    "atzufuki",
    "herkules",
    ".",
    processedIssues,
    saveState,
    "fake-token",
    "antigravity",
    undefined,
    fakeFetch1 as unknown as typeof fetch,
    fakeExecFn,
  );

  assertEquals(res4.triggeredCount, 1);
  assertEquals(processedIssues.has(48), true);
  assertEquals(executedIssues, [48, 48]); // Executed twice!
});
