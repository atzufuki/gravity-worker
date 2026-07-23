# GitHub Integration & Setup Guide

This guide walks you through setting up **GravityWorker** in any GitHub repository using GitHub Actions.

---

## 1. Configure Repository Workflow Permissions

By default, GitHub restricts `GITHUB_TOKEN` from creating Pull Requests. You must enable PR creation permissions:

1. Open your repository on GitHub.
2. Go to **Settings** → **Actions** → **General** (under *Code and automation*).
3. Scroll down to the **Workflow permissions** section:
   - Select **Read and write permissions**.
   - Check **Allow GitHub Actions to create and approve pull requests** ☑️.
4. Click **Save**.

> [!IMPORTANT]
> Without this setting, GravityWorker will fail with `HTTP 403: GitHub Actions is not permitted to create or approve pull requests.`

---

## 2. Add Required Secrets (`GEMINI_API_KEY`)

GravityWorker requires an API key for the LLM runner (unless using local `agy` CLI binary).

1. Go to **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret**.
3. Set **Name:** `GEMINI_API_KEY`
4. Set **Value:** *Your Gemini API Key*
5. Click **Add secret**.

---

## 3. Add Workflow File to Your Repository

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

## 4. Triggering Tasks

Once configured, you can trigger GravityWorker in three ways:

### A. Add Issue Label
Add the `gravity-fix` label to any issue. GravityWorker will pick up the issue title and description, create a worktree, apply changes, and open a Pull Request.

### B. Mention `@gravity-worker` in Issue Comments
Comment on any issue:
```text
@gravity-worker Fix the race condition in auth middleware and write unit tests.
```

### C. Manual Dispatch
Go to **Actions** → **GravityWorker Agent Automation** → **Run workflow**, enter your prompt and run.
