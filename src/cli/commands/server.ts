/**
 * Alexi Management Command: server
 *
 * Local Daemon & Issue Listener for Herkules.
 * Continuously watches target GitHub repository for issues labeled with 'herkules',
 * automatically executing tasks locally using Antigravity (agy) / Google AI Ultra subscription.
 * Dynamically tracks label removal and re-labeling to mirror GitHub Actions event triggers.
 *
 * @module cli/commands/server
 */

import { join } from "@std/path";
import { BaseCommand } from "@alexi/core/management";
import { getGitHubContext, getRepoFromGitRemote } from "@herkules/github.ts";

export interface ServerOptions {
  repo?: string;
  intervalMs?: number;
  agent?: string;
}

export async function resolveGitHubToken(): Promise<string | undefined> {
  const envToken = Deno.env.get("GITHUB_TOKEN");
  if (envToken) return envToken;

  try {
    const cmd = new Deno.Command("gh", {
      args: ["auth", "token"],
      stdout: "piped",
      stderr: "piped",
    });
    const output = await cmd.output();
    if (output.success) {
      const token = new TextDecoder().decode(output.stdout).trim();
      if (token) return token;
    }
  } catch {
    // Ignore
  }

  return undefined;
}

export class ServerCommand extends BaseCommand {
  override name = "server";
  override help = "Listen for GitHub issue 'herkules' labels and execute tasks automatically on local workstation";
  private running = true;

  public stop() {
    this.running = false;
  }

  /**
   * Processes a single polling cycle. Exposed for unit & integration testing.
   */
  async processCycle(
    owner: string,
    repo: string,
    targetDir: string,
    processedIssues: Set<number>,
    saveState: () => Promise<void>,
    token?: string,
    agentEngine = "antigravity",
    targetRepoFlag?: string,
    fetchFn: typeof fetch = fetch,
    execFn?: (issueNum: number, issueTitle: string) => Promise<boolean>,
  ): Promise<{ triggeredCount: number; stateChanged: boolean }> {
    let triggeredCount = 0;
    let stateChanged = false;

    const headers: Record<string, string> = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "Herkules-Local-Daemon",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetchFn(`https://api.github.com/repos/${owner}/${repo}/issues?labels=herkules&state=open`, {
      headers,
    });

    if (res.ok) {
      const issues = await res.json();
      if (Array.isArray(issues)) {
        const currentlyLabeledNums = new Set(issues.map((i: any) => i.number));

        // Automatically detect label removal: reset processed state for any issue where label was removed
        for (const processedId of Array.from(processedIssues)) {
          if (!currentlyLabeledNums.has(processedId)) {
            console.log(`ℹ️ Label 'herkules' removed from Issue #${processedId}. Resetting state to re-trigger on next label.`);
            processedIssues.delete(processedId);
            stateChanged = true;
          }
        }
        if (stateChanged) {
          await saveState();
        }

        for (const issue of issues) {
          const issueNum = issue.number;
          const issueTitle = issue.title;

          if (!processedIssues.has(issueNum)) {
            console.log(`\n🎯 New task detected: GitHub Issue #${issueNum} ("${issueTitle}")`);
            triggeredCount++;

            let success = false;
            if (execFn) {
              success = await execFn(issueNum, issueTitle);
            } else {
              // Determine execution binary path dynamically and sanitize Linux (deleted) re-compilation suffix
              let execPath = Deno.execPath();
              if (execPath.endsWith(" (deleted)")) {
                execPath = execPath.substring(0, execPath.length - " (deleted)".length);
              }
              try {
                await Deno.stat(execPath);
              } catch {
                const localBinary = join(Deno.cwd(), "herkules");
                try {
                  await Deno.stat(localBinary);
                  execPath = localBinary;
                } catch {
                  // Keep execPath
                }
              }

              const targetRepoArg = targetRepoFlag ?? `${owner}/${repo}`;
              const runArgs = execPath.endsWith("deno")
                ? ["run", "-A", `${Deno.cwd()}/src/cli/cli.ts`, "run", "--issue", String(issueNum), "--prompt", issueTitle, "--agent", agentEngine, "--repo", targetRepoArg]
                : ["run", "--issue", String(issueNum), "--prompt", issueTitle, "--agent", agentEngine, "--repo", targetRepoArg];

              const childEnv = { ...Deno.env.toObject() };
              if (token) {
                childEnv["GITHUB_TOKEN"] = token;
              }

              const runCmd = new Deno.Command(execPath, {
                args: runArgs,
                cwd: targetDir,
                env: childEnv,
                stdout: "inherit",
                stderr: "inherit",
              });

              console.log(`🚀 Triggering local execution for Issue #${issueNum} in ${targetDir}...`);
              const process = runCmd.spawn();
              const status = await process.status;
              success = status.success;
            }

            if (success) {
              processedIssues.add(issueNum);
              await saveState();
              console.log(`✓ Completed local processing for Issue #${issueNum}.\n`);
            } else {
              console.log(`⚠️ Processing for Issue #${issueNum} ended with status code 1. Will retry on next check.\n`);
            }
          }
        }
      }
    } else {
      const errText = await res.text();
      console.warn(`[Daemon Warning] GitHub API returned ${res.status}: ${errText.substring(0, 100)}`);
    }

    return { triggeredCount, stateChanged };
  }

