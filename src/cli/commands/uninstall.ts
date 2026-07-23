/**
 * Alexi Management Command: uninstall
 *
 * Removes Herkules configuration, workflow files, secrets, and worktrees from target repository.
 *
 * @module cli/commands/uninstall
 */

import { BaseCommand } from "@alexi/core/management";
import { getRepoFromGitRemote } from "@herkules/github.ts";

export class UninstallCommand extends BaseCommand {
  override name = "uninstall";
  override help = "Removes Herkules workflow, secrets, and worktrees from a target repository";

  override async handle(options?: any): Promise<{ exitCode: number }> {
    const targetRepoFlag = typeof options === "string" ? options : options?.repo;
    console.log("🧹 Uninstalling Herkules setup...\n");

    let repoSpec: string | undefined;
    let targetDir = ".";

    if (targetRepoFlag) {
      try {
        const stat = await Deno.stat(targetRepoFlag);
        if (stat.isDirectory) {
          targetDir = targetRepoFlag;
        }
      } catch {
        if (targetRepoFlag.includes("/")) {
          repoSpec = targetRepoFlag;
        }
      }
    }

    const remoteInfo = await getRepoFromGitRemote(targetDir);
    if (remoteInfo.repoOwner && remoteInfo.repoName) {
      repoSpec = `${remoteInfo.repoOwner}/${remoteInfo.repoName}`;
    }

    if (repoSpec) {
      console.log(`📌 Target repository: ${repoSpec}`);
      console.log(`📂 Target directory: ${targetDir}\n`);
    }

    // 1. Remove workflow file locally and from git tracking
    const workflowRelativePath = ".github/workflows/herkules.yml";
    const workflowPath = `${targetDir}/${workflowRelativePath}`;
    try {
      // Try git rm first
      const gitRmCmd = new Deno.Command("git", {
        args: ["rm", "-f", workflowRelativePath],
        cwd: targetDir,
        stdout: "piped",
        stderr: "piped",
      });
      const gitRmRes = await gitRmCmd.output();

      if (gitRmRes.success) {
        console.log(`✓ Removed workflow file from Git tracking: ${workflowPath}`);

        // Commit and push removal
        const commitCmd = new Deno.Command("git", {
          args: ["commit", "-m", "Remove Herkules workflow"],
          cwd: targetDir,
          stdout: "piped",
          stderr: "piped",
        });
        await commitCmd.output();

        const pushCmd = new Deno.Command("git", {
          args: ["push", "origin", "HEAD"],
          cwd: targetDir,
          stdout: "piped",
          stderr: "piped",
        });
        const pushRes = await pushCmd.output();
        if (pushRes.success) {
          console.log(`✓ Pushed workflow removal to remote GitHub repository.`);
        }
      } else {
        await Deno.remove(workflowPath).catch(() => {});
        console.log(`✓ Removed local workflow file: ${workflowPath}`);
      }
    } catch {
      await Deno.remove(workflowPath).catch(() => {});
      console.log(`ℹ️ Workflow file not found at: ${workflowPath}`);
    }

    // Also remove legacy gravity-worker.yml if present
    await Deno.remove(`${targetDir}/.github/workflows/gravity-worker.yml`).catch(() => {});

    // 2. Remove temporary directories (.worktrees, .herkules, .gravity-worker)
    await Deno.remove(`${targetDir}/.worktrees`, { recursive: true }).catch(() => {});
    await Deno.remove(`${targetDir}/.herkules`, { recursive: true }).catch(() => {});
    await Deno.remove(`${targetDir}/.gravity-worker`, { recursive: true }).catch(() => {});
    await Deno.remove(`${targetDir}/.herkules.json`).catch(() => {});
    await Deno.remove(`${targetDir}/.gravity-worker.json`).catch(() => {});
    console.log("✓ Cleaned temporary worktrees and artifact directories.");

    // 3. Remove GitHub secrets via gh CLI if available
    console.log(`\n🗑️ Removing GitHub secrets from ${repoSpec ?? "target repository"}...`);
    const secrets = ["HERKULES_APP_ID", "HERKULES_PRIVATE_KEY", "HERKULES_LOCAL_URL", "GRAVITY_WORKER_APP_ID", "GRAVITY_WORKER_PRIVATE_KEY", "GRAVITY_WORKER_LOCAL_URL", "GEMINI_API_KEY"];
    for (const secret of secrets) {
      try {
        const args = ["secret", "delete", secret];
        if (repoSpec) args.push("--repo", repoSpec);
        const cmd = new Deno.Command("gh", { args, stdout: "piped", stderr: "piped" });
        const res = await cmd.output();
        if (res.success) {
          console.log(`✓ Deleted secret: ${secret}`);
        }
      } catch {
        // Ignore if gh CLI fails
      }
    }

    console.log("\n=======================================================");
    console.log("✨ HERKULES UNINSTALLED SUCCESSFULLY!");
    console.log("=======================================================");
    console.log("💡 To view or delete registered GitHub Apps from your GitHub account, visit:");
    console.log("   https://github.com/settings/apps\n");

    return { exitCode: 0 };
  }
}
