/**
 * Herkules Reviewer - Git Provider & GitHub API Subsystem
 *
 * Handles posting PR review comments, overall review summaries, and triggering auto-merges
 * on GitHub when configured guard conditions are met.
 *
 * @module herkules/reviewer/git_provider
 */

import { PRVerificationResult } from "@herkules/reviewer/runner.ts";
import { ReviewSummary } from "@herkules/reviewer/reviewer.ts";

export interface PostReviewOptions {
  prNumber: number;
  repo: string; // "owner/repo"
  summary: ReviewSummary;
  verificationResult?: PRVerificationResult;
  githubToken?: string;
  mockMode?: boolean;
}

export interface AutoMergeOptions {
  prNumber: number;
  repo: string;
  githubToken?: string;
  verificationResult: PRVerificationResult;
  reviewSummary: ReviewSummary;
  autoMergeEnabled: boolean;
  mockMode?: boolean;
}

export interface AutoMergeResult {
  merged: boolean;
  reason: string;
  sha?: string;
}

/**
 * Posts PR review summary and inline comments to GitHub.
 */
export async function postPRReview(
  options: PostReviewOptions,
): Promise<{ reviewId?: string; postedCommentsCount: number; success: boolean }> {
  const { prNumber, repo, summary, githubToken, mockMode = false } = options;

  if (mockMode || !githubToken) {
    console.log(`[Reviewer Mock] Post PR Review for #${prNumber} on ${repo}: Status ${summary.status}, ${summary.inlineComments.length} inline comments.`);
    return {
      reviewId: "mock-review-123",
      postedCommentsCount: summary.inlineComments.length,
      success: true,
    };
  }

  const [owner, repoName] = repo.split("/");
  const url = `https://api.github.com/repos/${owner}/${repoName}/pulls/${prNumber}/reviews`;

  const githubComments = summary.inlineComments.map((c) => ({
    path: c.path,
    line: c.line,
    side: c.side ?? "RIGHT",
    body: c.body,
  }));

  const payload = {
    body: summary.summaryText,
    event: summary.status,
    comments: githubComments,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${githubToken.trim()}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Herkules-PR-Reviewer",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`GitHub Review API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return {
      reviewId: String(data.id),
      postedCommentsCount: summary.inlineComments.length,
      success: true,
    };
  } catch (err) {
    console.warn(`⚠️ Could not post PR review to GitHub: ${err instanceof Error ? err.message : String(err)}`);
    return {
      postedCommentsCount: 0,
      success: false,
    };
  }
}

/**
 * Attempts to automatically merge Pull Request if all guard conditions pass.
 */
export async function attemptAutoMerge(
  options: AutoMergeOptions,
): Promise<AutoMergeResult> {
  const {
    prNumber,
    repo,
    githubToken,
    verificationResult,
    reviewSummary,
    autoMergeEnabled,
    mockMode = false,
  } = options;

  // 1. Guard Condition: Auto-Merge Enabled
  if (!autoMergeEnabled) {
    return {
      merged: false,
      reason: "Auto-merge disabled (flag --auto-merge is false).",
    };
  }

  // 2. Guard Condition: Verification Checks Passed
  if (!verificationResult.allPassed) {
    return {
      merged: false,
      reason: "Auto-merge blocked: Test or lint verification checks failed.",
    };
  }

  // 3. Guard Condition: AI Code Review Approved (No critical issues)
  if (reviewSummary.status !== "APPROVE" || reviewSummary.hasCriticalIssues) {
    return {
      merged: false,
      reason: `Auto-merge blocked: AI code review status is ${reviewSummary.status} or critical issues detected.`,
    };
  }

  // If mock mode, simulate merge success
  if (mockMode || !githubToken) {
    console.log(`[Reviewer Mock] Auto-merged PR #${prNumber} on ${repo}.`);
    return {
      merged: true,
      reason: `Successfully auto-merged PR #${prNumber} (Mock Mode).`,
      sha: "mock-commit-sha-999",
    };
  }

  // Perform actual GitHub PR Merge
  const [owner, repoName] = repo.split("/");
  const mergeUrl = `https://api.github.com/repos/${owner}/${repoName}/pulls/${prNumber}/merge`;

  try {
    const res = await fetch(mergeUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${githubToken.trim()}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Herkules-PR-Reviewer",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        commit_title: `Auto-merge PR #${prNumber} via Herkules AI Reviewer`,
        merge_method: "squash",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        merged: false,
        reason: `GitHub merge API error (${res.status}): ${errText}`,
      };
    }

    const data = await res.json();
    return {
      merged: data.merged ?? true,
      reason: data.message ?? `Successfully merged PR #${prNumber}`,
      sha: data.sha,
    };
  } catch (err) {
    return {
      merged: false,
      reason: `Auto-merge failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
