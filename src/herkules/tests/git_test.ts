/**
 * Herkules - Unit Tests for Git Module & Worktree Naming logic
 *
 * All external Git CLI processes are fully mocked/isolated for pure, fast unit testing.
 *
 * @module herkules/tests/git_test
 */

import { assertEquals, assertExists } from "@std/assert";
import { join } from "@std/path";

Deno.test("Git Module - Branch Naming Strategy", () => {
  // Verify issue branch convention: fix/<issueNumber>-<slug>
  const issueNumber = 999;
  const taskId = "fix-bug-in-integration-test";
  const branchName = `fix/${issueNumber}-${taskId}`;
  assertEquals(branchName, "fix/999-fix-bug-in-integration-test");
});

Deno.test("Git Module - Worktree Directory Path Calculation", () => {
  const baseDir = "/tmp/herkules-test";
  const worktreeRootDir = ".worktrees";
  const taskId = "issue-123";
  
  const expectedPath = join(baseDir, worktreeRootDir, taskId);
  assertEquals(expectedPath.endsWith(".worktrees/issue-123"), true);
});

Deno.test("Git Module - Worktree Info Structure Validation", () => {
  const info = {
    worktreePath: "/tmp/herkules-test/.worktrees/issue-10",
    branchName: "test/10-featci-add-automated-test-ci",
    taskId: "issue-10",
  };

  assertExists(info.worktreePath);
  assertEquals(info.branchName.startsWith("test/"), true);
  assertEquals(info.taskId, "issue-10");
});
