/**
 * GravityWorker - Agent Runner Interface & Implementations
 *
 * Agnostic agent runner framework for Antigravity (agy), Claude, and custom LLM engines.
 *
 * @module gravity-worker/runner
 */

export interface RunOptions {
  prompt: string;
  worktreePath: string;
  agentName?: string;
  dryRun?: boolean;
  env?: Record<string, string>;
}

export interface RunResult {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

export interface AgentRunner {
  readonly name: string;
  run(options: RunOptions): Promise<RunResult>;
}

/**
 * Antigravity (agy) Agent Runner
 */
export class AntigravityRunner implements AgentRunner {
  readonly name = "antigravity";

  async run(options: RunOptions): Promise<RunResult> {
    const { prompt, worktreePath, dryRun, env } = options;
    const startTime = Date.now();

    if (dryRun) {
      return {
        success: true,
        output: `[Dry Run] Antigravity runner simulated for prompt: "${prompt}" at ${worktreePath}`,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const command = new Deno.Command("agy", {
        args: ["--headless", prompt],
        cwd: worktreePath,
        env: { ...Deno.env.toObject(), ...env },
        stdout: "piped",
        stderr: "piped",
      });

      const output = await command.output();
      const stdout = new TextDecoder().decode(output.stdout);
      const stderr = new TextDecoder().decode(output.stderr);

      return {
        success: output.success,
        output: stdout.trim() || stderr.trim(),
        error: output.success ? undefined : stderr.trim(),
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: "",
        error: `Failed to execute agy CLI: ${errorMsg}`,
        durationMs: Date.now() - startTime,
      };
    }
  }
}

/**
 * Generic Shell / Custom Command Agent Runner
 */
export class CustomAgentRunner implements AgentRunner {
  readonly name: string;
  private readonly commandName: string;

  constructor(name: string, commandName: string) {
    this.name = name;
    this.commandName = commandName;
  }

  async run(options: RunOptions): Promise<RunResult> {
    const { prompt, worktreePath, dryRun, env } = options;
    const startTime = Date.now();

    if (dryRun) {
      return {
        success: true,
        output: `[Dry Run] ${this.name} runner simulated for prompt: "${prompt}" at ${worktreePath}`,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const command = new Deno.Command(this.commandName, {
        args: [prompt],
        cwd: worktreePath,
        env: { ...Deno.env.toObject(), ...env },
        stdout: "piped",
        stderr: "piped",
      });

      const output = await command.output();
      const stdout = new TextDecoder().decode(output.stdout);
      const stderr = new TextDecoder().decode(output.stderr);

      return {
        success: output.success,
        output: stdout.trim() || stderr.trim(),
        error: output.success ? undefined : stderr.trim(),
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: "",
        error: `Failed to execute ${this.commandName}: ${errorMsg}`,
        durationMs: Date.now() - startTime,
      };
    }
  }
}

/**
 * Factory for instantiating AgentRunners by name.
 */
export class AgentRunnerFactory {
  static getRunner(agentName: string = "antigravity"): AgentRunner {
    const normalized = agentName.toLowerCase();
    if (normalized === "antigravity" || normalized === "agy") {
      return new AntigravityRunner();
    }
    return new CustomAgentRunner(normalized, normalized);
  }
}
