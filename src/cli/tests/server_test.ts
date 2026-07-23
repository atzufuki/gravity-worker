/**
 * Unit Tests for ServerCommand (Local Daemon Issue Watcher)
 *
 * @module cli/tests/server_test
 */

import { assertEquals, assertExists } from "@std/assert";
import { ServerCommand } from "@cli/commands/server.ts";

Deno.test("ServerCommand - instantiation and property checks", () => {
  const cmd = new ServerCommand();
  assertEquals(cmd.name, "server");
  assertExists(cmd.help);
});

Deno.test("ServerCommand - missing target repo returns error exit code", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "gw_server_test_" });
  try {
    const cmd = new ServerCommand();
    const result = await cmd.handle({ repo: tempDir });
    assertEquals(result.exitCode, 1);
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
});
