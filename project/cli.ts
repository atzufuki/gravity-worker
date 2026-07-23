#!/usr/bin/env -S deno run -A
/**
 * GravityWorker CLI Entrypoint
 *
 * Universal AI Agent Runner & Orchestrator for Git Worktrees & CI environments.
 *
 * @module project/cli
 */

import { parseArgs } from "@std/cli/parse-args";
import {
  commitWorktreeChanges,
  createWorktree,
  getWorktreeDiff,
  hasChanges,
  isGitRepository,
  pushWorktreeBranch,
  removeWorktree,
} from "@gravity-worker/git.ts";
import { AgentRunnerFactory } from "@gravity-worker/runner.ts";
import { generateImplementationPlan, generateWalkthrough, saveArtifact } from "@gravity-worker/artifacts.ts";
import { createPullRequest, getGitHubContext, postIssueComment } from "@gravity-worker/github.ts";

const VERSION = "0.1.0";

function printHelp() {
  console.log(`
GravityWorker v${VERSION}
Universal AI Agent Runner & Orchestrator for Git Worktrees & CI.

USAGE:
  gravity-worker <command> [options]

COMMANDS:
  run          Execute an agent task (default)
  setup-app    Automated creation of @gravity-worker[bot] GitHub App
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
  # Automated GitHub App setup
  gravity-worker setup-app

  # Run a prompt locally in an isolated worktree
  gravity-worker run --prompt "Fix bug in auth middleware"

  # Process a specific GitHub issue with custom agent
  gravity-worker run --issue 42 --agent agy
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
    case "setup-app": {
      const { SetupAppCommand } = await import("@gravity-worker/commands/setup_app.ts");
      const cmd = new SetupAppCommand();
      const res = await cmd.handle();
      Deno.exit(res.exitCode);
      break;
    }
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

      // 2. Post human-friendly start acknowledgement comment to GitHub Issue if running in CI
      const githubToken = Deno.env.get("GITHUB_TOKEN");
      const ghContext = await getGitHubContext();

      if (githubToken && ghContext.repoOwner && ghContext.repoName && ghContext.issueNumber) {
        console.log(`💬 Posting start acknowledgement comment to GitHub Issue #${ghContext.issueNumber}...`);
        await postIssueComment({
          owner: ghContext.repoOwner,
          repo: ghContext.repoName,
          issueNumber: ghContext.issueNumber,
          body: `Otan tämän työn alle! 🚀 Työstän ratkaisua taustalla eristetyssä worktreessä (\`gravity-worker/${taskId}\`) ja avaan PR:n heti kun se on valmis.`,
          token: githubToken,
        });
      }

      // 3. Create isolated Worktree
      console.log(`\n🌿 Creating Git Worktree for branch gravity-worker/${taskId}...`);
      const worktree = await createWorktree({ taskId });
      console.log(`✓ Worktree ready at: ${worktree.worktreePath}`);

      try {
        // 4. Save Implementation Plan Artifact in hidden .gravity-worker/ (isolated from target repo commits)
        console.log(`\n📝 Generating implementation_plan.md artifact...`);
        const planContent = generateImplementationPlan({
          taskId,
          prompt,
          agentName: flags.agent,
        });
        await saveArtifact(worktree.worktreePath, ".gravity-worker/implementation_plan.md", planContent);

        // 5. Run Agent
        console.log(`\n🤖 Executing agent (${flags.agent})...`);
        const runner = AgentRunnerFactory.getRunner(flags.agent);
        const result = await runner.run({
          prompt,
          worktreePath: worktree.worktreePath,
          dryRun: flags["dry-run"],
        });

        // 6. Get Diff before committing
        const diff = await getWorktreeDiff(worktree.worktreePath).catch(() => "");

        // 7. Save Walkthrough Artifact in hidden .gravity-worker/ (isolated from target repo commits)
        console.log(`📝 Generating walkthrough.md artifact...`);
        const walkthroughContent = generateWalkthrough({
          taskId,
          prompt,
          agentName: flags.agent,
          output: result.output || (result.success ? "Execution completed successfully." : "Execution failed."),
          diff,
          durationMs: result.durationMs,
        });
        await saveArtifact(worktree.worktreePath, ".gravity-worker/walkthrough.md", walkthroughContent);

        // 8. Commit & Push Worktree Changes if modified & success (artifacts in .gravity-worker/ are strictly excluded from commit)
        if (result.success && !flags["dry-run"] && await hasChanges(worktree.worktreePath)) {
          console.log(`\n📤 Committing & pushing branch ${worktree.branchName}...`);
          await commitWorktreeChanges(worktree.worktreePath, `Fix #${taskId}: ${prompt}`);
          await pushWorktreeBranch(worktree.worktreePath, worktree.branchName).catch((e) => {
            console.warn(`[Git Push Warning] ${e.message}`);
          });

          // 9. Create GitHub Pull Request linked with "Closes #issue" & Comment
          if (githubToken && ghContext.repoOwner && ghContext.repoName) {
            console.log(`\n🔀 Creating GitHub Pull Request...`);
            const closesKeyword = ghContext.issueNumber ? `\n\nCloses #${ghContext.issueNumber}` : "";
            const prBody = `${walkthroughContent}${closesKeyword}`;

            const prUrl = await createPullRequest({
              owner: ghContext.repoOwner,
              repo: ghContext.repoName,
              head: worktree.branchName,
              base: "main",
              title: `[GravityWorker] Fix #${taskId}: ${prompt}`,
              body: prBody,
              token: githubToken,
            });

            if (prUrl) {
              console.log(`✓ Pull Request created: ${prUrl}`);

              if (ghContext.issueNumber) {
                console.log(`💬 Posting completion comment to GitHub Issue #${ghContext.issueNumber}...`);
                await postIssueComment({
                  owner: ghContext.repoOwner,
                  repo: ghContext.repoName,
                  issueNumber: ghContext.issueNumber,
                  body: `Sain tehtävän valmiiksi! 🎉\n\n**Pull Request:** ${prUrl}\n\n${walkthroughContent}`,
                  token: githubToken,
                });
              }
            }
          }
        }

        // 10. Result Summary
        console.log(`\n✨ Task #${taskId} ${result.success ? "COMPLETED" : "FAILED"} in ${(result.durationMs / 1000).toFixed(2)}s`);
        console.log(`- Branch: ${worktree.branchName}`);
        console.log(`- Worktree: ${worktree.worktreePath}`);

        if (result.error) {
          console.error(`⚠️ Agent Error: ${result.error}`);
        }

        if (!flags["keep-worktree"] && flags["dry-run"]) {
          console.log(`🧹 Cleaning up dry-run worktree...`);
          await removeWorktree(worktree, { deleteBranch: true });
        }

        if (!result.success) {
          Deno.exit(1);
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
