/**
 * GravityWorker Module Exports
 *
 * @module gravity-worker
 */

import type { AppConfig } from "@alexi/types";

export const GravityWorkerConfig: AppConfig = {
  name: "gravity-worker",
  verboseName: "GravityWorker",
  appPath: new URL("./", import.meta.url).href,
};

export * from "./models.ts";
export * from "./views.ts";
export * from "./urls.ts";
export * from "./git.ts";
export * from "./runner.ts";
export * from "./artifacts.ts";
