/**
 * Herkules CLI Command Module Registry
 *
 * @module cli/commands
 */

export { InstallCommand } from "@cli/commands/install.ts";
export { UninstallCommand } from "@cli/commands/uninstall.ts";
export { ServerCommand } from "@cli/commands/server.ts";
export { ProxyCommand } from "@cli/commands/proxy.ts";
export { ListWorktreesCommand } from "@cli/commands/list_worktrees.ts";
export { CleanWorktreesCommand } from "@cli/commands/clean_worktrees.ts";
export { ReviewerCommand } from "@cli/commands/reviewer.ts";

export const cli_commands = [
  new (await import("@cli/commands/install.ts")).InstallCommand(),
  new (await import("@cli/commands/uninstall.ts")).UninstallCommand(),
  new (await import("@cli/commands/server.ts")).ServerCommand(),
  new (await import("@cli/commands/proxy.ts")).ProxyCommand(),
  new (await import("@cli/commands/list_worktrees.ts")).ListWorktreesCommand(),
  new (await import("@cli/commands/clean_worktrees.ts")).CleanWorktreesCommand(),
  new (await import("@cli/commands/reviewer.ts")).ReviewerCommand(),
];
