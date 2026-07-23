/**
 * Alexi Management Command: setup_app
 *
 * Automated GitHub App creation via Manifest Flow.
 *
 * @module gravity-worker/commands/setup_app
 */

import { BaseCommand } from "@alexi/core/management";
import { getManifestUrl, listenForManifestCallback } from "@gravity-worker/github_app.ts";

export class SetupAppCommand extends BaseCommand {
  override name = "setup_app";
  override help = "Automated creation of @gravity-worker[bot] GitHub App";

  override async handle(): Promise<{ exitCode: number }> {
    console.log("🤖 Starting automated GitHub App setup for GravityWorker...\n");

    const manifestUrl = getManifestUrl();
    console.log("1. Opening browser to create GitHub App with pre-configured permissions...");
    console.log(`   URL: ${manifestUrl}\n`);

    // Attempt to open browser automatically
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

    console.log("2. Waiting for GitHub App creation callback on http://localhost:3000/callback ...");

    try {
      const creds = await listenForManifestCallback();
      console.log("\n🎉 GitHub App created successfully!");
      console.log(`- App Name: ${creds.slug}`);
      console.log(`- App ID:   ${creds.appId}`);
      console.log(`- URL:      ${creds.htmlUrl}`);

      console.log("\n=======================================================");
      console.log("📋 ADD THESE SECRETS TO YOUR GITHUB REPOSITORY:");
      console.log("=======================================================");
      console.log(`GRAVITY_WORKER_APP_ID:`);
      console.log(`${creds.appId}\n`);
      console.log(`GRAVITY_WORKER_PRIVATE_KEY:`);
      console.log(`${creds.privateKey}`);
      console.log("=======================================================\n");

      return { exitCode: 0 };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Setup failed: ${msg}`);
      return { exitCode: 1 };
    }
  }
}
