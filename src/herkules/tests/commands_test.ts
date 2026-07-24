import { assertEquals } from "@std/assert";
import {
  formatCommandResponse,
  getCommandHelp,
  getSupportedCommands,
  parseCommentCommand,
} from "@herkules/commands.ts";

Deno.test("Comment Commands - getSupportedCommands and getCommandHelp", () => {
  const commands = getSupportedCommands();
  assertEquals(commands, ["plan", "update", "review", "retry", "run"]);

  assertEquals(getCommandHelp("plan").includes("implementation plan"), true);
  assertEquals(getCommandHelp("update").includes("worktree branch"), true);
  assertEquals(getCommandHelp("review").includes("code review"), true);
  assertEquals(getCommandHelp("retry").includes("Cleans worktree state"), true);
  assertEquals(getCommandHelp("run").includes("isolated Git worktree"), true);
});

Deno.test("Comment Commands - parse @herkules plan command", () => {
  const result = parseCommentCommand("@herkules plan Add authentication middleware");
  assertEquals(result.command, "plan");
  assertEquals(result.prompt, "Add authentication middleware");
  assertEquals(result.isMentioned, true);
});

Deno.test("Comment Commands - parse @herkules update command", () => {
  const result = parseCommentCommand("@herkules update Fix typing errors in auth router");
  assertEquals(result.command, "update");
  assertEquals(result.prompt, "Fix typing errors in auth router");
  assertEquals(result.isMentioned, true);
});

Deno.test("Comment Commands - parse @herkules review command", () => {
  const result = parseCommentCommand("@herkules review check for memory leaks");
  assertEquals(result.command, "review");
  assertEquals(result.prompt, "check for memory leaks");
  assertEquals(result.isMentioned, true);
});

Deno.test("Comment Commands - parse @herkules retry command", () => {
  const result = parseCommentCommand("@herkules retry with clean worktree");
  assertEquals(result.command, "retry");
  assertEquals(result.prompt, "with clean worktree");
  assertEquals(result.isMentioned, true);
});

Deno.test("Comment Commands - parse slash commands /plan, /update, /review, /retry", () => {
  const planResult = parseCommentCommand("/plan Refactor user service");
  assertEquals(planResult.command, "plan");
  assertEquals(planResult.prompt, "Refactor user service");
  assertEquals(planResult.isMentioned, true);

  const updateResult = parseCommentCommand("/update: Add unit tests");
  assertEquals(updateResult.command, "update");
  assertEquals(updateResult.prompt, "Add unit tests");
  assertEquals(updateResult.isMentioned, true);

  const reviewResult = parseCommentCommand("/review security audit");
  assertEquals(reviewResult.command, "review");
  assertEquals(reviewResult.prompt, "security audit");
  assertEquals(reviewResult.isMentioned, true);

  const retryResult = parseCommentCommand("/retry");
  assertEquals(retryResult.command, "retry");
  assertEquals(retryResult.prompt, "");
  assertEquals(retryResult.isMentioned, true);
});

Deno.test("Comment Commands - parse bot variant @herkules-bot and colons", () => {
  const planResult = parseCommentCommand("@herkules-bot plan: refactor database models");
  assertEquals(planResult.command, "plan");
  assertEquals(planResult.prompt, "refactor database models");
  assertEquals(planResult.isMentioned, true);

  const reviewResult = parseCommentCommand("@herkules[bot], review: check security");
  assertEquals(reviewResult.command, "review");
  assertEquals(reviewResult.prompt, "check security");
  assertEquals(reviewResult.isMentioned, true);

  const slashHerkulesResult = parseCommentCommand("/herkules update fix CSS overflow");
  assertEquals(slashHerkulesResult.command, "update");
  assertEquals(slashHerkulesResult.prompt, "fix CSS overflow");
  assertEquals(slashHerkulesResult.isMentioned, true);
});

Deno.test("Comment Commands - fallback run command when mention has no keyword", () => {
  const result = parseCommentCommand("@herkules create a new dark mode layout");
  assertEquals(result.command, "run");
  assertEquals(result.prompt, "create a new dark mode layout");
  assertEquals(result.isMentioned, true);
});

Deno.test("Comment Commands - direct command keyword without mention", () => {
  const result = parseCommentCommand("plan Create REST API endpoints");
  assertEquals(result.command, "plan");
  assertEquals(result.prompt, "Create REST API endpoints");
  assertEquals(result.isMentioned, false);
});

Deno.test("Comment Commands - formatCommandResponse for plan", () => {
  const response = formatCommandResponse("plan", {
    prompt: "Add auth middleware",
    content: "Step 1: Create auth.ts\nStep 2: Add JWT check",
    issueNumber: 42,
  });

  assertEquals(response.command, "plan");
  assertEquals(response.success, true);
  assertEquals(response.artifactIdentifier, ".herkules/implementation_plan.md");
  assertEquals(response.body.includes("Step 1: Create auth.ts"), true);
});

Deno.test("Comment Commands - formatCommandResponse for review", () => {
  const response = formatCommandResponse("review", {
    prompt: "Security audit",
    content: "### Quality & Security Assessment\nNo vulnerabilities detected.",
    issueNumber: 42,
  });

  assertEquals(response.command, "review");
  assertEquals(response.success, true);
  assertEquals(response.artifactIdentifier, ".herkules/review.md");
  assertEquals(response.body.includes("🔍 **Herkules Automated Code Review**"), true);
  assertEquals(response.body.includes("Security audit"), true);
});

Deno.test("Comment Commands - formatCommandResponse for update and retry", () => {
  const updateRes = formatCommandResponse("update", {
    prompt: "Update docs",
    content: "Updated README.md",
    prUrl: "https://github.com/owner/repo/pull/1",
  });
  assertEquals(updateRes.command, "update");
  assertEquals(updateRes.body.includes("🔄 **Herkules Worktree & PR Update**"), true);

  const retryRes = formatCommandResponse("retry", {
    prompt: "Retry build",
    content: "Re-executed build",
    prUrl: "https://github.com/owner/repo/pull/1",
  });
  assertEquals(retryRes.command, "retry");
  assertEquals(retryRes.body.includes("🔁 **Herkules Task Retry**"), true);
});

Deno.test("Comment Commands - formatCommandResponse for failure", () => {
  const failRes = formatCommandResponse("update", {
    success: false,
    error: "Branch conflict encountered",
  });
  assertEquals(failRes.success, false);
  assertEquals(failRes.title.includes("failed"), true);
  assertEquals(failRes.body.includes("Branch conflict encountered"), true);
});
