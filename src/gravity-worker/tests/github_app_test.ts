/**
 * GravityWorker - GitHub App Manifest Module Tests
 */

import { assertEquals, assert } from "@std/assert";
import { buildAppManifest, getManifestUrl } from "../github_app.ts";

Deno.test("GitHub App - manifest building", () => {
  const manifest = buildAppManifest({ appName: "gravity-worker-test" });
  assertEquals(manifest.name, "gravity-worker-test");
  assert(manifest.default_permissions !== undefined);
});

Deno.test("GitHub App - manifest URL generation", () => {
  const url = getManifestUrl({ appName: "gravity-worker-test" });
  assert(url.startsWith("https://github.com/settings/apps/new?manifest="));
});
