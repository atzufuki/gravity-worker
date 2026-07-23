/**
 * GravityWorker - GitHub Module Tests
 */

import { assertEquals, assert } from "@std/assert";
import { getGitHubContext } from "../github.ts";

Deno.test("GitHub Module - get context fallback without event file", async () => {
  const ctx = await getGitHubContext();
  assertEquals(ctx.issueNumber, undefined);
});

Deno.test("GitHub Module - parse event payload file", async () => {
  const tmpFile = await Deno.makeTempFile();
  const payload = {
    issue: {
      number: 42,
      title: "Test issue title",
      body: "Test issue body",
    },
    sender: {
      login: "test-user",
    },
  };

  await Deno.writeTextFile(tmpFile, JSON.stringify(payload));
  Deno.env.set("GITHUB_EVENT_PATH", tmpFile);
  Deno.env.set("GITHUB_REPOSITORY", "owner/test-repo");

  try {
    const ctx = await getGitHubContext();
    assertEquals(ctx.issueNumber, 42);
    assertEquals(ctx.issueTitle, "Test issue title");
    assertEquals(ctx.repoOwner, "owner");
    assertEquals(ctx.repoName, "test-repo");
    assertEquals(ctx.sender, "test-user");
  } finally {
    Deno.env.delete("GITHUB_EVENT_PATH");
    Deno.env.delete("GITHUB_REPOSITORY");
    await Deno.remove(tmpFile).catch(() => {});
  }
});
