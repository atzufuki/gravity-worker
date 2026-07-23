<p align="center">
  <img src="assets/logo.png" alt="Herkules Logo" width="160" height="160" style="border-radius: 24px;">
</p>

# Herkules 🪲

**Herkules** (named after the powerful Hercules beetle) is a universal, lightweight AI Agent Runner & Orchestrator designed for Git Worktrees, CI/CD pipelines (such as GitHub Actions), and local background automation. Built with [Deno](https://deno.com) and the [Alexi](https://github.com/atzufuki/alexi) framework.

> **Philosophy:** *Herkules carries the heavy lifting of routine software engineering tasks—running tests, inspecting codebases, executing background fixes—so developers can enjoy frictionless flow ("Antigravity").*

---

## Key Features

- **🚀 Universal & Agnostic:** Works with any AI engine (`agy` / Antigravity, Gemini API, Claude Code, Aider, custom LLMs) and any Git host (GitHub, GitLab, Forgejo).
- **🌿 Git Worktree Isolation:** Runs every agent task in an isolated Git worktree so your primary working tree stays clean.
- **⚡ Zero-Delay CI & Single Binary:** Compiles into a standalone single binary via `deno task compile` for fast startup without `node_modules` overhead.
- **☁️ Deno Deploy & Keyless Token Relay:** Built-in Django-style web application ready for edge deployment to Deno Deploy with DenoKV database and WebSocket execution tunnels.
- **🤖 GitHub App Manifest Flow (`install`):** Automated creation of `@herkules[bot]` identity with custom avatar and permissions.
- **💬 Interactive Comment Commands:** Mention `@herkules plan`, `update`, `review`, or `retry` in GitHub comments for real-time task control.
- **🛠️ Built on Alexi:** Powered by Deno's Django-inspired framework for modular configuration and management commands.
- **🔌 Native MCP & Agent Integration:** Includes `.agents/` configuration for Model Context Protocol (MCP) servers and agent skills.

---

## Quick Start

### 1. Automated GitHub App Installation
```bash
# Register automated @herkules[bot] GitHub App
deno task start install --repo owner/repo
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

### 3. Deploy Web & Relay App to Deno Deploy
```bash
# Deploy to Deno Deploy
deno task deploy
```

### 4. Compile to Standalone Binary
```bash
# Build single binary
deno task compile

# Run compiled binary
./herkules run --prompt "Refactor helper functions"
```

### 5. Run Project Tests
```bash
deno task test
```

---

## Documentation

- **[GitHub Integration & Setup Guide](docs/github.md):** Complete guide for setting up Herkules in GitHub Actions repositories (permissions, secrets, workflow configuration).
- **[Deno Deploy Deployment Guide](docs/deploy.md):** Step-by-step setup guide for deploying Herkules Web & Token Relay server to Deno Deploy edge infrastructure.

---

## Learn More

- [Alexi Framework](https://github.com/atzufuki/alexi)
- [Deno Deploy Documentation](https://deno.com/deploy/docs)
- [Antigravity Documentation](https://antigravity.google/docs)
