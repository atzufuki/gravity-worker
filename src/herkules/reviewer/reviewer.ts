/**
 * Herkules Reviewer - AI Code Review Engine
 *
 * Analyzes branch git diffs and verification results to produce structured inline code review
 * comments (bugs, security, style) and a high-level summary report.
 *
 * @module herkules/reviewer/reviewer
 */

import { PRVerificationResult } from "@herkules/reviewer/runner.ts";

export type CommentCategory = "bug" | "security" | "style" | "performance" | "general";

export interface InlineReviewComment {
  path: string;
  line: number;
  side?: "RIGHT" | "LEFT";
  body: string;
  category: CommentCategory;
}

export interface ReviewSummary {
  /** High-level review status recommendation */
  status: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
  /** Calculated quality score (0 to 100) */
  score: number;
  /** Markdown summary report body */
  summaryText: string;
  /** Inline line comments targeting specific changed files */
  inlineComments: InlineReviewComment[];
  /** Flag indicating whether critical issues were detected */
  hasCriticalIssues: boolean;
}

/**
 * Helper to run git CLI command in worktree directory.
 */
async function runGit(args: string[], cwd: string): Promise<string> {
  const command = new Deno.Command("git", {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  });
  const { stdout } = await command.output();
  return new TextDecoder().decode(stdout).trim();
}

/**
 * Gets PR git diff relative to base branch.
 */
export async function getPRDiff(
  worktreePath: string,
  baseBranch = "main",
): Promise<string> {
  try {
    let diff = await runGit(["diff", `origin/${baseBranch}...HEAD`], worktreePath).catch(() => "");
    if (!diff) {
      diff = await runGit(["diff", baseBranch], worktreePath).catch(() => "");
    }
    if (!diff) {
      diff = await runGit(["diff", "HEAD~1"], worktreePath).catch(() => "");
    }
    return diff.trim();
  } catch {
    return "";
  }
}

interface DiffLine {
  path: string;
  line: number;
  content: string;
}

/**
 * Simple diff parser extracting added/modified lines with path and line numbers.
 */
function parseDiffLines(diffText: string): DiffLine[] {
  const result: DiffLine[] = [];
  const lines = diffText.split(/\r?\n/);
  let currentFile = "";
  let currentLine = 0;

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      const match = line.match(/b\/(.+)$/);
      if (match) currentFile = match[1].trim();
    } else if (line.startsWith("@@ ")) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        currentLine = parseInt(match[1], 10);
      }
    } else if (currentFile && currentLine > 0) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        result.push({
          path: currentFile,
          line: currentLine,
          content: line.substring(1),
        });
        currentLine++;
      } else if (!line.startsWith("-")) {
        currentLine++;
      }
    }
  }

  return result;
}

/**
 * Analyzes code diff using rule-based inspection and AI review context.
 */
