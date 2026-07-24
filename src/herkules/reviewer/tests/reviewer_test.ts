/**
 * Herkules Reviewer - Unit & Integration Test Suite
 *
 * Validates PR worktree provisioning, verification runner, AI code review,
 * inline comments, and configurable auto-merge guard conditions.
 *
 * @module herkules/reviewer/tests/reviewer_test
 */

import { assert, assertEquals, assertExists, assertFalse } from "@std/assert";
import { parseReviewerArgs, parseReviewerConfig } from "@herkules/reviewer/config.ts";
import { provisionPRWorktree, teardownPRWorktree } from "@herkules/reviewer/worktree.ts";
import { runPRVerification } from "@herkules/reviewer/runner.ts";
import { analyzeDiffWithAI } from "@herkules/reviewer/reviewer.ts";
import { attemptAutoMerge } from "@herkules/reviewer/git_provider.ts";
import { executePRReview } from "@herkules/reviewer/main.ts";

Deno.test("Reviewer Config - parse defaults and options", () => {
  const defaultConfig = parseReviewerConfig();
  assertFalse(defaultConfig.autoMerge, "Default autoMerge should be false");
  assertEquals(defaultConfig.baseBranch, "main");
  assertEquals(defaultConfig.minSeverityToBlockMerge, "bug");

  const customConfig = parseReviewerConfig({
    autoMerge: true,
    testCommand: "deno task test",
    baseBranch: "develop",
  });
  assert(customConfig.autoMerge);
  assertEquals(customConfig.testCommand, "deno task test");
  assertEquals(customConfig.baseBranch, "develop");
});

Deno.test("Reviewer Config - parse CLI arguments", () => {
  const parsed = parseReviewerArgs(["--pr", "42", "--auto-merge", "--test-cmd", "npm test", "--repo", "owner/repo"]);
  assertEquals(parsed.prNumber, 42);
  assert(parsed.autoMerge);
  assertEquals(parsed.testCommand, "npm test");
  assertEquals(parsed.repo, "owner/repo");
});

Deno.test("Reviewer Worktree - provision and teardown lifecycle", async () => {
  const tempRootDir = await Deno.makeTempDir({ prefix: "herkules_reviewer_wt_" });

  try {
    const info = await provisionPRWorktree({
      prNumber: 99,
      worktreeRootDir: tempRootDir,
    });

    assertExists(info.worktreePath);
    assertEquals(info.prNumber, 99);

    const stat = await Deno.stat(info.worktreePath);
    assert(stat.isDirectory);

    await teardownPRWorktree(info);
    const existsAfterCleanup = await Deno.stat(info.worktreePath).then(() => true).catch(() => false);
    assertFalse(existsAfterCleanup, "Worktree directory should be removed after teardown");
  } finally {
    await Deno.remove(tempRootDir, { recursive: true }).catch(() => {});
  }
});

Deno.test("Reviewer Runner - verification execution handling", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "herkules_runner_test_" });

  try {
    // Write passing dummy script
    const config = parseReviewerConfig({
      testCommand: `${Deno.execPath()} eval "Deno.exit(0)"`,
    });

    const res = await runPRVerification(tempDir, config);
    assert(res.testResult.passed);
    assert(res.allPassed);
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
});

Deno.test("Reviewer Engine - analyze diff and generate inline comments", async () => {
  const sampleDiff = `
diff --git a/src/auth.ts b/src/auth.ts
index 0000000..1111111 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,3 +10,5 @@
+ const secretKey = "super_secret_password_123456789";
+ console.log("Debug auth", secretKey);
+ try { execute(); } catch (e) {}
`;

  const summary = await analyzeDiffWithAI(sampleDiff, { mockMode: true });

  assertEquals(summary.status, "REQUEST_CHANGES");
  assert(summary.hasCriticalIssues);
  assert(summary.inlineComments.length >= 2);

  const securityComment = summary.inlineComments.find((c) => c.category === "security");
  assertExists(securityComment);
  assertEquals(securityComment.path, "src/auth.ts");

  const bugComment = summary.inlineComments.find((c) => c.category === "bug");
  assertExists(bugComment);
});

Deno.test("Reviewer Auto-Merge - guard condition checks", async () => {
  const mockPassingVerification = {
    testResult: { passed: true, command: "test", stdout: "ok", stderr: "", exitCode: 0, durationMs: 100 },
    allPassed: true,
  };
  const mockFailingVerification = {
    testResult: { passed: false, command: "test", stdout: "", stderr: "failed", exitCode: 1, durationMs: 100 },
    allPassed: false,
  };

  const approvedReview = {
    status: "APPROVE" as const,
    score: 95,
    summaryText: "Looks good",
    inlineComments: [],
    hasCriticalIssues: false,
  };
  const rejectedReview = {
    status: "REQUEST_CHANGES" as const,
    score: 40,
    summaryText: "Security risk",
    inlineComments: [],
    hasCriticalIssues: true,
  };

  // 1. Guard check: disabled auto-merge
  const res1 = await attemptAutoMerge({
    prNumber: 1,
    repo: "owner/repo",
    verificationResult: mockPassingVerification,
    reviewSummary: approvedReview,
    autoMergeEnabled: false,
    mockMode: true,
  });
  assertFalse(res1.merged);
  assert(res1.reason.includes("disabled"));

  // 2. Guard check: failing tests block merge
  const res2 = await attemptAutoMerge({
    prNumber: 1,
    repo: "owner/repo",
    verificationResult: mockFailingVerification,
    reviewSummary: approvedReview,
    autoMergeEnabled: true,
    mockMode: true,
  });
  assertFalse(res2.merged);
  assert(res2.reason.toLowerCase().includes("verification checks failed"));

  // 3. Guard check: rejected review blocks merge
  const res3 = await attemptAutoMerge({
    prNumber: 1,
    repo: "owner/repo",
    verificationResult: mockPassingVerification,
    reviewSummary: rejectedReview,
    autoMergeEnabled: true,
    mockMode: true,
  });
  assertFalse(res3.merged);
  assert(res3.reason.includes("REQUEST_CHANGES"));

  // 4. Guard check: all pass -> merge succeeds
  const res4 = await attemptAutoMerge({
    prNumber: 1,
    repo: "owner/repo",
    verificationResult: mockPassingVerification,
    reviewSummary: approvedReview,
    autoMergeEnabled: true,
    mockMode: true,
  });
  assert(res4.merged);
  assert(res4.reason.includes("Successfully auto-merged"));
});

Deno.test("Reviewer Orchestrator - full executePRReview flow simulation", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "herkules_review_orchestrator_" });

  try {
    const result = await executePRReview(
      {
        prNumber: 101,
        autoMerge: true,
        mockMode: true,
        testCommand: `${Deno.execPath()} eval "Deno.exit(0)"`,
        lintCommand: `${Deno.execPath()} eval "Deno.exit(0)"`,
        worktreeRootDir: tempDir,
      },
      Deno.cwd(),
    );

    assertEquals(result.prNumber, 101);
    assert(result.verificationResult.allPassed);
    assertEquals(result.reviewSummary.status, "APPROVE");
    assert(result.autoMergeResult.merged);
    assert(result.success);
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
});
