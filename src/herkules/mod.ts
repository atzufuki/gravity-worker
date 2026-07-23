/**
 * Herkules Core Engine Module Exports
 *
 * @module herkules
 */

import type { AppConfig } from "@alexi/types";

export const HerkulesConfig: AppConfig = {
  name: "herkules",
  verboseName: "Herkules Core",
  appPath: new URL("./", import.meta.url).href,
};

export * from "./models.ts";
export * from "./git.ts";
export * from "./runner.ts";
export * from "./artifacts.ts";
export * from "./github.ts";
export * from "./github_app.ts";
export * from "./conventional.ts";