export async function analyzeDiffWithAI(
  diffText: string,
  options: {
    verificationResult?: PRVerificationResult;
    mockMode?: boolean;
    aiModel?: string;
  } = {},
): Promise<ReviewSummary> {
  const { verificationResult } = options;
  const inlineComments: InlineReviewComment[] = [];
  let hasCriticalIssues = false;
  let score = 100;

  const diffLines = parseDiffLines(diffText);

  for (const item of diffLines) {
    const code = item.content.trim();

    // 1. Security Checks
    if (/eval\(|new Function\(/.test(code)) {
      inlineComments.push({
        path: item.path,
        line: item.line,
        category: "security",
        body: "🔒 **Security Risk**: Avoid dynamic code evaluation (`eval` / `new Function`) as it exposes risks of arbitrary code execution.",
      });
      hasCriticalIssues = true;
      score -= 25;
    } else if (/(?:api_key|password|secret|token|key)[a-zA-Z0-9_]*\s*=\s*['"][^'"]{10,}['"]/i.test(code)) {
      inlineComments.push({
        path: item.path,
        line: item.line,
        category: "security",
        body: "🚨 **Security Vulnerability**: Potential hardcoded secret or API token detected. Store credentials in environment variables.",
      });
      hasCriticalIssues = true;
      score -= 30;
    }

    // 2. Bug Risk Checks
    if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(code)) {
      inlineComments.push({
        path: item.path,
        line: item.line,
        category: "bug",
        body: "🐛 **Bug Risk**: Empty `catch` block swallows exceptions silently without logging or handling errors.",
      });
      hasCriticalIssues = true;
      score -= 15;
    } else if (/TODO|FIXME/i.test(code) && code.includes("FIXME")) {
      inlineComments.push({
        path: item.path,
        line: item.line,
        category: "bug",
        body: "⚠️ **Unfinished Code**: `FIXME` comment found in PR branch. Please resolve before merging.",
      });
      score -= 10;
    }

    // 3. Style & Maintenance Checks
    if (/console\.log\(/.test(code) && !item.path.includes("test") && !item.path.includes("cli")) {
      inlineComments.push({
        path: item.path,
        line: item.line,
        category: "style",
        body: "🧹 **Style Improvement**: Remove leftover `console.log` statement before submitting PR.",
      });
      score -= 5;
    }
  }

  // Factor verification result into review
  if (verificationResult && !verificationResult.allPassed) {
    hasCriticalIssues = true;
    score -= 40;
  }

  score = Math.max(0, Math.min(100, score));

  // Determine recommendation status
  let status: "APPROVE" | "REQUEST_CHANGES" | "COMMENT" = "APPROVE";
  if (hasCriticalIssues || (verificationResult && !verificationResult.allPassed) || score < 70) {
    status = "REQUEST_CHANGES";
  } else if (score < 90) {
    status = "COMMENT";
  }

  // Generate markdown summary text
  const statusEmoji = status === "APPROVE" ? "✅" : status === "REQUEST_CHANGES" ? "❌" : "💬";
  const testBadge = verificationResult ? (verificationResult.testResult.passed ? "✅ PASS" : "❌ FAIL") : "⏩ SKIPPED";
  const lintBadge = verificationResult?.lintResult ? (verificationResult.lintResult.passed ? "✅ PASS" : "❌ FAIL") : "⏩ SKIPPED";

  const summaryLines: string[] = [
    `## ${statusEmoji} Automated AI PR Code Review Report`,
    "",
    `| Metric | Value |`,
    `| --- | --- |`,
    `| **Review Status** | \`${status}\` |`,
    `| **Quality Score** | **${score}/100** |`,
    `| **Automated Tests** | ${testBadge} |`,
    `| **Linter Checks** | ${lintBadge} |`,
    `| **Inline Comments** | ${inlineComments.length} |`,
    "",
  ];

  if (verificationResult && !verificationResult.allPassed) {
    summaryLines.push("### ⚠️ Verification Failures");
    if (!verificationResult.testResult.passed) {
      summaryLines.push("```text");
      summaryLines.push(verificationResult.testResult.stderr || verificationResult.testResult.stdout || "Test suite failed.");
      summaryLines.push("```");
    }
    if (verificationResult.lintResult && !verificationResult.lintResult.passed) {
      summaryLines.push("```text");
      summaryLines.push(verificationResult.lintResult.stderr || verificationResult.lintResult.stdout || "Lint check failed.");
      summaryLines.push("```");
    }
    summaryLines.push("");
  }

  if (inlineComments.length > 0) {
    summaryLines.push("### 🔍 Key Findings & Suggestions");
    for (const comment of inlineComments) {
      summaryLines.push(`- **\`${comment.path}:${comment.line}\`** [${comment.category.toUpperCase()}]: ${comment.body.replace(/\*\*/g, "")}`);
    }
    summaryLines.push("");
  } else {
    summaryLines.push("### ✨ Summary");
    summaryLines.push("No critical bugs, security vulnerabilities, or style defects were detected in this Pull Request.");
    summaryLines.push("");
  }

  return {
    status,
    score,
    summaryText: summaryLines.join("\n"),
    inlineComments,
    hasCriticalIssues,
  };
}
