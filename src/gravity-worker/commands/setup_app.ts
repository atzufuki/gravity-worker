/**
 * Alexi Management Command: setup_app
 *
 * Automated 100% Zero-Touch GitHub Setup for GravityWorker.
 * Creates GitHub App, configures workflow permissions, injects secrets, and generates workflow file.
 *
 * @module gravity-worker/commands/setup_app
 */

import { BaseCommand } from "@alexi/core/management";
import {
  createWorkflowFile,
  enableRepoWorkflowPermissions,
  getManifestUrl,
  listenForManifestCallback,
  setRepoSecretWithGh,
} from "@gravity-worker/github_app.ts";
import { getGitHubContext } from "@gravity-worker/github.ts";

export class SetupAppCommand extends BaseCommand {
  override name = "setup_app";
  override help = "100% Zero-Touch Automated Setup of GravityWorker for GitHub";

  override async handle(): Promise<{ exitCode: number }> {
    console.log("🤖 Starting 100% Automated Zero-Touch GravityWorker Setup...\n");

    // 1. Generate & Open GitHub App Manifest URL
    const manifestUrl = getManifestUrl();
    console.log("1️⃣ Opening browser for single-click GitHub App creation...");
    console.log(`   URL: ${manifestUrl}\n`);

    try {
      if (Deno.build.os === "linux") {
        new Deno.Command("xdg-open", { args: [manifestUrl] }).spawn();
      } else if (Deno.build.os === "darwin") {
        new Deno.Command("open", { args: [manifestUrl] }).spawn();
      } else if (Deno.build.os === "windows") {
        new Deno.Command("cmd", { args: ["/c", "start", manifestUrl] }).spawn();
      }
    } catch {
      // Ignore if browser launch fails
    }

    console.log("2️⃣ Waiting for GitHub App creation callback on http://localhost:3000/callback ...");

    try {
      const creds = await listenForManifestCallback();
      console.log("\n🎉 GitHub App Created!");
      console.log(`- App Name: ${creds.slug}`);
      console.log(`- App ID:   ${creds.appId}`);

      // 2. Automate .github/workflows/gravity-worker.yml file generation
      console.log("\n3️⃣ Generating .github/workflows/gravity-worker.yml in target repository...");
      const workflowPath = await createWorkflowFile(".");
      console.log(`✓ Workflow file generated at: ${workflowPath}`);

      // 3. Automate Secret Injection via gh CLI
      console.log("\n4️⃣ Injecting repository secrets (GRAVITY_WORKER_APP_ID & GRAVITY_WORKER_PRIVATE_KEY)...");
      const appSaved = await setRepoSecretWithGh("GRAVITY_WORKER_APP_ID", creds.appId);
      const keySaved = await setRepoSecretWithGh("GRAVITY_WORKER_PRIVATE_KEY", creds.privateKey);

      const geminiEnvKey = Deno.env.get("GEMINI_API_KEY");
      if (geminiEnvKey) {
        await setRepoSecretWithGh("GEMINI_API_KEY", geminiEnvKey);
        console.log("✓ Injected GEMINI_API_KEY from local environment.");
      }

      if (appSaved && keySaved) {
        console.log("✓ GitHub Secrets configured automatically via gh CLI!");
      } else {
        console.log("⚠️ Note: Run 'gh auth login' to enable automatic secret injection, or add secrets manually.");
      }

      // 4. Automate Workflow Permissions via API / gh CLI
      const ghContext = await getGitHubContext();
      if (ghContext.repoOwner && ghContext.repoName) {
        console.log(`\n5️⃣ Enabling PR creation permissions for ${ghContext.repoOwner}/${ghContext.repoName}...`);
        const token = Deno.env.get("GITHUB_TOKEN");
        if (token) {
          const permOk = await enableRepoWorkflowPermissions(ghContext.repoOwner, ghContext.repoName, token);
          if (permOk) {
            console.log("✓ Repository workflow permissions updated automatically!");
          }
        }
      }

      console.log("\n=======================================================");
      console.log("✨ 100% ZERO-TOUCH SETUP COMPLETE!");
      console.log("=======================================================");
      console.log("GravityWorker is ready to process issues on your repo.");
      console.log("Add the 'gravity-fix' label to any issue to begin!\n");

      return { exitCode: 0 };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Setup failed: ${msg}`);
      return { exitCode: 1 };
    }
  }
}
