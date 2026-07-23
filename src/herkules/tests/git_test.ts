/**
 * Herkules - Comprehensive Git Module & Worktree Tests
 *
 * @module herkules/tests/git_test
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  createWorktree,
  getCurrentBranch,
  isGitRepository,
  removeWorktree,
} from "@herkules/git.ts";

Deno.test("Git Module - repository check", async () => {
  const isRepo = await isGitRepository(Deno.cwd());
  assertEquals(isRepo, true);
});

Deno.test("Git Module - current branch", async () => {
  const branch = await getCurrentBranch(Deno.cwd());
  assertExists(branch);
  assertEquals(typeof branch, "string");
});

Deno.test("Git Module - full worktree lifecycle and branch reuse", async () => {
  const taskId = `test-lifecycle-${Date.now()}`;
  const options = { taskId, prompt: "Fix bug in integration test worktree", issueNumber: 999 };

  // 1. Create worktree
  const info = await createWorktree(options, Deno.cwd());
  assertExists(info.worktreePath);
  assertEquals(info.branchName, "fix/999-fix-bug-in-integration-test-worktree");

  // Verify worktree folder exists
  const stat = await Deno.stat(info.worktreePath);
  assertEquals(stat.isDirectory, true);

  // 2. Remove worktree (deleting branch)
  await removeWorktree(info, { deleteBranch: true });

  // Verify worktree folder removed
  let exists = true;
  try {
    await Deno.stat(info.worktreePath);
  } catch {
    exists = false;
  }
  assertEquals(exists, false);
});
