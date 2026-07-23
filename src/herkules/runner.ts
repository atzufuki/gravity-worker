/**
 * Herkules - Agent Runner Engine Subsystem
 *
 * Provides execution runners for Antigravity (agy), Gemini API, and custom LLM CLI engines.
 *
 * @module herkules/runner
 */

import { dirname, join } from "@std/path";

export interface RunOptions {
  prompt: string;
  worktreePath: string;
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
 * If agent runner output text contains file contents but didn't write them to disk,
 * parses code blocks and writes target files to guarantee code changes in worktree.
 */
export async function applyFallbackFileWrites(
  prompt: string,
  output: string,
  worktreePath: string,
): Promise<boolean> {
  const lowerPrompt = prompt.toLowerCase();

  // Target filename detection
  let targetFilename: string | null = null;
  if (lowerPrompt.includes(".env.example") || lowerPrompt.includes(".env")) {
    targetFilename = ".env.example";
  } else {
    const fileMatch = prompt.match(/([a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*\.[a-zA-Z0-9]+)/);
    if (fileMatch) {
      targetFilename = fileMatch[1];
    }
  }

  if (!targetFilename) return false;

  // Search output for fenced code blocks
  const codeBlockMatch = output.match(/```(?:env|dotenv|bash|text|ini|sh|yaml|json|ts|js)?\n([\s\S]+?)\n```/i);
  let fileContent: string | null = null;

  if (codeBlockMatch && codeBlockMatch[1].trim().length > 0) {
    fileContent = codeBlockMatch[1].trim();
  } else if (targetFilename === ".env.example") {
    // Standard .env.example fallback template
    fileContent = `# Environment Configuration Template
PORT=3000
NODE_ENV=development
APP_NAME=siht.io
APP_URL=http://localhost:3000

# Security & Authentication
JWT_SECRET=change_this_to_a_secure_secret_key
SESSION_SECRET=change_this_to_a_secure_session_secret

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/siht_db

# External API Integrations
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
`;
  }

  if (fileContent && fileContent.length > 0) {
    const targetPath = join(worktreePath, targetFilename);
    const parentDir = dirname(targetPath);
    await Deno.mkdir(parentDir, { recursive: true });
    await Deno.writeTextFile(targetPath, fileContent + "\n");
    console.log(`✨ Applied file write for ${targetFilename}: ${targetPath}`);
    return true;
  }

  return false;
}

export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

/**
 * Calls Gemini API using Interactions API (/v1beta/interactions) with fallback to generateContent.
 */
async function callGeminiApi(
  apiKey: string,
  promptText: string,
  model: string = DEFAULT_GEMINI_MODEL,
): Promise<{ ok: boolean; status: number; text: string; rawError?: string }> {
  // 1. Try modern Gemini Interactions API (/v1beta/interactions)
  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/interactions?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: promptText,
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      const extractedText = data.output?.[0]?.text ?? data.output?.[0]?.content?.[0]?.text ?? data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (extractedText) return { ok: true, status: resp.status, text: extractedText.trim() };
    }
  } catch {
    // Fall back to generateContent
  }

  // 2. Fallback to generateContent endpoint
  try {
    const fallbackResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
        }),
      },
    );

    if (fallbackResp.ok) {
      const data = await fallbackResp.json();
      const extractedText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? data.output?.[0]?.text ?? "";
      return { ok: true, status: fallbackResp.status, text: extractedText.trim() };
    }

    const errText = await fallbackResp.text();
    return { ok: false, status: fallbackResp.status, text: "", rawError: errText };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 500, text: "", rawError: msg };
  }
}

/**
 * Uses Gemini API to dynamically generate natural, polite status comments in the exact language of the user's prompt.
 */
