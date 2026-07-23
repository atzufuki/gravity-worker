/**
 * Alexi Management Command: remove_app
 *
 * Removes GravityWorker configuration, workflow files, secrets, and worktrees from target repository.
 *
 * @module gravity-worker/commands/remove_app
 */

import { BaseCommand } from "@alexi/core/management";
import { getGitHubContext, getRepoFromGitRemote } from "@gravity-worker/github.ts";

export class RemoveAppCommand extends BaseCommand {
  override name = "remove_app";
  override help = "Removes GravityWorker workflow, secrets, and worktrees from a target repository";

  override async handle(options?: any): Promise<{ exitCode: number }> {
    const targetRepoFlag = typeof options === "string" ? options : options?.repo;
    console.log("🧹 Uninstalling GravityWorker setup...\n");

    let repoSpec: string | undefined;
    let targetDir = ".";

    if (targetRepoFlag) {
      try {
        const stat = await Deno.stat(targetRepoFlag);
        if (stat.isDirectory) {
          targetDir = targetRepoFlag;
          const remoteInfo = await getRepoFromGitRemote(targetDir);
          if (remoteInfo.repoOwner && remoteInfo.repoName) {
            repoSpec = `${remoteInfo.repoOwner}/${remoteInfo.repoName}`;
          }
        }
      } catch {
        if (targetRepoFlag.includes("/")) {
          repoSpec = targetRepoFlag;
        }
      }
    }

    if (!repoSpec) {
      const ghContext = await getGitHubContext();
      if (ghContext.repoOwner && ghContext.repoName) {
        repoSpec = `${ghContext.repoOwner}/${ghContext.repoName}`;
      }
    }

    if (repoSpec) {
      console.log(`📌 Target repository: ${repoSpec}`);
      console.log(`📂 Target directory: ${targetDir}\n`);
    }

    // 1. Remove workflow file
    const workflowPath = `${targetDir}/.github/workflows/gravity-worker.yml`;
    try {
      await Deno.remove(workflowPath);
      console.log(`✓ Removed workflow file: ${workflowPath}`);
    } catch {
      console.log(`ℹ️ Workflow file not found at: ${workflowPath}`);
    }

    // 2. Remove temporary directories (.worktrees, .gravity-worker)
    await Deno.remove(`${targetDir}/.worktrees`, { recursive: true }).catch(() => {});
    await Deno.remove(`${targetDir}/.gravity-worker`, { recursive: true }).catch(() => {});
    console.log("✓ Cleaned temporary worktrees and artifact directories.");

    // 3. Remove GitHub secrets via gh CLI if available
    console.log(`\n🗑️ Removing GitHub secrets from ${repoSpec ?? "target repository"}...`);
    const secrets = ["GRAVITY_WORKER_APP_ID", "GRAVITY_WORKER_PRIVATE_KEY", "GEMINI_API_KEY"];
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
    console.log("✨ GRAVITYWORKER UNINSTALLED SUCCESSFULLY!");
    console.log("=======================================================\n");

    return { exitCode: 0 };
  }
}
