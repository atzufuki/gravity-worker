/**
 * Alexi Management Command: install
 *
 * Flexible Setup & Installation for GravityWorker.
 * Supports:
 *  1) ☁️ GitHub Actions CI / Cloud Automation (Uses GEMINI_API_KEY + GitHub App)
 *  2) 💻 Local Worktree Daemon / CLI (Uses Antigravity / agy with Google AI Ultra or Gemini API)
 *
 * @module gravity-worker/commands/install
 */

import { BaseCommand } from "@alexi/core/management";
import {
  createWorkflowFile,
  enableRepoWorkflowPermissions,
  listenForManifestCallback,
  setRepoSecretWithGh,
} from "@gravity-worker/github_app.ts";
import { getGitHubContext, getRepoFromGitRemote } from "@gravity-worker/github.ts";

function openBrowser(url: string) {
  try {
    if (Deno.build.os === "linux") {
      new Deno.Command("xdg-open", { args: [url] }).spawn();
    } else if (Deno.build.os === "darwin") {
      new Deno.Command("open", { args: [url] }).spawn();
    } else if (Deno.build.os === "windows") {
      new Deno.Command("cmd", { args: ["/c", "start", url] }).spawn();
    }
  } catch {
    // Ignore browser open errors
  }
}

async function resolveGeminiApiKey(options?: any, targetDir = "."): Promise<string | undefined> {
  if (typeof options === "object" && (options?.geminiApiKey || options?.key)) {
    return options.geminiApiKey ?? options.key;
  }

  let key = Deno.env.get("GEMINI_API_KEY");
  if (key) return key;

  try {
    const text = await Deno.readTextFile(`${targetDir}/.env`);
    const match = text.match(/GEMINI_API_KEY=["']?([^"'\r\n]+)["']?/);
    if (match?.[1]) return match[1];
  } catch {
    // Ignore
  }

  try {
    const text = await Deno.readTextFile(".env");
    const match = text.match(/GEMINI_API_KEY=["']?([^"'\r\n]+)["']?/);
    if (match?.[1]) return match[1];
  } catch {
    // Ignore
  }

  return undefined;
}

export class InstallCommand extends BaseCommand {
  override name = "install";
  override help = "Setup & Installation of GravityWorker for GitHub Actions CI or Local Workstations";

  override async handle(options?: any): Promise<{ exitCode: number }> {
    const targetRepoFlag = typeof options === "string" ? options : options?.repo;

    console.log("🤖 Starting GravityWorker Setup & Installation Wizard...\n");

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
      const ghContext = await getGitHubContext(targetDir);
      if (ghContext.repoOwner && ghContext.repoName) {
        repoSpec = `${ghContext.repoOwner}/${ghContext.repoName}`;
      }
    }

    if (repoSpec) {
      console.log(`📌 Target repository: ${repoSpec}`);
      console.log(`📂 Target directory:  ${targetDir}\n`);
    } else {
      console.log(`📌 Target directory:  ${targetDir}\n`);
    }

    // Interactive Step 1: Select Execution Environment
    console.log("🌐 Select Execution Environment for GravityWorker:");
    console.log("   1) ☁️  GitHub Actions CI / Cloud Automation (Automated on GitHub Issues)");
    console.log("   2) 💻 Local Worktree Daemon / CLI (Runs on your workstation with Antigravity agy / Google AI Ultra)");

    let envChoice: "1" | "2" = "1";
    if (Deno.stdin.isTerminal()) {
      const choice = prompt("\nSelect Environment (1 or 2) [default: 1]: ");
      if (choice?.trim() === "2") {
        envChoice = "2";
      }
    }

