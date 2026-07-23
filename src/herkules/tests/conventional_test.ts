/**
 * Conventional Commits Tests
 *
 * @module herkules/tests/conventional_test
 */

import { assertEquals } from "@std/assert";
import {
  detectConventionalType,
  generateConventionalMetadata,
} from "@herkules/conventional.ts";

Deno.test("Conventional Commits - type detection", () => {
  assertEquals(detectConventionalType("Fix race condition in auth"), "fix");
  assertEquals(detectConventionalType("Add new user profile view"), "feat");
  assertEquals(detectConventionalType("Update README documentation"), "docs");
  assertEquals(detectConventionalType("Refactor database queries"), "refactor");
  assertEquals(detectConventionalType("Add unit tests for API"), "test");
  assertEquals(detectConventionalType("Update Deno config dependencies"), "chore");
});

Deno.test("Conventional Commits - metadata generation for feature", () => {
  const meta = generateConventionalMetadata("Add dark mode toggle to UI");
  assertEquals(meta.type, "feat");
  assertEquals(meta.summary, "add dark mode toggle to UI");
  assertEquals(meta.branchName, "feat/add-dark-mode-toggle-to-ui");
  assertEquals(meta.commitMessage, "feat: add dark mode toggle to UI");
  assertEquals(meta.prTitle, "feat: add dark mode toggle to UI");
});

Deno.test("Conventional Commits - metadata generation for bug fix with issue", () => {
  const meta = generateConventionalMetadata("Fix crash on empty payload", 42);
  assertEquals(meta.type, "fix");
  assertEquals(meta.summary, "fix crash on empty payload");
  assertEquals(meta.branchName, "fix/42-fix-crash-on-empty-payload");
  assertEquals(meta.commitMessage, "fix: fix crash on empty payload (closes #42)");
  assertEquals(meta.prTitle, "fix: fix crash on empty payload");
});
