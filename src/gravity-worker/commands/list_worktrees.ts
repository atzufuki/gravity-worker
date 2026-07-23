/**
 * Alexi Management Command: list_worktrees
 */

import { BaseCommand } from "@alexi/core/management";

export class ListWorktreesCommand extends BaseCommand {
  override name = "list_worktrees";
  override help = "List all active GravityWorker Git worktrees";

  override async handle(): Promise<{ exitCode: number }> {
    console.log("Listing active Git worktrees:\n");
    const command = new Deno.Command("git", {
      args: ["worktree", "list"],
      stdout: "piped",
    });
    const output = await command.output();
    console.log(new TextDecoder().decode(output.stdout));
    return { exitCode: 0 };
  }
}