    if (envChoice === "2") {
      // LOCAL WORKSTATION INSTALLATION
      console.log("\n=======================================================");
      console.log("💻 CONFIGURING LOCAL WORKTREE DAEMON & CLI");
      console.log("=======================================================");

      console.log("\n🔐 Select AI Engine for Local Execution:");
      console.log("   1) 🚀 Antigravity CLI (agy) [Uses personal Google AI Ultra subscription]");
      console.log("   2) ⚡ Gemini API (GEMINI_API_KEY) [Token Usage API]");

      let localEngineChoice: "1" | "2" = "1";
      if (Deno.stdin.isTerminal()) {
        const choice = prompt("\nEngine choice (1 or 2) [default: 1]: ");
        if (choice?.trim() === "2") {
          localEngineChoice = "2";
        }
      }

      const agentEngine = localEngineChoice === "1" ? "antigravity" : "gemini";

      if (agentEngine === "antigravity") {
        console.log("\n🔍 Checking for Antigravity CLI (agy) binary...");
        try {
          const checkCmd = new Deno.Command("agy", { args: ["--help"], stdout: "null", stderr: "null" });
          const status = await checkCmd.output();
          if (status.success) {
            console.log("✓ Official Antigravity CLI (agy) detected in PATH!");
          } else {
            console.log("⚠️ agy CLI command returned non-zero. Run: curl -fsSL https://antigravity.google/cli/install.sh | bash");
          }
        } catch {
          console.log("⚠️ agy CLI binary not found in PATH.");
          console.log("   To install agy, run: curl -fsSL https://antigravity.google/cli/install.sh | bash");
        }
      } else {
        let apiKey = await resolveGeminiApiKey(options, targetDir);
        if (!apiKey && Deno.stdin.isTerminal()) {
          const inputKey = prompt("\nEnter GEMINI_API_KEY: ");
          if (inputKey?.trim()) apiKey = inputKey.trim();
        }
        if (apiKey) {
          console.log("✓ GEMINI_API_KEY configured for local execution.");
        } else {
          console.log("⚠️ Note: GEMINI_API_KEY missing. Set GEMINI_API_KEY in .env or environment.");
        }
      }

      // Save local config file .gravity-worker.json
      const config = {
        mode: "local",
        agent: agentEngine,
        targetRepo: repoSpec ?? null,
        targetDir,
        updatedAt: new Date().toISOString(),
      };

      const configPath = `${targetDir}/.gravity-worker.json`;
      await Deno.writeTextFile(configPath, JSON.stringify(config, null, 2));

      console.log("\n=======================================================");
      console.log("✨ LOCAL INSTALLATION COMPLETE!");
      console.log("=======================================================");
      console.log(`- Config saved to: ${configPath}`);
      console.log(`- Default Engine: ${agentEngine.toUpperCase()}`);
      console.log("\n💡 Usage:");
      console.log(`  ./gravity-worker run --prompt "Add .env.example template" --agent ${agentEngine}`);
      console.log(`  ./gravity-worker run --issue 48 --agent ${agentEngine}\n`);

      return { exitCode: 0 };
    }

    // GITHUB ACTIONS CI INSTALLATION
    console.log("\n=======================================================");
    console.log("☁️ CONFIGURING GITHUB ACTIONS AUTOMATION");
    console.log("=======================================================");

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const repoBase = repoSpec ? repoSpec.split("/")[1]?.replace(/[^a-zA-Z0-9-]/g, "-") ?? "app" : "app";
    const manifestAppName = `gravity-worker-${repoBase}-${randomSuffix}`;
    const localUrl = "http://localhost:3000";

    console.log("\n1️⃣ Starting local setup server and opening browser...");
    console.log(`   App Name: ${manifestAppName}`);
    console.log(`   URL: ${localUrl}\n`);

    const callbackPromise = listenForManifestCallback({ appName: manifestAppName });
    setTimeout(() => openBrowser(localUrl), 300);

    console.log("2️⃣ Waiting for single-click GitHub App creation...");

