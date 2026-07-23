/**
 * GravityWorker - Project Settings
 *
 * Minimal project configuration for GravityWorker.
 *
 * @module project/settings
 */

import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { DbConfig } from "@alexi/db";
import { errorHandlerMiddleware, loggingMiddleware } from "@alexi/middleware";
import { GravityWorkerConfig } from "@gravity-worker/mod.ts";

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
    name: "gravity-worker",
    path: Deno.env.get("DENO_KV_PATH"),
  }),
};

// Installed Apps
export const INSTALLED_APPS = [
  DbConfig,
  GravityWorkerConfig,
];

// URL Configuration
export const ROOT_URLCONF = () => import("@gravity-worker/urls.ts");

// Middleware
export const MIDDLEWARE = [
  loggingMiddleware(),
  errorHandlerMiddleware(),
];
