/**
 * Alexi Management Command: clean_worktrees
 */

import { BaseCommand } from "@alexi/core/management";

export class CleanWorktreesCommand extends BaseCommand {
  override name = "clean_worktrees";
  override help = "Prune and clean stale GravityWorker Git worktrees";

  override async handle(): Promise<{ exitCode: number }> {
    console.log("Pruning stale Git worktrees...");
    const command = new Deno.Command("git", {
      args: ["worktree", "prune"],
      stdout: "piped",
    });
    await command.output();
    console.log("✓ Stale worktrees pruned successfully.");
    return { exitCode: 0 };
  }
}
