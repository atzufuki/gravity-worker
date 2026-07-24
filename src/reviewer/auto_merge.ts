export interface AutoMergeResult {
  merged: boolean;
  reason: string;
}

export interface MergeEvaluationInput {
  autoMergeEnabled: boolean;
  checksPassed: boolean;
  aiApproved: boolean;
  prId: number | string;
  githubToken?: string;
}

export class AutoMerger {
  async evaluateAndMerge(input: MergeEvaluationInput): Promise<AutoMergeResult> {
    if (!input.autoMergeEnabled) {
      return {
        merged: false,
        reason: "Auto-merge is disabled by configuration.",
      };
    }

    if (!input.checksPassed) {
      return {
        merged: false,
        reason: "Auto-merge skipped: Automated test/lint checks failed.",
      };
    }

    if (!input.aiApproved) {
      return {
        merged: false,
        reason: "Auto-merge skipped: AI code review found critical findings or changes requested.",
      };
    }

    if (input.githubToken) {
      const merged = await this.performGitHubMerge(input.prId, input.githubToken);
      if (merged) {
        return {
          merged: true,
          reason: `Successfully auto-merged PR #${input.prId} via GitHub API.`,
        };
      }
    }

    const mergedLocally = await this.performLocalMerge(input.prId);
    if (mergedLocally) {
      return {
        merged: true,
        reason: `Successfully auto-merged PR #${input.prId} locally.`,
      };
    }

    return {
      merged: false,
      reason: `Failed to auto-merge PR #${input.prId}.`,
    };
  }

  private async performGitHubMerge(prId: number | string, token: string): Promise<boolean> {
    try {
      const repo = Deno.env.get("GITHUB_REPOSITORY") || "";
      if (!repo) return false;
      const url = `https://api.github.com/repos/${repo}/pulls/${prId}/merge`;
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({
          merge_method: "squash",
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async performLocalMerge(prId: number | string): Promise<boolean> {
    try {
      const cmd = new Deno.Command("git", {
        args: ["merge", "--no-ff", `pr-${prId}`],
      });
      const output = await cmd.output();
      return output.success;
    } catch {
      return false;
    }
  }
}
