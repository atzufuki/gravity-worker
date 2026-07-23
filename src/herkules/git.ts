/**
 * Herkules - Git Operations & Worktree Subsystem
 *
 * Handles creation and lifecycle management of isolated Git worktrees,
 * branch naming conventions (fix/ID-task), diff generation, committing, and pushing.
 *
 * @module herkules/git
 */

import { join } from "@std/path";
import { generateConventionalMetadata } from "@herkules/conventional.ts";

export interface WorktreeInfo {
  worktreePath: string;
  branchName: string;
  taskId: string;
}

export interface CreateWorktreeOptions {
  taskId: string;
  prompt?: string;
  issueNumber?: number;
  baseBranch?: string;
  worktreeRootDir?: string;
  reuseBranch?: boolean;
}

/**
 * Helper to run git CLI commands inside specified directory.
 */
async function runGit(args: string[], cwd?: string): Promise<string> {
  const command = new Deno.Command("git", {
    args,
    cwd,
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
 * Checks if current directory is inside a Git repository.
 */
export async function isGitRepository(cwd?: string): Promise<boolean> {
  try {
    const res = await runGit(["rev-parse", "--is-inside-work-tree"], cwd);
    return res === "true";
  } catch {
    return false;
  }
}

/**
 * Gets current branch name.
 */
export async function getCurrentBranch(cwd?: string): Promise<string> {
  return await runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
}

/**
 * Creates an isolated Git worktree for a task using standard branch naming (e.g. feat/48-slug).
 * Always resets branch to baseBranch (main) and purges old remote task branches to guarantee fresh PR creation.
 */
export async function createWorktree(
  options: CreateWorktreeOptions,
  cwd?: string,
): Promise<WorktreeInfo> {
  const { taskId, prompt, issueNumber, baseBranch, worktreeRootDir = ".worktrees", reuseBranch = false } = options;
  const branchName = prompt
    ? generateConventionalMetadata(prompt, issueNumber).branchName
    : (issueNumber ? `fix/${issueNumber}-${taskId}` : `herkules/${taskId}`);

  const baseDir = cwd ?? Deno.cwd();
  const targetDir = join(baseDir, worktreeRootDir, taskId);

  // Ensure root worktree dir exists
  await Deno.mkdir(join(baseDir, worktreeRootDir), { recursive: true });

  // 1. Force remove old worktree directory & prune git registration
  await runGit(["worktree", "remove", "--force", targetDir], cwd).catch(() => {});
  await Deno.remove(targetDir, { recursive: true }).catch(() => {});
  await runGit(["worktree", "prune"], cwd).catch(() => {});

  const currentBranch = baseBranch ?? await getCurrentBranch(cwd).catch(() => "main");

  // 2. Delete old local & remote task branch if not explicitly reusing, to ensure a fresh PR can be created on GitHub
  if (!reuseBranch) {
    await runGit(["branch", "-D", branchName], cwd).catch(() => {});
    await runGit(["push", "origin", "--delete", branchName], cwd).catch(() => {});
  }

  // 3. Check if target branch already exists locally
  let branchExists = false;
  if (reuseBranch) {
    try {
      await runGit(["rev-parse", "--verify", branchName], cwd);
      branchExists = true;
    } catch {
      branchExists = false;
    }
  }

  // 4. Create fresh worktree branch off main (using -B to force reset branch to main)
  try {
    if (branchExists) {
      await runGit(["worktree", "add", "--force", targetDir, branchName], cwd);
    } else {
      await runGit(["worktree", "add", "-B", branchName, targetDir, currentBranch], cwd);
    }
  } catch (_err) {
    await runGit(["worktree", "prune"], cwd).catch(() => {});
    if (branchExists) {
      await runGit(["worktree", "add", "-f", targetDir, branchName], cwd);
    } else {
      await runGit(["worktree", "add", "-f", "-B", branchName, targetDir, currentBranch], cwd);
    }
  }

  return {
    worktreePath: targetDir,
    branchName,
    taskId,
  };
}

/**
 * Removes a Git worktree and optionally deletes its branch.
 */
export async function removeWorktree(
  worktreeInfo: WorktreeInfo,
  options: { deleteBranch?: boolean } = {},
  cwd?: string,
): Promise<void> {
  const { worktreePath, branchName } = worktreeInfo;

  try {
    await runGit(["worktree", "remove", "--force", worktreePath], cwd);
  } catch {
    // Fallback if worktree dir exists without git registration
    await Deno.remove(worktreePath, { recursive: true }).catch(() => {});
    await runGit(["worktree", "prune"], cwd).catch(() => {});
  }

  if (options.deleteBranch) {
    await runGit(["branch", "-D", branchName], cwd).catch(() => {});
  }
}

/**
 * Gets git diff for code changes inside a worktree, strictly excluding Herkules artifact reports.
 */
export async function getWorktreeDiff(worktreePath: string): Promise<string> {
  // Mark untracked files with intent-to-add so new source code files appear in git diff HEAD output
  await runGit(["add", "-N", "."], worktreePath).catch(() => {});
  // Exclude .herkules/ directory and artifact files from diff output
  await runGit(["reset", "HEAD", "--", ".herkules", "implementation_plan.md", "walkthrough.md"], worktreePath).catch(() => {});

  const rawDiff = await runGit(["diff", "HEAD", "--", ".", ":(exclude).herkules", ":(exclude)implementation_plan.md", ":(exclude)walkthrough.md"], worktreePath).catch(() => "");
  return rawDiff.trim();
}

/**
 * Checks if worktree has uncommitted or untracked code changes (strictly ignoring Herkules artifact reports).
 */
export async function hasChanges(worktreePath: string): Promise<boolean> {
  const status = await runGit(["status", "--porcelain"], worktreePath);
  const codeLines = status.split("\n").filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.includes(".herkules") || trimmed.includes("implementation_plan.md") || trimmed.includes("walkthrough.md")) {
      return false;
    }
    return true;
  });
  return codeLines.length > 0;
}

