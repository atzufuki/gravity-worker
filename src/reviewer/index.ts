import { parseReviewerConfig, ReviewerConfig } from "./config.ts";
import { WorktreeManager, WorktreeInfo } from "./worktree.ts";
import { VerificationChecker, CheckResult } from "./checker.ts";
import { AIReviewer, AIReviewResult } from "./ai_reviewer.ts";
import { AutoMerger, AutoMergeResult } from "./auto_merge.ts";

export interface ReviewerPipelineResult {
  prId: number | string;
  worktree: WorktreeInfo;
  checks: CheckResult;
  aiReview: AIReviewResult;
  autoMerge: AutoMergeResult;
  success: boolean;
}

export class ReviewerOrchestrator {
  private config: ReviewerConfig;
  private worktreeMgr: WorktreeManager;
  private checker: VerificationChecker;
  private aiReviewer: AIReviewer;
  private autoMerger: AutoMerger;

  constructor(config?: Partial<ReviewerConfig>) {
    this.config = {
      ...parseReviewerConfig(),
      ...config,
    };
    this.worktreeMgr = new WorktreeManager(this.config.worktreeDir);
    this.checker = new VerificationChecker();
    this.aiReviewer = new AIReviewer(undefined, this.config.aiModel);
    this.autoMerger = new AutoMerger();
  }

  async runReview(prId: number | string, branch: string, diffText = ""): Promise<ReviewerPipelineResult> {
    let worktree: WorktreeInfo | null = null;
    try {
      worktree = await this.worktreeMgr.setupWorktree(prId, branch);

      const checks = await this.checker.runChecks(
        worktree.path,
        this.config.testCommand,
        this.config.lintCommand
      );

      const aiReview = await this.aiReviewer.reviewDiff(diffText);

      const autoMerge = await this.autoMerger.evaluateAndMerge({
        autoMergeEnabled: this.config.autoMerge,
        checksPassed: checks.passed,
        aiApproved: aiReview.approved,
        prId,
        githubToken: this.config.githubToken,
      });

      return {
        prId,
        worktree,
        checks,
        aiReview,
        autoMerge,
        success: checks.passed && aiReview.approved,
      };
    } finally {
      if (worktree) {
        await this.worktreeMgr.removeWorktree(worktree);
      }
    }
  }
}

export * from "./config.ts";
export * from "./worktree.ts";
export * from "./checker.ts";
export * from "./ai_reviewer.ts";
export * from "./auto_merge.ts";
