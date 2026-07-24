import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { healthView, tokenRelayView, tunnelView } from "@web/views.ts";
import { cleanupRelay } from "@web/relay.ts";

Deno.test("Views API - healthView returns HTTP 200 with status ok and version", async () => {
  const req = new Request("http://localhost:8000/health/");
  const res = healthView(req);
  assertEquals(res.status, 200);

  const data = await res.json();
  assertEquals(data.status, "ok");
  assertEquals(data.app, "herkules");
  assertExists(data.version);
  assertExists(data.timestamp);
});

Deno.test("Views API - tokenRelayView missing owner/repo returns HTTP 400", async () => {
  const req = new Request("http://localhost:8000/api/token/");
  const res = await tokenRelayView(req);
  assertEquals(res.status, 400);

  const data = await res.json();
  assertStringIncludes(data.error, "Missing required");
});

Deno.test("Views API - tokenRelayView with invalid HTTP method returns 405", async () => {
  const req = new Request("http://localhost:8000/api/token/", { method: "DELETE" });
  const res = await tokenRelayView(req);
  assertEquals(res.status, 405);
});

Deno.test("Views API - tunnelView invalid path format returns HTTP 400", async () => {
  const req = new Request("http://localhost:8000/invalid-path");
  const res = await tunnelView(req);
  assertEquals(res.status, 400);

  const data = await res.json();
  assertStringIncludes(data.error, "Invalid tunnel URL format");
});

Deno.test("Views API - tunnelView health check offline repo returns HTTP 503", async () => {
  try {
    const req = new Request("http://localhost:8000/tunnel/nonexistent-owner/nonexistent-repo/health");
    const res = await tunnelView(req);
    assertEquals(res.status, 503);

    const data = await res.json();
    assertEquals(data.status, "offline");
    assertEquals(data.repo, "nonexistent-owner/nonexistent-repo");
  } finally {
    cleanupRelay();
  }
});
