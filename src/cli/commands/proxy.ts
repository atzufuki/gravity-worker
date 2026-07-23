/**
 * Alexi Management Command: proxy
 *
 * Starts an Antigravity Execution Proxy HTTP server for Herkules with built-in zero-auth tunneling.
 * Exposes a lightweight Deno HTTP endpoint for GitHub Actions CI.
 * Executes incoming prompts locally using the official `agy` CLI (Google AI Ultra)
 * and returns generated files back to GitHub Actions.
 *
 * Usage:
 *  ./herkules proxy [--port 8000] [--repo owner/repo]
 *
 * @module cli/commands/proxy
 */

import { BaseCommand } from "@alexi/core/management";
import { AntigravityRunner, applyFallbackFileWrites } from "@herkules/runner.ts";
import { setRepoSecretWithGh } from "@herkules/github_app.ts";
import { getGitHubContext } from "@herkules/github.ts";
import { handleTokenRelayRequest, TunnelMessage, TunnelResponse } from "@web/relay.ts";

export interface ProxyExecuteRequest {
  prompt: string;
  issueNum?: number;
  repoSpec?: string;
  secretToken?: string;
}

export interface ProxyExecuteResponse {
  success: boolean;
  files: Record<string, string>;
  logs: string;
  engine: string;
  error?: string;
}

function connectNativeTunnel(relayUrl: string, repoSpec: string, localPort: number): WebSocket | undefined {
  try {
    const wsUrl = relayUrl
      .replace(/^http:/, "ws:")
      .replace(/^https:/, "wss:")
      .replace(/\/+$/, "") + `/ws/${repoSpec}`;

    console.log(`🔌 Connecting Native WebSocket Tunnel to ${wsUrl}...`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log(`✓ Connected to Herkules Native WebSocket Tunnel for ${repoSpec}!`);
    };

    ws.onmessage = async (event) => {
      let reqId = "";
      let heartbeatTimer: any = null;
      try {
        const msg: TunnelMessage = JSON.parse(event.data);
        reqId = msg.id;

        // Send periodic heartbeat every 2 seconds to keep stream alive
        heartbeatTimer = setInterval(() => {
          try {
            ws.send(JSON.stringify({ id: reqId, chunk: `⏳ Agent running on local proxy...\n`, done: false }));
          } catch {
            clearInterval(heartbeatTimer);
          }
        }, 2000);

        // Forward request locally to Deno.serve endpoint on localhost:localPort
        const targetUrl = `http://127.0.0.1:${localPort}${msg.url}`;
        const cleanHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (msg.headers?.["content-type"]) {
          cleanHeaders["Content-Type"] = msg.headers["content-type"];
        }

        const res = await fetch(targetUrl, {
          method: msg.method,
          headers: cleanHeaders,
          body: msg.body,
        });

        const resBody = await res.text();
        clearInterval(heartbeatTimer);

        const tunnelRes: TunnelResponse = {
          id: msg.id,
          status: res.status,
          headers: { "Content-Type": "application/json" },
          body: resBody,
        };

        ws.send(JSON.stringify({ id: reqId, response: tunnelRes, done: true }));
      } catch (err) {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        console.error("❌ Tunnel request processing error:", err);
        if (reqId) {
          try {
            const tunnelRes: TunnelResponse = {
              id: reqId,
              status: 500,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ success: false, error: String(err) }),
            };
            ws.send(JSON.stringify({ id: reqId, response: tunnelRes, done: true }));
          } catch {
            // Ignore
          }
        }
      }
    };

    ws.onerror = (err) => {
      const msg = err instanceof ErrorEvent ? err.message : "";
      if (msg) console.warn("⚠️ WebSocket Tunnel Connection Notice:", msg);
    };

    ws.onclose = () => {
      // Auto-reconnect after 5 seconds
      setTimeout(() => connectNativeTunnel(relayUrl, repoSpec, localPort), 5000);
    };

    return ws;
  } catch {
    return undefined;
  }
}

export class ProxyCommand extends BaseCommand {
  override name = "proxy";
  override help = "Starts local Antigravity (agy) execution proxy server with built-in zero-auth tunnel";

