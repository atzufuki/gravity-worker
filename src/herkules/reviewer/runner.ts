/**
 * Herkules Reviewer - Automated Verification Pipeline
 *
 * Runs test suites (`deno task test` / `npm test`) and linter checks inside PR worktree.
 * Captures stdout, stderr, exit codes, and durations to determine pass/fail status.
 *
 * @module herkules/reviewer/runner
 */

import { ReviewerConfig } from "@herkules/reviewer/config.ts";

export interface VerificationCheckResult {
  passed: boolean;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface PRVerificationResult {
  testResult: VerificationCheckResult;
  lintResult?: VerificationCheckResult;
  allPassed: boolean;
}

/**
 * Runs a shell command inside a worktree directory.
 */
export async function runCommandInWorktree(
  commandStr: string,
  worktreePath: string,
): Promise<VerificationCheckResult> {
  const startTime = Date.now();
  try {
    let executable: string;
    let args: string[];

    if (commandStr.includes('"') || commandStr.includes("'") || commandStr.includes("&&") || commandStr.includes("||")) {
      executable = "sh";
      args = ["-c", commandStr];
    } else {
      const parts = commandStr.trim().split(/\s+/);
      executable = parts[0];
      args = parts.slice(1);
    }

    const cmd = new Deno.Command(executable, {
      args,
      cwd: worktreePath,
      stdout: "piped",
      stderr: "piped",
      env: {
        ...Deno.env.toObject(),
        NO_COLOR: "1",
      },
    });

    const { success, code, stdout, stderr } = await cmd.output();
    const decoder = new TextDecoder();

    return {
      passed: success,
      command: commandStr,
      stdout: decoder.decode(stdout).trim(),
      stderr: decoder.decode(stderr).trim(),
      exitCode: code,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      passed: false,
      command: commandStr,
      stdout: "",
      stderr: err instanceof Error ? err.message : String(err),
      exitCode: 1,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Detects default test command for a worktree project.
 */
async function detectTestCommand(worktreePath: string): Promise<string> {
  try {
    const hasDeno = await Deno.stat(`${worktreePath}/deno.json`).then(() => true).catch(() => false) ||
      await Deno.stat(`${worktreePath}/deno.jsonc`).then(() => true).catch(() => false);
    if (hasDeno) return "deno task test";

    const hasNpm = await Deno.stat(`${worktreePath}/package.json`).then(() => true).catch(() => false);
    if (hasNpm) return "npm test";
  } catch {
    // Fallback
  }
  return "deno task test";
}

/**
 * Detects default lint command for a worktree project if available.
 */
async function detectLintCommand(worktreePath: string): Promise<string | undefined> {
  try {
    const hasDeno = await Deno.stat(`${worktreePath}/deno.json`).then(() => true).catch(() => false) ||
      await Deno.stat(`${worktreePath}/deno.jsonc`).then(() => true).catch(() => false);
    if (hasDeno) return "deno lint";

    const hasPackageJson = await Deno.stat(`${worktreePath}/package.json`).then(() => true).catch(() => false);
    if (hasPackageJson) return "npm run lint";
  } catch {
    // None
  }
  return undefined;
}

/**
 * Executes test suite and lint checks inside the worktree directory.
 */
export async function runPRVerification(
  worktreePath: string,
  config: ReviewerConfig,
): Promise<PRVerificationResult> {
  const testCmd = config.testCommand || await detectTestCommand(worktreePath);
  const lintCmd = config.lintCommand || await detectLintCommand(worktreePath);

  const testResult = await runCommandInWorktree(testCmd, worktreePath);

  let lintResult: VerificationCheckResult | undefined;
  if (lintCmd) {
    lintResult = await runCommandInWorktree(lintCmd, worktreePath);
    if (!config.lintCommand && !lintResult.passed && (lintResult.stderr.includes("No target files") || lintResult.stdout.includes("No target files"))) {
      lintResult.passed = true;
    }
  }

  const allPassed = testResult.passed && (lintResult ? lintResult.passed : true);

  return {
    testResult,
    lintResult,
    allPassed,
  };
}
