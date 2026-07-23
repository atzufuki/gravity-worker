#!/usr/bin/env -S deno run -A --unstable-kv
/**
 * Django-style management entry point for GravityWorker
 *
 * Run with:
 *   deno run -A manage.ts <command> [options]
 */

import {
  alexi_management_commands,
  getCliApplication,
} from "@alexi/core/management";
import { gravity_worker_commands } from "@gravity-worker/commands/mod.ts";

const commands = [
  ...alexi_management_commands,
  ...gravity_worker_commands,
];

const management = await getCliApplication({
  programName: "manage.ts",
  title: "GravityWorker & Alexi Management Commands",
  usage: [
    "Usage:",
    "  deno task <command> [options]",
    "  deno run -A manage.ts <command> [options]",
  ],
  version: "GravityWorker v0.1.0 (Alexi v0.8.0)",
  commands,
});

await management.execute(Deno.args);
