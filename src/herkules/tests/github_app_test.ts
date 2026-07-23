/**
 * Herkules - GitHub App Manifest Module Tests
 *
 * @module herkules/tests/github_app_test
 */

import { assertEquals, assertExists } from "@std/assert";
import { buildAppManifest } from "@herkules/github_app.ts";

Deno.test("GitHub App - manifest building", () => {
  const manifest = buildAppManifest({ appName: "herkules-test" });
  assertEquals(manifest.name, "herkules-test");
  assertExists(manifest.default_permissions);
  assertEquals(manifest.public, true);
});
