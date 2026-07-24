export interface WorktreeInfo {
  path: string;
  prId: number | string;
  branch: string;
}

export class WorktreeManager {
  private baseDir: string;

  constructor(baseDir = ".worktrees") {
    this.baseDir = baseDir;
  }

  async setupWorktree(prId: number | string, branch: string): Promise<WorktreeInfo> {
    const worktreePath = `${this.baseDir}/pr-${prId}`;
    
    await Deno.mkdir(this.baseDir, { recursive: true });

    const cmd = new Deno.Command("git", {
      args: ["worktree", "add", "-f", worktreePath, branch],
      stdout: "piped",
      stderr: "piped",
    });
    const output = await cmd.output();
    if (!output.success) {
      const errorText = new TextDecoder().decode(output.stderr);
      throw new Error(`Failed to create worktree at ${worktreePath}: ${errorText}`);
    }

    return {
      path: worktreePath,
      prId,
      branch,
    };
  }

  async removeWorktree(worktreeInfo: WorktreeInfo): Promise<void> {
    const cmd = new Deno.Command("git", {
      args: ["worktree", "remove", "--force", worktreeInfo.path],
      stdout: "piped",
      stderr: "piped",
    });
    const output = await cmd.output();
    if (!output.success) {
      try {
        await Deno.remove(worktreeInfo.path, { recursive: true });
        const pruneCmd = new Deno.Command("git", {
          args: ["worktree", "prune"],
        });
        await pruneCmd.output();
      } catch {
        // Ignore error if worktree path is already cleaned up
      }
    }
  }
}
