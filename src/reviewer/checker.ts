export interface CheckResult {
  passed: boolean;
  testPassed: boolean;
  lintPassed: boolean;
  testOutput: string;
  lintOutput: string;
}

export class VerificationChecker {
  async runChecks(worktreePath: string, testCmd = "deno task test", lintCmd = "deno lint"): Promise<CheckResult> {
    const testResult = await this.executeCommand(worktreePath, testCmd);
    const lintResult = await this.executeCommand(worktreePath, lintCmd);

    return {
      passed: testResult.success && lintResult.success,
      testPassed: testResult.success,
      lintPassed: lintResult.success,
      testOutput: testResult.output,
      lintOutput: lintResult.output,
    };
  }

  private async executeCommand(cwd: string, fullCommand: string): Promise<{ success: boolean; output: string }> {
    const parts = fullCommand.split(" ");
    const cmdName = parts[0];
    const args = parts.slice(1);

    try {
      const command = new Deno.Command(cmdName, {
        args,
        cwd,
        stdout: "piped",
        stderr: "piped",
      });
      const output = await command.output();
      const stdout = new TextDecoder().decode(output.stdout);
      const stderr = new TextDecoder().decode(output.stderr);
      const fullOutput = `${stdout}\n${stderr}`.trim();

      return {
        success: output.success,
        output: fullOutput,
      };
    } catch (err) {
      return {
        success: false,
        output: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
