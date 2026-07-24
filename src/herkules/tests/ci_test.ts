/**
 * Herkules - CI & Release Workflow Infrastructure Tests
 */

import { assert } from "@std/assert";

Deno.test("CI Workflow - ci.yml exists and configures automated test CI", async () => {
  const content = await Deno.readTextFile(".github/workflows/ci.yml");
  assert(content.length > 0, "ci.yml should not be empty");
  assert(content.includes("Automated Test CI"), "ci.yml should have name Automated Test CI");
  assert(content.includes("deno task test"), "ci.yml should execute deno task test");
  assert(content.includes("push:"), "ci.yml should trigger on push");
  assert(content.includes("pull_request:"), "ci.yml should trigger on pull_request");
});

Deno.test("Release Workflow - release.yml exists and configures tag-gated release workflow", async () => {
  const content = await Deno.readTextFile(".github/workflows/release.yml");
  assert(content.length > 0, "release.yml should not be empty");
  assert(content.includes("Tag-Gated Release Workflow"), "release.yml should have name Tag-Gated Release Workflow");
  assert(content.includes("tags:"), "release.yml should be tag-gated");
  assert(content.includes("- 'v*'"), "release.yml should trigger on v* tags");
  assert(content.includes("generate_release_notes: true"), "release.yml should generate release notes");
  assert(content.includes("deno task compile"), "release.yml should compile binary");
  assert(content.includes("deno task test"), "release.yml should run pre-flight tests");
  assert(content.includes("softprops/action-gh-release"), "release.yml should publish GitHub release");
});
