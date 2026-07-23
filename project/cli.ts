#!/usr/bin/env -S deno run -A
/**
 * GravityWorker CLI Entrypoint
 *
 * Universal AI Agent Runner & Orchestrator for Git Worktrees & CI environments.
 *
 * @module project/cli
 */

import { parseArgs } from "@std/cli/parse-args";
import { createWorktree, getWorktreeDiff, isGitRepository, removeWorktree } from "@gravity-worker/git.ts";
import { AgentRunnerFactory } from "@gravity-worker/runner.ts";
import { generateImplementationPlan, generateWalkthrough, saveArtifact } from "@gravity-worker/artifacts.ts";

const VERSION = "0.1.0";

function printHelp() {
  console.log(`
GravityWorker v${VERSION}
Universal AI Agent Runner & Orchestrator for Git Worktrees & CI.

USAGE:
  gravity-worker <command> [options]

COMMANDS:
  run          Execute an agent task (default)
  status       Check status of current worker / worktrees
  version      Print version information
  help         Print this help message

OPTIONS:
  -p, --prompt <text>    Instructions for the AI agent
  -a, --agent <name>     AI agent engine to use (default: "antigravity")
  -i, --issue <number>   GitHub / Git issue ID to process
  -w, --worktree [name]  Run in an isolated Git worktree (default: true)
      --keep-worktree    Keep worktree directory after execution
      --dry-run          Simulate execution without making changes
  -h, --help             Show help for command
  -v, --version          Show version

EXAMPLES:
  # Run a prompt locally in an isolated worktree
  gravity-worker run --prompt "Fix bug in auth middleware"

  # Process a specific GitHub issue with custom agent
  gravity-worker run --issue 42 --agent agy

  # Show version
  gravity-worker --version
`);
}

export async function main(args: string[] = Deno.args) {
  const flags = parseArgs(args, {
    alias: {
      h: "help",
      v: "version",
      p: "prompt",
      a: "agent",
      i: "issue",
      w: "worktree",
    },
    boolean: ["help", "version", "dry-run", "keep-worktree"],
    string: ["prompt", "agent", "issue", "worktree"],
    default: {
      agent: "antigravity",
    },
  });

  const command = flags._[0]?.toString() ?? (flags.prompt || flags.issue ? "run" : "help");

  if (flags.version || command === "version") {
    console.log(`GravityWorker v${VERSION}`);
    return;
  }

  if (flags.help || command === "help") {
    printHelp();
    return;
  }

  switch (command) {
    case "run": {
      const taskId = flags.issue ? `issue-${flags.issue}` : `task-${Date.now()}`;
      const prompt = flags.prompt ?? (flags.issue ? `Fix GitHub issue #${flags.issue}` : "Default task");

      console.log(`\n🚀 GravityWorker v${VERSION} starting task #${taskId}...`);
      console.log(`- Agent Engine: ${flags.agent}`);
      console.log(`- Prompt: "${prompt}"`);

      // 1. Verify Git repo
      if (!await isGitRepository()) {
        console.error("❌ Error: Must be executed inside a Git repository.");
        Deno.exit(1);
      }

      // 2. Create isolated Worktree
      console.log(`\n🌿 Creating Git Worktree for branch gravity-worker/${taskId}...`);
      const worktree = await createWorktree({ taskId });
      console.log(`✓ Worktree ready at: ${worktree.worktreePath}`);

      try {
        // 3. Save Implementation Plan Artifact
        console.log(`\n📝 Generating implementation_plan.md artifact...`);
        const planContent = generateImplementationPlan({
          taskId,
          prompt,
          agentName: flags.agent,
        });
        await saveArtifact(worktree.worktreePath, "implementation_plan.md", planContent);

        // 4. Run Agent
        console.log(`\n🤖 Executing agent (${flags.agent})...`);
        const runner = AgentRunnerFactory.getRunner(flags.agent);
        const result = await runner.run({
          prompt,
          worktreePath: worktree.worktreePath,
          dryRun: flags["dry-run"],
        });

        // 5. Get Diff
        const diff = await getWorktreeDiff(worktree.worktreePath).catch(() => "");

        // 6. Save Walkthrough Artifact
        console.log(`📝 Generating walkthrough.md artifact...`);
        const walkthroughContent = generateWalkthrough({
          taskId,
          prompt,
          agentName: flags.agent,
          output: result.output || (result.success ? "Execution completed successfully." : "Execution failed."),
          diff,
          durationMs: result.durationMs,
        });
        await saveArtifact(worktree.worktreePath, "walkthrough.md", walkthroughContent);

        // 7. Result Summary
        console.log(`\n✨ Task #${taskId} ${result.success ? "COMPLETED" : "FAILED"} in ${(result.durationMs / 1000).toFixed(2)}s`);
        console.log(`- Branch: ${worktree.branchName}`);
        console.log(`- Worktree: ${worktree.worktreePath}`);

        if (!flags["keep-worktree"] && flags["dry-run"]) {
          console.log(`🧹 Cleaning up dry-run worktree...`);
          await removeWorktree(worktree, { deleteBranch: true });
        }
      } catch (err) {
        console.error(`❌ Task execution failed:`, err);
        Deno.exit(1);
      }
      break;
    }
    case "status": {
      console.log(`GravityWorker Status: Ready`);
      break;
    }
    default: {
      console.error(`Unknown command: ${command}`);
      printHelp();
      Deno.exit(1);
    }
  }
}

if (import.meta.main) {
  await main();
}
