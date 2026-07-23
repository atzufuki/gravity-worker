/**
 * GravityWorker - Agent Runner Interface & Implementations
 *
 * Agnostic agent runner framework for Antigravity (agy), Gemini API, Claude, and custom LLM engines.
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
 * Direct Gemini API Agent Runner (Zero External Binary Dependencies)
 */
export class GeminiRunner implements AgentRunner {
  readonly name = "gemini";

  async run(options: RunOptions): Promise<RunResult> {
    const { prompt, worktreePath, dryRun, env } = options;
    const startTime = Date.now();
    const apiKey = env?.GEMINI_API_KEY ?? Deno.env.get("GEMINI_API_KEY");

    if (dryRun) {
      return {
        success: true,
        output: `[Dry Run] Gemini API runner simulated for prompt: "${prompt}" at ${worktreePath}`,
        durationMs: Date.now() - startTime,
      };
    }

    if (!apiKey) {
      return {
        success: false,
        output: "",
        error: "GEMINI_API_KEY environment variable is missing.",
        durationMs: Date.now() - startTime,
      };
    }

    try {
      // 1. Gather repository context (list non-hidden files)
      const files: string[] = [];
      try {
        for await (const entry of Deno.readDir(worktreePath)) {
          if (!entry.name.startsWith(".")) {
            files.push(entry.name);
          }
        }
      } catch {
        // Ignore readDir error if empty
      }

      const systemInstruction = `You are GravityWorker, an AI agent running in a Git repository worktree at ${worktreePath}.
Current root directory files: ${files.join(", ") || "empty repository"}.
Fulfill the user's task precisely.
If you need to create or update files, include a JSON block in your response formatted as:
\`\`\`json
[
  { "action": "write", "path": "filename.ext", "content": "file contents..." }
]
\`\`\`
Summarize what you accomplished concisely.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemInstruction}\n\nTask: ${prompt}` }] }],
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          output: "",
          error: `Gemini API HTTP ${response.status}: ${errorText}`,
          durationMs: Date.now() - startTime,
        };
      }

      const data = await response.json();
      const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      // Parse and apply file writes if present
      const jsonMatch = textOutput.match(/```json\s*(\[\s*\{[\s\S]*\}\s*\])\s*```/) || textOutput.match(/(\[\s*\{[\s\S]*\}\s*\])/);
      if (jsonMatch) {
        try {
          const actions = JSON.parse(jsonMatch[1]);
          for (const item of actions) {
            if (item.action === "write" && item.path && item.content) {
              const fullPath = `${worktreePath}/${item.path}`;
              await Deno.writeTextFile(fullPath, item.content);
              console.log(`[GeminiRunner] Applied file change: ${item.path}`);
            }
          }
        } catch (e) {
          console.warn("[GeminiRunner] Warning: Could not parse file action JSON:", e);
        }
      }

      return {
        success: true,
        output: textOutput.trim() || "Task executed successfully.",
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: "",
        error: `Gemini API error: ${errorMsg}`,
        durationMs: Date.now() - startTime,
      };
    }
  }
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
      // Fallback to Gemini API runner if agy binary is not installed in PATH
      const hasApiKey = (env?.GEMINI_API_KEY ?? Deno.env.get("GEMINI_API_KEY")) !== undefined;
      if (hasApiKey) {
        console.log(`[AntigravityRunner] 'agy' binary not found in PATH. Falling back to Gemini API Runner...`);
        const geminiRunner = new GeminiRunner();
        return await geminiRunner.run(options);
      }

      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: "",
        error: `'agy' CLI not found in PATH and GEMINI_API_KEY is not set: ${errorMsg}`,
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
    if (normalized === "gemini") {
      return new GeminiRunner();
    }
    return new CustomAgentRunner(normalized, normalized);
  }
}
