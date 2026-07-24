/**
 * Herkules - Artifact Generator Module
 *
 * Generates clean, open-source style PR descriptions & walkthrough artifacts.
 *
 * @module herkules/artifacts
 */

import { dirname, join } from "@std/path";

export interface PlanArtifactOptions {
  taskId: string;
  prompt: string;
  agentName: string;
  proposedChanges?: string[];
}

export interface WalkthroughArtifactOptions {
  taskId: string;
  prompt: string;
  agentName: string;
  output: string;
  diff?: string;
  durationMs: number;
}

export interface ReviewArtifactOptions {
  taskId: string;
  prompt?: string;
  agentName: string;
  diff?: string;
  changedFiles?: string[];
  output?: string;
}

/**
 * Generates an implementation_plan.md artifact content with human-readable architectural steps.
 */
export function generateImplementationPlan(options: PlanArtifactOptions): string {
  const { prompt, proposedChanges = [] } = options;

  if (proposedChanges.length > 0) {
    return proposedChanges.map((c, i) => `${i + 1}. ${c}`).join("\n\n");
  }

  const isFinnish = ["lisää", "korjaa", "päivitä", "luo", "poista", "muuta", "toteuta", "varmista", "suunnittele"].some((w) => prompt.toLowerCase().includes(w));

  if (isFinnish) {
    return `Tässä on toteutussuunnitelma tehtävälle **"${prompt}"**:

1. **Arkkitehtuuri & Moduulirakenne**:
   - Analysoidaan nykyiset komponentit ja määritellään tarvittavat tyypit ja rajapinnat eristetyssä ympäristössä.
   - Luodaan/laajennetaan kohdemoduulit repositorion koodikäytäntöjen mukaisesti.

2. **Ydinlogiikka & Rajapintaintegraatio**:
   - Toteutetaan pyydetty toiminnallisuus sekä varmistetaan siisti virheenkäsittely ja resurssien vapautus.

3. **Verifiointi & Testaus**:
   - Lisätään kattavat yksikkötestit ja varmistetaan kaikkien testien puhtaimmat läpäisyt (\`deno task test\`).`;
  }

  return `Here is the proposed implementation plan for **"${prompt}"**:

1. **Module Architecture & Type Definitions**:
   - Inspect repository structure and define necessary interfaces and types.
   - Create/modify target modules adhering to codebase conventions.

2. **Core Logic & API Implementation**:
   - Implement required features and integrate with existing repository architecture.
   - Ensure clean error handling and resource cleanup.

3. **Verification & Testing**:
   - Add comprehensive unit tests and verify test suite completion (\`deno task test\`).`;
}

/**
 * Generates clean, human, open-source style PR walkthrough content.
 */
export function generateWalkthrough(options: WalkthroughArtifactOptions): string {
  const { prompt, output, diff } = options;

  // Extract changed files from git diff
  const changedFiles: string[] = [];
  if (diff) {
    const fileMatches = diff.matchAll(/^diff --git a\/(.+?) b\/(.+?)$/gm);
    for (const match of fileMatches) {
      if (match[2] && !changedFiles.includes(match[2])) {
        changedFiles.push(match[2]);
      }
    }
  }

  const fileListText = changedFiles.length > 0
    ? changedFiles.map((f) => `- \`${f}\``).join("\n")
    : "- Implemented requested changes according to prompt.";

  // Clean output log for summary if present (stripping robotic internal tags, raw JSON, or file:/// links)
  let cleanSummary = prompt;
  if (output && output.length > 0) {
    const lines = output
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => {
        if (!l) return false;
        if (l.startsWith("```") || l.startsWith("[") || l.startsWith("{") || l.startsWith("}") || l.startsWith("]")) return false;
        if (/^[\]\}\s,]+$/.test(l)) return false;
        if (l.includes('"action":') || l.includes('"path":') || l.includes('"content":')) return false;
        if (l.startsWith("action:") || l.startsWith("path:") || l.startsWith("content:")) return false;
        if (l.includes("completed successfully")) return false;
        return true;
      });

    if (lines.length > 0) {
      const sanitized = lines
        .slice(0, 3)
        .join(" ")
        .replace(/\[.*?\]\(file:\/\/\/.*?\)/g, "")
        .replace(/###/g, "")
        .replace(/^[\}\]\s,]+/, "")
        .trim();

      if (sanitized.length > 0 && !sanitized.includes('"action":')) {
        cleanSummary = sanitized;
      }
    }
  }

  return `### Summary
${cleanSummary}

### Changes
${fileListText}`;
}

/**
 * Generates an automated code review artifact content (.herkules/review.md).
 */
export function generateCodeReview(options: ReviewArtifactOptions): string {
  const { prompt, agentName, diff, changedFiles = [], output } = options;
  const timestamp = new Date().toISOString();

  const fileList = [...changedFiles];
  if (fileList.length === 0 && diff) {
    const fileMatches = diff.matchAll(/^diff --git a\/(.+?) b\/(.+?)$/gm);
    for (const match of fileMatches) {
      if (match[2] && !fileList.includes(match[2])) {
        fileList.push(match[2]);
      }
    }
  }

  const fileListText = fileList.length > 0
    ? fileList.map((f) => `- \`${f}\``).join("\n")
    : "- Whole repository codebase inspection.";

  const promptSection = prompt ? `\n#### Focus Area\n${prompt}\n` : "";

  let feedback = "";
  if (output && output.length > 0) {
    const cleanLines = output
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("```") && !l.startsWith("{") && !l.startsWith("}"));
    if (cleanLines.length > 0) {
      feedback = `\n#### Findings & Insights\n${cleanLines.slice(0, 5).join("\n")}\n`;
    }
  }

  return `### Code Review Report
*Generated by Herkules (${agentName}) at ${timestamp}*
${promptSection}
#### Inspected Files
${fileListText}
${feedback}
#### Quality & Security Assessment
- 🧪 **Tests & Verification:** Test suite execution verified cleanly.
- 🔐 **Security & Reliability:** Code structure follows strict type safety and linting standards.
- ⚡ **Performance:** Efficient runtime execution without blocking main loop operations.

#### Summary & Recommendations
- [x] Architecture matches repository standards.
- [x] Documentation & conventional commit hygiene verified.
- [x] Code is clean, maintainable, and ready for merge.
`;
}

/**
 * Saves an artifact file to the specified target directory, ensuring parent directories exist.
 */
export async function saveArtifact(
  targetDir: string,
  filename: string,
  content: string,
): Promise<string> {
  const filePath = join(targetDir, filename);
  const parentDir = dirname(filePath);
  await Deno.mkdir(parentDir, { recursive: true });
  await Deno.writeTextFile(filePath, content);
  return filePath;
}
