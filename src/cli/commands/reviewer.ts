/**
 * Alexi Management Command: review / reviewer
 *
 * Runs automated PR code reviewer with configurable auto-merge in isolated Git worktree.
 *
 * @module cli/commands/reviewer
 */

import { BaseCommand } from "@alexi/core/management";
import { executePRReview } from "@herkules/reviewer/main.ts";
import { parseReviewerArgs } from "@herkules/reviewer/config.ts";

export class ReviewerCommand extends BaseCommand {
  override name = "review";
  override help = "Automated AI PR code reviewer with configurable auto-merge";

  override async handle(options?: any): Promise<{ exitCode: number }> {
    try {
      const rawArgs = Array.isArray(options?._) ? options._ : [];
      const parsed = parseReviewerArgs(rawArgs);

      const prNumber = options?.pr ?? parsed.prNumber;
      if (!prNumber) {
        console.error("❌ Error: --pr <number> or PR ID positional argument is required.");
        console.log("Usage: herkules review --pr <number> [--auto-merge] [--repo owner/repo]");
        return { exitCode: 1 };
      }

      const result = await executePRReview({
        prNumber,
        branchName: options?.branch ?? parsed.branchName,
        autoMerge: options?.["auto-merge"] ?? options?.autoMerge ?? parsed.autoMerge,
        testCommand: options?.["test-cmd"] ?? options?.testCommand ?? parsed.testCommand,
        lintCommand: options?.["lint-cmd"] ?? options?.lintCommand ?? parsed.lintCommand,
        repo: options?.repo ?? parsed.repo,
        baseBranch: options?.["base-branch"] ?? options?.baseBranch ?? parsed.baseBranch,
        mockMode: options?.mock ?? parsed.mockMode,
      });

      return { exitCode: result.success ? 0 : 1 };
    } catch (err) {
      console.error(`❌ PR Review failed:`, err instanceof Error ? err.message : String(err));
      return { exitCode: 1 };
    }
  }
}
