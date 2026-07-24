/**
 * Herkules Reviewer - Configuration & Options Parser
 *
 * Manages configuration settings for PR code reviewer, including auto-merge flags,
 * verification commands, and review thresholds.
 *
 * @module herkules/reviewer/config
 */

import { parseArgs } from "@std/cli/parse-args";

export type SeverityLevel = "bug" | "security" | "style" | "none";

export interface ReviewerConfig {
  /** Whether auto-merge is enabled when all checks & reviews pass */
  autoMerge: boolean;
  /** Command to execute test suite (default: "deno task test" or "npm test") */
  testCommand?: string;
  /** Command to execute lint suite (default: "deno lint" or "npm run lint") */
  lintCommand?: string;
  /** Minimum severity level that blocks auto-merge */
  minSeverityToBlockMerge: SeverityLevel;
  /** Root directory for provisioning isolated worktrees */
  worktreeRootDir: string;
  /** Target base branch for PR diff comparison (default: "main") */
  baseBranch: string;
  /** AI model to use for review (default: "antigravity") */
  aiModel: string;
  /** GitHub personal access token or App token */
  githubToken?: string;
  /** GitHub repository spec (owner/repo) */
  repo?: string;
}

export interface ReviewerOptions extends Partial<ReviewerConfig> {
  prNumber?: number;
  branchName?: string;
  mockMode?: boolean;
}

/**
 * Default configuration values for @herkules/reviewer
 */
export const DEFAULT_REVIEWER_CONFIG: ReviewerConfig = {
  autoMerge: false,
  minSeverityToBlockMerge: "bug",
  worktreeRootDir: ".worktrees",
  baseBranch: "main",
  aiModel: "antigravity",
};

/**
 * Resolves final ReviewerConfig by merging options with environment variables and defaults.
 */
export function parseReviewerConfig(options: ReviewerOptions = {}): ReviewerConfig {
  const envAutoMerge = Deno.env.get("HERKULES_AUTO_MERGE");
  const autoMergeFromEnv = envAutoMerge === "true" || envAutoMerge === "1";

  const githubToken = options.githubToken ?? Deno.env.get("GITHUB_TOKEN");
  const repo = options.repo ?? Deno.env.get("GITHUB_REPOSITORY");

  return {
    autoMerge: options.autoMerge ?? autoMergeFromEnv ?? DEFAULT_REVIEWER_CONFIG.autoMerge,
    testCommand: options.testCommand ?? Deno.env.get("HERKULES_TEST_CMD"),
    lintCommand: options.lintCommand ?? Deno.env.get("HERKULES_LINT_CMD"),
    minSeverityToBlockMerge: options.minSeverityToBlockMerge ?? DEFAULT_REVIEWER_CONFIG.minSeverityToBlockMerge,
    worktreeRootDir: options.worktreeRootDir ?? DEFAULT_REVIEWER_CONFIG.worktreeRootDir,
    baseBranch: options.baseBranch ?? DEFAULT_REVIEWER_CONFIG.baseBranch,
    aiModel: options.aiModel ?? DEFAULT_REVIEWER_CONFIG.aiModel,
    githubToken,
    repo,
  };
}

/**
 * Parses command line arguments into ReviewerOptions.
 */
export function parseReviewerArgs(args: string[]): ReviewerOptions & { prNumber?: number } {
  const flags = parseArgs(args, {
    alias: {
      p: "pr",
      b: "branch",
      r: "repo",
      m: "auto-merge",
      t: "test-cmd",
      l: "lint-cmd",
    },
    boolean: ["auto-merge", "mock"],
    string: ["pr", "branch", "repo", "base-branch", "test-cmd", "lint-cmd", "model"],
  });

  const prNumber = flags.pr ? parseInt(String(flags.pr), 10) : (flags._[0] ? parseInt(String(flags._[0]), 10) : undefined);

  return {
    prNumber: isNaN(Number(prNumber)) ? undefined : prNumber,
    branchName: flags.branch,
    repo: flags.repo,
    baseBranch: flags["base-branch"],
    autoMerge: flags["auto-merge"],
    testCommand: flags["test-cmd"],
    lintCommand: flags["lint-cmd"],
    aiModel: flags.model,
    mockMode: flags.mock,
  };
}