/**
 * Commits code changes in a worktree, strictly excluding Herkules artifact reports.
 * If no new staged code changes exist, creates an empty commit to ensure GitHub PR creation succeeds on re-runs.
 */
export async function commitWorktreeChanges(
  worktreePath: string,
  message: string,
  botName = "herkules[bot]",
  botEmail = "4375516+herkules[bot]@users.noreply.github.com",
): Promise<boolean> {
  await runGit(["config", "user.name", botName], worktreePath);
  await runGit(["config", "user.email", botEmail], worktreePath);
  await runGit(["add", "-A"], worktreePath);
  // Remove .herkules/ directory and artifact files from git staging area
  await runGit(["reset", "HEAD", "--", ".herkules", "implementation_plan.md", "walkthrough.md"], worktreePath).catch(() => {});
  await runGit(["rm", "-rf", "--cached", ".herkules", "implementation_plan.md", "walkthrough.md"], worktreePath).catch(() => {});

  // Check if anything remains staged to commit
  const stagedStatus = await runGit(["diff", "--cached", "--name-only"], worktreePath).catch(() => "");
  if (!stagedStatus.trim()) {
    // Force a fresh commit so GitHub API receives a new commit on re-run PR creation
    await runGit(["commit", "--allow-empty", "-m", `re-trigger: ${message}`], worktreePath).catch(() => {});
    return true;
  }

  await runGit(["commit", "-m", message], worktreePath);
  return true;
}

/**
 * Pushes worktree branch to remote repository using --force-with-lease to safely update existing PR branches.
 */
export async function pushWorktreeBranch(
  worktreePath: string,
  branchName: string,
  remote = "origin",
  force = true,
): Promise<void> {
  const args = ["push", "-u", remote, branchName];
  if (force) {
    args.push("--force-with-lease");
  }
  await runGit(args, worktreePath);
}