    try {
      const creds = await callbackPromise;
      console.log("\n🎉 GitHub App Created!");
      console.log(`- App Name: ${creds.slug}`);
      console.log(`- App ID:   ${creds.appId}`);

      const installUrl = `https://github.com/apps/${creds.slug}/installations/new`;
      console.log(`\n🔗 Opening App installation page: ${installUrl}`);
      openBrowser(installUrl);

      // Workflow file generation
      console.log(`\n3️⃣ Generating .github/workflows/gravity-worker.yml in ${targetDir}...`);
      const workflowPath = await createWorkflowFile(targetDir);
      console.log(`✓ Workflow file generated at: ${workflowPath}`);

      try {
        const gitAddCmd = new Deno.Command("git", {
          args: ["add", ".github/workflows/gravity-worker.yml"],
          cwd: targetDir,
          stdout: "piped",
          stderr: "piped",
        });
        await gitAddCmd.output();

        const gitCommitCmd = new Deno.Command("git", {
          args: ["commit", "-m", "Add GravityWorker GitHub Actions automation workflow"],
          cwd: targetDir,
          stdout: "piped",
          stderr: "piped",
        });
        await gitCommitCmd.output();

        const gitPushCmd = new Deno.Command("git", {
          args: ["push", "origin", "HEAD"],
          cwd: targetDir,
          stdout: "piped",
          stderr: "piped",
        });
        const pushRes = await gitPushCmd.output();
        if (pushRes.success) {
          console.log(`✓ Committed & pushed workflow file to remote GitHub repository!`);
        }
      } catch (e) {
        console.warn("⚠️ Warning: Could not push workflow file via Git:", e);
      }

      // Secret injection for GitHub Actions CI (GEMINI_API_KEY)
      console.log(`\n4️⃣ Injecting repository secrets to ${repoSpec ?? "current repository"}...`);
      const appSaved = await setRepoSecretWithGh("GRAVITY_WORKER_APP_ID", creds.appId, repoSpec);
      const keySaved = await setRepoSecretWithGh("GRAVITY_WORKER_PRIVATE_KEY", creds.privateKey, repoSpec);

      console.log("\n🔍 Resolving GEMINI_API_KEY for GitHub Actions CI execution...");
      let geminiKey = await resolveGeminiApiKey(options, targetDir);
      if (!geminiKey && Deno.stdin.isTerminal()) {
        const inputKey = prompt("Enter / Paste GEMINI_API_KEY: ");
        if (inputKey?.trim()) geminiKey = inputKey.trim();
      }

      if (geminiKey) {
        await setRepoSecretWithGh("GEMINI_API_KEY", geminiKey, repoSpec);
        console.log("✓ Injected GEMINI_API_KEY to repository secrets.");
      } else {
        console.log("⚠️ Could not resolve GEMINI_API_KEY. Set it manually using: gh secret set GEMINI_API_KEY");
      }

      if (appSaved && keySaved) {
        console.log("✓ GitHub Secrets configured automatically via gh CLI!");
      }

      // Workflow permissions
      if (repoSpec) {
        const [owner, repo] = repoSpec.split("/");
        if (owner && repo) {
          console.log(`\n5️⃣ Enabling PR creation permissions for ${owner}/${repo}...`);
          const token = Deno.env.get("GITHUB_TOKEN");
          if (token) {
            const permOk = await enableRepoWorkflowPermissions(owner, repo, token);
            if (permOk) {
              console.log("✓ Repository workflow permissions updated automatically!");
            }
          }
        }
      }

      console.log("\n=======================================================");
      console.log("✨ GITHUB ACTIONS CI INSTALLATION COMPLETE!");
      console.log("=======================================================");
      console.log(`GravityWorker is ready to process issues on ${repoSpec ?? "your repository"}.`);
      console.log(`Ensure the GitHub App is installed on ${repoSpec ?? "your repository"}.`);
      console.log("Add the 'gravity-fix' label to any issue to begin!\n");

      return { exitCode: 0 };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Installation failed: ${msg}`);
      return { exitCode: 1 };
    }
  }
}
