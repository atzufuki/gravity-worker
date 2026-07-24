/**
 * Herkules Reviewer - Git Worktree Subsystem
 *
 * Provisions isolated git worktrees at `.worktrees/pr-<prNumber>` for inspecting
 * Pull Request branches without dirtying the main workspace. Handles setup and cleanup.
 *
 * @module herkules/reviewer/worktree
 */

import { join } from "@std/path";

export interface PRWorktreeInfo {
  /** Path to the provisioned worktree directory */
  worktreePath: string;
  /** PR branch name */
  branchName: string;
  /** PR number or identifier */
  prNumber: number;
  /** Task or worktree identifier */
  taskId: string;
}

export interface ProvisionPRWorktreeOptions {
  prNumber: number;
  branchName?: string;
  baseBranch?: string;
  worktreeRootDir?: string;
  cwd?: string;
}

/**
 * Helper to execute git command and return trimmed output string.
 */
async function runGit(args: string[], cwd?: string): Promise<string> {
  const command = new Deno.Command("git", {
    args,
    cwd,
    env: {
      ...Deno.env.toObject(),
      GIT_TERMINAL_PROMPT: "0",
    },
    stdout: "piped",
    stderr: "piped",
  });

  const { success, stdout, stderr } = await command.output();
  const textDecoder = new TextDecoder();

  if (!success) {
    const errorMsg = textDecoder.decode(stderr).trim() || textDecoder.decode(stdout).trim();
    throw new Error(`Git command failed [git ${args.join(" ")}]: ${errorMsg}`);
  }

  return textDecoder.decode(stdout).trim();
}

/**
 * Provisions an isolated Git worktree for reviewing a Pull Request.
 */
export async function provisionPRWorktree(
  options: ProvisionPRWorktreeOptions,
  cwd?: string,
): Promise<PRWorktreeInfo> {
  const {
    prNumber,
    branchName: rawBranchName,
    baseBranch = "main",
    worktreeRootDir = ".worktrees",
  } = options;

  const baseDir = cwd ?? Deno.cwd();
  const taskId = `pr-${prNumber}`;
  const targetDir = join(baseDir, worktreeRootDir, taskId);
  const branchName = rawBranchName ?? `pr-${prNumber}`;

  // Ensure worktree root directory exists
  await Deno.mkdir(join(baseDir, worktreeRootDir), { recursive: true });

  // 1. Force remove old worktree directory & prune git registration
  await runGit(["worktree", "remove", "--force", targetDir], cwd).catch(() => {});
  await Deno.remove(targetDir, { recursive: true }).catch(() => {});
  await runGit(["worktree", "prune"], cwd).catch(() => {});

  // 2. Attempt fetching PR head branch if remote exists
  try {
    await runGit(["fetch", "origin", `pull/${prNumber}/head:${branchName}`], cwd).catch(() => {});
  } catch {
    // Ignore fetch failure (might be running locally or in mock mode)
  }

  // 3. Create fresh worktree
  try {
    // Check if branch exists
    let branchExists = false;
    try {
      await runGit(["rev-parse", "--verify", branchName], cwd);
      branchExists = true;
    } catch {
      branchExists = false;
    }

    if (branchExists) {
      await runGit(["worktree", "add", "--force", targetDir, branchName], cwd);
    } else {
      await runGit(["worktree", "add", "-B", branchName, targetDir, baseBranch], cwd);
    }
  } catch (_err) {
    await runGit(["worktree", "prune"], cwd).catch(() => {});
    await Deno.mkdir(targetDir, { recursive: true });
  }

  return {
    worktreePath: targetDir,
    branchName,
    prNumber,
    taskId,
  };
}

/**
 * Tears down a provisioned PR git worktree and cleans up the filesystem.
 */
export async function teardownPRWorktree(
  info: PRWorktreeInfo,
  options: { deleteBranch?: boolean } = {},
  cwd?: string,
): Promise<void> {
  const { worktreePath, branchName } = info;

  try {
    await runGit(["worktree", "remove", "--force", worktreePath], cwd);
  } catch {
    await Deno.remove(worktreePath, { recursive: true }).catch(() => {});
    await runGit(["worktree", "prune"], cwd).catch(() => {});
  }

  if (options.deleteBranch) {
    await runGit(["branch", "-D", branchName], cwd).catch(() => {});
  }
}
