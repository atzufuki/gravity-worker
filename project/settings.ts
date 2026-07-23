/**
 * Herkules - Project Settings
 *
 * Minimal project configuration for Herkules.
 *
 * @module project/settings
 */

import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { DbConfig } from "@alexi/db";
import { errorHandlerMiddleware, loggingMiddleware } from "@alexi/middleware";
import { HerkulesConfig } from "@herkules/mod.ts";
import { WebConfig } from "@web/mod.ts";
import { CliConfig } from "@cli/mod.ts";

// Environment
export const DEBUG = Deno.env.get("DEBUG") === "true";
export const SECRET_KEY = Deno.env.get("SECRET_KEY") ??
  "development-secret-key-change-in-production";

// Server Configuration
export const DEFAULT_HOST = "0.0.0.0";
export const DEFAULT_PORT = 8000;

// Database
export const DATABASES = {
  default: new DenoKVBackend({
    name: "herkules",
    path: Deno.env.get("DENO_KV_PATH"),
  }),
};

// Installed Apps
export const INSTALLED_APPS = [
  DbConfig,
  HerkulesConfig,
  WebConfig,
  CliConfig,
];

// URL Configuration
export const ROOT_URLCONF = () => import("@web/urls.ts");

// Middleware
export const MIDDLEWARE = [
  loggingMiddleware(),
  errorHandlerMiddleware(),
];
