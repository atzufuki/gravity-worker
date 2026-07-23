/**
 * Unit Tests for ProxyCommand (Local Antigravity Execution Proxy Server)
 *
 * @module cli/tests/proxy_test
 */

import { assertEquals, assertExists } from "@std/assert";
import { ProxyCommand } from "@cli/commands/proxy.ts";
import { collectModifiedFiles } from "@cli/commands/proxy.ts";

Deno.test({
  name: "ProxyCommand - instantiation and property checks",
  fn() {
    const cmd = new ProxyCommand();
    assertEquals(cmd.name, "proxy");
    assertExists(cmd.help);
  },
});

Deno.test("ProxyCommand - collectModifiedFiles recursive directory traversal", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "herkules_proxy_collect_" });
  try {
    // Create root file and nested subdirectory file
    await Deno.writeTextFile(`${tempDir}/.env.example`, "PORT=3000\n");
    await Deno.mkdir(`${tempDir}/src/commands`, { recursive: true });
    await Deno.writeTextFile(`${tempDir}/src/commands/types.ts`, "export interface Options {}\n");

    const files = await collectModifiedFiles(tempDir);
    assertExists(files[".env.example"]);
    assertExists(files["src/commands/types.ts"]);
    assertEquals(files["src/commands/types.ts"].includes("export interface Options"), true);
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
});