  override async handle(options?: any): Promise<{ exitCode: number }> {
    const port = (typeof options === "object" && options?.port) ? parseInt(options.port, 10) : 8000;
    const secretToken = Deno.env.get("HERKULES_PROXY_SECRET") ?? Deno.env.get("GRAVITY_WORKER_PROXY_SECRET");
    const targetRepoFlag = typeof options === "object" ? options?.repo : undefined;
    const providedUrl = typeof options === "object" ? (options?.url ?? options?.tunnelUrl) : undefined;

    let targetDir = ".";
    let repoSpec: string | undefined;

    if (targetRepoFlag) {
      repoSpec = targetRepoFlag;
    } else {
      try {
        const text = await Deno.readTextFile(`${targetDir}/.herkules.json`);
        const config = JSON.parse(text);
        if (config.targetRepo) {
          repoSpec = config.targetRepo;
        }
      } catch {
        // Ignore
      }

      if (!repoSpec) {
        const ghContext = await getGitHubContext(targetDir);
        if (ghContext.repoOwner && ghContext.repoName) {
          repoSpec = `${ghContext.repoOwner}/${ghContext.repoName}`;
        }
      }
    }

    console.log("=======================================================");
    console.log("🚀 HERKULES LOCAL ANTIGRAVITY PROXY SERVER STARTED");
    console.log("=======================================================");
    console.log(`- Listening Port:  ${port}`);
    console.log(`- Engine:          ANTIGRAVITY (agy CLI / Google AI Ultra)`);
    console.log(`- Target Repo:     ${repoSpec ?? "Auto-detect"}`);
    console.log(`- Auth Security:   ${secretToken ? "Protected (Secret Token Set)" : "Open Local Endpoint"}`);

    const controller = new AbortController();

    const server = Deno.serve(
      { port, signal: controller.signal },
      async (req: Request): Promise<Response> => {
        const url = new URL(req.url);

        // 1. Health check endpoint for GitHub Actions pre-flight check
        if (req.method === "GET" && (url.pathname === "/health" || url.pathname.endsWith("/health") || url.pathname === "/")) {
          return new Response(
            JSON.stringify({ status: "ok", engine: "antigravity", version: "0.1.0" }),
            { headers: { "Content-Type": "application/json", "Bypass-Tunnel-Remainder": "true" } },
          );
        }

        // 2. Token Relay endpoint for GitHub Actions keyless authentication
        if (url.pathname.endsWith("/api/token") || url.pathname.endsWith("/api/token/")) {
          const res = await handleTokenRelayRequest(req);
          res.headers.set("Bypass-Tunnel-Remainder", "true");
          return res;
        }

        // 3. Execution endpoint /api/execute
        if (req.method === "POST" && (url.pathname.endsWith("/api/execute") || url.pathname.endsWith("/execute"))) {
          try {
            const body: ProxyExecuteRequest = await req.json();

            if (secretToken && body.secretToken !== secretToken) {
              return new Response(
                JSON.stringify({ success: false, error: "Unauthorized: Invalid secretToken" }),
                { status: 401, headers: { "Content-Type": "application/json", "Bypass-Tunnel-Remainder": "true" } },
              );
            }

            if (!body.prompt) {
              return new Response(
                JSON.stringify({ success: false, error: "Bad Request: Missing prompt" }),
                { status: 400, headers: { "Content-Type": "application/json", "Bypass-Tunnel-Remainder": "true" } },
              );
            }

            console.log(`\n🎯 Received proxy execution request for Issue #${body.issueNum ?? "N/A"}`);
            console.log(`  Prompt: "${body.prompt.substring(0, 80)}..."`);

            // Create temporary worktree directory for execution
            const tempDir = await Deno.makeTempDir({ prefix: "herkules-proxy-" });
            const runner = new AntigravityRunner();
            const result = await runner.run({ prompt: body.prompt, worktreePath: tempDir });

            // Collect modified files
            const files: Record<string, string> = {};
            await applyFallbackFileWrites(body.prompt, result.output, tempDir);

            // Read generated files from tempDir
            for await (const entry of Deno.readDir(tempDir)) {
              if (entry.isFile && !entry.name.startsWith(".")) {
                try {
                  const content = await Deno.readTextFile(`${tempDir}/${entry.name}`);
                  files[entry.name] = content;
                } catch {
                  // Ignore binary files
                }
              }
            }

            // Cleanup temp directory
            await Deno.remove(tempDir, { recursive: true }).catch(() => {});

            console.log(`✓ Proxy execution completed successfully. (${Object.keys(files).length} files generated)`);

            const responsePayload: ProxyExecuteResponse = {
              success: result.success,
              files,
              logs: result.output,
              engine: "antigravity",
            };

            return new Response(JSON.stringify(responsePayload), {
              headers: { "Content-Type": "application/json", "Bypass-Tunnel-Remainder": "true" },
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`❌ Proxy execution error: ${msg}`);
            return new Response(
              JSON.stringify({ success: false, files: {}, logs: msg, engine: "antigravity", error: msg }),
              { status: 500, headers: { "Content-Type": "application/json", "Bypass-Tunnel-Remainder": "true" } },
            );
          }
        }

        return new Response("Not Found", { status: 404, headers: { "Bypass-Tunnel-Remainder": "true" } });
      },
    );

    // Initialize Native WebSocket Tunnel
    const relayUrl = Deno.env.get("HERKULES_RELAY_URL") ?? "https://herkules.atzufuki.deno.net";

    if (repoSpec) {
      connectNativeTunnel(relayUrl, repoSpec, port);
      const activeTunnelUrl = `${relayUrl.replace(/\/+$/, "")}/tunnel/${repoSpec}`;
      console.log(`- Native Relay Tunnel: ${activeTunnelUrl}`);
    } else {
      console.warn("⚠️ Warning: Could not determine target repository. Specify repo using: ./herkules proxy --repo owner/repo");
    }

    console.log("-------------------------------------------------------");
    console.log("Waiting for execution requests from GitHub Actions...\n");

    await server.finished;

    return { exitCode: 0 };
  }
}
