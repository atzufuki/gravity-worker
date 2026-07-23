/**
 * Herkules CLI Application Module
 *
 * @module cli
 */

import type { AppConfig } from "@alexi/types";

export const CliConfig: AppConfig = {
  name: "cli",
  verboseName: "Herkules CLI App",
  appPath: new URL("./", import.meta.url).href,
};

export * from "./commands/mod.ts";
