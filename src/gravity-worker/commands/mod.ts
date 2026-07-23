/**
 * GravityWorker Alexi Management Commands
 *
 * @module gravity-worker/commands
 */

import { ListWorktreesCommand } from "./list_worktrees.ts";
import { CleanWorktreesCommand } from "./clean_worktrees.ts";
import { InstallCommand } from "./install.ts";
import { UninstallCommand } from "./uninstall.ts";

export const gravity_worker_commands = [
  ListWorktreesCommand,
  CleanWorktreesCommand,
  InstallCommand,
  UninstallCommand,
];

export * from "./list_worktrees.ts";
export * from "./clean_worktrees.ts";
export * from "./install.ts";
export * from "./uninstall.ts";
