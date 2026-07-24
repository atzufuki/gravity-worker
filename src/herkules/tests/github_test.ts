/**
 * Herkules - GitHub Module Tests
 *
 * @module herkules/tests/github_test
 */

import { assertEquals, assertExists } from "@std/assert";
import { buildFullIssueContext, detectLanguages, getGitHubContext } from "@herkules/github.ts";

Deno.test("GitHub Module - buildFullIssueContext with Head & Tail comments", () => {
  const comments = Array.from({ length: 10 }, (_, i) => ({
    user: `user${i + 1}`,
    body: `Comment ${i + 1}`,
    createdAt: new Date().toISOString(),
  }));

  const fullText = buildFullIssueContext({
    issueNumber: 42,
    issueTitle: "Test Issue",
    issueBody: "Detailed issue description text",
    comments,
    userInstruction: "plan",
  });

  assertEquals(fullText.includes("Issue #42: Test Issue"), true);
  assertEquals(fullText.includes("Detailed issue description text"), true);
  assertEquals(fullText.includes("@user1: Comment 1"), true);
  assertEquals(fullText.includes("@user10: Comment 10"), true);
});
