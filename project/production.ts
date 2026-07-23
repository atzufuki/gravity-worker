/**
 * GravityWorker - Production Settings
 *
 * Minimal production configuration for GravityWorker.
 *
 * @module project/production
 */

import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { DbConfig } from "@alexi/db";
import { errorHandlerMiddleware, loggingMiddleware } from "@alexi/middleware";
import { GravityWorkerConfig } from "@gravity-worker/mod.ts";

export const DEBUG = false;
export const SECRET_KEY = Deno.env.get("SECRET_KEY")!;

export const DEFAULT_HOST = "0.0.0.0";
export const DEFAULT_PORT = 8000;

export const DATABASES = {
  default: new DenoKVBackend({
    name: "gravity-worker",
    url: Deno.env.get("DENO_KV_URL"),
  }),
};

export const INSTALLED_APPS = [
  DbConfig,
  GravityWorkerConfig,
];

export const ROOT_URLCONF = () => import("@gravity-worker/urls.ts");

export const MIDDLEWARE = [
  loggingMiddleware(),
  errorHandlerMiddleware(),
];
