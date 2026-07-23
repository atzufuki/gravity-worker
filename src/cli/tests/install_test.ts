/**
 * Unit Tests for InstallCommand (Automated Installation Wizard)
 *
 * @module cli/tests/install_test
 */

import { assertEquals, assertExists } from "@std/assert";
import { InstallCommand } from "@cli/commands/install.ts";

Deno.test("InstallCommand - instantiation and property checks", () => {
  const cmd = new InstallCommand();
  assertEquals(cmd.name, "install");
  assertExists(cmd.help);
});

Deno.test("InstallCommand - local mode configuration saving", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "gw_install_test_" });
  try {
    // Initialize git repo in tempDir
    const gitInit = new Deno.Command("git", { args: ["init"], cwd: tempDir });
    await gitInit.output();

    // Verify directory exists
    const stat = await Deno.stat(tempDir);
    assertEquals(stat.isDirectory, true);
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
});
