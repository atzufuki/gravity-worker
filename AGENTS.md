# AGENTS.md

Welcome AI Agent! This document provides technical context, codebase conventions, and execution guidelines for working on the **GravityWorker** repository.

---

## 1. Project Overview

**GravityWorker** is an AI-agent runner and orchestrator designed to run tasks in isolated Git worktrees and CI environments.
- **Runtime:** Deno 2.x
- **Framework:** [Alexi](https://github.com/atzufuki/alexi) (Django-inspired full-stack framework for Deno)
- **Database Backend:** DenoKV (`@alexi/db/backends/denokv`)
- **CLI Framework:** `@std/cli` for [project/cli.ts](file:///var/home/atzufuki/Code/gravity-worker/project/cli.ts)

---

## 2. Directory Structure & Architecture

- **[project/cli.ts](file:///var/home/atzufuki/Code/gravity-worker/project/cli.ts):** User-facing CLI entry point. Handles commands (`run`, `setup-app`, `status`, `version`) and arguments (`--prompt`, `--issue`, `--agent`, `--dry-run`) via `@std/cli/parse-args`.
- **[manage.ts](file:///var/home/atzufuki/Code/gravity-worker/manage.ts):** Alexi framework management entry point (`runserver`, `list_worktrees`, `clean_worktrees`, `setup_app`).
- **[project/settings.ts](file:///var/home/atzufuki/Code/gravity-worker/project/settings.ts):** Central project settings (`DATABASES`, `INSTALLED_APPS`, `MIDDLEWARE`).
- **[src/gravity-worker/](file:///var/home/atzufuki/Code/gravity-worker/src/gravity-worker/):** Core GravityWorker app package:
  - `git.ts`: Isolated Git worktree creation, diffing, clean staging, commit & push.
  - `runner.ts`: Agent runners (`AntigravityRunner`, `GeminiRunner`, `CustomAgentRunner`).
  - `github.ts`: GitHub API parsing, event payload context, issue comment posting, PR creation.
  - `github_app.ts`: GitHub App Manifest Flow, JWT authentication, 100% zero-touch repo setup.
  - `commands/`: Alexi management commands (`list_worktrees`, `clean_worktrees`, `setup_app`).
- **[docs/github.md](file:///var/home/atzufuki/Code/gravity-worker/docs/github.md):** GitHub integration and 100% zero-touch automated setup guide.
- **[.agents/](file:///var/home/atzufuki/Code/gravity-worker/.agents/):** MCP servers, configuration (`mcp_config.json`), and custom skills.

---

## 3. Development Guidelines for Agents

### A. Environment & Commands
- **Run CLI:** `deno task start -- [args]`
- **Run Zero-Touch Setup:** `deno task start setup-app`
- **Run Tests:** `deno task test`
- **Compile Binary:** `deno task compile`
- **Run Management Commands:** `deno run -A --unstable-kv manage.ts [command]`

### B. Code Conventions
1. **TypeScript Strictness:** Always maintain strict TypeScript types. Avoid using explicit `any` when possible.
2. **Imports:** Use import maps defined in `deno.jsonc` (e.g., `@gravity-worker/` maps to `./src/gravity-worker/`).
3. **Alexi Framework Conventions:**
   - Management commands extend `BaseCommand` from `@alexi/core/management`.
   - Models extend `Model` or `AbstractUser` from `@alexi/db` / `@alexi/auth`.
4. **Git Worktree & Artifact Hygiene:**
   - Temporary worktrees are created under `.worktrees/`.
   - Report artifacts (`implementation_plan.md`, `walkthrough.md`) are saved into `.gravity-worker/` and strictly excluded from target repo git commits.

---

## 4. Verification Protocol

Before declaring any task completed:
1. Run `deno task test` to ensure all unit and integration tests pass (12+ tests).
2. Run `deno task start --help` or test relevant CLI flags to verify CLI responsiveness.
3. If modifying build configuration, run `deno task compile` to ensure binary compilation succeeds.
