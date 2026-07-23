/**
 * Unit Tests for ProxyCommand (Local Antigravity Execution Proxy Server)
 *
 * @module cli/tests/proxy_test
 */

import { assertEquals, assertExists } from "@std/assert";
import { ProxyCommand } from "@cli/commands/proxy.ts";

Deno.test({
  name: "ProxyCommand - instantiation and property checks",
  fn() {
    const cmd = new ProxyCommand();
    assertEquals(cmd.name, "proxy");
    assertExists(cmd.help);
  },
});
