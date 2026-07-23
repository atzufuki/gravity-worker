/**
 * Herkules — HTTP Entry Point
 *
 * Production server entrypoint for Deno Deploy and `deno serve`.
 * Analogous to Django's wsgi.py — a thin shell that calls
 * getHttpApplication() and exports the result.
 *
 * Imports settings modules statically so Deno Deploy's static analyzer
 * pre-caches all backend dependencies (DenoKVBackend, etc.) at build time.
 *
 * Usage:
 *   deno serve -A --unstable-kv project/http.ts
 *
 * @module http
 */

import { configureSettings, getHttpApplication } from "@alexi/core";
import { tunnelView } from "@web/views.ts";
import * as productionSettings from "./production.ts";
import * as devSettings from "./settings.ts";

const settingsFlag = Deno.args.find((a) => a.startsWith("--settings="));
const settings = settingsFlag
  ? (settingsFlag.includes("settings.ts") ? devSettings : productionSettings)
  : productionSettings;

configureSettings(settings);

const app = await getHttpApplication();

export default {
  async fetch(req: Request, info?: any): Promise<Response> {
    const url = new URL(req.url);

    // Direct routing for WebSocket tunnels and tunnel endpoints (supports dots in repo names like siht.io)
    if (
      url.pathname.startsWith("/ws/") ||
      url.pathname.startsWith("/tunnel/") ||
      (req.headers.get("upgrade")?.toLowerCase() === "websocket")
    ) {
      return tunnelView(req);
    }

    return app.fetch(req, info);
  },
};