  override async handle(options?: any): Promise<{ exitCode: number }> {
    const targetRepoFlag = typeof options === "string" ? options : options?.repo;
    const agentEngine = (typeof options === "object" && options?.agent) ? options.agent : "antigravity";
    const pollInterval = (typeof options === "object" && options?.interval) ? parseInt(options.interval, 10) * 1000 : 1000;

    let targetDir = ".";
    let repoSpec: string | undefined;

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
          const [_, repoName] = targetRepoFlag.split("/");
          // Check sibling or common code directories for local checkout matching repoName
          const possibleDirs = [
            join(Deno.cwd(), "..", repoName),
            join(Deno.env.get("HOME") ?? "", "Code", repoName),
            join(Deno.cwd(), repoName),
          ];
          for (const dir of possibleDirs) {
            try {
              const stat = await Deno.stat(dir);
              if (stat.isDirectory) {
                targetDir = dir;
                break;
              }
            } catch {
              // Continue
            }
          }
        }
      }
    }

    if (!repoSpec) {
      const ghContext = await getGitHubContext(targetDir);
      if (ghContext.repoOwner && ghContext.repoName) {
        repoSpec = `${ghContext.repoOwner}/${ghContext.repoName}`;
      }
    }

    if (!repoSpec) {
      console.error("❌ Error: Could not determine target GitHub repository owner/name.");
      console.error("   Specify target repo using: ./herkules server --repo owner/repo");
      return { exitCode: 1 };
    }

    const token = await resolveGitHubToken();
    const [owner, repo] = repoSpec.split("/");

    console.log("=======================================================");
    console.log("📡 HERKULES LOCAL DAEMON & ISSUE WATCHER STARTED");
    console.log("=======================================================");
    console.log(`- Target Repository: ${owner}/${repo}`);
    console.log(`- Target Directory:  ${targetDir}`);
    console.log(`- Agent Engine:      ${agentEngine.toUpperCase()} (Local Machine)`);
    console.log(`- Watch Label:       herkules`);
    console.log(`- Polling Interval:  ${pollInterval / 1000}s`);
    console.log(`- GitHub Auth:       ${token ? "Authenticated (via gh / token)" : "Anonymous (Public Repos only)"}`);
    console.log("-------------------------------------------------------");
    console.log("Listening for labeled issues on GitHub... Press Ctrl+C to stop.\n");

    const processedIssues = new Set<number>();
    const stateFile = `${targetDir}/.herkules-processed.json`;

    try {
      const text = await Deno.readTextFile(stateFile);
      const arr = JSON.parse(text);
      if (Array.isArray(arr)) {
        arr.forEach((id) => processedIssues.add(id));
      }
    } catch {
      // Ignore if state file doesn't exist yet
    }

    const saveState = async () => {
      try {
        await Deno.writeTextFile(stateFile, JSON.stringify(Array.from(processedIssues), null, 2));
      } catch {
        // Ignore
      }
    };

    while (this.running) {
      try {
        await this.processCycle(
          owner,
          repo,
          targetDir,
          processedIssues,
          saveState,
          token,
          agentEngine,
          targetRepoFlag,
        );
      } catch (e) {
        console.warn(`[Daemon Watcher Warning] Error checking GitHub issues:`, e);
      }

      if (options.once) {
        break;
      }

      await new Promise((r) => setTimeout(r, pollInterval));
    }

    return { exitCode: 0 };
  }
}
