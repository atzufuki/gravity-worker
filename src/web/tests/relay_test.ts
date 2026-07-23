import { assertEquals, assertExists } from "@std/assert";
import { TunnelRegistry, handleTokenRelayRequest } from "@web/relay.ts";

Deno.test("Relay Subsystem - handleTokenRelayRequest missing parameters returns 400", async () => {
  const req = new Request("http://localhost:8000/api/token");
  const res = await handleTokenRelayRequest(req);
  assertEquals(res.status, 400);
});

Deno.test("Relay Subsystem - TunnelRegistry status tracking", async () => {
  const isOnline = await TunnelRegistry.isOnline("atzufuki/siht.io");
  assertEquals(isOnline, false);
});
