/**
 * Herkules - GitHub Module Tests
 *
 * @module herkules/tests/github_test
 */

import { assertEquals, assertExists } from "@std/assert";
import { detectLanguages, getGitHubContext } from "@herkules/github.ts";

Deno.test("GitHub Module - language detection", async () => {
  const langs = await detectLanguages(Deno.cwd());
  assertExists(langs);
  assertEquals(langs.includes("TypeScript"), true);
});

Deno.test("GitHub Module - get context fallback without event file", async () => {
  const ctx = await getGitHubContext(Deno.cwd());
  assertExists(ctx);
});

Deno.test("GitHub Module - parse event payload file", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "herkules_gh_test_" });
  const eventFile = `${tempDir}/event.json`;
  const payload = {
    issue: {
      number: 42,
      title: "Test Issue Title",
      body: "Test Issue Body",
    },
    sender: {
      login: "test-user",
    },
  };

  try {
    await Deno.writeTextFile(eventFile, JSON.stringify(payload));
    Deno.env.set("GITHUB_EVENT_PATH", eventFile);

    const ctx = await getGitHubContext(tempDir);
    assertEquals(ctx.issueNumber, 42);
    assertEquals(ctx.issueTitle, "Test Issue Title");
    assertEquals(ctx.sender, "test-user");
  } finally {
    Deno.env.delete("GITHUB_EVENT_PATH");
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
});
