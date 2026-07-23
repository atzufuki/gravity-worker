/**
 * GravityWorker - Git Module Tests
 */

import { assertEquals, assert } from "@std/assert";
import { isGitRepository, getCurrentBranch } from "../git.ts";

Deno.test("Git Module - repository check", async () => {
  const isRepo = await isGitRepository();
  assert(isRepo, "Should be running inside a git repository");
});

Deno.test("Git Module - current branch", async () => {
  const branch = await getCurrentBranch();
  assert(branch.length > 0, "Branch name should not be empty");
});
