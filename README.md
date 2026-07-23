# GravityWorker

**GravityWorker** is a universal, lightweight AI Agent Runner & Orchestrator designed for Git Worktrees, CI/CD pipelines (such as GitHub Actions), and local background automation. Built with [Deno](https://deno.com) and the [Alexi](https://github.com/atzufuki/alexi) framework.

> **Philosophy:** *GravityWorker absorbs and carries the heavy lifting ("gravity") of routine software engineering tasks—running tests, inspecting codebases, executing background fixes—so developers can enjoy frictionless flow ("Antigravity").*

---

## Key Features

- **🚀 Universal & Agnostic:** Works with any AI engine (`agy` / Antigravity, Gemini API, Claude Code, Aider, custom LLMs) and any Git host (GitHub, GitLab, Forgejo).
- **🌿 Git Worktree Isolation:** Runs every agent task in an isolated Git worktree so your primary working tree stays clean.
- **⚡ Zero-Delay CI & Single Binary:** Compiles into a standalone single binary via `deno task compile` for fast startup without `node_modules` overhead.
- **🤖 GitHub App Manifest Flow (`setup-app`):** Automated creation of `@gravity-worker[bot]` identity with custom avatar and permissions.
- **🛠️ Built on Alexi:** Powered by Deno's Django-inspired framework for modular configuration and management commands.
- **🔌 Native MCP & Agent Integration:** Includes `.agents/` configuration for Model Context Protocol (MCP) servers and agent skills.

---

## Quick Start

### 1. Automated GitHub App Setup
```bash
# Register automated @gravity-worker[bot] GitHub App
deno task start setup-app
```

### 2. Run Tasks via Deno
```bash
# Display help and usage
deno task start --help

# Execute a prompt in an isolated worktree
deno task start run --prompt "Fix race condition in auth middleware"

# Run in dry-run mode
deno task start run --prompt "Refactor logger" --agent agy --dry-run
```

### 3. Compile to Standalone Binary
```bash
# Build single binary
deno task compile

# Run compiled binary
./gravity-worker run --prompt "Refactor helper functions"
```

### 4. Run Project Tests
```bash
deno task test
```

---

## Documentation

- **[GitHub Integration & Setup Guide](docs/github.md):** Complete guide for setting up GravityWorker in GitHub Actions repositories (permissions, secrets, workflow configuration).

---

## Project Structure

```text
gravity-worker/
├── docs/
│   └── github.md         # GitHub Integration & Setup Guide
├── project/
│   ├── cli.ts            # CLI application entry point (@std/cli)
│   ├── settings.ts       # Alexi project settings
│   └── production.ts     # Production settings (DenoKV remote)
├── manage.ts             # Alexi management CLI (worktrees, setup_app)
├── deno.jsonc            # Deno workspace configuration & tasks
├── src/
│   └── gravity-worker/   # Core GravityWorker app
│       ├── mod.ts        # App module exports
│       ├── git.ts        # Git Worktree management
│       ├── runner.ts     # Agent runner engines (agy / gemini / custom)
│       ├── artifacts.ts  # Antigravity markdown artifact generator
│       ├── github.ts     # GitHub API & webhook payload handler
│       ├── github_app.ts # GitHub App Manifest Flow & JWT Auth
│       ├── commands/     # Alexi management commands (worktrees, setup_app)
│       ├── views.ts      # Health & status endpoints
│       └── urls.ts       # URL routing
├── .agents/              # MCP servers & agent skills
└── .zed/                 # Zed editor configuration
```

---

## Learn More

- [Alexi Framework](https://github.com/atzufuki/alexi)
- [Antigravity Documentation](https://antigravity.google/docs)
