# GitHub Integration & Setup Guide

This guide walks you through setting up **Herkules** in any GitHub repository.

---

## ⚡ 100% Zero-Touch Automated Setup (`install`)

Herkules provides a **single automated command** that performs all setup steps without manual configuration in GitHub UI:

```bash
deno task start install --repo owner/repo
# or using compiled binary:
./herkules install --repo owner/repo
```

### What `install` Automates:

1. **GitHub App Creation:** Opens your browser for a 1-click authorization that registers the official `@herkules[bot]` identity.
2. **App Installation:** Opens the installation page so you can attach `@herkules[bot]` to your repository.
3. **Workflow File Generation & Commit:** Generates and commits `.github/workflows/herkules.yml` directly into your repository.
4. **Secret Injection:** Automatically sets `HERKULES_APP_ID`, `HERKULES_PRIVATE_KEY`, and `GEMINI_API_KEY` into your repository via `gh CLI`.
5. **Workflow Permissions:** Programmatically enables Read & Write permissions and PR creation rights on your repository via GitHub REST API.

---

## 🧹 Automated Uninstallation (`uninstall`)

To completely remove Herkules workflow files, worktrees, and secrets from a repository:

```bash
./herkules uninstall --repo owner/repo
```

---

## 🛠️ Manual Alternative Setup (Optional)

If you prefer to configure steps manually without using `install`:

### Step 1: Configure Repository Workflow Permissions
1. Open your repository on GitHub → **Settings** → **Actions** → **General**.
2. Under **Workflow permissions**:
   - Select **Read and write permissions**.
   - Check **Allow GitHub Actions to create and approve pull requests** ☑️.
3. Click **Save**.

### Step 2: Add Required Secret (`GEMINI_API_KEY`)
1. Go to **Settings** → **Secrets and variables** → **Actions**.
2. Add a new repository secret named `GEMINI_API_KEY` with your API key.

### Step 3: Add Workflow File
Create `.github/workflows/herkules.yml`:

```yaml
name: Herkules Agent Automation

on:
  issues:
    types: [labeled]
  issue_comment:
    types: [created]
  workflow_dispatch:
    inputs:
      prompt:
        description: 'Task instructions for Herkules'
        required: true
      agent:
        description: 'Agent engine (default: antigravity)'
        required: false
        default: 'antigravity'

jobs:
  herkules:
    if: >-
      (github.event_name == 'issues' && github.event.label.name == 'herkules') ||
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@herkules')) ||
      (github.event_name == 'workflow_dispatch')
    runs-on: ubuntu-latest

    permissions:
      contents: write
      issues: write
      pull-requests: write

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Herkules Agent
        uses: atzufuki/herkules@main
        with:
          prompt: ${{ github.event.inputs.prompt || github.event.issue.title || github.event.comment.body }}
          agent: ${{ github.event.inputs.agent || 'antigravity' }}
          issue-id: ${{ github.event.issue.number }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
          app-id: ${{ secrets.HERKULES_APP_ID }}
          private-key: ${{ secrets.HERKULES_PRIVATE_KEY }}
```

---

## 🤖 How Herkules Interacts with Issues & PRs

- **👀 Immediate Emoji Reaction:** Reacts with `eyes` (👀) to acknowledge receipt of issues and comments.
- **AI-Powered Multilingual Status Messages:** Generates friendly status updates in the exact language of the user's issue prompt.
- **Automated Pull Requests:** Opens a PR against `main` containing code changes and links the PR to automatically close the issue using `Closes #<issue>`.
- **Clean Workspace Isolation:** Saves reports to `.herkules/` and strictly excludes report artifacts from being committed into your repository's code history.

---

## 💬 Interactive Comment Commands

Mention `@herkules` in any GitHub issue or PR comment to trigger interactive agent sub-commands:

| Command | Example Usage | Action & Output |
| :--- | :--- | :--- |
| **`plan`** | `@herkules plan Add JWT auth middleware` | Generates an implementation plan (`.herkules/implementation_plan.md`) & posts comment without mutating codebase. |
| **`update`** | `@herkules update Add tests for edge cases` | Updates existing worktree branch & PR with new requirements and posts update summary. |
| **`review`** | `@herkules review Check for security issues` | Performs automated code review (`.herkules/review.md`) & posts detailed quality report comment. |
| **`retry`** | `@herkules retry` | Re-runs task execution from scratch with a fresh worktree and updates PR. |
| **`run`** | `@herkules Refactor logger` | Standard task execution (default when no command keyword is specified). |

