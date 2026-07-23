/**
 * Conventional Commits & Branch Naming Subsystem
 *
 * Enforces Conventional Commits standards (feat:, fix:, chore:, docs:, refactor:)
 * for Git branches, commit messages, and GitHub Pull Request titles.
 *
 * @module herkules/conventional
 */

export interface ConventionalMetadata {
  type: "feat" | "fix" | "docs" | "style" | "refactor" | "test" | "chore";
  summary: string;
  slug: string;
  branchName: string;
  commitMessage: string;
  prTitle: string;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .substring(0, 40)
    .replace(/-+$/, "");
}

export function detectConventionalType(
  prompt: string,
  issueNumber?: number,
): "feat" | "fix" | "docs" | "style" | "refactor" | "test" | "chore" {
  const lower = prompt.toLowerCase();
  if (lower.includes("fix") || lower.includes("bug") || lower.includes("resolve") || lower.includes("error") || lower.includes("crash")) {
    return "fix";
  }
  if (lower.includes("readme") || lower.includes("doc") || lower.includes("comment")) {
    return "docs";
  }
  if (lower.includes("refactor") || lower.includes("clean") || lower.includes("restructure")) {
    return "refactor";
  }
  if (lower.includes("test") || lower.includes("coverage")) {
    return "test";
  }
  if (lower.includes("ci") || lower.includes("build") || lower.includes("deps") || lower.includes("config")) {
    return "chore";
  }
  if (lower.includes("add") || lower.includes("new") || lower.includes("create") || lower.includes("implement") || lower.includes("feature")) {
    return "feat";
  }
  return issueNumber ? "fix" : "feat";
}

/**
 * Formats summary into clean Conventional Commits lowercase style while preserving code identifiers & acronyms.
 */
export function formatConventionalSummary(text: string): string {
  const words = text.trim().split(/\s+/);
  const formattedWords = words.map((word) => {
    // Preserve backticked tokens, file paths/extensions (.env.example), code tokens (_), or all-caps acronyms (API, JWT)
    if (word.startsWith("`") || word.includes(".") || word.includes("_") || (word.length > 1 && word === word.toUpperCase())) {
      return word;
    }
    return word.toLowerCase();
  });

  let result = formattedWords.join(" ");
  if (result.endsWith(".")) {
    result = result.slice(0, -1);
  }
  return result;
}

export function generateConventionalMetadata(prompt: string, issueNumber?: number): ConventionalMetadata {
  const type = detectConventionalType(prompt, issueNumber);
  const cleanSummary = formatConventionalSummary(prompt);

  const slug = slugify(prompt);
  const issuePrefix = issueNumber ? `${issueNumber}-` : "";
  const branchName = `${type}/${issuePrefix}${slug || "task"}`;

  const closesSuffix = issueNumber ? ` (closes #${issueNumber})` : "";
  const commitMessage = `${type}: ${cleanSummary}${closesSuffix}`;
  const prTitle = `${type}: ${cleanSummary}`;

  return {
    type,
    summary: cleanSummary,
    slug,
    branchName,
    commitMessage,
    prTitle,
  };
}
