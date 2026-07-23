# GitHub Integration & Setup Guide

This guide walks you through setting up **GravityWorker** in any GitHub repository using GitHub Actions.

---

## 1. Automated GitHub App Setup (`setup-app`)

To run GravityWorker with a dedicated `@gravity-worker[bot]` identity (with custom avatar and bot badge), run the automated Manifest setup command:

```bash
deno task start setup-app
# or using compiled binary:
./gravity-worker setup-app
```

This will:
1. Open your browser with a pre-configured GitHub App creation form.
2. Complete single-click authorization.
3. Automatically retrieve your `APP_ID` and `PRIVATE_KEY` and output them for your GitHub Repository Secrets (`GRAVITY_WORKER_APP_ID` & `GRAVITY_WORKER_PRIVATE_KEY`).

---

## 2. Configure Repository Workflow Permissions

When using standard `GITHUB_TOKEN`, GitHub restricts PR creation by default. Enable PR creation permissions:

1. Open your repository on GitHub.
2. Go to **Settings** → **Actions** → **General** (under *Code and automation*).
3. Scroll down to **Workflow permissions**:
   - Select **Read and write permissions**.
   - Check **Allow GitHub Actions to create and approve pull requests** ☑️.
4. Click **Save**.

> [!IMPORTANT]
> Without this setting, GITHUB_TOKEN calls will fail with `HTTP 403: GitHub Actions is not permitted to create or approve pull requests.`

---

## 3. Add Required Secrets (`GEMINI_API_KEY`)

GravityWorker requires an API key for the LLM runner when running in GitHub Actions.

1. Go to **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret**.
3. Set **Name:** `GEMINI_API_KEY`
4. Set **Value:** *Your Gemini API Key*
5. Click **Add secret**.

---

## 4. Add Workflow File to Your Repository

Create `.github/workflows/gravity-worker.yml` in your target repository:

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

## 5. How GravityWorker Interacts with Issues & PRs

- **Human-Friendly Comments:** Posts first-person status updates when starting work and when completing tasks.
- **Automated Pull Requests:** Opens a PR against `main` containing code changes and links the PR to automatically close the issue using `Closes #<issue>`.
- **Clean Workspace Isolation:** Saves reports to `.gravity-worker/` and strictly excludes report artifacts from being committed into your repository's code history.
