/**
 * Alexi Management Command: install
 *
 * Automated 100% Zero-Touch GitHub Setup & Installation for GravityWorker.
 * Creates GitHub App via auto-submitted manifest POST form, configures workflow permissions,
 * prompts user to choose authentication method (AGY_CREDENTIALS vs GEMINI_API_KEY),
 * injects secrets, commits workflow file, and launches App Installation in browser.
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

async function resolveAgyCredentials(): Promise<string | undefined> {
  let creds = Deno.env.get("AGY_CREDENTIALS");
  if (creds) return creds;

  const home = Deno.env.get("HOME") ?? "";
  const possiblePaths = [
    `${home}/.gemini/oauth_creds.json`,
    `${home}/.config/antigravity/credentials.json`,
    `${home}/.gemini/antigravity-cli/credentials.json`,
    `${home}/.config/Antigravity/credentials.json`,
  ];

  for (const path of possiblePaths) {
    try {
      const content = await Deno.readTextFile(path);
      if (content.trim().startsWith("{")) {
        return content.trim();
      }
    } catch {
      // Ignore
    }
  }

  return undefined;
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
  override help = "100% Zero-Touch Automated Setup & Installation of GravityWorker for GitHub";

  override async handle(options?: any): Promise<{ exitCode: number }> {
    const targetRepoFlag = typeof options === "string" ? options : options?.repo;

    console.log("🤖 Starting 100% Automated Zero-Touch GravityWorker Installation...\n");

    let repoSpec: string | undefined;
    let targetDir = ".";

    if (targetRepoFlag) {
      // Check if targetRepoFlag is a local directory path
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
        // Not a local directory, assume it's owner/repo format
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
      console.log(`📌 Target repository detected: ${repoSpec}`);
      console.log(`📂 Target directory: ${targetDir}\n`);
    } else {
      console.log(`📌 Target directory: ${targetDir}\n`);
    }

    // Append 4-digit random suffix to prevent global GitHub App name collision ("Name is already taken")
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const repoBase = repoSpec ? repoSpec.split("/")[1]?.replace(/[^a-zA-Z0-9-]/g, "-") ?? "app" : "app";
    const manifestAppName = `gravity-worker-${repoBase}-${randomSuffix}`;
    const localUrl = "http://localhost:3000";

    console.log("1️⃣ Starting local setup server and opening browser...");
    console.log(`   App Name: ${manifestAppName}`);
    console.log(`   URL: ${localUrl}\n`);

    // Start local server to handle POST form auto-submit & OAuth callback
    const callbackPromise = listenForManifestCallback({ appName: manifestAppName });

    // Open browser to local server
    setTimeout(() => openBrowser(localUrl), 300);

    console.log("2️⃣ Waiting for single-click GitHub App creation...");

    try {
      const creds = await callbackPromise;
      console.log("\n🎉 GitHub App Created!");
      console.log(`- App Name: ${creds.slug}`);
      console.log(`- App ID:   ${creds.appId}`);

      // Open installation URL so user can install the App on the repo
      const installUrl = `https://github.com/apps/${creds.slug}/installations/new`;
      console.log(`\n🔗 Opening App installation page: ${installUrl}`);
      openBrowser(installUrl);

      // 2. Automate .github/workflows/gravity-worker.yml file generation and git push
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

      // 3. Automate Secret Injection via gh CLI with interactive auth choice
      console.log(`\n4️⃣ Injecting repository secrets to ${repoSpec ?? "current repository"}...`);
      const appSaved = await setRepoSecretWithGh("GRAVITY_WORKER_APP_ID", creds.appId, repoSpec);
      const keySaved = await setRepoSecretWithGh("GRAVITY_WORKER_PRIVATE_KEY", creds.privateKey, repoSpec);

      console.log("\n🔐 Select Authentication Method for GitHub Actions AI Engine:");
      console.log("   1) Antigravity CLI Session Token (AGY_CREDENTIALS) [Full agy engine]");
      console.log("   2) Gemini API Key (GEMINI_API_KEY)                 [Zero-dependency engine]");

      let selectedAuth: "1" | "2" = "1";
      if (Deno.stdin.isTerminal()) {
        const inputChoice = prompt("\nChoice (1 or 2) [default: 1]: ");
        if (inputChoice?.trim() === "2") {
          selectedAuth = "2";
        }
      }

      if (selectedAuth === "1") {
        console.log("\n🔍 Resolving AGY_CREDENTIALS...");
        let agyCreds = await resolveAgyCredentials();
        if (!agyCreds && Deno.stdin.isTerminal()) {
          const manualInput = prompt("Enter / Paste AGY_CREDENTIALS JSON: ");
          if (manualInput?.trim()) agyCreds = manualInput.trim();
        }

        if (agyCreds) {
          await setRepoSecretWithGh("AGY_CREDENTIALS", agyCreds, repoSpec);
          console.log("✓ Injected AGY_CREDENTIALS (Antigravity CLI OAuth Token) to repository secrets.");
        } else {
          console.log("⚠️ Could not resolve AGY_CREDENTIALS. Set it manually using: gh secret set AGY_CREDENTIALS");
        }
      } else {
        console.log("\n🔍 Resolving GEMINI_API_KEY...");
        let geminiKey = await resolveGeminiApiKey(options, targetDir);
        if (!geminiKey && Deno.stdin.isTerminal()) {
          const manualInput = prompt("Enter / Paste GEMINI_API_KEY: ");
          if (manualInput?.trim()) geminiKey = manualInput.trim();
        }

        if (geminiKey) {
          await setRepoSecretWithGh("GEMINI_API_KEY", geminiKey, repoSpec);
          console.log("✓ Injected GEMINI_API_KEY to repository secrets.");
        } else {
          console.log("⚠️ Could not resolve GEMINI_API_KEY. Set it manually using: gh secret set GEMINI_API_KEY");
        }
      }

      if (appSaved && keySaved) {
        console.log("✓ GitHub Secrets configured automatically via gh CLI!");
      } else {
        console.log("⚠️ Note: Run 'gh auth login' to enable automatic secret injection, or add secrets manually.");
      }

      // 4. Automate Workflow Permissions via API / gh CLI
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
      console.log("✨ 100% ZERO-TOUCH INSTALLATION COMPLETE!");
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
