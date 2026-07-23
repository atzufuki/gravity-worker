#!/usr/bin/env -S deno run -A
/**
 * Herkules CLI Entrypoint (Wrapper)
 *
 * Forwards execution to @cli/cli.ts main entrypoint.
 *
 * @module project/cli
 */

import { main } from "@cli/cli.ts";

if (import.meta.main) {
  await main();
}
