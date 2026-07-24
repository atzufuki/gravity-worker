export interface ReviewerConfig {
  autoMerge: boolean;
  worktreeDir: string;
  testCommand?: string;
  lintCommand?: string;
  aiModel?: string;
  githubToken?: string;
  prNumber?: number;
  repoOwner?: string;
  repoName?: string;
  branchName?: string;
}

export function parseReviewerConfig(args: string[] = [], env: Record<string, string> = Deno.env.toObject()): ReviewerConfig {
  const autoMerge = args.includes("--auto-merge") || env["AUTO_MERGE"] === "true";
  
  let prNumber: number | undefined;
  const prArgIndex = args.findIndex(a => a.startsWith("--pr="));
  if (prArgIndex !== -1) {
    prNumber = parseInt(args[prArgIndex].split("=")[1], 10);
  } else if (env["PR_NUMBER"]) {
    prNumber = parseInt(env["PR_NUMBER"], 10);
  }

  const worktreeDir = env["WORKTREE_DIR"] || ".worktrees";
  const testCommand = env["TEST_COMMAND"] || "deno task test";
  const lintCommand = env["LINT_COMMAND"] || "deno lint";
  const aiModel = env["AI_MODEL"] || "gpt-4o";
  const githubToken = env["GITHUB_TOKEN"] || env["GH_TOKEN"];

  return {
    autoMerge,
    worktreeDir,
    testCommand,
    lintCommand,
    aiModel,
    githubToken,
    prNumber,
    repoOwner: env["REPO_OWNER"],
    repoName: env["REPO_NAME"],
    branchName: env["PR_BRANCH"]
  };
}
