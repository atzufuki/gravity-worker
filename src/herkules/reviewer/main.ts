/**
 * Herkules Reviewer - Main Orchestrator Subsystem
 *
 * Orchestrates isolated worktree provisioning, verification checks, AI review generation,
 * review posting, and conditional auto-merging for Pull Requests.
 *
 * @module herkules/reviewer/main
 */

import { parseReviewerConfig, ReviewerOptions } from "@herkules/reviewer/config.ts";
import { PRWorktreeInfo, provisionPRWorktree, teardownPRWorktree } from "@herkules/reviewer/worktree.ts";
import { PRVerificationResult, runPRVerification } from "@herkules/reviewer/runner.ts";
import { analyzeDiffWithAI, getPRDiff, ReviewSummary } from "@herkules/reviewer/reviewer.ts";
import { attemptAutoMerge, AutoMergeResult, postPRReview } from "@herkules/reviewer/git_provider.ts";

export interface PRReviewRunOptions extends ReviewerOptions {
  prNumber: number;
  branchName?: string;
  keepWorktree?: boolean;
}

export interface PRReviewRunResult {
  prNumber: number;
  worktree: PRWorktreeInfo;
  verificationResult: PRVerificationResult;
  reviewSummary: ReviewSummary;
  autoMergeResult: AutoMergeResult;
  success: boolean;
}

/**
 * Executes an automated PR code review cycle.
 */
export async function executePRReview(
  options: PRReviewRunOptions,
  cwd?: string,
): Promise<PRReviewRunResult> {
  const config = parseReviewerConfig(options);
  const { prNumber, branchName, keepWorktree = false, mockMode = false } = options;

  console.log(`\n🔍 Starting Automated AI PR Review for PR #${prNumber}...`);
  console.log(`- Auto-Merge: ${config.autoMerge ? "Enabled" : "Disabled"}`);
  console.log(`- Base Branch: ${config.baseBranch}`);

  // 1. Provision isolated worktree
  const worktree = await provisionPRWorktree(
    {
      prNumber,
      branchName,
      baseBranch: config.baseBranch,
      worktreeRootDir: config.worktreeRootDir,
    },
    cwd,
  );
  console.log(`✓ Provisioned worktree at: ${worktree.worktreePath}`);

  try {
    // 2. Run automated verification suite (tests & lints)
    console.log(`🧪 Running automated verification checks in worktree...`);
    const verificationResult = await runPRVerification(worktree.worktreePath, config);
    console.log(`- Test Suite: ${verificationResult.testResult.passed ? "PASS" : "FAIL"}`);
    if (verificationResult.lintResult) {
      console.log(`- Linter: ${verificationResult.lintResult.passed ? "PASS" : "FAIL"}`);
    }

    // 3. Extract diff & generate AI review
    console.log(`🤖 Analyzing code diff & generating review comments...`);
    const diffText = await getPRDiff(worktree.worktreePath, config.baseBranch);
    const reviewSummary = await analyzeDiffWithAI(diffText, {
      verificationResult,
      mockMode,
      aiModel: config.aiModel,
    });
    console.log(`- Review Recommendation: ${reviewSummary.status}`);
    console.log(`- Quality Score: ${reviewSummary.score}/100`);
    console.log(`- Inline Comments Generated: ${reviewSummary.inlineComments.length}`);

    // 4. Post review summary & inline comments
    if (config.repo) {
      console.log(`💬 Posting review summary to ${config.repo} PR #${prNumber}...`);
      await postPRReview({
        prNumber,
        repo: config.repo,
        summary: reviewSummary,
        verificationResult,
        githubToken: config.githubToken,
        mockMode,
      });
    }

    // 5. Evaluate & trigger auto-merge if guard conditions pass
    const autoMergeResult = await attemptAutoMerge({
      prNumber,
      repo: config.repo ?? "owner/repo",
      githubToken: config.githubToken,
      verificationResult,
      reviewSummary,
      autoMergeEnabled: config.autoMerge,
      mockMode,
    });

    if (config.autoMerge) {
      console.log(`🔀 Auto-Merge Status: ${autoMergeResult.merged ? "MERGED" : "BLOCKED"}`);
      console.log(`- Details: ${autoMergeResult.reason}`);
    }

    // 6. Teardown worktree unless requested to keep
    if (!keepWorktree) {
      console.log(`🧹 Tearing down PR worktree...`);
      await teardownPRWorktree(worktree, { deleteBranch: false }, cwd);
    }

    const overallSuccess = verificationResult.allPassed && reviewSummary.status === "APPROVE";

    return {
      prNumber,
      worktree,
      verificationResult,
      reviewSummary,
      autoMergeResult,
      success: overallSuccess,
    };
  } catch (err) {
    if (!keepWorktree) {
      await teardownPRWorktree(worktree, {}, cwd).catch(() => {});
    }
    throw err;
  }
}
