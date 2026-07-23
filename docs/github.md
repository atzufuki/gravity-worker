# GitHub Integration & Setup Guide

This guide walks you through setting up **GravityWorker** in any GitHub repository.

---

## ⚡ 100% Zero-Touch Automated Setup (`setup-app`)

GravityWorker provides a **single automated command** that performs all setup steps without manual configuration in GitHub UI:

```bash
deno task start setup-app
# or using compiled binary:
./gravity-worker setup-app
```

### What `setup-app` Automates:

1. **GitHub App Creation:** Opens your browser for a 1-click authorization that registers the official `@gravity-worker[bot]` identity.
2. **Workflow File Generation:** Generates `.github/workflows/gravity-worker.yml` directly in your repository.
3. **Secret Injection:** Automatically sets `GRAVITY_WORKER_APP_ID`, `GRAVITY_WORKER_PRIVATE_KEY`, and `GEMINI_API_KEY` into your repository via `gh CLI`.
4. **Workflow Permissions:** Programmatically enables Read & Write permissions and PR creation rights on your repository via GitHub REST API.

---

## 🛠️ Manual Alternative Setup (Optional)

If you prefer to configure steps manually without using `setup-app`:

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
Create `.github/workflows/gravity-worker.yml`:

```yaml
name: GravityWorker Agent Automation

on:
  issues:
    types: [labeled]
  issue_comment:
    types: [created]
  workflow_dispatch:
    inputs:
      prompt:
        description: 'Task instructions for GravityWorker'
        required: true
      agent:
        description: 'Agent engine (default: antigravity)'
        required: false
        default: 'antigravity'

jobs:
  gravity-worker:
    if: >-
      (github.event_name == 'issues' && github.event.label.name == 'gravity-fix') ||
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@gravity-worker')) ||
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

      - name: Run GravityWorker Agent
        uses: atzufuki/gravity-worker@main
        with:
          prompt: ${{ github.event.inputs.prompt || github.event.issue.title || github.event.comment.body }}
          agent: ${{ github.event.inputs.agent || 'antigravity' }}
          issue-id: ${{ github.event.issue.number }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
```

---

## 🤖 How GravityWorker Interacts with Issues & PRs

- **Human-Friendly Comments:** Posts first-person status updates when starting work and when completing tasks.
- **Automated Pull Requests:** Opens a PR against `main` containing code changes and links the PR to automatically close the issue using `Closes #<issue>`.
- **Clean Workspace Isolation:** Saves reports to `.gravity-worker/` and strictly excludes report artifacts from being committed into your repository's code history.
