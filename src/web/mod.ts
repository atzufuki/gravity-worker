/**
 * Herkules Web Application Module
 *
 * @module web
 */

import type { AppConfig } from "@alexi/types";

export const WebConfig: AppConfig = {
  name: "web",
  verboseName: "Herkules Web App",
  appPath: new URL("./", import.meta.url).href,
};

export * from "./views.ts";
export * from "./urls.ts";
export * from "./relay.ts";
