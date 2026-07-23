/**
 * GravityWorker Alexi Management Commands
 *
 * @module gravity-worker/commands
 */

import { ListWorktreesCommand } from "./list_worktrees.ts";
import { CleanWorktreesCommand } from "./clean_worktrees.ts";
import { SetupAppCommand } from "./setup_app.ts";

export const gravity_worker_commands = [
  ListWorktreesCommand,
  CleanWorktreesCommand,
  SetupAppCommand,
];

export * from "./list_worktrees.ts";
export * from "./clean_worktrees.ts";
export * from "./setup_app.ts";
