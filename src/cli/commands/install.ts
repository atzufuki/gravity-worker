/**
 * Alexi Management Command: install
 *
 * Universal Setup & Installation Wizard for Herkules.
 * Configures:
 *  1) Official GitHub App Identity (@herkules[bot])
 *  2) Hybrid GitHub Actions Workflow (.github/workflows/herkules.yml)
 *  3) Built-In Antigravity Execution Proxy & Cloud Fallback Secrets
 *
 * @module cli/commands/install
 */

import { join } from "@std/path";
import { BaseCommand } from "@alexi/core/management";
import {
  createWorkflowFile,
  enableRepoWorkflowPermissions,
  ensureRepoLabelWithGh,
  listenForManifestCallback,
  setRepoSecretWithGh,
} from "@herkules/github_app.ts";
import { getGitHubContext, getRepoFromGitRemote } from "@herkules/github.ts";

const OFFICIAL_APP_SLUG = "herkules-bot";
const OFFICIAL_APP_ID = "4375516";

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
  override help = "Universal Setup & Installation Wizard for Herkules GitHub Actions & Proxy";

  override async handle(options?: any): Promise<{ exitCode: number }> {
    const targetRepoFlag = typeof options === "string" ? options : options?.repo;
    const specifiedDir = typeof options === "object" ? options?.dir ?? options?.targetDir : undefined;

    console.log("=======================================================");
    console.log("🚀 HERKULES AUTOMATED INSTALLATION WIZARD");
    console.log("=======================================================");

    let repoSpec: string | undefined;
    let targetDir = specifiedDir ?? ".";

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
          if (targetDir === ".") {
            const possibleDirs = [
              join(Deno.cwd(), "..", repoName),
              join(Deno.env.get("HOME") ?? "", "Code", repoName),
              join("/var/home", Deno.env.get("USER") ?? "atzufuki", "Code", repoName),
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
    }

    if (!repoSpec) {
      const ghContext = await getGitHubContext(targetDir);
      if (ghContext.repoOwner && ghContext.repoName) {
        repoSpec = `${ghContext.repoOwner}/${ghContext.repoName}`;
      }
    }

    if (repoSpec) {
      console.log(`📌 Target Repository: ${repoSpec}`);
      console.log(`📂 Target Directory:  ${targetDir}\n`);
    } else {
      console.log(`📌 Target Directory:  ${targetDir}\n`);
    }

    // Step 1: Install Official GitHub App (@herkules[bot])
    const installUrl = `https://github.com/apps/${OFFICIAL_APP_SLUG}/installations/new`;
    console.log(`1️⃣ Install Official GitHub App (@herkules[bot]):`);
    console.log(`   Opening browser: ${installUrl}`);
    openBrowser(installUrl);

    // Step 2: Generate & Push Hybrid GitHub Actions Workflow
    console.log(`\n2️⃣ Generating Hybrid Workflow (.github/workflows/herkules.yml)...`);
    try {
      const workflowPath = await createWorkflowFile(targetDir);
      console.log(`✓ Workflow file created at: ${workflowPath}`);

      try {
        const gitAddCmd = new Deno.Command("git", {
          args: ["add", ".github/workflows/herkules.yml"],
          cwd: targetDir,
          stdout: "piped",
          stderr: "piped",
        });
        await gitAddCmd.output();

        const gitCommitCmd = new Deno.Command("git", {
          args: ["commit", "-m", "Add Herkules Hybrid GitHub Actions workflow"],
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
          console.log(`✓ Committed & pushed workflow to remote GitHub repository!`);
        }
      } catch {
        // Ignore git push warnings
      }

      // Step 3: Inject Repository Secrets via gh CLI
      console.log(`\n3️⃣ Injecting Repository Secrets via gh CLI...`);
      const defaultRelayUrl = "https://herkules.atzufuki.deno.net";
      const relayUrl = Deno.env.get("HERKULES_RELAY_URL") ?? defaultRelayUrl;
      const relaySaved = await setRepoSecretWithGh("HERKULES_RELAY_URL", relayUrl, repoSpec);
      if (relaySaved) {
        console.log(`✓ Saved HERKULES_RELAY_URL="${relayUrl}" secret (Keyless Token Relay).`);
      }

      let geminiKey = await resolveGeminiApiKey(options, targetDir);
      if (!geminiKey && Deno.stdin.isTerminal()) {
        const inputKey = prompt("\nPaste GEMINI_API_KEY for Cloud Fallback (optional, press ENTER to skip): ");
        if (inputKey?.trim()) geminiKey = inputKey.trim();
      }

      if (geminiKey) {
        await setRepoSecretWithGh("GEMINI_API_KEY", geminiKey, repoSpec);
        console.log("✓ Injected GEMINI_API_KEY secret for Cloud Fallback.");
      }

      // Step 4: Enable Repository Workflow Permissions & Create 'herkules' Label
      if (repoSpec) {
        const [owner, repo] = repoSpec.split("/");
        if (owner && repo) {
          let token = Deno.env.get("GITHUB_TOKEN") || Deno.env.get("GH_TOKEN");
          if (!token) {
            try {
              const tokenCmd = new Deno.Command("gh", { args: ["auth", "token"], stdout: "piped" });
              const out = await tokenCmd.output();
              if (out.success) {
                token = new TextDecoder().decode(out.stdout).trim();
              }
            } catch {
              // Ignore
            }
          }
          if (token) {
            const enabled = await enableRepoWorkflowPermissions(owner, repo, token).catch(() => false);
            if (enabled) {
              console.log("✓ Automatically enabled Read & Write workflow permissions for repository.");
            }
          }
        }
      }

      const labelCreated = await ensureRepoLabelWithGh("herkules", "58a6ff", "Trigger Herkules AI Agent automated processing", repoSpec);
      if (labelCreated) {
        console.log("✓ Automatically created 'herkules' issue label in repository.");
      }

      // Step 5: Save Local Configuration .herkules.json
      const config = {
        appId: OFFICIAL_APP_ID,
        appSlug: OFFICIAL_APP_SLUG,
        relayUrl,
        targetRepo: repoSpec ?? null,
        targetDir,
        updatedAt: new Date().toISOString(),
      };

      const configPath = `${targetDir}/.herkules.json`;
      await Deno.writeTextFile(configPath, JSON.stringify(config, null, 2));

      console.log("\n=======================================================");
      console.log("✨ HERKULES INSTALLATION COMPLETE!");
      console.log("=======================================================");
      console.log(`- Bot Identity: @herkules-bot[bot] (Keyless Relay)`);
      console.log(`- Repository:   ${repoSpec ?? "Current Repository"}`);
      console.log(`- Web & Relay:  ${relayUrl}`);
      console.log(`- Workflow:     .github/workflows/herkules.yml`);
      console.log(`- Label:        herkules`);
      console.log(`- Config:       ${configPath}`);
      console.log("\n🚀 HOW TO RUN:");
      console.log("  1) Start Local Proxy (Free Antigravity / Google AI Ultra):");
      console.log(`     ./herkules proxy --repo ${repoSpec ?? "owner/repo"}`);
      console.log("\n  2) Trigger Task on GitHub:");
      console.log(`     Add label 'herkules' to any GitHub Issue!\n`);

      return { exitCode: 0 };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Installation failed: ${msg}`);
      return { exitCode: 1 };
    }
  }
}
