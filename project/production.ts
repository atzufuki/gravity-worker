/**
 * Herkules - Production Settings for Deno Deploy & Server
 *
 * Minimal production configuration for Herkules web application and keyless token relay.
 *
 * @module project/production
 */

import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { DbConfig } from "@alexi/db";
import { errorHandlerMiddleware, loggingMiddleware } from "@alexi/middleware";
import { HerkulesConfig } from "@herkules/mod.ts";
import { WebConfig } from "@web/mod.ts";
import { CliConfig } from "@cli/mod.ts";

export const DEBUG = Deno.env.get("DEBUG") === "true";
export const SECRET_KEY = Deno.env.get("SECRET_KEY") ?? "herkules-production-secret-key-change-me";

export const DEFAULT_HOST = "0.0.0.0";
export const DEFAULT_PORT = parseInt(Deno.env.get("PORT") ?? "8000", 10);

export const DATABASES = {
  default: new DenoKVBackend({
    name: "herkules",
    path: Deno.env.get("DENO_KV_PATH"),
    url: Deno.env.get("DENO_KV_URL"),
  }),
};

export const INSTALLED_APPS = [
  DbConfig,
  HerkulesConfig,
  WebConfig,
  CliConfig,
];

export const ROOT_URLCONF = () => import("@web/urls.ts");

export const MIDDLEWARE = [
  loggingMiddleware(),
  errorHandlerMiddleware(),
];