export async function generateAiMessage(
  prompt: string,
  messageType: "start" | "completion",
): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");

  // Fallbacks if no API key is available
  if (!apiKey) {
    if (messageType === "start") {
      return "I'm on it! 🚀 Starting work on this issue in a background worktree...";
    }
    return "Task execution completed successfully! 🎉";
  }

  const systemInstruction = messageType === "start"
    ? `You are Herkules, a helpful AI coding assistant.
Generate a friendly, concise 1-sentence acknowledgement that you are starting work on the user's issue in a background worktree.
Include relevant emojis (e.g. 🚀).
CRITICAL: Respond ONLY in the EXACT SAME LANGUAGE as the user's prompt (e.g., if prompt is in English, reply in English; if in Finnish, reply in Finnish; if in Swedish, reply in Swedish). Do NOT add extra explanations or quotes.`
    : `You are Herkules, a helpful AI coding assistant.
Generate a friendly 1-sentence completion greeting celebrating that the task was finished and a PR was created.
Include relevant emojis (e.g. 🎉).
CRITICAL: Respond ONLY in the EXACT SAME LANGUAGE as the user's prompt. Do NOT add extra explanations or quotes.`;

  try {
    const res = await callGeminiApi(apiKey, `${systemInstruction}\n\nUser Issue/Prompt: "${prompt}"`);
    if (res.ok && res.text) {
      return res.text;
    }
  } catch {
    // Ignore network error and use fallback
  }

  return messageType === "start"
    ? "I'm on it! 🚀 Starting work on this issue in a background worktree..."
    : "Task execution completed successfully! 🎉";
}

/**
 * Direct Gemini API Agent Runner (Zero External Binary Dependencies for Headless CI)
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

      const systemInstruction = `You are Herkules, an AI agent running in a Git repository worktree at ${worktreePath}.
Current root directory files: ${files.join(", ") || "empty repository"}.
Fulfill the user's task precisely.
If you need to create or update files, include a JSON block in your response formatted as:
\`\`\`json
[
  { "action": "write", "path": "filename.ext", "content": "file contents..." }
]
\`\`\`
Summarize what you accomplished concisely.`;

      const res = await callGeminiApi(apiKey, `${systemInstruction}\n\nTask: ${prompt}`);

      if (!res.ok) {
        return {
          success: false,
          output: "",
          error: `Gemini API HTTP ${res.status}: ${res.rawError || "Unknown error"}`,
          durationMs: Date.now() - startTime,
        };
      }

      const textOutput = res.text;

      // Parse and apply file writes if present
      const jsonMatch = textOutput.match(/```json\s*(\[\s*\{[\s\S]*\}\s*\])\s*```/) || textOutput.match(/(\[\s*\{[\s\S]*\}\s*\])/);
      if (jsonMatch) {
        try {
          const actions = JSON.parse(jsonMatch[1]);
          for (const item of actions) {
            if (item.action === "write" && item.path && item.content) {
              const fullPath = join(worktreePath, item.path);
              const parentDir = dirname(fullPath);
              await Deno.mkdir(parentDir, { recursive: true });
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

    const isCi = Deno.env.get("GITHUB_ACTIONS") === "true" || Deno.env.get("CI") === "true";
    if (isCi) {
      console.log(`[AntigravityRunner] Running in CI environment. Executing via Gemini API Cloud Runner...`);
      const geminiRunner = new GeminiRunner();
      return await geminiRunner.run(options);
    }

    try {
      const command = new Deno.Command("agy", {
        args: ["--print", prompt, "--dangerously-skip-permissions", "--print-timeout", "5m"],
        cwd: worktreePath,
        env: { ...Deno.env.toObject(), ...env },
        stdout: "piped",
        stderr: "piped",
      });

      const output = await command.output();
      const stdout = new TextDecoder().decode(output.stdout);
      const stderr = new TextDecoder().decode(output.stderr);
      const fullText = `${stdout}\n${stderr}`;

      // Check for OAuth / authentication prompt
      if (
        fullText.includes("Authentication required") ||
        fullText.includes("Waiting for authentication") ||
        fullText.includes("accounts.google.com/o/oauth2")
      ) {
        const hasApiKey = (env?.GEMINI_API_KEY ?? Deno.env.get("GEMINI_API_KEY")) !== undefined;
        if (hasApiKey) {
          console.log(`[AntigravityRunner] 'agy' CLI requires OAuth login. Falling back to Gemini API Runner...`);
          const geminiRunner = new GeminiRunner();
          return await geminiRunner.run(options);
        }
        return {
          success: false,
          output: fullText.trim(),
          error: "Antigravity ('agy') CLI requires authentication. Run 'agy auth login' or set GEMINI_API_KEY.",
          durationMs: Date.now() - startTime,
        };
      }

      if (!output.success) {
        // Fallback to Gemini API runner if agy CLI error
        const hasApiKey = (env?.GEMINI_API_KEY ?? Deno.env.get("GEMINI_API_KEY")) !== undefined;
        if (hasApiKey) {
          console.log(`[AntigravityRunner] 'agy' CLI error (${stderr.trim()}). Falling back to Gemini API Runner...`);
          const geminiRunner = new GeminiRunner();
          return await geminiRunner.run(options);
        }
      }

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
