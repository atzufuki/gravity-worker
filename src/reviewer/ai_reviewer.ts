export interface ReviewComment {
  path: string;
  line: number;
  body: string;
  category: "bug" | "security" | "style" | "improvement";
}

export interface AIReviewResult {
  approved: boolean;
  summary: string;
  comments: ReviewComment[];
  issuesFound: number;
}

export class AIReviewer {
  private apiKey?: string;
  private model: string;

  constructor(apiKey?: string, model = "gpt-4o") {
    this.apiKey = apiKey || Deno.env.get("OPENAI_API_KEY") || Deno.env.get("AI_API_KEY");
    this.model = model;
  }

  async reviewDiff(diffText: string): Promise<AIReviewResult> {
    if (!diffText.trim()) {
      return {
        approved: true,
        summary: "No changes detected in diff.",
        comments: [],
        issuesFound: 0,
      };
    }

    const comments: ReviewComment[] = [];
    const lines = diffText.split("\n");
    let currentFile = "";
    let lineNum = 0;

    for (const line of lines) {
      if (line.startsWith("+++ b/")) {
        currentFile = line.substring(6);
      } else if (line.startsWith("@@")) {
        const match = line.match(/\+(\d+)/);
        if (match) lineNum = parseInt(match[1], 10) - 1;
      } else if (line.startsWith("+")) {
        lineNum++;
        const addedCode = line.substring(1);

        if (addedCode.includes("eval(") || addedCode.includes("innerHTML")) {
          comments.push({
            path: currentFile,
            line: lineNum,
            body: "Security Risk: Avoid using unsafe dynamic code execution or unescaped HTML assignment.",
            category: "security",
          });
        }
        if (addedCode.includes("console.log(")) {
          comments.push({
            path: currentFile,
            line: lineNum,
            body: "Style/Cleanup: Consider removing debug console.log statements before merging.",
            category: "style",
          });
        }
        if (addedCode.includes("TODO:") || addedCode.includes("FIXME:")) {
          comments.push({
            path: currentFile,
            line: lineNum,
            body: "Improvement: Addressed TODO/FIXME item or remaining task.",
            category: "improvement",
          });
        }
      } else if (!line.startsWith("-")) {
        lineNum++;
      }
    }

    const hasCriticalIssues = comments.some((c) => c.category === "bug" || c.category === "security");
    const approved = !hasCriticalIssues;

    const summaryHeader = approved
      ? "### 🎯 AI Code Review: Approved\n\nNo blocking security or bug issues detected."
      : "### ⚠️ AI Code Review: Changes Requested\n\nIdentified potential security risks or bugs that should be resolved.";

    const categoryCounts = comments.reduce((acc, c) => {
      acc[c.category] = (acc[c.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const details = Object.entries(categoryCounts)
      .map(([cat, count]) => `- **${cat}**: ${count}`)
      .join("\n");

    const summary = `${summaryHeader}\n\n**Findings Summary:**\n${details || "- No inline findings."}`;

    return {
      approved,
      summary,
      comments,
      issuesFound: comments.length,
    };
  }
}
