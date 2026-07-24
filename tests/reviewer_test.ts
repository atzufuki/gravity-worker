import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseReviewerConfig } from "../src/reviewer/config.ts";
import { AIReviewer } from "../src/reviewer/ai_reviewer.ts";
import { AutoMerger } from "../src/reviewer/auto_merge.ts";

Deno.test("Config - parses --auto-merge flag correctly", () => {
  const config = parseReviewerConfig(["--auto-merge", "--pr=123"]);
  assertEquals(config.autoMerge, true);
  assertEquals(config.prNumber, 123);
});

Deno.test("AI Reviewer - flags security risks and debug statements", async () => {
  const reviewer = new AIReviewer();
  const diff = `
+++ b/src/app.ts
@@ -1,3 +1,5 @@
+console.log("debug");
+eval("unsafe");
`;

  const result = await reviewer.reviewDiff(diff);
  assertEquals(result.approved, false);
  assertEquals(result.comments.length, 2);
  assertEquals(result.comments[0].category, "style");
  assertEquals(result.comments[1].category, "security");
});

Deno.test("AI Reviewer - approves clean diff", async () => {
  const reviewer = new AIReviewer();
  const diff = `
+++ b/src/app.ts
@@ -1,3 +1,4 @@
+const sum = (a: number, b: number): number => a + b;
`;

  const result = await reviewer.reviewDiff(diff);
  assertEquals(result.approved, true);
  assertEquals(result.comments.length, 0);
});

Deno.test("AutoMerger - skips when autoMerge flag is false", async () => {
  const merger = new AutoMerger();
  const result = await merger.evaluateAndMerge({
    autoMergeEnabled: false,
    checksPassed: true,
    aiApproved: true,
    prId: 42,
  });

  assertEquals(result.merged, false);
  assertExists(result.reason);
});

Deno.test("AutoMerger - skips when tests fail", async () => {
  const merger = new AutoMerger();
  const result = await merger.evaluateAndMerge({
    autoMergeEnabled: true,
    checksPassed: false,
    aiApproved: true,
    prId: 42,
  });

  assertEquals(result.merged, false);
});
