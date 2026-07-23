/**
 * GravityWorker - GitHub API & Event Handler Module
 *
 * Handles parsing GitHub Action event payloads, posting comments to issues,
 * and creating Pull Requests via GitHub REST API.
 *
 * @module gravity-worker/github
 */

export interface GitHubEventContext {
  issueNumber?: number;
  issueTitle?: string;
  issueBody?: string;
  repoOwner?: string;
  repoName?: string;
  sender?: string;
}

/**
 * Parses repository owner and name from local git remote.origin.url.
 */
export async function getRepoFromGitRemote(cwd = "."): Promise<{ repoOwner?: string; repoName?: string }> {
  try {
    const cmd = new Deno.Command("git", {
      args: ["config", "--get", "remote.origin.url"],
      cwd,
      stdout: "piped",
      stderr: "piped",
    });
    const output = await cmd.output();
    if (!output.success) return {};

    const remoteUrl = new TextDecoder().decode(output.stdout).trim();
    // Handles git@github.com:owner/repo.git or https://github.com/owner/repo.git
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/);
    if (match) {
      return { repoOwner: match[1], repoName: match[2] };
    }
  } catch {
    // Ignore git command errors
  }
  return {};
}

/**
 * Parses GitHub event payload from environment (GITHUB_EVENT_PATH & GITHUB_REPOSITORY),
 * with fallback to local Git remote origin URL.
 */
export async function getGitHubContext(): Promise<GitHubEventContext> {
  const eventPath = Deno.env.get("GITHUB_EVENT_PATH");
  const repoEnv = Deno.env.get("GITHUB_REPOSITORY"); // e.g. "owner/repo"

  let repoOwner: string | undefined;
  let repoName: string | undefined;

  if (repoEnv && repoEnv.includes("/")) {
    [repoOwner, repoName] = repoEnv.split("/");
  } else {
    const remoteInfo = await getRepoFromGitRemote();
    repoOwner = remoteInfo.repoOwner;
    repoName = remoteInfo.repoName;
  }

  if (!eventPath) {
    return { repoOwner, repoName };
  }

  try {
    const text = await Deno.readTextFile(eventPath);
    const payload = JSON.parse(text);

    const issue = payload.issue;
    const sender = payload.sender?.login;

    return {
      issueNumber: issue?.number,
      issueTitle: issue?.title,
      issueBody: issue?.body,
      repoOwner,
      repoName,
      sender,
    };
  } catch (err) {
    console.warn(`[GravityWorker] Unable to parse GITHUB_EVENT_PATH:`, err);
    return { repoOwner, repoName };
  }
}

/**
 * Posts a comment to a GitHub issue or PR.
 */
export async function postIssueComment(
  options: {
    owner: string;
    repo: string;
    issueNumber: number;
    body: string;
    token: string;
  },
): Promise<boolean> {
  const { owner, repo, issueNumber, body, token } = options;
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "GravityWorker",
      },
      body: JSON.stringify({ body }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[GitHub API] Failed to post comment: HTTP ${response.status} - ${errorText}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[GitHub API] Network error posting comment:`, err);
    return false;
  }
}

/**
 * Creates a Pull Request on GitHub.
 */
export async function createPullRequest(
  options: {
    owner: string;
    repo: string;
    head: string;
    base: string;
    title: string;
    body: string;
    token: string;
  },
): Promise<string | null> {
  const { owner, repo, head, base, title, body, token } = options;
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "GravityWorker",
      },
      body: JSON.stringify({ head, base, title, body }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[GitHub API] Failed to create PR: HTTP ${response.status} - ${errorText}`);
      if (response.status === 403) {
        console.error(
          `💡 Tip: Ensure 'Allow GitHub Actions to create and approve pull requests' is enabled in Repository Settings -> Actions -> General -> Workflow permissions.`,
        );
      }
      return null;
    }

    const data = await response.json();
    return data.html_url ?? null;
  } catch (err) {
    console.error(`[GitHub API] Network error creating PR:`, err);
    return null;
  }
}
